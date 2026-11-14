<?php
declare(strict_types=1);

require __DIR__ . '/../config/helpers.php';
require __DIR__ . '/../config/db.php';

require_method('POST');
$uid = require_user();
$in = json_body();

$current = (string)($in['current_password'] ?? '');
$new     = (string)($in['new_password'] ?? '');

if ($current === '' || $new === '') {
    respond(422, ['message' => 'Fill in all the fields.']);
}
$problem = password_problem($new);
if ($problem !== null) {
    respond(422, ['message' => $problem]);
}
if ($new === $current) {
    respond(422, ['message' => 'The new password must be different from your current password.']);
}

try {
    $stmt = db()->prepare('SELECT password_hash FROM users WHERE id = :id');
    $stmt->execute([':id' => $uid]);
    $hash = $stmt->fetchColumn();
    $stmt->closeCursor();

    if (!is_string($hash)) {
        respond(401, ['message' => 'You are not signed in.']);
    }
    if (!password_verify($current, $hash)) {
        respond(403, ['message' => 'Your current password is incorrect.']);
    }

    $update = db()->prepare('UPDATE users SET password_hash = :hash WHERE id = :id');
    $update->execute([':hash' => password_hash($new, PASSWORD_DEFAULT), ':id' => $uid]);
} catch (PDOException $e) {
    error_log($e->getMessage());
    respond(500, ['message' => 'Server error.']);
}

session_regenerate_id(true);   // a new session id after a password change
respond(200, ['message' => 'Password updated.']);
