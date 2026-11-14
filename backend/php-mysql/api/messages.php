<?php
declare(strict_types=1);

require __DIR__ . '/../config/helpers.php';
require __DIR__ . '/../config/db.php';
require __DIR__ . '/../config/chat.php';

$method = $_SERVER['REQUEST_METHOD'];
if ($method !== 'GET' && $method !== 'POST') {
    header('Allow: GET, POST');
    respond(405, ['message' => 'This method is not allowed.']);
}
$me = require_user();

const MESSAGE_SELECT =
    'SELECT m.id, m.body, m.sent_at, m.read_at, fu.username AS from_username, tu.username AS to_username
       FROM messages m
       JOIN users fu ON fu.id = m.sender_id
       JOIN users tu ON tu.id = m.recipient_id';

try {
    if ($method === 'GET') {
        // GET /api/messages?with=username[&after=id]  -> the conversation, oldest first (last 200)
        $peerName = trim((string)($_GET['with'] ?? ''));
        $after    = max(0, (int)($_GET['after'] ?? 0));
        $peer     = $peerName === '' ? null : chat_find_user($peerName);
        if (!$peer) {
            respond(404, ['message' => 'This user does not exist.']);
        }

        $stmt = db()->prepare(
            MESSAGE_SELECT . '
              WHERE ((m.sender_id = :me1 AND m.recipient_id = :peer1) OR (m.sender_id = :peer2 AND m.recipient_id = :me2))
                AND m.id > :after
              ORDER BY m.id DESC LIMIT 200'
        );
        $stmt->execute([':me1' => $me, ':me2' => $me, ':peer1' => $peer['id'], ':peer2' => $peer['id'], ':after' => $after]);
        $rows = array_reverse($stmt->fetchAll());
        respond(200, ['messages' => array_map('chat_message_json', $rows)]);
    }

    // POST /api/messages  { to, text }
    require_method('POST');
    $in   = json_body();
    $to   = trim((string)($in['to'] ?? ''));
    $text = chat_clean_text($in['text'] ?? null);

    if ($to === '' || $text === '') {
        respond(422, ['message' => 'Write a message first.']);
    }
    if (chat_length($text) > CHAT_MAX_LENGTH) {
        respond(422, ['message' => 'A message can have up to ' . CHAT_MAX_LENGTH . ' characters.']);
    }
    $peer = chat_find_user($to);
    if (!$peer) {
        respond(404, ['message' => 'This user does not exist.']);
    }
    if ($peer['id'] === $me) {
        respond(422, ['message' => 'You cannot write to yourself.']);
    }
    if (!chat_can_talk($me, $peer['id'])) {
        respond(403, ['message' => 'You cannot write to this person.']);
    }

    $now = chat_now_ms();
    $recent = db()->prepare('SELECT COUNT(*) FROM messages WHERE sender_id = :me AND sent_at > :since');
    $recent->execute([':me' => $me, ':since' => $now - 60000]);
    if ((int)$recent->fetchColumn() >= CHAT_MAX_PER_MINUTE) {
        respond(429, ['message' => 'You are sending too fast. Wait a moment.']);
    }

    $insert = db()->prepare('INSERT INTO messages (sender_id, recipient_id, body, sent_at) VALUES (:s, :r, :b, :t)');
    $insert->execute([':s' => $me, ':r' => $peer['id'], ':b' => $text, ':t' => $now]);
    $id = (int)db()->lastInsertId();

    $stmt = db()->prepare(MESSAGE_SELECT . ' WHERE m.id = :id');
    $stmt->execute([':id' => $id]);
    respond(201, ['message' => chat_message_json($stmt->fetch())]);
} catch (PDOException $e) {
    error_log($e->getMessage());
    respond(500, ['message' => 'Server error.']);
}
