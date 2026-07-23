<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$uid = firebase_user_id($config);
$pdo = database($config);
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

function recommendation_snapshot($value)
{
    if (!is_string($value) || $value === '') {
        return null;
    }
    if (strlen($value) > 16000) {
        json_response(['error' => 'La recomendación es demasiado grande.'], 422);
    }
    $decoded = json_decode($value, true);
    if (!is_array($decoded)) {
        json_response(['error' => 'Los datos de la recomendación no son válidos.'], 422);
    }
    return $decoded;
}

function recommendation_payload(array $item): array
{
    $snapshot = is_string($item['snapshot_json']) ? json_decode($item['snapshot_json'], true) : null;
    return [
        'id' => $item['recommendation_id'],
        'status' => $item['status'],
        'snapshot' => is_array($snapshot) ? $snapshot : null,
        'createdAt' => gmdate(DATE_ATOM, strtotime($item['created_at'] . ' UTC')),
        'updatedAt' => gmdate(DATE_ATOM, strtotime($item['updated_at'] . ' UTC')),
    ];
}

if ($method === 'GET') {
    $statement = $pdo->prepare(
        'SELECT recommendation_id, status, snapshot_json, created_at, updated_at
         FROM recommendation_feedback
         WHERE user_id = ?
         ORDER BY updated_at DESC'
    );
    $statement->execute([$uid]);
    $items = array_map('recommendation_payload', $statement->fetchAll());
    json_response(['feedback' => $items]);
}

if ($method === 'POST') {
    $id = trim((string) ($_POST['id'] ?? ''));
    $status = trim((string) ($_POST['status'] ?? ''));
    if (!preg_match('/^[A-Za-z0-9-]{3,80}$/', $id)) {
        json_response(['error' => 'El identificador de la recomendación no es válido.'], 422);
    }
    if (!in_array($status, ['saved', 'owned', 'dismissed', 'removed'], true)) {
        json_response(['error' => 'El estado de la recomendación no es válido.'], 422);
    }

    $snapshot = recommendation_snapshot($_POST['snapshot'] ?? '');
    $snapshotJson = $snapshot === null
        ? null
        : json_encode($snapshot, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $now = gmdate('Y-m-d H:i:s');

    try {
        $statement = $pdo->prepare(
            'INSERT INTO recommendation_feedback
                (user_id, recommendation_id, status, snapshot_json, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                status = VALUES(status),
                snapshot_json = COALESCE(VALUES(snapshot_json), snapshot_json),
                updated_at = VALUES(updated_at)'
        );
        $statement->execute([$uid, $id, $status, $snapshotJson, $now, $now]);

        $saved = $pdo->prepare(
            'SELECT recommendation_id, status, snapshot_json, created_at, updated_at
             FROM recommendation_feedback
             WHERE user_id = ? AND recommendation_id = ?'
        );
        $saved->execute([$uid, $id]);
        json_response(['ok' => true, 'feedback' => recommendation_payload($saved->fetch())]);
    } catch (Throwable $error) {
        error_log('QMP recommendation save: ' . $error->getMessage());
        json_response(['error' => 'No pudimos guardar la recomendación.'], 503);
    }
}

if ($method === 'DELETE') {
    $id = trim((string) ($_GET['id'] ?? ''));
    if ($id === '') {
        $statement = $pdo->prepare('DELETE FROM recommendation_feedback WHERE user_id = ?');
        $statement->execute([$uid]);
        json_response(['ok' => true]);
    }
    if (!preg_match('/^[A-Za-z0-9-]{3,80}$/', $id)) {
        json_response(['error' => 'El identificador de la recomendación no es válido.'], 422);
    }
    $statement = $pdo->prepare(
        'DELETE FROM recommendation_feedback WHERE user_id = ? AND recommendation_id = ?'
    );
    $statement->execute([$uid, $id]);
    json_response(['ok' => true]);
}

header('Allow: GET, POST, DELETE');
json_response(['error' => 'Método no permitido.'], 405);
