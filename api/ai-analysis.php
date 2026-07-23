<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

const AI_ANALYSIS_LIMIT = 5;
const AI_WINDOW_SECONDS = 86400;
const AI_MAX_IMAGE_BYTES = 3145728;
const AI_UNLIMITED_USER_IDS = ['uCEIekqiXsTKlbPZxu8McnfTRs53'];
const AI_CUSTOM_USER_LIMITS = [
    'fy30a3QtfdPXgSjxnDywVnLkTJr1' => 30,
];

$uid = firebase_user_id($config);
$pdo = database($config);
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

function is_unlimited_user(string $uid): bool
{
    return in_array($uid, AI_UNLIMITED_USER_IDS, true);
}

function analysis_limit_for_user(string $uid): int
{
    return AI_CUSTOM_USER_LIMITS[$uid] ?? AI_ANALYSIS_LIMIT;
}

function quota_payload(int $used, $startedAt, bool $available, bool $unlimited = false, int $limit = AI_ANALYSIS_LIMIT): array
{
    return [
        'limit' => $limit,
        'remaining' => $unlimited ? $limit : max(0, $limit - $used),
        'resetAt' => $unlimited || $startedAt === null ? null : gmdate(DATE_ATOM, $startedAt + AI_WINDOW_SECONDS),
        'mode' => 'gemini',
        'available' => $available,
        'unlimited' => $unlimited,
    ];
}

function current_quota(PDO $pdo, string $uid, bool $available): array
{
    if (is_unlimited_user($uid)) {
        return quota_payload(0, null, $available, true);
    }
    $limit = analysis_limit_for_user($uid);
    $statement = $pdo->prepare('SELECT window_started_at, used_count FROM ai_usage_limits WHERE user_id = ?');
    $statement->execute([$uid]);
    $row = $statement->fetch();
    if (!$row) {
        return quota_payload(0, null, $available, false, $limit);
    }
    $startedAt = strtotime($row['window_started_at'] . ' UTC');
    if ($startedAt === false || time() >= $startedAt + AI_WINDOW_SECONDS) {
        $delete = $pdo->prepare('DELETE FROM ai_usage_limits WHERE user_id = ?');
        $delete->execute([$uid]);
        return quota_payload(0, null, $available, false, $limit);
    }
    return quota_payload((int) $row['used_count'], $startedAt, $available, false, $limit);
}

