<?php
declare(strict_types=1);

$config = require __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function json_response(array $payload, int $status = 200)
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function bearer_token(): string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/^Bearer\s+(.+)$/i', $header, $matches)) {
        json_response(['error' => 'Necesitás iniciar sesión.'], 401);
    }
    return trim($matches[1]);
}

function firebase_user_id(array $config): string
{
    $token = bearer_token();
    $url = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' . rawurlencode($config['firebase_api_key']);
    $curl = curl_init($url);
    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode(['idToken' => $token]),
    ]);
    $body = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);

    $data = is_string($body) ? json_decode($body, true) : null;
    $uid = $data['users'][0]['localId'] ?? null;
    if ($status !== 200 || !is_string($uid) || $uid === '') {
        json_response(['error' => 'La sesión venció. Volvé a ingresar.'], 401);
    }
    return $uid;
}

function database(array $config): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    try {
        $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $config['db_host'], $config['db_name']);
        $pdo = new PDO($dsn, $config['db_user'], $config['db_password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS garments (
                id VARCHAR(80) NOT NULL PRIMARY KEY,
                user_id VARCHAR(128) NOT NULL,
                image_filename VARCHAR(96) NOT NULL,
                image_mime VARCHAR(32) NOT NULL,
                category VARCHAR(64) NOT NULL,
                color VARCHAR(64) NOT NULL,
                warmth VARCHAR(32) NOT NULL,
                style VARCHAR(32) NOT NULL,
                subtype VARCHAR(100) NULL,
                secondary_colors TEXT NULL,
                pattern VARCHAR(64) NULL,
                material VARCHAR(100) NULL,
                waterproof TINYINT(1) NULL,
                seasons TEXT NULL,
                occasions TEXT NULL,
                description VARCHAR(500) NULL,
                confidence DECIMAL(4,3) NULL,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                INDEX idx_garments_user_updated (user_id, updated_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS ai_usage_limits (
                user_id VARCHAR(128) NOT NULL PRIMARY KEY,
                window_started_at DATETIME NOT NULL,
                used_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
                updated_at DATETIME NOT NULL,
                INDEX idx_ai_usage_updated (updated_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS recommendation_feedback (
                user_id VARCHAR(128) NOT NULL,
                recommendation_id VARCHAR(80) NOT NULL,
                status VARCHAR(16) NOT NULL,
                snapshot_json TEXT NULL,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                PRIMARY KEY (user_id, recommendation_id),
                INDEX idx_recommendation_feedback_user_status_updated (user_id, status, updated_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
        ensure_garment_columns($pdo, $config['db_name']);
    } catch (Throwable $error) {
        error_log('QMP database: ' . $error->getMessage());
        json_response(['error' => 'No pudimos conectar con el guardarropa.'], 503);
    }
    return $pdo;
}

function ensure_garment_columns(PDO $pdo, string $databaseName)
{
    $definitions = [
        'subtype' => 'VARCHAR(100) NULL',
        'secondary_colors' => 'TEXT NULL',
        'pattern' => 'VARCHAR(64) NULL',
        'material' => 'VARCHAR(100) NULL',
        'waterproof' => 'TINYINT(1) NULL',
        'seasons' => 'TEXT NULL',
        'occasions' => 'TEXT NULL',
        'description' => 'VARCHAR(500) NULL',
        'confidence' => 'DECIMAL(4,3) NULL',
    ];
    $query = $pdo->prepare(
        'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?'
    );
    $query->execute([$databaseName, 'garments']);
    $existing = array_flip($query->fetchAll(PDO::FETCH_COLUMN));
    foreach ($definitions as $column => $definition) {
        if (isset($existing[$column])) {
            continue;
        }
        $pdo->exec('ALTER TABLE garments ADD COLUMN `' . $column . '` ' . $definition);
    }
}

function uploads_directory(array $config): string
{
    $directory = $config['upload_dir'];
    if (!is_dir($directory) && !mkdir($directory, 0750, true) && !is_dir($directory)) {
        json_response(['error' => 'No pudimos preparar el espacio para las fotos.'], 503);
    }
    return $directory;
}

function request_value(string $key, int $maxLength): string
{
    $value = trim((string) ($_POST[$key] ?? ''));
    if ($value === '' || mb_strlen($value) > $maxLength) {
        json_response(['error' => 'Los datos de la prenda no son válidos.'], 422);
    }
    return $value;
}

function request_optional_value(string $key, int $maxLength)
{
    $value = trim((string) ($_POST[$key] ?? ''));
    if ($value === '') {
        return null;
    }
    if (mb_strlen($value) > $maxLength) {
        json_response(['error' => 'Los datos de la prenda no son válidos.'], 422);
    }
    return $value;
}

function request_string_array(string $key, int $maxItems = 8, int $maxItemLength = 50): array
{
    $raw = (string) ($_POST[$key] ?? '[]');
    $items = json_decode($raw, true);
    if (!is_array($items) || count($items) > $maxItems) {
        json_response(['error' => 'Los datos de la prenda no son válidos.'], 422);
    }
    $clean = [];
    foreach ($items as $item) {
        if (!is_string($item)) {
            json_response(['error' => 'Los datos de la prenda no son válidos.'], 422);
        }
        $item = trim($item);
        if ($item === '' || mb_strlen($item) > $maxItemLength) {
            continue;
        }
        if (!in_array($item, $clean, true)) {
            $clean[] = $item;
        }
    }
    return $clean;
}
