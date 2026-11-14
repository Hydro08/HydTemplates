<?php
declare(strict_types=1);

require __DIR__ . '/../config/helpers.php';
require __DIR__ . '/../config/db.php';

require_method('POST');
$in = json_body();

$username = trim((string)($in['username'] ?? ''));
$password = (string)($in['password'] ?? '');

if ($username === '' || $password === '') {
    respond(422, ['message' => 'Enter your username and password.']);
}

try {
    $stmt = db()->prepare('SELECT id, name, username, role, password_hash FROM users WHERE username = :u');
    $stmt->execute([':u' => $username]);
    $user = $stmt->fetch();
} catch (PDOException $e) {
    error_log($e->getMessage());
    respond(500, ['message' => 'Server error.']);
}

// Same message whether the username or the password is wrong, and password_verify always runs,
// so nobody can tell whether a username exists.
$dummy = '$2y$10$.vGA1O9wmRjrwAVXD98HNOgsNpDczlqm3Jq7KnEd1rVAGv3Fykk1a'; // a real bcrypt hash that belongs to no user
$hash  = $user['password_hash'] ?? $dummy;
$valid = password_verify($password, $hash) && $user !== false;

if (!$valid) {
    respond(401, ['message' => 'Wrong username or password.']);
}

start_session();
session_regenerate_id(true);
$_SESSION['uid'] = (int)$user['id'];

respond(200, [
    'name'     => $user['name'],
    'username' => $user['username'],
    'role'     => $user['role'] ?? 'student',
    'verified' => is_verified((int)$user['id']),
    'student_id' => ensure_student_id((int)$user['id']),
]);
