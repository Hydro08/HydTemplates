/* Admin only. GET /api/admin-students -> [{ username, student_id, name, section, verified }]
   DELETE /api/admin-students?username=... -> deletes a student (an admin account cannot be deleted here). */
const { requireAdmin } = require("./auth");

function register(router, db) {
  router.get("/admin-students", requireAdmin(db), (req, res) => {
    const rows = db.prepare(
      `SELECT u.username, u.student_id, u.name, p.section, (p.user_id IS NOT NULL) AS verified
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.role <> 'admin' ORDER BY u.id DESC`
    ).all();
    res.json(rows.map(r => ({ ...r, verified: Boolean(r.verified) })));
  });

  router.delete("/admin-students", requireAdmin(db), (req, res) => {
    const username = String(req.query.username ?? "").trim();
    if (!username) return res.status(422).json({ message: "Missing username." });
    const result = db.prepare("DELETE FROM users WHERE username = ? AND role <> 'admin'").run(username);
    if (!result.changes) return res.status(404).json({ message: "Student not found." });
    res.json({ message: "Student deleted." });
  });
}

module.exports = { register };
