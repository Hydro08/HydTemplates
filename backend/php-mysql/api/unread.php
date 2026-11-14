<?php
declare(strict_types=1);

require __DIR__ . '/../config/helpers.php';
require __DIR__ . '/../config/db.php';
require __DIR__ . '/../config/chat.php';

require_method('GET');
$me = require_user();

try {
    $stmt = db()->prepare(
        'SELECT u.username, COUNT(*) AS n
           FROM messages m JOIN users u ON u.id = m.sender_id
          WHERE m.recipient_id = :me AND m.read_at IS NULL
          GROUP BY u.username'
    );
    $stmt->execute([':me' => $me]);
    $byUser = [];
    $count  = 0;
    foreach ($stmt->fetchAll() as $row) {
        $byUser[$row['username']] = (int)$row['n'];
        $count += (int)$row['n'];
    }
    // (new stdClass when empty, so the JSON is {} and not [])
    respond(200, ['count' => $count, 'by_user' => $byUser ?: new stdClass()]);
} catch (PDOException $e) {
    error_log($e->getMessage());
    respond(500, ['message' => 'Server error.']);
}
