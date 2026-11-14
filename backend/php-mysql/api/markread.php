<?php
declare(strict_types=1);

require __DIR__ . '/../config/helpers.php';
require __DIR__ . '/../config/db.php';
require __DIR__ . '/../config/chat.php';

require_method('POST');
$me   = require_user();
$in   = json_body();
$with = trim((string)($in['with'] ?? ''));

$peer = $with === '' ? null : chat_find_user($with);
if (!$peer) {
    respond(404, ['message' => 'This user does not exist.']);
}

try {
    // Only what THEY sent to ME is marked. Nobody can mark the messages of somebody else.
    $stmt = db()->prepare(
        'UPDATE messages SET read_at = :now
          WHERE recipient_id = :me AND sender_id = :peer AND read_at IS NULL'
    );
    $stmt->execute([':now' => chat_now_ms(), ':me' => $me, ':peer' => $peer['id']]);
    respond(200, ['updated' => $stmt->rowCount()]);
} catch (PDOException $e) {
    error_log($e->getMessage());
    respond(500, ['message' => 'Server error.']);
}
