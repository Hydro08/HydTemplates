/* The user, sign out and verifySession() live in session.js; the menu in menu.js. The account must be verified to enter this page.
   One page, five views (Dashboard, Enrollment, Schedule, Grades, Calendar events) chosen by the #hash in the menu links. */
document.getElementById("year").textContent = new Date().getFullYear();

verifySession().then(u => {
  if (u && u.role === "admin") location.replace("admin.html");   // the role comes from the server: an admin never stays on the student pages
  else if (u && !u.verified) location.replace("profile.html");
});

/* ---------- Views ---------- */
const VIEWS = ["dashboard", "enrollment", "schedule", "grades", "calendar"];
const TITLES = { dashboard: "Dashboard", enrollment: "Enrollment", schedule: "Schedule", grades: "Grades", calendar: "Calendar events" };

function showView() {
  let v = location.hash.slice(1);
  if (!VIEWS.includes(v)) v = "dashboard";
  VIEWS.forEach(id => { document.getElementById(id).hidden = id !== v; });
  document.querySelectorAll("#sideMenu a[data-view]").forEach(a => {
    if (a.dataset.view === v) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  document.title = `${TITLES[v]} | School Portal`;
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", showView);
showView();

/* ---------- Sample data. Replace it with fetch(API_BASE_URL + "/schedule") etc. once you add the endpoints. ---------- */
const schedule = [
  { subject: "Mathematics", day: "Mon / Wed", time: "8:00 - 9:30 AM", room: "Room 101" },
  { subject: "English", day: "Tue / Thu", time: "9:30 - 11:00 AM", room: "Room 204" },
  { subject: "Science", day: "Mon / Wed", time: "1:00 - 2:30 PM", room: "Lab 2" },
  { subject: "Computer Programming", day: "Fri", time: "8:00 - 11:00 AM", room: "Comp Lab" }
];

const grades = [
  { course: "Mathematics", prelim: 88, midterm: 90, final: 91 },
  { course: "English", prelim: 85, midterm: 87, final: 89 },
  { course: "Science", prelim: 90, midterm: 92, final: 94 },
  { course: "Computer Programming", prelim: 95, midterm: 96, final: 97 }
];

const enrollSteps = [
  { title: "Report card", text: "Submit a copy of your report card to the registrar.", done: true },
  { title: "Valid ID", text: "Bring one valid ID for verification.", done: true },
  { title: "Tuition and fees", text: "Settle your balance at the cashier.", done: false }
];

const daysFromToday = n => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
const events = [
  { date: daysFromToday(3),  title: "Midterm exams begin",    time: "8:00 AM",  place: "All rooms" },
  { date: daysFromToday(9),  title: "Parent-teacher meeting", time: "1:00 PM",  place: "Gymnasium" },
  { date: daysFromToday(15), title: "Science fair",           time: "9:00 AM",  place: "Main hall" },
  { date: daysFromToday(24), title: "Intramurals opening",    time: "7:30 AM",  place: "Oval" }
];

/* ---------- Render ---------- */
document.getElementById("scheduleBody").innerHTML = schedule.map(s => `
  <tr>
    <td data-label="Subject">
      <button type="button" class="subject-toggle" aria-expanded="false">
        <span>${escapeHtml(s.subject)}</span>
      </button>
    </td>
    <td data-label="Day" class="detail">${escapeHtml(s.day)}</td>
    <td data-label="Time" class="detail">${escapeHtml(s.time)}</td>
    <td data-label="Room" class="detail">${escapeHtml(s.room)}</td>
  </tr>`).join("");

document.getElementById("gradesBody").innerHTML = grades.map(g => `
  <tr>
    <td data-label="Course">${escapeHtml(g.course)}</td>
    <td data-label="Prelim">${g.prelim}</td>
    <td data-label="Midterm">${g.midterm}</td>
    <td data-label="Final">${g.final}</td>
    <td data-label="Remarks">${g.final >= 75 ? "Passed" : "Failed"}</td>
  </tr>`).join("");

document.getElementById("enrollId").textContent = user.studentId || "-";
const y = new Date().getFullYear();
document.getElementById("enrollYear").textContent = `${y} - ${y + 1}`;
document.getElementById("enrollSteps").innerHTML = enrollSteps.map(s => `
  <li class="card">
    <h3>${escapeHtml(s.title)} <span class="badge ${s.done ? "ready" : "progress"}">${s.done ? "Done" : "Pending"}</span></h3>
    <p class="muted">${escapeHtml(s.text)}</p>
  </li>`).join("");

/* ---------- Calendar: a real month grid. Click a date to see its events in a modal. ---------- */
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const eventsOn = key => events.filter(ev => ymd(ev.date) === key);
let shown = new Date(); shown.setDate(1);
const calGrid = document.getElementById("calGrid");
const calModal = document.getElementById("calModal");

function renderCalendar() {
  const y = shown.getFullYear(), m = shown.getMonth();
  document.getElementById("calTitle").textContent = shown.toLocaleString("en", { month: "long", year: "numeric" });
  const lead = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate(), today = ymd(new Date());
  let html = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => `<div class="cal-dow" aria-hidden="true">${d}</div>`).join("");
  html += '<div class="cal-blank"></div>'.repeat(lead);
  for (let d = 1; d <= days; d++) {
    const key = ymd(new Date(y, m, d)), n = eventsOn(key).length;
    html += `<button type="button" class="cal-day${key === today ? " today" : ""}${n ? " has-event" : ""}" data-date="${key}"
      aria-label="${new Date(y, m, d).toLocaleDateString("en", { dateStyle: "full" })}${n ? `, ${n} event${n > 1 ? "s" : ""}` : ""}">
      <span>${d}</span>${n ? `<i class="cal-dot" aria-hidden="true"></i>` : ""}</button>`;
  }
  calGrid.innerHTML = html;
}

function openDay(key) {
  const [y, mo, d] = key.split("-").map(Number), list = eventsOn(key);
  document.getElementById("calModalTitle").textContent = new Date(y, mo - 1, d).toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  document.getElementById("calModalBody").innerHTML = list.length ? list.map(ev => `
    <div class="cal-event">
      <h3>${escapeHtml(ev.title)}</h3>
      <p class="muted">${escapeHtml(ev.time)} &middot; ${escapeHtml(ev.place)}</p>
    </div>`).join("") : '<p class="muted">No events on this day.</p>';
  calModal.showModal();
}

calGrid.addEventListener("click", e => { const b = e.target.closest("[data-date]"); if (b) openDay(b.dataset.date); });
document.getElementById("calPrev").onclick = () => { shown.setMonth(shown.getMonth() - 1); renderCalendar(); };
document.getElementById("calNext").onclick = () => { shown.setMonth(shown.getMonth() + 1); renderCalendar(); };
document.getElementById("calToday").onclick = () => { shown = new Date(); shown.setDate(1); renderCalendar(); };
document.getElementById("calClose").onclick = () => calModal.close();
calModal.addEventListener("click", e => { if (e.target === calModal) calModal.close(); });   // click outside = close
renderCalendar();

/* Phones only: the schedule shows just the subjects; tap one to reveal its day, time and room.
   On larger screens it stays a normal table and the subject is not clickable. */
const phone = window.matchMedia("(max-width: 640px)");
const toggles = document.querySelectorAll(".subject-toggle");

toggles.forEach(btn => {
  btn.addEventListener("click", () => {
    if (!phone.matches) return;
    const row = btn.closest("tr");
    const open = row.classList.toggle("open");
    btn.setAttribute("aria-expanded", open);
  });
});

function syncToggles() {
  toggles.forEach(btn => {
    btn.tabIndex = phone.matches ? 0 : -1;
    if (!phone.matches) {
      btn.closest("tr").classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    }
  });
}
phone.addEventListener("change", syncToggles);
syncToggles();

/* Announcements: the admin manages them in admin.html (DEMO_MODE: saved in localStorage). Same default list as the admin page. */
const DEFAULT_ANNOUNCEMENTS = [
  { title: "Enrollment is open", text: "Bring your report card and a valid ID to the registrar." },
  { title: "Midterm exam week", text: "Check the schedule of each subject." },
  { title: "Library hours extended", text: "Open until 6:00 PM on weekdays." }
];
let announcements = DEFAULT_ANNOUNCEMENTS;
try { const saved = JSON.parse(localStorage.getItem("portalAnnouncements")); if (Array.isArray(saved)) announcements = saved; } catch {}
document.getElementById("announceList").innerHTML = announcements.length
  ? announcements.map(a => `<li class="card"><h3>${escapeHtml(a.title)}</h3><p class="muted">${escapeHtml(a.text)}</p></li>`).join("")
  : '<li class="muted">No announcements right now.</li>';
