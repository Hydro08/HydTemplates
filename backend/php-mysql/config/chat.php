<?php
declare(strict_types=1);

/**
 * Chat helpers. Used by api/chats.php, api/messages.php, api/markread.php and api/unread.php.
 * (Load config/helpers.php and config/db.php before this file.)
 */

const CHAT_MAX_LENGTH     = 500;   // the longest message, in characters (the frontend chat.js uses the same number)
const CHAT_MAX_PER_MINUTE = 30;    // how many messages one user may send in a minute

/** Finds a user by username. Returns ['id' => int, 'name' => string, 'username' => string], or null. */
function chat_find_user(string $username): ?array
{
    $stmt = db()->prepare('SELECT id, name, username FROM users WHERE username = :u');
    $stmt->execute([':u' => $username]);
    $row = $stmt->fetch();
    return $row ? ['id' => (int)$row['id'], 'name' => $row['name'], 'username' => $row['username']] : null;
}

/**
 * THE RULE: may user $from write to user $to?
 *
 * The default only blocks writing to yourself, so any signed in user can write to any user.
 * Put your own rule here, for example "a student can only write to the teachers of their class,
 * and a teacher only to their students" (see backend/CHAT-API.md).
 */
function chat_can_talk(int $from, int $to): bool
{
    if ($from === $to) {
        return false;
    }
    // TODO: check the class here (roles + class members) before you put this online.
    return true;
}

/** The number of characters (not bytes), so "Magandang umaga po" and emoji count fairly. */
function chat_length(string $text): int
{
    if (function_exists('mb_strlen')) {
        return mb_strlen($text, 'UTF-8');
    }
    return (int)preg_match_all('/./su', $text);
}

/** Trims the text and removes control characters (new lines and tabs stay). Returns '' when nothing is left. */
function chat_clean_text($raw): string
{
    if (!is_string($raw)) {
        return '';
    }
    $text = str_replace(["\r\n", "\r"], "\n", $raw);
    $text = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $text) ?? '';
    return trim($text);
}

/** Turns a database row (with from_username and to_username) into the JSON shape of a message. */
function chat_message_json(array $row): array
{
    return [
        'id'   => (int)$row['id'],
        'from' => $row['from_username'],
        'to'   => $row['to_username'],
        'text' => $row['body'],
        'time' => (int)$row['sent_at'],
        'read' => $row['read_at'] !== null,
    ];
}

/** The current time in milliseconds (the same unit as Date.now() in the frontend). */
function chat_now_ms(): int
{
    return (int)round(microtime(true) * 1000);
}
