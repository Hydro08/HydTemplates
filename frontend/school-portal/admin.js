/* Admin page. Only the admin gets here (the check is also at the top of admin.html).
   The user, sign out and the menu live in session.js and menu.js.
   DEMO_MODE: the students are read from this browser's localStorage (accounts + profiles made in Sign up / Profile).
   With a real backend: GET {API_BASE_URL}/admin-students must return [{ username, student_id, name, section, verified }]
   and DELETE {API_BASE_URL}/admin-students?username=... removes one. The server must check that the user is an admin. */
document.getElementById("year").textContent = new Date().getFullYear();

/* Only the admin stays here. In DEMO_MODE the role is the one saved at sign in; with a backend it is asked from the server (/me),
   so an account you just made admin in the database works after a refresh. Everybody else goes to the student portal. */
const adminReady = verifySession().then(u => {
  if (!u) return false;
  if (u.role !== "admin") { location.replace("portal.html"); return false; }
  document.documentElement.style.visibility = "";
  return true;
});

/* ---------- Views (#overview, #students, #announcements) ---------- */
const VIEWS = ["overview", "students", "announcements"];
const TITLES = { overview: "Overview", students: "Students", announcements: "Announcements" };
function showView() {
  let v = location.hash.slice(1);
  if (!VIEWS.includes(v)) v = "overview";
  VIEWS.forEach(id => { document.getElementById(id).hidden = id !== v; });
  document.querySelectorAll("#sideMenu a[data-view]").forEach(a => {
    if (a.dataset.view === v) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  document.title = `${TITLES[v]} | Admin`;
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", showView);

/* ---------- Students ---------- */
let students = [];
async function loadStudents() {
  if (DEMO_MODE) {
    const list = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith("portalAccount:")) continue;
      try {
        const acct = JSON.parse(localStorage.getItem(k));
        const prof = JSON.parse(localStorage.getItem("portalProfile:" + acct.username.toLowerCase())) || {};
        const name = [prof.first_name, prof.middle_name, prof.last_name].filter(Boolean).join(" ");
        const complete = typeof PROFILE_FIELDS !== "undefined" ? PROFILE_FIELDS.every(f => String(prof[f] ?? "").trim() !== "") : !!name;
        list.push({ username: acct.username, student_id: acct.studentId, name: name || acct.username, section: prof.section || "-", verified: complete });
      } catch {}
    }
    return list;
  }
  try {
    const res = await fetch(`${API_BASE_URL}/admin-students`);
    if (!res.ok) throw new Error();
    return await res.json();
  } catch { return null; }
}

function renderStudents() {
  const q = document.getElementById("studentSearch").value.trim().toLowerCase();
  const f = document.getElementById("studentFilter").value;
  const rows = students.filter(s =>
    (f === "all" || (f === "verified") === !!s.verified) &&
    [s.name, s.student_id, s.username].some(v => String(v || "").toLowerCase().includes(q)));
  document.getElementById("studentsBody").innerHTML = rows.length ? rows.map(s => `
    <tr>
      <td data-label="Name">${escapeHtml(s.name)}</td>
      <td data-label="Student ID">${escapeHtml(s.student_id)}</td>
      <td data-label="Course / Strand">${escapeHtml(s.section || "-")}</td>
      <td data-label="Status"><span class="badge ${s.verified ? "ready" : "progress"}">${s.verified ? "Verified" : "Not verified"}</span></td>
      <td data-label="Action"><button type="button" class="btn danger" data-delete="${escapeHtml(s.username)}">Delete</button></td>
    </tr>`).join("") : '<tr><td class="empty">No students found.</td></tr>';
}

document.getElementById("studentsBody").addEventListener("click", async e => {
  const btn = e.target.closest("[data-delete]");
  if (!btn) return;
  const username = btn.dataset.delete;
  if (!confirm(`Delete the account "${username}"? This cannot be undone.`)) return;
  if (DEMO_MODE) {
    const key = username.toLowerCase();
    const acct = getDemoAccount(username);
    ["portalAccount:", "portalProfile:", "portalProfileDraft:"].forEach(p => localStorage.removeItem(p + key));
    if (acct) localStorage.removeItem("portalStudentId:" + key);
  } else {
    try {
      const res = await fetch(`${API_BASE_URL}/admin-students?username=${encodeURIComponent(username)}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch { alert("Could not delete the account."); return; }
  }
  await refreshStudents();
});
document.getElementById("studentSearch").addEventListener("input", renderStudents);
document.getElementById("studentFilter").addEventListener("change", renderStudents);

/* ---------- Announcements (shown on portal.html; saved in localStorage in demo mode) ---------- */
const DEFAULT_ANNOUNCEMENTS = [
  { title: "Enrollment is open", text: "Bring your report card and a valid ID to the registrar." },
  { title: "Midterm exam week", text: "Check the schedule of each subject." },
  { title: "Library hours extended", text: "Open until 6:00 PM on weekdays." }
];
let announcements = DEFAULT_ANNOUNCEMENTS.slice();
try { const s = JSON.parse(localStorage.getItem("portalAnnouncements")); if (Array.isArray(s)) announcements = s; } catch {}
function saveAnnouncements() { try { localStorage.setItem("portalAnnouncements", JSON.stringify(announcements)); } catch {} }

function renderAnnouncements() {
  document.getElementById("annList").innerHTML = announcements.length ? announcements.map((a, i) => `
    <li class="card">
      <h3>${escapeHtml(a.title)}</h3>
      <p class="muted">${escapeHtml(a.text)}</p>
      <button type="button" class="btn danger" data-remove="${i}">Remove</button>
    </li>`).join("") : '<li class="empty">No announcements yet.</li>';
}
document.getElementById("annList").addEventListener("click", e => {
  const b = e.target.closest("[data-remove]");
  if (!b) return;
  announcements.splice(Number(b.dataset.remove), 1);
  saveAnnouncements(); renderAnnouncements(); renderStats();
});
document.getElementById("announceForm").addEventListener("submit", e => {
  e.preventDefault();
  const title = document.getElementById("annTitle"), text = document.getElementById("annText"), msg = document.getElementById("annMsg");
  if (!title.value.trim() || !text.value.trim()) { msg.className = "form-msg error"; msg.textContent = "Fill in the title and the message."; return; }
  announcements.unshift({ title: title.value.trim(), text: text.value.trim() });
  saveAnnouncements(); renderAnnouncements(); renderStats();
  e.target.reset();
  msg.className = "form-msg ok"; msg.textContent = "Posted. Students see it on their dashboard.";
});

/* ---------- Overview ---------- */
function renderStats() {
  const total = students.length, ok = students.filter(s => s.verified).length;
  document.getElementById("statCards").innerHTML = [
    ["Students", total], ["Verified", ok], ["Not verified", total - ok], ["Announcements", announcements.length]
  ].map(([label, n]) => `<li class="card"><span class="muted">${label}</span><strong>${n}</strong></li>`).join("");
}

async function refreshStudents() {
  const list = await loadStudents();
  const note = document.getElementById("studentsNote");
  if (list === null) {
    students = [];
    note.textContent = "Could not load the students. Check that your backend has GET /admin-students (see the top of admin.js).";
  } else {
    students = list;
    note.textContent = DEMO_MODE ? "Demo mode: these are the accounts made in this browser." : "All registered students.";
  }
  renderStudents(); renderStats();
}

adminReady.then(ok => {
  if (!ok) return;
  showView();
  renderAnnouncements();
  refreshStudents();
});
