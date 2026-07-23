<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$uid = firebase_user_id($config);
$pdo = database($config);
$id = trim((string) ($_GET['id'] ?? ''));
$statement = $pdo->prepare('SELECT image_filename, image_mime FROM garments WHERE id = ? AND user_id = ?');
$statement->execute([$id, $uid]);
$item = $statement->fetch();

if (!$item) {
    json_response(['error' => 'No encontramos esa foto.'], 404);
}

$path = uploads_directory($config) . DIRECTORY_SEPARATOR . basename($item['image_filename']);
if (!is_file($path)) {
    json_response(['error' => 'La foto ya no está disponible.'], 404);
}

header_remove('Content-Type');
header('Content-Type: ' . $item['image_mime']);
header('Content-Length: ' . filesize($path));
header('Cache-Control: private, max-age=3600');
header('X-Content-Type-Options: nosniff');
readfile($path);
exit;
