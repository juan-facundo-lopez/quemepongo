<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$uid = firebase_user_id($config);
$pdo = database($config);
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

function json_string_array($value): array
{
    $decoded = is_string($value) ? json_decode($value, true) : null;
    if (!is_array($decoded)) {
        return [];
    }
    return array_values(array_filter($decoded, 'is_string'));
}

if ($method === 'GET') {
    $statement = $pdo->prepare(
        'SELECT id, category, color, warmth, style, subtype, secondary_colors, pattern, material,
                waterproof, seasons, occasions, description, confidence, created_at, updated_at
         FROM garments WHERE user_id = ? ORDER BY updated_at DESC'
    );
    $statement->execute([$uid]);
    $items = array_map(static function (array $item): array {
        return [
            'id' => $item['id'],
            'category' => $item['category'],
            'color' => $item['color'],
            'warmth' => $item['warmth'],
            'style' => $item['style'],
            'subtype' => $item['subtype'],
            'secondaryColors' => json_string_array($item['secondary_colors']),
            'pattern' => $item['pattern'],
            'material' => $item['material'],
            'waterproof' => $item['waterproof'] === null ? null : (bool) $item['waterproof'],
            'seasons' => json_string_array($item['seasons']),
            'occasions' => json_string_array($item['occasions']),
            'description' => $item['description'],
            'confidence' => $item['confidence'] === null ? null : (float) $item['confidence'],
            'createdAt' => gmdate(DATE_ATOM, strtotime($item['created_at'] . ' UTC')),
            'updatedAt' => gmdate(DATE_ATOM, strtotime($item['updated_at'] . ' UTC')),
        ];
    }, $statement->fetchAll());
    json_response(['garments' => $items]);
}

