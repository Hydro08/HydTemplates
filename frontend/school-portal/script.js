/* Sample data. Once there is a backend, replace it with fetch(API_BASE_URL + "/schedule"). */
const schedule = [
  { subject: "Mathematics", day: "Mon / Wed", time: "8:00 - 9:30 AM", room: "Room 101" },
  { subject: "English", day: "Tue / Thu", time: "9:30 - 11:00 AM", room: "Room 204" },
  { subject: "Science", day: "Mon / Wed", time: "1:00 - 2:30 PM", room: "Lab 2" },
  { subject: "Computer Programming", day: "Fri", time: "8:00 - 11:00 AM", room: "Comp Lab" }
];

document.getElementById("scheduleBody").innerHTML = schedule.map(s => `
  <tr>
    <td>${escapeHtml(s.subject)}</td>
    <td>${escapeHtml(s.day)}</td>
    <td>${escapeHtml(s.time)}</td>
    <td>${escapeHtml(s.room)}</td>
  </tr>`).join("");

document.getElementById("year").textContent = new Date().getFullYear();

const form = document.getElementById("loginForm");
const message = document.getElementById("loginMessage");

form.addEventListener("submit", async e => {
  e.preventDefault();
  const username = form.username.value.trim();
  const password = form.password.value;

  if (!username || !password) {
    message.textContent = "Enter your username and password.";
    return;
  }

  message.textContent = "Nagla-log in…";
  try {
    const res = await fetch(`${API_BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    message.textContent = res.ok
      ? "Naka-log in ka na."
      : (data.message || "Wrong username or password.");
  } catch {
    message.textContent = "Cannot reach the server. Is the backend running?";
  }
});
