<?php
declare(strict_types=1);

/* Admin only. GET /api/admin-students -> [{ username, student_id, name, section, verified }]
   DELETE /api/admin-students?username=... -> deletes a student (an admin account cannot be deleted here). */
require __DIR__ . '/../config/helpers.php';
require __DIR__ . '/../config/db.php';

$uid = require_admin();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $rows = db()->query(
        "SELECT u.username, u.student_id, u.name, p.section, (p.user_id IS NOT NULL) AS verified
         FROM users u LEFT JOIN profiles p ON p.user_id = u.id
         WHERE u.role <> 'admin' ORDER BY u.id DESC"
    )->fetchAll();
    foreach ($rows as &$r) { $r['verified'] = (bool)$r['verified']; }
    respond(200, $rows);
}

if ($method === 'DELETE') {
    $username = trim((string)($_GET['username'] ?? ''));
    if ($username === '') respond(422, ['message' => 'Missing username.']);
    $stmt = db()->prepare("DELETE FROM users WHERE username = :u AND role <> 'admin'");
    $stmt->execute([':u' => $username]);
    respond($stmt->rowCount() ? 200 : 404, ['message' => $stmt->rowCount() ? 'Student deleted.' : 'Student not found.']);
}

respond(405, ['message' => 'Method not allowed.']);
