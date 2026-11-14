<?php
declare(strict_types=1);

require __DIR__ . '/../config/helpers.php';
require __DIR__ . '/../config/db.php';

/*
 * GET  /api/profile -> {verified, profile}
 * POST /api/profile -> saves the profile. When every required field is filled in and valid, the account is verified.
 * The Student ID is not part of the form: it is assigned automatically (see random_student_id() in config/helpers.php).
 * YEAR_LEVELS must match the <select> in frontend/school-portal/profile.html,
 * and FIELDS must match the inputs there and the columns of `profiles` in database/schema.sql.
 */
const YEAR_LEVELS = [
    'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12',
    '1st Year', '2nd Year', '3rd Year', '4th Year',
];
const FIELDS = [
    'birthdate', 'year_level', 'section',
    'email', 'phone', 'street', 'barangay', 'city', 'province', 'zip',
    'father_name', 'father_occupation', 'father_phone',
    'mother_name', 'mother_occupation', 'mother_phone',
];
// [min, max] length of the plain text fields
const TEXT_LIMITS = [
    'section' => [1, 100], 'street' => [3, 150], 'barangay' => [2, 100], 'city' => [2, 100], 'province' => [2, 100],
    'father_name' => [2, 200], 'father_occupation' => [2, 100],
    'mother_name' => [2, 200], 'mother_occupation' => [2, 100],
];
const PHONE_FIELDS = ['phone', 'father_phone', 'mother_phone'];

function fail(string $field, string $message, int $status = 422): void
{
    respond($status, ['field' => $field, 'message' => $message]);
}

/** Returns [field, message] for the first problem, or null when everything is fine. */
function validate_profile(array $p): ?array
{
    foreach (FIELDS as $f) {
        if ($p[$f] === '') {
            return [$f, 'This field is required.'];
        }
    }
    $d = DateTime::createFromFormat('!Y-m-d', $p['birthdate']);
    $validDate = $d && $d->format('Y-m-d') === $p['birthdate'];
    if (!$validDate || $p['birthdate'] > date('Y-m-d') || $p['birthdate'] < '1900-01-01') {
        return ['birthdate', 'Enter a valid birthdate.'];
    }
    if (!in_array($p['year_level'], YEAR_LEVELS, true)) {
        return ['year_level', 'Select a year level.'];
    }
    if (strlen($p['email']) > 200 || !filter_var($p['email'], FILTER_VALIDATE_EMAIL)) {
        return ['email', 'Enter a valid email address.'];
    }
    foreach (PHONE_FIELDS as $f) {
        if (!preg_match('/^[0-9+\-\s()]{7,20}$/', $p[$f]) || strlen(preg_replace('/\D/', '', $p[$f])) < 7) {
            return [$f, 'Enter a valid contact number.'];
        }
    }
    if (!preg_match('/^[A-Za-z0-9 -]{3,10}$/', $p['zip'])) {
        return ['zip', 'Enter a valid ZIP code.'];
    }
    foreach (TEXT_LIMITS as $f => [$min, $max]) {
        $len = mb_strlen($p[$f]);
        if ($len < $min || $len > $max) {
            return [$f, "Must be $min-$max characters."];
        }
    }
    return null;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $uid = require_user();
    $stmt = db()->prepare('SELECT ' . implode(', ', FIELDS) . ' FROM profiles WHERE user_id = :id');
    $stmt->execute([':id' => $uid]);
    $profile = $stmt->fetch() ?: null;
    respond(200, ['verified' => $profile !== null, 'profile' => $profile, 'student_id' => ensure_student_id($uid)]);
}

require_method('POST');
$uid = require_user();
$in  = json_body();

$p = [];
foreach (FIELDS as $f) {
    $v = $in[$f] ?? '';
    $p[$f] = is_string($v) ? trim($v) : '';
}

if ($err = validate_profile($p)) {
    fail($err[0], $err[1]);
}

// Column and placeholder names come from the FIELDS constant above, never from user input.
$cols   = implode(', ', FIELDS);
$params = implode(', ', array_map(fn($f) => ':' . $f, FIELDS));
$update = implode(', ', array_map(fn($f) => "$f = VALUES($f)", FIELDS));

try {
    $stmt = db()->prepare(
        "INSERT INTO profiles (user_id, $cols) VALUES (:uid, $params)
         ON DUPLICATE KEY UPDATE $update, updated_at = NOW()"
    );
    $stmt->execute([':uid' => $uid] + array_combine(array_map(fn($f) => ':' . $f, FIELDS), array_values($p)));
} catch (PDOException $e) {
    error_log($e->getMessage());
    respond(500, ['message' => 'Server error.']);
}

respond(200, ['verified' => true, 'profile' => $p, 'student_id' => ensure_student_id($uid)]);
