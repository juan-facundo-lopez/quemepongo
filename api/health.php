<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
database($config);
uploads_directory($config);
json_response(['ok' => true]);
