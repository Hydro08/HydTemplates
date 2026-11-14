# Node + Express backend

A small backend with sign up, sign in, the **school portal profile** and the **chat** of the quiz app (student <-> teacher messages).
It saves to SQLite (`data/app.db`, created automatically) using the SQLite built into Node, so nothing needs to be compiled.

Endpoints (JSON). The chat ones are described in [`../CHAT-API.md`](../CHAT-API.md).

| Method | Path          | Body                                   | Response                                          |
|--------|---------------|----------------------------------------|---------------------------------------------------|
| POST   | /api/register | name, username, password               | 201 {student_id} / 409 (username already taken)   |
| POST   | /api/login    | username, password                     | 200 {name, username, verified, student_id} / 401  |
| GET    | /api/me       |                                        | 200 {name, username, verified, student_id} / 401   |
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

Requires **Node 22.13 or newer** (for `node:sqlite`).

    npm install
    npm start

(Inside the Hyd Templates repo: `cd backend/node-express` first.)

Open http://localhost:3000. Express also serves `frontend/` and `shared/` (and nothing else), so the pages and `/api` have the same
address and the login cookie just works. In `shared/js/config.js` use `API_BASE_URL = "/api"`
(`DEMO_MODE` is already `false` in the downloaded zip).
Node prints an "ExperimentalWarning: SQLite" message. It is normal and harmless.

Inside the Hyd Templates repo `/` opens the quiz app. In a downloaded project `server.js` sits next to `frontend/` and `index.html`,
and `/` opens that project's `index.html`.

Settings (environment variables, all optional): `PORT` (3000), `SESSION_SECRET` (otherwise a random one is used and everybody signs in
again after a restart), `COOKIE_SECURE=1` (when you use https).

## Files

    server.js          the app: session, /api, and the public folders
    db.js              the SQLite file, the tables and the upgrade of older files
    helpers.js         isVerified, requireVerified, and the Student ID (randomStudentId, ensureStudentId)
    routes/auth.js     register, login, me, logout (and requireUser, to protect an endpoint)
    routes/profile.js  the profile endpoints and their validation
    routes/chat.js     the chat endpoints

## Verification (school portal)

An account is **verified** when every required profile field is filled in and valid (there is a row in the `profiles` table).
After signing in, a user who is not verified yet is sent to `profile.html` first and cannot enter the portal until the profile is complete.

Profile fields: `birthdate`, `year_level`, `section`, `email`, `phone`, `street`, `barangay`, `city`, `province`, `zip`,
`father_name`, `father_occupation`, `father_phone`, `mother_name`, `mother_occupation`, `mother_phone`.
The Student ID is not a profile field: it is assigned automatically (see below).

For your own endpoints that only verified users should reach (schedule, grades, ...), add `requireVerified(db)` inside `createApp` in `server.js`:

    api.get("/schedule", requireVerified(db), (req, res) => { /* req.session.uid */ });   // 401 if not signed in, 403 if not verified yet

To add or remove a required field, edit `profiles` in `db.js`, `FIELDS` and `validateProfile()` in `routes/profile.js`,
and `profile.html`, `profile.js` and `demo-profile.js` in `frontend/school-portal/`.

## Student ID (you decide)

The Student ID is assigned **automatically and randomly** when an account is created (`2026-48213` = current year + 5 random digits).
Students cannot change it. It is stored in `users.student_id` (unique) and returned by `/api/register`, `/api/login`, `/api/me` and `/api/profile`.
To use your own rule (sequential numbers, a prefix per course, school-issued IDs...), change `randomStudentId()` in `helpers.js`. Keep the IDs unique.

Older `app.db` files are upgraded automatically: a profile that had a typed Student ID keeps it (it moves to `users.student_id`).

## Who may chat with who

`canChat()` in `routes/chat.js` is the one place for that rule. By default any signed in user can write to any user,
because this backend has no roles or classes yet. Add yours before you put it online (see `../CHAT-API.md`).

## Notes

- `data/` holds the database. It is not public and it is in `.gitignore`. Do not zip it with real data.
- The session is kept in memory (the express-session default): fine for development, but for a real server use a session store.
- Passwords are hashed with bcrypt (bcryptjs). The cookie is httponly, SameSite=Lax.
- There is no rate limiting on login. If you put this online, add a limit for wrong logins.
