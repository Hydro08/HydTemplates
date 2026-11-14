/**
 * Chat: messages between two users (see ../../CHAT-API.md).
 *   GET  /api/chats      GET /api/messages?with=username&after=id      POST /api/messages
 *   POST /api/markread   GET /api/unread
 */
const { requireUser, jsonOnly } = require("./auth");

const CHAT_MAX_LENGTH = 500;       // the longest message, in characters (the frontend chat.js uses the same number)
const CHAT_MAX_PER_MINUTE = 30;    // how many messages one user may send in a minute

/**
 * THE RULE: may user fromId write to user toId?
 *
 * The default only blocks writing to yourself, so any signed in user can write to any user.
 * Put your own rule here, for example "a student can only write to the teachers of their class,
 * and a teacher only to their students" (see ../../CHAT-API.md).
 */
function canChat(fromId, toId) {
  if (fromId === toId) return false;
  // TODO: check the class here (roles + class members) before you put this online.
  return true;
}

/** Trims the text and removes control characters (new lines and tabs stay). Returns "" when nothing is left. */
function cleanText(raw) {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim();
}

const MESSAGE_SELECT = `
  SELECT m.id, m.body, m.sent_at, m.read_at, fu.username AS from_username, tu.username AS to_username
    FROM messages m
    JOIN users fu ON fu.id = m.sender_id
    JOIN users tu ON tu.id = m.recipient_id`;

function messageJson(row) {
  return {
    id: Number(row.id),
    from: row.from_username,
    to: row.to_username,
    text: row.body,
    time: Number(row.sent_at),
    read: row.read_at !== null,
  };
}

function register(router, db) {
  const findUser = username =>
    db.prepare("SELECT id, name, username FROM users WHERE username = ?").get(username);

  router.get("/chats", requireUser, (req, res) => {
    const me = req.session.uid;
    // One row per person I exchanged messages with: the last message and how many of theirs I did not read yet.
    const rows = db.prepare(`
      SELECT u.username, u.name,
             lm.body AS last_text, lm.sent_at AS last_at, lm.sender_id AS last_sender,
             (SELECT COUNT(*) FROM messages x
               WHERE x.sender_id = u.id AND x.recipient_id = :me AND x.read_at IS NULL) AS unread
        FROM users u
        JOIN messages lm ON lm.id = (
             SELECT MAX(m.id) FROM messages m
              WHERE (m.sender_id = :me AND m.recipient_id = u.id)
                 OR (m.sender_id = u.id AND m.recipient_id = :me))
       ORDER BY lm.id DESC`).all({ me });
    res.json({
      chats: rows.map(r => ({
        username: r.username,
        name: r.name,
        last_text: r.last_text,
        last_at: Number(r.last_at),
        last_from_me: Number(r.last_sender) === me,
        unread: Number(r.unread),
      })),
    });
  });

  // GET /api/messages?with=username[&after=id]  -> the conversation, oldest first (last 200)
  router.get("/messages", requireUser, (req, res) => {
    const me = req.session.uid;
    const peer = findUser(String(req.query.with ?? "").trim());
    if (!peer) return res.status(404).json({ message: "This user does not exist." });
    const after = Math.max(0, Number.parseInt(req.query.after, 10) || 0);

    const rows = db.prepare(`${MESSAGE_SELECT}
       WHERE ((m.sender_id = :me AND m.recipient_id = :peer) OR (m.sender_id = :peer AND m.recipient_id = :me))
         AND m.id > :after
       ORDER BY m.id DESC LIMIT 200`).all({ me, peer: peer.id, after });
    res.json({ messages: rows.reverse().map(messageJson) });
  });

  // POST /api/messages  { to, text }
  router.post("/messages", requireUser, (req, res) => {
    if (!jsonOnly(req, res)) return;
    const me = req.session.uid;
    const body = req.body || {};
    const to = String(body.to ?? "").trim();
    const text = cleanText(body.text);

    if (!to || !text) return res.status(422).json({ message: "Write a message first." });
    if ([...text].length > CHAT_MAX_LENGTH) {      // [...text] counts characters, not bytes
      return res.status(422).json({ message: `A message can have up to ${CHAT_MAX_LENGTH} characters.` });
    }
    const peer = findUser(to);
    if (!peer) return res.status(404).json({ message: "This user does not exist." });
    if (peer.id === me) return res.status(422).json({ message: "You cannot write to yourself." });
    if (!canChat(me, peer.id)) return res.status(403).json({ message: "You cannot write to this person." });

    const now = Date.now();
    const recent = db.prepare("SELECT COUNT(*) AS n FROM messages WHERE sender_id = ? AND sent_at > ?").get(me, now - 60000).n;
    if (Number(recent) >= CHAT_MAX_PER_MINUTE) {
      return res.status(429).json({ message: "You are sending too fast. Wait a moment." });
    }

    const info = db.prepare("INSERT INTO messages (sender_id, recipient_id, body, sent_at) VALUES (?, ?, ?, ?)")
      .run(me, peer.id, text, now);
    const row = db.prepare(`${MESSAGE_SELECT} WHERE m.id = ?`).get(info.lastInsertRowid);
    res.status(201).json({ message: messageJson(row) });
  });

  // POST /api/markread  { with }
  router.post("/markread", requireUser, (req, res) => {
    if (!jsonOnly(req, res)) return;
    const me = req.session.uid;
    const peer = findUser(String((req.body || {}).with ?? "").trim());
    if (!peer) return res.status(404).json({ message: "This user does not exist." });

    // Only what THEY sent to ME is marked. Nobody can mark the messages of somebody else.
    const info = db.prepare(
      "UPDATE messages SET read_at = ? WHERE recipient_id = ? AND sender_id = ? AND read_at IS NULL"
    ).run(Date.now(), me, peer.id);
    res.json({ updated: Number(info.changes) });
  });

  router.get("/unread", requireUser, (req, res) => {
    const rows = db.prepare(`
      SELECT u.username, COUNT(*) AS n
        FROM messages m JOIN users u ON u.id = m.sender_id
       WHERE m.recipient_id = ? AND m.read_at IS NULL
       GROUP BY u.username`).all(req.session.uid);
    const byUser = {};
    let count = 0;
    for (const row of rows) {
      byUser[row.username] = Number(row.n);
      count += Number(row.n);
    }
    res.json({ count, by_user: byUser });
  });
}

module.exports = { register, canChat, cleanText, CHAT_MAX_LENGTH, CHAT_MAX_PER_MINUTE };
