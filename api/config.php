<?php
declare(strict_types=1);

function qmp_load_env(string $path)
{
    if (!is_file($path) || !is_readable($path)) {
        return;
    }
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (!is_array($lines)) {
        return;
    }
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#' || strpos($line, '=') === false) {
            continue;
        }
        list($name, $value) = array_map('trim', explode('=', $line, 2));
        if (!preg_match('/^[A-Z][A-Z0-9_]*$/', $name) || getenv($name) !== false) {
            continue;
        }
        if (strlen($value) >= 2 && (($value[0] === '"' && substr($value, -1) === '"') || ($value[0] === "'" && substr($value, -1) === "'"))) {
            $value = substr($value, 1, -1);
        }
        putenv($name . '=' . $value);
        $_ENV[$name] = $value;
    }
}

qmp_load_env(dirname(__DIR__, 3) . '/quemepongo_private/.env');
qmp_load_env(__DIR__ . '/.env');

return [
    'db_host' => 'localhost',
    'db_name' => 'u446573652_qmpdata',
    'db_user' => 'u446573652_qmpuser',
    'db_password' => '__DB_PASSWORD__',
    'firebase_api_key' => 'AIzaSyA1m7wKFsUcUxJ2fimc-Z29xgOLKJzMRsU',
    'upload_dir' => dirname(__DIR__, 3) . '/quemepongo_uploads',
    'gemini_api_key' => trim((string) (getenv('GEMINI_API_KEY') ?: '')),
    'gemini_model' => trim((string) (getenv('GEMINI_MODEL') ?: 'gemini-3.1-flash-lite')),
];
