/* Used by portal.html and profile.html: the user, sign out and session checking. */
let user = {};
try { user = JSON.parse(sessionStorage.getItem("portalUser")) || {}; } catch {}

function saveUser(next) {
  user = next;
  sessionStorage.setItem("portalUser", JSON.stringify(user));
}

function renderUser() {
  const welcome = document.getElementById("welcome");
  if (welcome) welcome.textContent = `Welcome, ${user.name || user.username || "student"}`;
  document.getElementById("userName").textContent = user.username || "";
  const menuName = document.getElementById("menuUserName");
  if (menuName) menuName.textContent = user.name || user.username || "";
}
renderUser();

function signOutLocal() {
  sessionStorage.removeItem("portalUser");
  location.replace("index.html");
}

/* With a real backend, make sure the session is still valid and get `verified` (not just sessionStorage).
   Returns the user, or null if the page was redirected to sign in. */
async function verifySession() {
  if (DEMO_MODE) return user;
  try {
    const res = await fetch(`${API_BASE_URL}/me`);
    if (!res.ok) throw new Error("not signed in");
    const data = await res.json();
    saveUser({ role: data.role || "student", username: data.username, name: data.name, last_name: data.last_name || "", first_name: data.first_name || "", middle_name: data.middle_name || "", verified: !!data.verified, studentId: data.student_id });
    renderUser();
    return user;
  } catch {
    signOutLocal();
    return null;
  }
}

document.getElementById("logoutBtn").addEventListener("click", async () => {
  if (!DEMO_MODE) {
    try {
      await fetch(`${API_BASE_URL}/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      });
    } catch {}
  }
  sessionStorage.removeItem("portalUser");
  location.href = "index.html";
});