function reserve_analysis(PDO $pdo, string $uid, bool $available): array
{
    $limit = analysis_limit_for_user($uid);
    $nowTimestamp = time();
    $now = gmdate('Y-m-d H:i:s', $nowTimestamp);
    $pdo->beginTransaction();
    try {
        $insert = $pdo->prepare(
            'INSERT IGNORE INTO ai_usage_limits (user_id, window_started_at, used_count, updated_at) VALUES (?, ?, 0, ?)'
        );
        $insert->execute([$uid, $now, $now]);
        $select = $pdo->prepare('SELECT window_started_at, used_count FROM ai_usage_limits WHERE user_id = ? FOR UPDATE');
        $select->execute([$uid]);
        $row = $select->fetch();
        $startedAt = strtotime($row['window_started_at'] . ' UTC');
        $used = (int) $row['used_count'];
        if ($startedAt === false || $nowTimestamp >= $startedAt + AI_WINDOW_SECONDS) {
            $startedAt = $nowTimestamp;
            $used = 0;
            $reset = $pdo->prepare('UPDATE ai_usage_limits SET window_started_at = ?, used_count = 0, updated_at = ? WHERE user_id = ?');
            $reset->execute([$now, $now, $uid]);
        }
        if ($used >= $limit) {
            $pdo->commit();
            json_response([
                'error' => "Ya usaste tus {$limit} análisis. Podés completar la prenda manualmente.",
                'quota' => quota_payload($used, $startedAt, $available, false, $limit),
            ], 429);
        }
        $used++;
        $update = $pdo->prepare('UPDATE ai_usage_limits SET used_count = ?, updated_at = ? WHERE user_id = ?');
        $update->execute([$used, $now, $uid]);
        $pdo->commit();
        return quota_payload($used, $startedAt, $available, false, $limit);
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
}

function restore_analysis(PDO $pdo, string $uid)
{
    try {
        $statement = $pdo->prepare(
            'UPDATE ai_usage_limits SET used_count = IF(used_count > 0, used_count - 1, 0), updated_at = ? WHERE user_id = ?'
        );
        $statement->execute([gmdate('Y-m-d H:i:s'), $uid]);
    } catch (Throwable $error) {
        error_log('QMP Gemini quota restore: ' . $error->getMessage());
    }
}

function nullable_string($value, int $maxLength)
{
    if ($value === null) {
        return null;
    }
    if (!is_string($value)) {
        return null;
    }
    $value = trim($value);
    return $value === '' ? null : mb_substr($value, 0, $maxLength);
}

function controlled_string($value, array $allowed)
{
    return is_string($value) && in_array($value, $allowed, true) ? $value : null;
}

function controlled_array($value, array $allowed = [], int $maxItems = 8): array
{
    if (!is_array($value)) {
        return [];
    }
    $clean = [];
    foreach ($value as $item) {
        if (!is_string($item)) {
            continue;
        }
        $item = trim(mb_strtolower($item));
        if ($item === '' || ($allowed && !in_array($item, $allowed, true)) || in_array($item, $clean, true)) {
            continue;
        }
        $clean[] = mb_substr($item, 0, 50);
        if (count($clean) >= $maxItems) {
            break;
        }
    }
    return $clean;
}

function garment_schema(): array
{
    return [
        'type' => 'OBJECT',
        'properties' => [
            'esPrenda' => ['type' => 'BOOLEAN'],
            'tipo' => ['type' => 'STRING', 'enum' => ['remera', 'camisa', 'buzo', 'sweater', 'campera', 'abrigo', 'pantalón', 'short', 'pollera', 'vestido', 'calzado', 'accesorio', 'otra'], 'nullable' => true],
            'subtipo' => ['type' => 'STRING', 'nullable' => true],
            'colorPrincipal' => ['type' => 'STRING', 'nullable' => true],
            'coloresSecundarios' => ['type' => 'ARRAY', 'items' => ['type' => 'STRING']],
            'estampado' => ['type' => 'STRING', 'enum' => ['liso', 'rayado', 'cuadros', 'estampado', 'animal_print', 'lunares', 'otro'], 'nullable' => true],
            'materialAproximado' => ['type' => 'STRING', 'nullable' => true],
            'nivelAbrigo' => ['type' => 'STRING', 'enum' => ['muy_liviano', 'liviano', 'medio', 'abrigado', 'muy_abrigado'], 'nullable' => true],
            'impermeable' => ['type' => 'BOOLEAN', 'nullable' => true],
            'temporadas' => ['type' => 'ARRAY', 'items' => ['type' => 'STRING', 'enum' => ['verano', 'otoño', 'invierno', 'primavera']]],
            'ocasiones' => ['type' => 'ARRAY', 'items' => ['type' => 'STRING']],
            'descripcion' => ['type' => 'STRING', 'nullable' => true],
            'confianza' => ['type' => 'NUMBER'],
        ],
        'required' => ['esPrenda', 'tipo', 'subtipo', 'colorPrincipal', 'coloresSecundarios', 'estampado', 'materialAproximado', 'nivelAbrigo', 'impermeable', 'temporadas', 'ocasiones', 'descripcion', 'confianza'],
    ];
}

function call_gemini(array $config, string $mime, string $imagePath): array
{
    $bytes = file_get_contents($imagePath);
    if (!is_string($bytes) || $bytes === '') {
        throw new RuntimeException('No pudimos leer la foto para analizarla.', 422);
    }
    $prompt = 'Analizá exclusivamente la prenda visible en la foto. No identifiques personas ni infieras datos que no puedan observarse. '
        . 'Si no hay una prenda clara, devolvé esPrenda=false y los campos inciertos como null o arrays vacíos. '
        . 'Usá solamente los valores permitidos por el esquema. El material debe ser aproximado y puede ser null. '
        . 'La confianza debe estar entre 0 y 1. Respondé solamente con el JSON solicitado.';
    $payload = [
        'contents' => [[
            'role' => 'user',
            'parts' => [
                ['inline_data' => ['mime_type' => $mime, 'data' => base64_encode($bytes)]],
                ['text' => $prompt],
            ],
        ]],
        'generationConfig' => [
            'temperature' => 0.1,
            'maxOutputTokens' => 650,
            'responseMimeType' => 'application/json',
            'responseSchema' => garment_schema(),
        ],
    ];
    $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($config['gemini_model']) . ':generateContent';
    $curl = curl_init($url);
    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 35,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'x-goog-api-key: ' . $config['gemini_api_key'],
        ],
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);
    $body = curl_exec($curl);
    $curlError = curl_error($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);
    if (!is_string($body)) {
        error_log('QMP Gemini connection: ' . $curlError);
        throw new RuntimeException('No pudimos conectarnos con Gemini. Revisá internet e intentá nuevamente.', 503);
    }
    if ($status !== 200) {
        error_log('QMP Gemini HTTP ' . $status);
        if ($status === 429) {
            throw new RuntimeException('Gemini alcanzó su límite gratuito por ahora. Probá nuevamente más tarde o completá los datos manualmente.', 429);
        }
        if ($status === 401 || $status === 403) {
            throw new RuntimeException('Gemini no está disponible porque la clave del servidor necesita revisarse.', 503);
        }
        throw new RuntimeException('Gemini no pudo analizar la foto en este momento. Probá nuevamente.', 503);
    }
    $response = json_decode($body, true);
    $text = $response['candidates'][0]['content']['parts'][0]['text'] ?? null;
    $analysis = is_string($text) ? json_decode($text, true) : null;
    if (!is_array($analysis)) {
        throw new RuntimeException('Gemini devolvió un resultado incompleto. Probá con otra foto.', 502);
    }
    return $analysis;
}

