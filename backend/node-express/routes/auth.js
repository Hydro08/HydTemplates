/**
 * Sign up, sign in, who am I, sign out.
 *   POST /api/register   POST /api/login   GET /api/me   POST /api/change-password   POST /api/logout
 * Every handler is a plain function (req, res), and register() attaches them to the router.
 */
const bcrypt = require("bcryptjs");
const { isVerified, ensureStudentId, studentIdFromUsername, isUniqueError } = require("../helpers");

const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);   // so a wrong username takes as long as a wrong password

function isJson(req) {
  return /^application\/json/i.test(req.headers["content-type"] || "");
}

/** For POST: only JSON is accepted (protects against CSRF). Answers 415 and returns false when it is not JSON. */
function jsonOnly(req, res) {
  if (isJson(req)) return true;
  res.status(415).json({ message: "Only JSON is accepted." });
  return false;
}

/** Use this on every endpoint for signed in users only. */
function requireUser(req, res, next) {
  if (!req.session || !req.session.uid) {
    return res.status(401).json({ message: "You are not signed in." });
  }
  next();
}

/** Password rules (same as the sign up form): 8+ characters, an uppercase letter, a number and a special character. Returns a message, or null if it is fine. */
function passwordProblem(password) {
  const missing = [];
  if (password.length < 8) missing.push("at least 8 characters");
  if (!/[A-Z]/.test(password)) missing.push("an uppercase letter");
  if (!/[0-9]/.test(password)) missing.push("a number");
  if (!/[^\p{L}\p{N}\s]/u.test(password)) missing.push("a special character");
  if (missing.length) return "Password needs " + missing.join(", ") + ".";
  if (password.length > 72) return "The password is too long (max 72).";   // bcrypt only uses the first 72 bytes
  return null;
}

function register(router, db) {
  router.post("/register", async (req, res) => {
    if (!jsonOnly(req, res)) return;
    const body = req.body || {};
    const name = String(body.name ?? "").trim();
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");

    if (!name || !username || !password) return res.status(422).json({ message: "Fill in all the fields." });
    if (name.length > 200) return res.status(422).json({ message: "The name is too long." });
    if (!/^[A-Za-z0-9._-]{3,50}$/.test(username)) {
      return res.status(422).json({ message: "Username: 3-50 characters, letters, numbers, . _ - only." });
    }
    const problem = passwordProblem(password);
    if (problem) return res.status(422).json({ message: problem });

    let studentId;
    try {
      const hash = await bcrypt.hash(password, 10);
      const created = db.prepare("INSERT INTO users (name, username, student_id, password_hash) VALUES (?, ?, ?, ?)").run(name, username, studentIdFromUsername(username), hash);
      studentId = ensureStudentId(db, Number(created.lastInsertRowid));   // assign the Student ID automatically
    } catch (error) {
      if (isUniqueError(error)) {
        return res.status(409).json({ message: "This username is already taken." });
      }
      console.error(error);
      return res.status(500).json({ message: "Server error." });
    }
    res.status(201).json({ message: "Account created.", student_id: studentId });
  });

  router.post("/login", async (req, res) => {
    if (!jsonOnly(req, res)) return;
    const body = req.body || {};
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");
    if (!username || !password) return res.status(422).json({ message: "Enter your username and password." });

    const user = db.prepare("SELECT id, name, username, role, password_hash FROM users WHERE username = ?").get(username);
    // Same message whether the username or the password is wrong, and the check always runs.
    const valid = (await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH)) && Boolean(user);
    if (!valid) return res.status(401).json({ message: "Wrong username or password." });

    req.session.regenerate(error => {              // a new session id after sign in
      if (error) return res.status(500).json({ message: "Server error." });
      req.session.uid = user.id;
      res.json({
        name: user.name,
        username: user.username,
        role: user.role || "student",
        verified: isVerified(db, user.id),
        student_id: ensureStudentId(db, user.id),
      });
    });
  });

  router.get("/me", requireUser, (req, res) => {
    const user = db.prepare("SELECT name, username, role FROM users WHERE id = ?").get(req.session.uid);
    if (!user) return req.session.destroy(() => res.status(401).json({ message: "You are not signed in." }));
    res.json({
      role: user.role || "student",
      name: user.name,
      username: user.username,
      verified: isVerified(db, req.session.uid),
      student_id: ensureStudentId(db, req.session.uid),
    });
  });

  router.post("/change-password", requireUser, async (req, res) => {
    if (!jsonOnly(req, res)) return;
    const body = req.body || {};
    const current = String(body.current_password ?? "");
    const next = String(body.new_password ?? "");
    if (!current || !next) return res.status(422).json({ message: "Fill in all the fields." });
    const problem = passwordProblem(next);
    if (problem) return res.status(422).json({ message: problem });
    if (next === current) return res.status(422).json({ message: "The new password must be different from your current password." });

    const user = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(req.session.uid);
    if (!user) return req.session.destroy(() => res.status(401).json({ message: "You are not signed in." }));
    if (!(await bcrypt.compare(current, user.password_hash))) {
      return res.status(403).json({ message: "Your current password is incorrect." });
    }
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(await bcrypt.hash(next, 10), req.session.uid);
    res.json({ message: "Password updated." });
  });

  router.post("/logout", (req, res) => {
    if (!jsonOnly(req, res)) return;
    req.session.destroy(() => {
      res.clearCookie("sid");
      res.json({ message: "You are signed out." });
    });
  });
}

/** Admins only (users.role = 'admin'). Promote one with: UPDATE users SET role = 'admin' WHERE username = '...'; */
function requireAdmin(db) {
  return (req, res, next) => {
    requireUser(req, res, () => {
      const u = db.prepare("SELECT role FROM users WHERE id = ?").get(req.session.uid);
      if (!u || u.role !== "admin") return res.status(403).json({ message: "Admins only." });
      next();
    });
  };
}

module.exports = { register, requireUser, requireAdmin, jsonOnly };
