# Chat API (student <-> teacher messages)

Every backend folder (`php-sqlite`, `php-mysql`, `flask`, `node-express`) has the same five endpoints.
They are what `frontend/quiz-app/chat.js` needs once you stop using the browser demo (`database.messages`).

All requests and answers are JSON. The person must be signed in (session cookie), otherwise every endpoint answers
`401 {"message": "You are not signed in."}`. For POST, the `Content-Type` must be `application/json` (415 otherwise).

| Method | Path            | Body / Query                       | Answer                                                         |
|--------|-----------------|------------------------------------|----------------------------------------------------------------|
| GET    | /api/chats      |                                    | 200 `{chats: [{username, name, last_text, last_at, last_from_me, unread}]}` |
| GET    | /api/messages   | `?with=username` `&after=id`       | 200 `{messages: [{id, from, to, text, time, read}]}`           |
| POST   | /api/messages   | `{to, text}`                       | 201 `{message}` / 403 / 404 / 422 / 429                        |
| POST   | /api/markread   | `{with}`                           | 200 `{updated}` (how many messages were marked as read)        |
| GET    | /api/unread     |                                    | 200 `{count, by_user: {username: number}}`                     |

- **/api/chats**: the people this user already exchanged messages with, newest conversation first.
  `last_at` is in milliseconds, `unread` = messages from that person that this user did not read yet.
  People with no messages yet are NOT here: your app already knows them (the class list), like `chat.js` does.
- **/api/messages (GET)**: the conversation with one person, oldest first, the last 200 messages.
  Add `after=<id of the newest message you have>` to get only the new ones (that is how polling works).
  `time` is in milliseconds (same as `message.time` in `db.js`), `read` is true when the receiver opened it.
- **/api/messages (POST)**: `text` is trimmed and must have 1 to 500 characters (`CHAT_MAX_LENGTH`).
  422 = empty, too long, or writing to yourself. 404 = that username does not exist.
  403 = not allowed to chat with that person (see "Who may chat with who"). 429 = more than 30 messages in one minute.
- **/api/markread**: everything that `with` sent to me becomes read. Call it when the conversation is on the screen.
- **/api/unread**: the number for the badge (poll it every 5 to 10 seconds, it is a tiny query).

## Who may chat with who (you must do this part)

The backends only know `users` (name, username, password). The **class rules** of the quiz app
(a student can write only to the teachers of their class, a teacher only to their students) live in your frontend demo,
so a backend does not know them yet. Every backend has ONE function for it:

| Backend       | Where                                  |
|---------------|----------------------------------------|
| php-sqlite    | `chat_can_talk()` in `config/chat.php` |
| php-mysql     | `chat_can_talk()` in `config/chat.php` |
| flask         | `can_chat()` in `app.py`               |
| node-express  | `canChat()` in `routes/chat.js`        |

The default only blocks writing to yourself, so **any signed in user can write to any user**. Before you put it online, add
roles and a class table (for example `users.role` and `class_members(student_id, teacher_id)`) and return `false` for everybody else.
The check runs on the server for every message, so a person cannot skip it by changing the frontend.

## Polling in the frontend

The demo updates by itself because all tabs share `localStorage`. With a backend, ask for news on a timer:

    every 3-5 seconds, while the Messages tab is open:   GET /api/messages?with=<peer>&after=<last id>
    every 10 seconds, anywhere else:                      GET /api/unread       (for the badge and the pop-up)

For instant messages use WebSocket or Server-Sent Events later. The endpoints above stay the same.

## Notes

- The text is stored as plain text. The frontend must show it with `escapeHtml` (chat.js does).
- There is only a small limit (30 messages per minute per user). Add a stronger one if you put this online.
- Deleting a user deletes their messages (`ON DELETE CASCADE`).

## Not in these backends yet (the quiz-app demo has them in the browser)

`frontend/quiz-app/chat.js` now also has classmate chat (student to student), reply, forward, reactions, unsend and report.
The four backends here do NOT have them yet, they only have the five endpoints above. To move them to a backend you need:

- `messages` extra columns: `reply_to`, `forwarded`, `deleted`, `removed`
- a `reactions` table: `(message_id, username, emoji)`, one row per person per message
- a `reports` table: `(id, message_id, reporter, reported, text, reason, time, status)`
- endpoints: react, unsend, report, and (admin only) list and review reports
- the classmate rule in `chat_can_talk()` / `can_chat()` / `canChat()`: two students may talk when they share a teacher
