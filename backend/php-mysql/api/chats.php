<?php
declare(strict_types=1);

require __DIR__ . '/../config/helpers.php';
require __DIR__ . '/../config/db.php';
require __DIR__ . '/../config/chat.php';

require_method('GET');
$me = require_user();

try {
    // One row per person I exchanged messages with: the last message and how many of theirs I did not read yet.
    $stmt = db()->prepare(
        'SELECT u.username, u.name,
                lm.body AS last_text, lm.sent_at AS last_at, lm.sender_id AS last_sender,
                (SELECT COUNT(*) FROM messages x
                  WHERE x.sender_id = u.id AND x.recipient_id = :me1 AND x.read_at IS NULL) AS unread
           FROM users u
           JOIN messages lm ON lm.id = (
                SELECT MAX(m.id) FROM messages m
                 WHERE (m.sender_id = :me2 AND m.recipient_id = u.id)
                    OR (m.sender_id = u.id AND m.recipient_id = :me3))
          ORDER BY lm.id DESC'
    );
    $stmt->execute([':me1' => $me, ':me2' => $me, ':me3' => $me]);
    $rows = $stmt->fetchAll();
} catch (PDOException $e) {
    error_log($e->getMessage());
    respond(500, ['message' => 'Server error.']);
}

$chats = array_map(static fn(array $r): array => [
    'username'     => $r['username'],
    'name'         => $r['name'],
    'last_text'    => $r['last_text'],
    'last_at'      => (int)$r['last_at'],
    'last_from_me' => (int)$r['last_sender'] === $me,
    'unread'       => (int)$r['unread'],
], $rows);

respond(200, ['chats' => $chats]);
