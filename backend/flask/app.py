"""
Flask backend: sign up, sign in, the school portal PROFILE and the CHAT of the quiz app (student <-> teacher messages).
It uses SQLite (a file: data/app.db, created automatically), so there is nothing to install except Flask.

Run:
    pip install -r requirements.txt
    python app.py            ->  http://localhost:5000

Endpoints (JSON). The chat ones are described in ../CHAT-API.md.
    POST /api/register   POST /api/login   GET /api/me   POST /api/logout
    GET  /api/profile    POST /api/profile
    GET  /api/chats      GET  /api/messages?with=username&after=id      POST /api/messages
    POST /api/markread   GET  /api/unread
"""
import os
import re
import secrets
import sqlite3
import time
from datetime import date, datetime
from functools import wraps
from pathlib import Path

from flask import Flask, g, jsonify, redirect, request, send_from_directory, session
from werkzeug.security import check_password_hash, generate_password_hash

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "app.db"
# The folder that has frontend/ and shared/. In a downloaded project they are next to app.py;
# inside the Hyd Templates repo they are two folders up.
ZIPPED = (BASE_DIR / "frontend").is_dir()
PROJECT_ROOT = BASE_DIR if ZIPPED else BASE_DIR.parent.parent

CHAT_MAX_LENGTH = 500          # the longest message, in characters (the frontend chat.js uses the same number)
CHAT_MAX_PER_MINUTE = 30       # how many messages one user may send in a minute

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  student_id    TEXT COLLATE NOCASE,
  role          TEXT NOT NULL DEFAULT 'student',   -- 'student' or 'admin'   -- assigned automatically at sign up (unique index is created in create_app)
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
"""


PROFILE_COLUMNS = (
    "user_id, birthdate, year_level, section, email, phone, street, barangay, city, province, zip, "
    "father_name, father_occupation, father_phone, mother_name, mother_occupation, mother_phone, verified_at, updated_at"
)


def setup_database(path):
    """Creates the tables when they do not exist yet and upgrades a database made by an older version."""
    con = sqlite3.connect(path)
    try:
        def columns(table):
            return [row[1] for row in con.execute(f"PRAGMA table_info({table})")]

        # Old profiles had the Student ID typed by the user. It now lives in users.student_id (assigned automatically),
        # so the old table is set aside here and its rows are moved over below.
        had_typed_ids = "student_id" in columns("profiles")
        if had_typed_ids:
            con.execute("ALTER TABLE profiles RENAME TO profiles_v2_tmp")

        con.executescript(SCHEMA)

        # users.student_id: add the column to an old users table, and make sure the IDs are unique
        if "student_id" not in columns("users"):
            con.execute("ALTER TABLE users ADD COLUMN student_id TEXT COLLATE NOCASE")
        con.execute("CREATE UNIQUE INDEX IF NOT EXISTS users_student_id_uq ON users(student_id)")
        if "role" not in columns("users"):
            con.execute("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'student'")

        if had_typed_ids:
            con.execute(
                "UPDATE users SET student_id = (SELECT p.student_id FROM profiles_v2_tmp p WHERE p.user_id = users.id) "
                "WHERE student_id IS NULL AND id IN (SELECT user_id FROM profiles_v2_tmp)"
            )
            con.execute(f"INSERT INTO profiles ({PROFILE_COLUMNS}) SELECT {PROFILE_COLUMNS} FROM profiles_v2_tmp")
            con.execute("DROP TABLE profiles_v2_tmp")
        con.commit()
    finally:
        con.close()


YEAR_LEVELS = [
    "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12",
    "1st Year", "2nd Year", "3rd Year", "4th Year",
]
PROFILE_FIELDS = [
    "birthdate", "year_level", "section",
    "email", "phone", "street", "barangay", "city", "province", "zip",
    "father_name", "father_occupation", "father_phone",
    "mother_name", "mother_occupation", "mother_phone",
]
# (min, max) length of the plain text fields
TEXT_LIMITS = {
    "section": (1, 100), "street": (3, 150), "barangay": (2, 100), "city": (2, 100), "province": (2, 100),
    "father_name": (2, 200), "father_occupation": (2, 100),
    "mother_name": (2, 200), "mother_occupation": (2, 100),
}
PHONE_FIELDS = ["phone", "father_phone", "mother_phone"]
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def validate_profile(p):
    """Returns (field, message) for the first problem, or None when everything is fine."""
    for f in PROFILE_FIELDS:
        if p[f] == "":
            return f, "This field is required."
    try:
        born = datetime.strptime(p["birthdate"], "%Y-%m-%d").date()
        valid_date = born.isoformat() == p["birthdate"]
    except ValueError:
        valid_date = False
    if not valid_date or born > date.today() or born < date(1900, 1, 1):
        return "birthdate", "Enter a valid birthdate."
    if p["year_level"] not in YEAR_LEVELS:
        return "year_level", "Select a year level."
    if len(p["email"]) > 200 or not EMAIL_RE.match(p["email"]):
        return "email", "Enter a valid email address."
    for f in PHONE_FIELDS:
        if not re.fullmatch(r"[0-9+\-\s()]{7,20}", p[f]) or len(re.sub(r"\D", "", p[f])) < 7:
            return f, "Enter a valid contact number."
    if not re.fullmatch(r"[A-Za-z0-9 -]{3,10}", p["zip"]):
        return "zip", "Enter a valid ZIP code."
    for f, (lo, hi) in TEXT_LIMITS.items():
        if not lo <= len(p[f]) <= hi:
            return f, f"Must be {lo}-{hi} characters."
    return None


def student_id_from_username(username):
    """The Student ID uses the same number as the username: 2026Pogi32198 -> 2026-32198. None if it does not end in 5 digits."""
    m = re.match(r"^(\d{4}).*?(\d{5})$", username)
    return f"{m.group(1)}-{m.group(2)}" if m else None


def random_student_id():
    """
    STUDENT ID: how IDs are made is up to you (the school). This template just hands out a random one when
    the account is created: the current year + 5 random digits, e.g. 2026-48213.
    Replace this function with your own rule (sequential numbers, a school-issued list, a course prefix, ...).
    Keep it unique: users.student_id has a unique index.
    """
    return f"{date.today().year}-{secrets.randbelow(100000):05d}"


def password_problem(password):
    """Password rules (same as the sign up form): 8+ characters, an uppercase letter, a number and a special character.
    Returns a message, or None if the password is fine."""
    missing = []
    if len(password) < 8:
        missing.append("at least 8 characters")
    if not re.search(r"[A-Z]", password):
        missing.append("an uppercase letter")
    if not re.search(r"[0-9]", password):
        missing.append("a number")
    if not re.search(r"[^\w\s]|_", password):
        missing.append("a special character")
    if missing:
        return "Password needs " + ", ".join(missing) + "."
    if len(password) > 72:
        return "The password is too long (max 72)."
    return None


def create_app(db_path=DB_PATH):
    app = Flask(__name__)
    app.config["DB_PATH"] = str(db_path)
    app.config["MAX_CONTENT_LENGTH"] = 64 * 1024          # no request is bigger than 64 KB
    app.config["SECRET_KEY"] = load_secret_key()
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
    app.config["SESSION_COOKIE_SECURE"] = os.environ.get("COOKIE_SECURE") == "1"   # set COOKIE_SECURE=1 when you use https

    Path(app.config["DB_PATH"]).parent.mkdir(parents=True, exist_ok=True)
    setup_database(app.config["DB_PATH"])

    dummy_hash = generate_password_hash("not-a-real-password")   # so a wrong username takes as long as a wrong password

    # ---------- helpers ----------

    def get_db():
        if "db" not in g:
            g.db = sqlite3.connect(app.config["DB_PATH"])
            g.db.row_factory = sqlite3.Row
            g.db.execute("PRAGMA foreign_keys = ON")
        return g.db

    @app.teardown_appcontext
    def close_db(_error):
        db = g.pop("db", None)
        if db is not None:
            db.close()

    def error(status, message):
        return jsonify({"message": message}), status

    def json_only():
        """For POST: only JSON is accepted (protects against CSRF). Returns (body, error_response)."""
        if request.mimetype != "application/json":
            return None, error(415, "Only JSON is accepted.")
        body = request.get_json(silent=True)
        return (body if isinstance(body, dict) else {}), None

    def login_required(view):
        @wraps(view)
        def wrapper(*args, **kwargs):
            uid = session.get("uid")
            if not uid:
                return error(401, "You are not signed in.")
            return view(int(uid), *args, **kwargs)
        return wrapper

    def admin_required(view):
        """Admins only (users.role = 'admin'). Promote one with: UPDATE users SET role = 'admin' WHERE username = '...';"""
        @wraps(view)
        @login_required
        def wrapper(uid, *args, **kwargs):
            row = get_db().execute("SELECT role FROM users WHERE id = ?", (uid,)).fetchone()
            if not row or row["role"] != "admin":
                return error(403, "Admins only.")
            return view(uid, *args, **kwargs)
        return wrapper

    @app.get("/api/admin-students")
    @admin_required
    def admin_students_list(uid):
        rows = get_db().execute(
            "SELECT u.username, u.student_id, u.name, p.section, (p.user_id IS NOT NULL) AS verified "
            "FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.role <> 'admin' ORDER BY u.id DESC"
        ).fetchall()
        return jsonify([{**dict(r), "verified": bool(r["verified"])} for r in rows])

    @app.delete("/api/admin-students")
    @admin_required
    def admin_students_delete(uid):
        username = request.args.get("username", "").strip()
        if not username:
            return error(422, "Missing username.")
        db = get_db()
        cur = db.execute("DELETE FROM users WHERE username = ? AND role <> 'admin'", (username,))
        db.commit()
        return jsonify({"message": "Student deleted."}) if cur.rowcount else error(404, "Student not found.")

    def is_verified(uid):
        """An account is verified when it has a complete profile (a row in `profiles`)."""
        return get_db().execute("SELECT 1 FROM profiles WHERE user_id = ?", (uid,)).fetchone() is not None

    def verified_required(view):
        """
        Use this on endpoints that are for verified users only (e.g. schedule, grades):
            @app.get("/api/schedule")
            @verified_required
            def schedule(uid): ...
        """
        @wraps(view)
        @login_required
        def wrapper(uid, *args, **kwargs):
            if not is_verified(uid):
                return jsonify({"message": "Complete your profile first to verify your account.", "verified": False}), 403
            return view(uid, *args, **kwargs)
        return wrapper

    def ensure_student_id(uid):
        """Returns the user's Student ID. Creates one if the user does not have it yet (e.g. accounts made before this feature)."""
        db = get_db()
        row = db.execute("SELECT student_id FROM users WHERE id = ?", (uid,)).fetchone()
        if row and row["student_id"]:
            return row["student_id"]
        for _ in range(20):
            try:
                db.execute("UPDATE users SET student_id = ? WHERE id = ? AND student_id IS NULL", (random_student_id(), uid))
                db.commit()
                break
            except sqlite3.IntegrityError:
                db.rollback()      # that random ID is already taken: try another one
        row = db.execute("SELECT student_id FROM users WHERE id = ?", (uid,)).fetchone()
        return row["student_id"] if row else None

    @app.after_request
    def no_cache_for_api(response):
        if request.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
            response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    # ---------- sign up, sign in ----------

    @app.post("/api/register")
    def register():
        body, bad = json_only()
        if bad:
            return bad
        name = str(body.get("name", "")).strip()
        username = str(body.get("username", "")).strip()
        password = str(body.get("password", ""))

        if not name or not username or not password:
            return error(422, "Fill in all the fields.")
        if len(name) > 200:
            return error(422, "The name is too long.")
        if not re.fullmatch(r"[A-Za-z0-9._-]{3,50}", username):
            return error(422, "Username: 3-50 characters, letters, numbers, . _ - only.")
        problem = password_problem(password)
        if problem:
            return error(422, problem)

        db = get_db()
        try:
            cursor = db.execute(
                "INSERT INTO users (name, username, student_id, password_hash) VALUES (?, ?, ?, ?)",
                (name, username, student_id_from_username(username), generate_password_hash(password)),
            )
            db.commit()
        except sqlite3.IntegrityError:
            return error(409, "This username is already taken.")
        student_id = ensure_student_id(cursor.lastrowid)       # assign the Student ID automatically
        return jsonify({"message": "Account created.", "student_id": student_id}), 201

    @app.post("/api/login")
    def login():
        body, bad = json_only()
        if bad:
            return bad
        username = str(body.get("username", "")).strip()
        password = str(body.get("password", ""))
        if not username or not password:
            return error(422, "Enter your username and password.")

        user = get_db().execute(
            "SELECT id, name, username, role, password_hash FROM users WHERE username = ?", (username,)
        ).fetchone()
        # Same message whether the username or the password is wrong, and the check always runs.
        valid = check_password_hash(user["password_hash"] if user else dummy_hash, password) and user is not None
        if not valid:
            return error(401, "Wrong username or password.")

        session.clear()
        session["uid"] = user["id"]
        return jsonify({
            "name": user["name"],
            "username": user["username"],
            "role": user["role"],
            "verified": is_verified(user["id"]),
            "student_id": ensure_student_id(user["id"]),
        })

    @app.get("/api/me")
    @login_required
    def me(uid):
        user = get_db().execute("SELECT name, username, role FROM users WHERE id = ?", (uid,)).fetchone()
        if not user:
            session.clear()
            return error(401, "You are not signed in.")
        return jsonify({
            "role": user["role"],
            "name": user["name"],
            "username": user["username"],
            "verified": is_verified(uid),
            "student_id": ensure_student_id(uid),
        })

    @app.post("/api/change-password")
    @login_required
    def change_password(uid):
        body, bad = json_only()
        if bad:
            return bad
        current = str(body.get("current_password", ""))
        new = str(body.get("new_password", ""))
        if not current or not new:
            return error(422, "Fill in all the fields.")
        problem = password_problem(new)
        if problem:
            return error(422, problem)
        if new == current:
            return error(422, "The new password must be different from your current password.")

        db = get_db()
        user = db.execute("SELECT password_hash FROM users WHERE id = ?", (uid,)).fetchone()
        if not user:
            session.clear()
            return error(401, "You are not signed in.")
        if not check_password_hash(user["password_hash"], current):
            return error(403, "Your current password is incorrect.")
        db.execute("UPDATE users SET password_hash = ? WHERE id = ?", (generate_password_hash(new), uid))
        db.commit()
        return jsonify({"message": "Password updated."})

    @app.post("/api/logout")
    def logout():
        _body, bad = json_only()
        if bad:
            return bad
        session.clear()
        return jsonify({"message": "You are signed out."})

    # ---------- profile (an account is verified when it has a complete profile) ----------
    # The Student ID is not part of the form: it is assigned automatically (see random_student_id() above).
    # YEAR_LEVELS must match the <select> in frontend/school-portal/profile.html,
    # and FIELDS must match the inputs there and the columns of `profiles` in SCHEMA.

    @app.get("/api/profile")
    @login_required
    def profile_get(uid):
        row = get_db().execute("SELECT " + ", ".join(PROFILE_FIELDS) + " FROM profiles WHERE user_id = ?", (uid,)).fetchone()
        return jsonify({"verified": row is not None, "profile": dict(row) if row else None, "student_id": ensure_student_id(uid)})

    @app.post("/api/profile")
    @login_required
    def profile_save(uid):
        body, bad = json_only()
        if bad:
            return bad
        p = {}
        for f in PROFILE_FIELDS:
            v = body.get(f, "")
            p[f] = v.strip() if isinstance(v, str) else ""

        problem = validate_profile(p)
        if problem:
            return jsonify({"field": problem[0], "message": problem[1]}), 422

        # Column and placeholder names come from the PROFILE_FIELDS list, never from user input.
        cols = ", ".join(PROFILE_FIELDS)
        marks = ", ".join("?" for _ in PROFILE_FIELDS)
        update = ", ".join(f"{f} = excluded.{f}" for f in PROFILE_FIELDS)
        db = get_db()
        try:
            db.execute(
                f"INSERT INTO profiles (user_id, {cols}) VALUES (?, {marks}) "
                f"ON CONFLICT(user_id) DO UPDATE SET {update}, updated_at = datetime('now')",
                (uid, *[p[f] for f in PROFILE_FIELDS]),
            )
            db.commit()
        except sqlite3.Error as e:
            app.logger.error(e)
            return error(500, "Server error.")
        return jsonify({"verified": True, "profile": p, "student_id": ensure_student_id(uid)})

    # ---------- chat ----------

    def find_user(username):
        return get_db().execute(
            "SELECT id, name, username FROM users WHERE username = ?", (username,)
        ).fetchone()

    def can_chat(from_id, to_id):
        """
        THE RULE: may user from_id write to user to_id?

        The default only blocks writing to yourself, so any signed in user can write to any user.
        Put your own rule here, for example "a student can only write to the teachers of their class,
        and a teacher only to their students" (see ../CHAT-API.md).
        """
        if from_id == to_id:
            return False
        # TODO: check the class here (roles + class members) before you put this online.
        return True

    def clean_text(raw):
        """Trims the text and removes control characters (new lines and tabs stay). Returns '' when nothing is left."""
        if not isinstance(raw, str):
            return ""
        text = raw.replace("\r\n", "\n").replace("\r", "\n")
        text = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", "", text)
        return text.strip()

    def now_ms():
        return int(time.time() * 1000)

    MESSAGE_SELECT = """
        SELECT m.id, m.body, m.sent_at, m.read_at, fu.username AS from_username, tu.username AS to_username
          FROM messages m
          JOIN users fu ON fu.id = m.sender_id
          JOIN users tu ON tu.id = m.recipient_id
    """

    def message_json(row):
        return {
            "id": row["id"],
            "from": row["from_username"],
            "to": row["to_username"],
            "text": row["body"],
            "time": row["sent_at"],
            "read": row["read_at"] is not None,
        }

    @app.get("/api/chats")
    @login_required
    def chats(uid):
        # One row per person I exchanged messages with: the last message and how many of theirs I did not read yet.
        rows = get_db().execute(
            """
            SELECT u.username, u.name,
                   lm.body AS last_text, lm.sent_at AS last_at, lm.sender_id AS last_sender,
                   (SELECT COUNT(*) FROM messages x
                     WHERE x.sender_id = u.id AND x.recipient_id = :me AND x.read_at IS NULL) AS unread
              FROM users u
              JOIN messages lm ON lm.id = (
                   SELECT MAX(m.id) FROM messages m
                    WHERE (m.sender_id = :me AND m.recipient_id = u.id)
                       OR (m.sender_id = u.id AND m.recipient_id = :me))
             ORDER BY lm.id DESC
            """,
            {"me": uid},
        ).fetchall()
        return jsonify({"chats": [
            {
                "username": r["username"],
                "name": r["name"],
                "last_text": r["last_text"],
                "last_at": r["last_at"],
                "last_from_me": r["last_sender"] == uid,
                "unread": r["unread"],
            } for r in rows
        ]})

    @app.get("/api/messages")
    @login_required
    def messages_list(uid):
        # GET /api/messages?with=username[&after=id]  -> the conversation, oldest first (last 200)
        peer = find_user(request.args.get("with", "").strip())
        if not peer:
            return error(404, "This user does not exist.")
        try:
            after = max(0, int(request.args.get("after", 0)))
        except ValueError:
            after = 0

        rows = get_db().execute(
            MESSAGE_SELECT + """
             WHERE ((m.sender_id = :me AND m.recipient_id = :peer) OR (m.sender_id = :peer AND m.recipient_id = :me))
               AND m.id > :after
             ORDER BY m.id DESC LIMIT 200
            """,
            {"me": uid, "peer": peer["id"], "after": after},
        ).fetchall()
        return jsonify({"messages": [message_json(r) for r in reversed(rows)]})

    @app.post("/api/messages")
    @login_required
    def messages_send(uid):
        body, bad = json_only()
        if bad:
            return bad
        to = str(body.get("to", "")).strip()
        text = clean_text(body.get("text"))

        if not to or not text:
            return error(422, "Write a message first.")
        if len(text) > CHAT_MAX_LENGTH:
            return error(422, f"A message can have up to {CHAT_MAX_LENGTH} characters.")
        peer = find_user(to)
        if not peer:
            return error(404, "This user does not exist.")
        if peer["id"] == uid:
            return error(422, "You cannot write to yourself.")
        if not can_chat(uid, peer["id"]):
            return error(403, "You cannot write to this person.")

        db = get_db()
        now = now_ms()
        recent = db.execute(
            "SELECT COUNT(*) FROM messages WHERE sender_id = ? AND sent_at > ?", (uid, now - 60000)
        ).fetchone()[0]
        if recent >= CHAT_MAX_PER_MINUTE:
            return error(429, "You are sending too fast. Wait a moment.")

        cursor = db.execute(
            "INSERT INTO messages (sender_id, recipient_id, body, sent_at) VALUES (?, ?, ?, ?)",
            (uid, peer["id"], text, now),
        )
        db.commit()
        row = db.execute(MESSAGE_SELECT + " WHERE m.id = ?", (cursor.lastrowid,)).fetchone()
        return jsonify({"message": message_json(row)}), 201

    @app.post("/api/markread")
    @login_required
    def mark_read(uid):
        body, bad = json_only()
        if bad:
            return bad
        peer = find_user(str(body.get("with", "")).strip())
        if not peer:
            return error(404, "This user does not exist.")

        db = get_db()
        # Only what THEY sent to ME is marked. Nobody can mark the messages of somebody else.
        cursor = db.execute(
            "UPDATE messages SET read_at = ? WHERE recipient_id = ? AND sender_id = ? AND read_at IS NULL",
            (now_ms(), uid, peer["id"]),
        )
        db.commit()
        return jsonify({"updated": cursor.rowcount})

    @app.get("/api/unread")
    @login_required
    def unread(uid):
        rows = get_db().execute(
            """
            SELECT u.username, COUNT(*) AS n
              FROM messages m JOIN users u ON u.id = m.sender_id
             WHERE m.recipient_id = ? AND m.read_at IS NULL
             GROUP BY u.username
            """,
            (uid,),
        ).fetchall()
        by_user = {r["username"]: r["n"] for r in rows}
        return jsonify({"count": sum(by_user.values()), "by_user": by_user})

    @app.errorhandler(404)
    def not_found(_e):
        if request.path.startswith("/api/"):
            return error(404, "Not found.")
        return "Not found", 404

    @app.errorhandler(405)
    def method_not_allowed(_e):
        return error(405, "This method is not allowed.")

    @app.errorhandler(413)
    def too_big(_e):
        return error(413, "The request is too big.")

    # ---------- the website itself (only frontend/ and shared/ are public, never this folder or data/) ----------

    @app.get("/")
    def home():
        # Downloaded project: its own index.html. Inside the repo (the gallery is there): the quiz app.
        if ZIPPED:
            return send_from_directory(PROJECT_ROOT, "index.html")
        return redirect("/frontend/quiz-app/index.html")

    @app.get("/frontend/<path:path>")
    def frontend_files(path):
        return send_from_directory(PROJECT_ROOT / "frontend", path)

    @app.get("/shared/<path:path>")
    def shared_files(path):
        return send_from_directory(PROJECT_ROOT / "shared", path)

    return app


def load_secret_key():
    """The key that signs the login cookie. SECRET_KEY from the environment, or a random one saved in data/secret.key."""
    from_env = os.environ.get("SECRET_KEY")
    if from_env:
        return from_env
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    key_file = DATA_DIR / "secret.key"
    if not key_file.exists():
        key_file.write_text(secrets.token_hex(32))
    return key_file.read_text().strip()


app = create_app()          # also what "flask --app app run" and gunicorn (app:app) use

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", 5000)), debug=False)
