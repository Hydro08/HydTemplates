/**
 * Verification and Student ID helpers. Used by routes/auth.js and routes/profile.js.
 */

/** An account is verified when it has a complete profile (a row in `profiles`). */
function isVerified(db, uid) {
  return Boolean(db.prepare("SELECT 1 AS ok FROM profiles WHERE user_id = ?").get(uid));
}

/**
 * Use this on endpoints that are for verified users only (e.g. schedule, grades):
 *   api.get("/schedule", requireVerified(db), (req, res) => { ... req.session.uid ... });
 */
function requireVerified(db) {
  return (req, res, next) => {
    if (!req.session || !req.session.uid) return res.status(401).json({ message: "You are not signed in." });
    if (!isVerified(db, req.session.uid)) {
      return res.status(403).json({ message: "Complete your profile first to verify your account.", verified: false });
    }
    next();
  };
}

/**
 * STUDENT ID: how IDs are made is up to you (the school). This template just hands out a random one when
 * the account is created: the current year + 5 random digits, e.g. 2026-48213.
 * Replace this function with your own rule (sequential numbers, a school-issued list, a course prefix, ...).
 * Keep it unique: users.student_id has a unique index.
 */
function randomStudentId() {
  const digits = String(Math.floor(Math.random() * 100000)).padStart(5, "0");
  return `${new Date().getFullYear()}-${digits}`;
}

/** The Student ID uses the same number as the username: 2026Pogi32198 -> 2026-32198. null if the username does not end in 5 digits. */
function studentIdFromUsername(username) {
  const m = /^(\d{4}).*?(\d{5})$/.exec(username);
  return m ? `${m[1]}-${m[2]}` : null;
}

function isUniqueError(error) {
  return String(error.code || "").startsWith("ERR_SQLITE") && /UNIQUE/i.test(error.message);
}

/** Returns the user's Student ID. Creates one if the user does not have it yet (e.g. accounts made before this feature). */
function ensureStudentId(db, uid) {
  const read = () => db.prepare("SELECT student_id FROM users WHERE id = ?").get(uid);
  const current = read();
  if (current && current.student_id) return current.student_id;
  for (let i = 0; i < 20; i++) {
    try {
      db.prepare("UPDATE users SET student_id = ? WHERE id = ? AND student_id IS NULL").run(randomStudentId(), uid);
      break;
    } catch (error) {
      if (!isUniqueError(error)) throw error;
      // that random ID is already taken: try another one
    }
  }
  const after = read();
  return after ? after.student_id : null;
}

module.exports = { isVerified, requireVerified, randomStudentId, studentIdFromUsername, ensureStudentId, isUniqueError };
