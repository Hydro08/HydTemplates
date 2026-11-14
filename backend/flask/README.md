# Flask backend

A small backend with sign up, sign in, the **school portal profile** and the **chat** of the quiz app (student <-> teacher messages).
Everything is in `app.py`. It saves to SQLite (`data/app.db`, created automatically), so only Flask is needed.

Endpoints (JSON). The chat ones are described in [`../CHAT-API.md`](../CHAT-API.md).

| Method | Path          | Body                                   | Response                                          |
|--------|---------------|----------------------------------------|---------------------------------------------------|
| POST   | /api/register | name, username, password               | 201 {student_id} / 409 (username already taken)   |
| POST   | /api/login    | username, password                     | 200 {name, username, verified, student_id} / 401  |
| GET    | /api/me       |                                        | 200 {name, username, verified, student_id} / 401  |
| GET    | /api/profile  |                                        | 200 {verified, profile, student_id} / 401         |
| POST   | /api/profile  | the 16 profile fields (see below)      | 200 / 422 {field, message}                        |
| POST   | /api/change-password | current_password, new_password   | 200 / 403 (wrong current password) / 422          |
| POST   | /api/logout   |                                        | 200                                               |
| GET    | /api/chats    |                                        | 200 {chats}                                       |
| GET    | /api/messages | ?with=username&after=id                | 200 {messages}                                    |
| POST   | /api/messages | to, text                               | 201 {message} / 403 / 404 / 422 / 429             |
| POST   | /api/markread | with                                   | 200 {updated}                                     |
| GET    | /api/unread   |                                        | 200 {count, by_user}                              |

## How to run

Requires Python 3.9+.

    pip install -r requirements.txt
    python app.py

Open http://localhost:5000. Flask also serves `frontend/` and `shared/` (and nothing else), so the pages and `/api` have the same
address and the login cookie just works. In `shared/js/config.js` use `API_BASE_URL = "/api"`
(`DEMO_MODE` is already `false` in the downloaded zip).

Inside the Hyd Templates repo run it from `backend/flask` (`/` opens the quiz app). In a downloaded project `app.py` sits next to
`frontend/` and `index.html`, and `/` opens that project's `index.html`.

Settings (environment variables, all optional): `PORT` (5000), `SECRET_KEY` (otherwise a random one is saved in `data/secret.key`),
`COOKIE_SECURE=1` (when you use https).

## Verification (school portal)

An account is **verified** when every required profile field is filled in and valid (there is a row in the `profiles` table).
After signing in, a user who is not verified yet is sent to `profile.html` first and cannot enter the portal until the profile is complete.

Profile fields: `birthdate`, `year_level`, `section`, `email`, `phone`, `street`, `barangay`, `city`, `province`, `zip`,
`father_name`, `father_occupation`, `father_phone`, `mother_name`, `mother_occupation`, `mother_phone`.
The Student ID is not a profile field: it is assigned automatically (see below).

For your own endpoints that only verified users should reach (schedule, grades, ...), put the decorator under the route (inside `create_app`):

    @app.get("/api/schedule")
    @verified_required          # 401 if not signed in, 403 if not verified yet
    def schedule(uid):
        ...

To add or remove a required field, edit `profiles` in `SCHEMA`, `PROFILE_FIELDS` and `validate_profile()` in `app.py`,
and `profile.html`, `profile.js` and `demo-profile.js` in `frontend/school-portal/`.

## Student ID (you decide)

The Student ID is assigned **automatically and randomly** when an account is created (`2026-48213` = current year + 5 random digits).
Students cannot change it. It is stored in `users.student_id` (unique) and returned by `/api/register`, `/api/login`, `/api/me` and `/api/profile`.
To use your own rule (sequential numbers, a prefix per course, school-issued IDs...), change `random_student_id()` in `app.py`. Keep the IDs unique.

Older `app.db` files are upgraded automatically: a profile that had a typed Student ID keeps it (it moves to `users.student_id`).

## Who may chat with who

`can_chat()` in `app.py` is the one place for that rule. By default any signed in user can write to any user,
because this backend has no roles or classes yet. Add yours before you put it online (see `../CHAT-API.md`).

## Notes

- `data/` holds the database and the secret key. It is not public and it is in `.gitignore`. Do not zip it with real data.
- `python app.py` is for development. To put it online use a real server, for example `gunicorn app:app`.
- Passwords are hashed (werkzeug). Login uses a signed session cookie (httponly, SameSite=Lax).
- There is no rate limiting on login. If you put this online, add a limit for wrong logins.
