<?php
declare(strict_types=1);

require __DIR__ . '/../config/helpers.php';
require __DIR__ . '/../config/db.php';

require_method('GET');
start_session();

if (empty($_SESSION['uid'])) {
    respond(401, ['message' => 'You are not signed in.']);
}

$stmt = db()->prepare('SELECT name, username, role FROM users WHERE id = :id');
$stmt->execute([':id' => $_SESSION['uid']]);
$user = $stmt->fetch();

if (!$user) {
    session_destroy();
    respond(401, ['message' => 'You are not signed in.']);
}

$user['verified'] = is_verified((int)$_SESSION['uid']);
$user['student_id'] = ensure_student_id((int)$_SESSION['uid']);
respond(200, $user);
