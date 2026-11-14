/**
 * Profile of the school portal. An account is verified when it has a complete profile.
 *   GET  /api/profile -> {verified, profile, student_id}
 *   POST /api/profile -> saves the profile. When every required field is filled in and valid, the account is verified.
 * The Student ID is not part of the form: it is assigned automatically (see randomStudentId() in ../helpers.js).
 * YEAR_LEVELS must match the <select> in frontend/school-portal/profile.html,
 * and FIELDS must match the inputs there and the columns of `profiles` in ../db.js.
 */
const { requireUser, jsonOnly } = require("./auth");
const { ensureStudentId } = require("../helpers");

const YEAR_LEVELS = [
  "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12",
  "1st Year", "2nd Year", "3rd Year", "4th Year",
];
const FIELDS = [
  "birthdate", "year_level", "section",
  "email", "phone", "street", "barangay", "city", "province", "zip",
  "father_name", "father_occupation", "father_phone",
  "mother_name", "mother_occupation", "mother_phone",
];
// [min, max] length of the plain text fields
const TEXT_LIMITS = {
  section: [1, 100], street: [3, 150], barangay: [2, 100], city: [2, 100], province: [2, 100],
  father_name: [2, 200], father_occupation: [2, 100],
  mother_name: [2, 200], mother_occupation: [2, 100],
};
const PHONE_FIELDS = ["phone", "father_phone", "mother_phone"];

/** Returns [field, message] for the first problem, or null when everything is fine. */
function validateProfile(p) {
  for (const f of FIELDS) if (p[f] === "") return [f, "This field is required."];

  const d = new Date(p.birthdate + "T00:00:00Z");
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(p.birthdate) && !Number.isNaN(d.getTime()) &&
    d.toISOString().slice(0, 10) === p.birthdate;
  const today = new Date().toISOString().slice(0, 10);
  if (!validDate || p.birthdate > today || p.birthdate < "1900-01-01") return ["birthdate", "Enter a valid birthdate."];

  if (!YEAR_LEVELS.includes(p.year_level)) return ["year_level", "Select a year level."];
  if (p.email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) return ["email", "Enter a valid email address."];
  for (const f of PHONE_FIELDS) {
    if (!/^[0-9+\-\s()]{7,20}$/.test(p[f]) || p[f].replace(/\D/g, "").length < 7) return [f, "Enter a valid contact number."];
  }
  if (!/^[A-Za-z0-9 -]{3,10}$/.test(p.zip)) return ["zip", "Enter a valid ZIP code."];
  for (const [f, [min, max]] of Object.entries(TEXT_LIMITS)) {
    const len = [...p[f]].length;
    if (len < min || len > max) return [f, `Must be ${min}-${max} characters.`];
  }
  return null;
}

function register(router, db) {
  router.get("/profile", requireUser, (req, res) => {
    const uid = req.session.uid;
    const profile = db.prepare(`SELECT ${FIELDS.join(", ")} FROM profiles WHERE user_id = ?`).get(uid);
    res.json({ verified: Boolean(profile), profile: profile ? { ...profile } : null, student_id: ensureStudentId(db, uid) });
  });

  router.post("/profile", requireUser, (req, res) => {
    if (!jsonOnly(req, res)) return;
    const uid = req.session.uid;
    const body = req.body || {};
    const p = {};
    for (const f of FIELDS) p[f] = typeof body[f] === "string" ? body[f].trim() : "";

    const problem = validateProfile(p);
    if (problem) return res.status(422).json({ field: problem[0], message: problem[1] });

    // Column names come from the FIELDS list above, never from user input.
    const cols = FIELDS.join(", ");
    const marks = FIELDS.map(() => "?").join(", ");
    const update = FIELDS.map(f => `${f} = excluded.${f}`).join(", ");
    try {
      db.prepare(
        `INSERT INTO profiles (user_id, ${cols}) VALUES (?, ${marks})
         ON CONFLICT(user_id) DO UPDATE SET ${update}, updated_at = datetime('now')`
      ).run(uid, ...FIELDS.map(f => p[f]));
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Server error." });
    }
    res.json({ verified: true, profile: p, student_id: ensureStudentId(db, uid) });
  });
}

module.exports = { register, validateProfile, FIELDS, YEAR_LEVELS };