if ($method === 'POST') {
    $id = trim((string) ($_POST['id'] ?? ''));
    if (!preg_match('/^[A-Za-z0-9-]{8,80}$/', $id)) {
        json_response(['error' => 'El identificador de la prenda no es válido.'], 422);
    }

    $category = request_value('category', 64);
    $color = request_value('color', 64);
    $warmth = request_value('warmth', 32);
    $style = request_value('style', 32);
    $subtype = request_optional_value('subtype', 100);
    $secondaryColors = request_string_array('secondaryColors');
    $pattern = request_optional_value('pattern', 64);
    $material = request_optional_value('material', 100);
    $waterproofRaw = trim((string) ($_POST['waterproof'] ?? ''));
    if (!in_array($waterproofRaw, ['', '0', '1'], true)) {
        json_response(['error' => 'Los datos de la prenda no son válidos.'], 422);
    }
    $waterproof = $waterproofRaw === '' ? null : ($waterproofRaw === '1' ? 1 : 0);
    $seasons = request_string_array('seasons', 4, 20);
    $occasions = request_string_array('occasions');
    $description = request_optional_value('description', 500);
    $confidenceRaw = trim((string) ($_POST['confidence'] ?? ''));
    if ($confidenceRaw !== '' && !is_numeric($confidenceRaw)) {
        json_response(['error' => 'Los datos de la prenda no son válidos.'], 422);
    }
    $confidence = $confidenceRaw === '' ? null : max(0, min(1, (float) $confidenceRaw));
    $allowedCategories = ['Remera', 'Camisa', 'Buzo', 'Sweater', 'Campera', 'Abrigo', 'Pantalón', 'Short', 'Pollera', 'Vestido', 'Calzado', 'Accesorio', 'Otra'];
    $allowedWarmths = ['Muy liviano', 'Liviano', 'Medio', 'Abrigado', 'Muy abrigado', 'Alto'];
    $allowedStyles = ['Casual', 'Formal', 'Deportivo', 'Urbano'];
    $allowedPatterns = [null, 'liso', 'rayado', 'cuadros', 'estampado', 'animal_print', 'lunares', 'otro'];
    $allowedSeasons = ['verano', 'otoño', 'invierno', 'primavera'];
    if (!in_array($category, $allowedCategories, true) || !in_array($warmth, $allowedWarmths, true)
        || !in_array($style, $allowedStyles, true) || !in_array($pattern, $allowedPatterns, true)
        || array_diff($seasons, $allowedSeasons)) {
        json_response(['error' => 'Los datos de la prenda no son válidos.'], 422);
    }
    $existingQuery = $pdo->prepare('SELECT image_filename, created_at FROM garments WHERE id = ? AND user_id = ?');
    $existingQuery->execute([$id, $uid]);
    $existing = $existingQuery->fetch();

    $imageFilename = $existing['image_filename'] ?? null;
    $imageMime = null;
    $newImagePath = null;
    if (isset($_FILES['image']) && $_FILES['image']['error'] !== UPLOAD_ERR_NO_FILE) {
        if ($_FILES['image']['error'] !== UPLOAD_ERR_OK || $_FILES['image']['size'] > 6 * 1024 * 1024) {
            json_response(['error' => 'La foto no pudo subirse o es demasiado grande.'], 422);
        }
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($_FILES['image']['tmp_name']);
        $extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
        if (!isset($extensions[$mime])) {
            json_response(['error' => 'El formato de la foto no es válido.'], 422);
        }
        $imageMime = $mime;
        $imageFilename = bin2hex(random_bytes(24)) . '.' . $extensions[$mime];
        $newImagePath = uploads_directory($config) . DIRECTORY_SEPARATOR . $imageFilename;
        if (!move_uploaded_file($_FILES['image']['tmp_name'], $newImagePath)) {
            json_response(['error' => 'No pudimos guardar la foto.'], 503);
        }
    }

    if (!$existing && !$imageFilename) {
        json_response(['error' => 'La prenda necesita una foto.'], 422);
    }

    $now = gmdate('Y-m-d H:i:s');
    try {
        if ($existing) {
            if ($imageMime === null) {
                $mimeQuery = $pdo->prepare('SELECT image_mime FROM garments WHERE id = ? AND user_id = ?');
                $mimeQuery->execute([$id, $uid]);
                $imageMime = (string) $mimeQuery->fetchColumn();
            }
            $statement = $pdo->prepare(
                'UPDATE garments SET image_filename = ?, image_mime = ?, category = ?, color = ?, warmth = ?, style = ?,
                 subtype = ?, secondary_colors = ?, pattern = ?, material = ?, waterproof = ?, seasons = ?, occasions = ?,
                 description = ?, confidence = ?, updated_at = ?
                 WHERE id = ? AND user_id = ?'
            );
            $statement->execute([
                $imageFilename, $imageMime, $category, $color, $warmth, $style, $subtype,
                json_encode($secondaryColors, JSON_UNESCAPED_UNICODE), $pattern, $material, $waterproof,
                json_encode($seasons, JSON_UNESCAPED_UNICODE), json_encode($occasions, JSON_UNESCAPED_UNICODE),
                $description, $confidence, $now, $id, $uid,
            ]);
        } else {
            $statement = $pdo->prepare(
                'INSERT INTO garments (id, user_id, image_filename, image_mime, category, color, warmth, style,
                 subtype, secondary_colors, pattern, material, waterproof, seasons, occasions, description, confidence,
                 created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $statement->execute([
                $id, $uid, $imageFilename, $imageMime, $category, $color, $warmth, $style, $subtype,
                json_encode($secondaryColors, JSON_UNESCAPED_UNICODE), $pattern, $material, $waterproof,
                json_encode($seasons, JSON_UNESCAPED_UNICODE), json_encode($occasions, JSON_UNESCAPED_UNICODE),
                $description, $confidence, $now, $now,
            ]);
        }
    } catch (Throwable $error) {
        if ($newImagePath && is_file($newImagePath)) {
            unlink($newImagePath);
        }
        error_log('QMP garment save: ' . $error->getMessage());
        json_response(['error' => 'No pudimos guardar la prenda.'], 503);
    }

    if ($existing && $newImagePath && $existing['image_filename'] !== $imageFilename) {
        $oldPath = uploads_directory($config) . DIRECTORY_SEPARATOR . basename($existing['image_filename']);
        if (is_file($oldPath)) {
            unlink($oldPath);
        }
    }
    json_response(['ok' => true, 'id' => $id]);
}

if ($method === 'DELETE') {
    $id = trim((string) ($_GET['id'] ?? ''));
    $query = $pdo->prepare('SELECT image_filename FROM garments WHERE id = ? AND user_id = ?');
    $query->execute([$id, $uid]);
    $item = $query->fetch();
    if (!$item) {
        json_response(['error' => 'No encontramos esa prenda.'], 404);
    }
    $delete = $pdo->prepare('DELETE FROM garments WHERE id = ? AND user_id = ?');
    $delete->execute([$id, $uid]);
    $path = uploads_directory($config) . DIRECTORY_SEPARATOR . basename($item['image_filename']);
    if (is_file($path)) {
        unlink($path);
    }
    json_response(['ok' => true]);
}

header('Allow: GET, POST, DELETE');
json_response(['error' => 'Método no permitido.'], 405);
