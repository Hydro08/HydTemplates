/**
 * The database: SQLite, one file (data/app.db), created automatically.
 * It uses the SQLite that is built into Node (node:sqlite, Node 22.13 or newer), so there is nothing to compile.
 */
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  student_id    TEXT COLLATE NOCASE,
  role          TEXT NOT NULL DEFAULT 'student',   -- 'student' or 'admin'   -- assigned automatically at sign up (unique index is created in openDatabase)
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- A user's profile. A row here (all required fields filled in) means the account is verified.
CREATE TABLE IF NOT EXISTS profiles (
  user_id           INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  birthdate         TEXT NOT NULL,
  year_level        TEXT NOT NULL,
  section           TEXT NOT NULL,
  email             TEXT NOT NULL,
  phone             TEXT NOT NULL,
  street            TEXT NOT NULL,
  barangay          TEXT NOT NULL,
  city              TEXT NOT NULL,
  province          TEXT NOT NULL,
  zip               TEXT NOT NULL,
  father_name       TEXT NOT NULL,
  father_occupation TEXT NOT NULL,
  father_phone      TEXT NOT NULL,
  mother_name       TEXT NOT NULL,
  mother_occupation TEXT NOT NULL,
  mother_phone      TEXT NOT NULL,
  verified_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Chat: messages between two users (see ../CHAT-API.md). Times are in milliseconds since 1970.
CREATE TABLE IF NOT EXISTS messages (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body         TEXT    NOT NULL,
  sent_at      INTEGER NOT NULL,
  read_at      INTEGER            -- NULL = the receiver did not read it yet
);
CREATE INDEX IF NOT EXISTS messages_pair_idx   ON messages(sender_id, recipient_id, id);
CREATE INDEX IF NOT EXISTS messages_unread_idx ON messages(recipient_id, read_at);
`;

const PROFILE_COLUMNS =
  "user_id, birthdate, year_level, section, email, phone, street, barangay, city, province, zip, " +
  "father_name, father_occupation, father_phone, mother_name, mother_occupation, mother_phone, verified_at, updated_at";

function columnNames(db, table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
}

/** Opens the database (a file path, or ":memory:" for tests), creates the tables when they do not exist and upgrades older files. */
function openDatabase(file = path.join(__dirname, "data", "app.db")) {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON");

  // --- Migrations for databases created by older versions of this template ---
  // Old profiles had the Student ID typed by the user. It now lives in users.student_id (assigned automatically),
  // so the old table is set aside here and its rows are moved over below.
  const hadTypedIds = columnNames(db, "profiles").includes("student_id");
  if (hadTypedIds) db.exec("ALTER TABLE profiles RENAME TO profiles_v2_tmp");

  db.exec(SCHEMA);

  // users.student_id: add the column to an old users table, and make sure the IDs are unique
  if (!columnNames(db, "users").includes("student_id")) {
    db.exec("ALTER TABLE users ADD COLUMN student_id TEXT COLLATE NOCASE");
  }
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS users_student_id_uq ON users(student_id)");
  if (!columnNames(db, "users").includes("role")) {
    db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'student'");
  }

  if (hadTypedIds) {
    db.exec(`UPDATE users SET student_id = (SELECT p.student_id FROM profiles_v2_tmp p WHERE p.user_id = users.id)
             WHERE student_id IS NULL AND id IN (SELECT user_id FROM profiles_v2_tmp)`);
    db.exec(`INSERT INTO profiles (${PROFILE_COLUMNS}) SELECT ${PROFILE_COLUMNS} FROM profiles_v2_tmp`);
    db.exec("DROP TABLE profiles_v2_tmp");
  }
  return db;
}

module.exports = { openDatabase, SCHEMA };
