<?php
declare(strict_types=1);

require __DIR__ . '/../config/helpers.php';
require __DIR__ . '/../config/db.php';

require_method('POST');
$in = json_body();

$name     = trim((string)($in['name'] ?? ''));
$username = trim((string)($in['username'] ?? ''));
$password = (string)($in['password'] ?? '');

if ($name === '' || $username === '' || $password === '') {
    respond(422, ['message' => 'Fill in all the fields.']);
}
if (strlen($name) > 200) {
    respond(422, ['message' => 'The name is too long.']);
}
if (!preg_match('/^[A-Za-z0-9._-]{3,50}$/', $username)) {
    respond(422, ['message' => 'Username: 3-50 characters, letters, numbers, . _ - only.']);
}
$problem = password_problem($password);
if ($problem !== null) {
    respond(422, ['message' => $problem]);
}

try {
    $stmt = db()->prepare('INSERT INTO users (name, username, student_id, password_hash) VALUES (:name, :username, :sid, :hash)');
    $stmt->execute([
        ':name'     => $name,
        ':username' => $username,
        ':sid'      => student_id_from_username($username), // same number as the username (NULL = a random ID is made below)
        ':hash'     => password_hash($password, PASSWORD_DEFAULT),
    ]);
    $studentId = ensure_student_id((int)db()->lastInsertId()); // assign the Student ID automatically
} catch (PDOException $e) {
    // 23000 / 1062 = duplicate entry (username already taken)
    if ($e->getCode() === '23000' || (int)($e->errorInfo[1] ?? 0) === 1062) {
        respond(409, ['message' => 'This username is already taken.']);
    }
    error_log($e->getMessage());
    respond(500, ['message' => 'Server error.']);
}

respond(201, ['message' => 'Account created.', 'student_id' => $studentId]);