function validated_analysis(array $raw): array
{
    $types = ['remera', 'camisa', 'buzo', 'sweater', 'campera', 'abrigo', 'pantalón', 'short', 'pollera', 'vestido', 'calzado', 'accesorio', 'otra'];
    $warmths = ['muy_liviano', 'liviano', 'medio', 'abrigado', 'muy_abrigado'];
    $patterns = ['liso', 'rayado', 'cuadros', 'estampado', 'animal_print', 'lunares', 'otro'];
    $seasons = ['verano', 'otoño', 'invierno', 'primavera'];
    $type = controlled_string($raw['tipo'] ?? null, $types);
    $warmth = controlled_string($raw['nivelAbrigo'] ?? null, $warmths);
    $pattern = controlled_string($raw['estampado'] ?? null, $patterns);
    $confidence = is_numeric($raw['confianza'] ?? null) ? max(0, min(1, (float) $raw['confianza'])) : 0;
    $isGarment = ($raw['esPrenda'] ?? false) === true && $type !== null;
    $occasions = controlled_array($raw['ocasiones'] ?? []);
    $categoryMap = ['remera' => 'Remera', 'camisa' => 'Camisa', 'buzo' => 'Buzo', 'sweater' => 'Sweater', 'campera' => 'Campera', 'abrigo' => 'Abrigo', 'pantalón' => 'Pantalón', 'short' => 'Short', 'pollera' => 'Pollera', 'vestido' => 'Vestido', 'calzado' => 'Calzado', 'accesorio' => 'Accesorio', 'otra' => 'Otra'];
    $warmthMap = ['muy_liviano' => 'Muy liviano', 'liviano' => 'Liviano', 'medio' => 'Medio', 'abrigado' => 'Abrigado', 'muy_abrigado' => 'Muy abrigado'];
    $principal = nullable_string($raw['colorPrincipal'] ?? null, 64);
    $style = 'Casual';
    if (in_array('formal', $occasions, true)) {
        $style = 'Formal';
    } elseif (in_array('deportivo', $occasions, true) || in_array('deporte', $occasions, true)) {
        $style = 'Deportivo';
    } elseif (in_array('urbano', $occasions, true)) {
        $style = 'Urbano';
    }
    return [
        'esPrenda' => $isGarment,
        'tipo' => $type,
        'subtipo' => nullable_string($raw['subtipo'] ?? null, 100),
        'colorPrincipal' => $principal,
        'coloresSecundarios' => controlled_array($raw['coloresSecundarios'] ?? []),
        'estampado' => $pattern,
        'materialAproximado' => nullable_string($raw['materialAproximado'] ?? null, 100),
        'nivelAbrigo' => $warmth,
        'impermeable' => is_bool($raw['impermeable'] ?? null) ? $raw['impermeable'] : null,
        'temporadas' => controlled_array($raw['temporadas'] ?? [], $seasons, 4),
        'ocasiones' => $occasions,
        'descripcion' => nullable_string($raw['descripcion'] ?? null, 500),
        'confianza' => $confidence,
        'category' => $categoryMap[$type] ?? 'Otra',
        'color' => $principal === null ? 'Sin definir' : ucfirst(mb_strtolower($principal)),
        'warmth' => $warmthMap[$warmth] ?? 'Medio',
        'style' => $style,
        'subtype' => nullable_string($raw['subtipo'] ?? null, 100),
        'secondaryColors' => controlled_array($raw['coloresSecundarios'] ?? []),
        'pattern' => $pattern,
        'material' => nullable_string($raw['materialAproximado'] ?? null, 100),
        'waterproof' => is_bool($raw['impermeable'] ?? null) ? $raw['impermeable'] : null,
        'seasons' => controlled_array($raw['temporadas'] ?? [], $seasons, 4),
        'occasions' => $occasions,
        'description' => nullable_string($raw['descripcion'] ?? null, 500),
        'confidence' => $confidence,
    ];
}

