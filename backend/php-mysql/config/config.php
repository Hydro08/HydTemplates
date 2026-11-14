<?php
// Database settings. XAMPP defaults: user "root", empty password.
// You can also set them as environment variables (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS).
return [
    "host" => getenv("DB_HOST") ?: "127.0.0.1",
    "port" => getenv("DB_PORT") ?: "3306",
    "name" => getenv("DB_NAME") ?: "hyd_app",
    "user" => getenv("DB_USER") ?: "root",
    "pass" => getenv("DB_PASS") !== false ? getenv("DB_PASS") : "",
];