$available = $config['gemini_api_key'] !== '';
$unlimited = is_unlimited_user($uid);

if ($method === 'GET') {
    json_response(['quota' => current_quota($pdo, $uid, $available)]);
}

if ($method === 'POST') {
    if (!$available) {
        json_response(['error' => 'Falta configurar GEMINI_API_KEY en el servidor. Podés completar la prenda manualmente.'], 503);
    }
    if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
        json_response(['error' => 'No pudimos recibir la foto para analizarla.'], 422);
    }
    if ((int) $_FILES['image']['size'] <= 0 || (int) $_FILES['image']['size'] > AI_MAX_IMAGE_BYTES) {
        json_response(['error' => 'La foto es demasiado pesada para analizarla. Probá con otra imagen.'], 422);
    }
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($_FILES['image']['tmp_name']);
    if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) {
        json_response(['error' => 'El archivo seleccionado no es una imagen válida.'], 422);
    }
    try {
        $quota = $unlimited ? quota_payload(0, null, true, true) : reserve_analysis($pdo, $uid, true);
    } catch (Throwable $error) {
        error_log('QMP Gemini quota: ' . $error->getMessage());
        json_response(['error' => 'No pudimos verificar tu cupo de análisis.'], 503);
    }
    try {
        $analysis = validated_analysis(call_gemini($config, $mime, $_FILES['image']['tmp_name']));
    } catch (RuntimeException $error) {
        if (!$unlimited) restore_analysis($pdo, $uid);
        json_response(['error' => $error->getMessage(), 'quota' => current_quota($pdo, $uid, true)], $error->getCode() ?: 503);
    } catch (Throwable $error) {
        if (!$unlimited) restore_analysis($pdo, $uid);
        error_log('QMP Gemini analysis: ' . $error->getMessage());
        json_response(['error' => 'No pudimos analizar la prenda en este momento.'], 503);
    }
    if (!$analysis['esPrenda']) {
        json_response([
            'error' => 'No pude identificar una prenda en esta foto. Probá nuevamente con la prenda completa y buena luz.',
            'quota' => $quota,
        ], 422);
    }
    json_response(['analysis' => $analysis, 'quota' => $quota]);
}

header('Allow: GET, POST');
json_response(['error' => 'Método no permitido.'], 405);
