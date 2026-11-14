/* DEMO_MODE and API_BASE_URL live in shared/js/config.js.
   DEMO_MODE = true: any username and password is accepted as long as they are not empty.
   A new account (or a username with no profile yet) goes to profile.html first to get verified. */

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

// Already signed in? Go straight to the portal
try { const u = JSON.parse(sessionStorage.getItem("portalUser")); if (u) location.replace(u.role === "admin" ? "admin.html" : "portal.html"); } catch {}

/* ---------- Toast (bottom right, kusang mawawala after 2 seconds) ---------- */
const toastBox = document.getElementById("toasts");
const SHOW_MS = 2000; // also used for the red text field
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function dismissToast(el, instant = false) {
  if (!el.isConnected || el.dataset.leaving) return;
  el.dataset.leaving = "1";
  if (instant || reducedMotion) { el.remove(); return; }
  el.style.transition = "transform .25s ease, opacity .25s ease";
  el.style.transform = "translateX(120%)";
  el.style.opacity = "0";
  setTimeout(() => el.remove(), 260);
}

function showToast(text, kind = "info", ms = SHOW_MS) {
  // avoid repeating the same toast, and show at most 3 on screen
  [...toastBox.children].forEach(t => { if (t.dataset.text === text) dismissToast(t, true); });
  while (toastBox.children.length >= 3) dismissToast(toastBox.firstElementChild, true);

  const el = document.createElement("div");
  el.className = "toast " + kind;
  el.dataset.text = text;
  el.textContent = text;
  toastBox.append(el);

  setTimeout(() => dismissToast(el), ms);
}

/* ---------- Red text field when something is wrong (goes away after 2 seconds) ---------- */
const invalidTimers = new Map();

function markInvalid(input, invalid = true) {
  clearTimeout(invalidTimers.get(input));
  invalidTimers.delete(input);

  if (invalid) {
    input.setAttribute("aria-invalid", "true");
    invalidTimers.set(input, setTimeout(() => input.removeAttribute("aria-invalid"), SHOW_MS));
  } else {
    input.removeAttribute("aria-invalid");
  }
}

function clearInvalid(form) {
  form.querySelectorAll("input").forEach(i => markInvalid(i, false));
}

document.querySelectorAll(".glass input").forEach(input =>
  input.addEventListener("input", () => markInvalid(input, false))
);

function focusFirstInvalid(form) {
  const first = form.querySelector('input[aria-invalid="true"]');
  if (first) first.focus();
}

/* ---------- Sign in <-> Sign up ---------- */
const card = document.getElementById("authCard");
const infoTitle = document.getElementById("infoTitle");
const infoText = document.getElementById("infoText");
const switchBtn = document.getElementById("switchBtn");

const resetForm = document.getElementById("resetForm");
const INFO = {
  reset: {
    title: "Remembered your password?",
    text: "Go back and sign in.",
    button: "Sign in"
  },
  login: {
    title: "Don't have an account yet?",
    text: "Create an account to see your announcements and class schedule.",
    button: "Sign up"
  },
  register: {
    title: "Already have an account?",
    text: "Sign in to continue using the portal.",
    button: "Sign in"
  }
};

/* The reset password view stays on this page: only the address changes to ...#reset-password (no new page opens). */
const RESET_HASH = "#reset-password";
function showForm(which, updateUrl = true) {
  card.classList.toggle("is-signup", which === "register");
  loginForm.inert = which !== "login";
  registerForm.inert = which !== "register";
  resetForm.inert = which !== "reset";
  infoTitle.textContent = INFO[which].title;
  infoText.textContent = INFO[which].text;
  switchBtn.textContent = INFO[which].button;
  switchBtn.dataset.next = which === "login" ? "register" : "login";
  if (updateUrl) {
    const wanted = which === "reset" ? RESET_HASH : "";
    if (location.hash !== wanted) history.pushState(null, "", location.pathname + location.search + wanted);
  }
  const form = { login: loginForm, register: registerForm, reset: resetForm }[which];
  [...form.querySelectorAll("input")].find(i => !i.closest("[hidden]")).focus({ preventScroll: true });
}

switchBtn.dataset.next = "register";
switchBtn.addEventListener("click", () => showForm(switchBtn.dataset.next));

/* ---------- Show / Hide password ---------- */
document.querySelectorAll(".toggle").forEach(btn =>
  btn.addEventListener("click", () => {
    const input = document.getElementById(btn.dataset.target);
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.textContent = show ? "Hide" : "Show";
    btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
  })
);

/* Live checklist under the sign up password (8+ characters, uppercase, number, special character) */
bindPasswordChecklist(registerForm.password, document.getElementById("regRules"));

/* ---------- Backend helpers ---------- */
async function postJson(path, body) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  let data = {};
  try { data = await res.json(); } catch {}
  return { ok: res.ok, status: res.status, data };
}

/* Not verified yet (no complete profile)? Go to the profile page first */
function startSession(user) {
  sessionStorage.setItem("portalUser", JSON.stringify(user));
  location.href = user.role === "admin" ? "admin.html" : (user.verified ? "portal.html" : "profile.html");
}

/* ---------- SIGN IN ---------- */
loginForm.addEventListener("submit", async e => {
  e.preventDefault();
  clearInvalid(loginForm);

  const userInput = loginForm.username;
  const passInput = loginForm.password;
  const username = userInput.value.trim();
  const password = passInput.value;

  markInvalid(userInput, !username);
  markInvalid(passInput, !password);

  if (!username || !password) {
    showToast("Fill in the fields marked in red.", "error");
    focusFirstInvalid(loginForm);
    return;
  }

  if (DEMO_MODE) {
    // Demo accounts live in this browser: sign in only works with the account (and password) made in Sign up.
    // The username OR the Student ID can be used.
    if (username.toLowerCase() === DEMO_ADMIN.username.toLowerCase() && password === DEMO_ADMIN.password) {
      startSession({ username: DEMO_ADMIN.username, name: "Administrator", role: "admin", verified: true });
      return;
    }
    const acct = getDemoAccount(username);
    let okPass = false;
    try { okPass = await verifyDemoPassword(acct, password); } catch {}
    if (!acct || !okPass) {
      markInvalid(userInput);
      markInvalid(passInput);
      showToast("Wrong username or password.", "error");
      return;
    }
    const saved = getDemoProfile(acct.username);   // a returning demo user: use the name saved in the profile
    startSession({ username: acct.username, name: (saved && composeName(saved)) || acct.username,
                   last_name: saved?.last_name || "", first_name: saved?.first_name || "", middle_name: saved?.middle_name || "",
                   verified: isProfileComplete(saved), studentId: acct.studentId });
    return;
  }

  const submitBtn = loginForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const { ok, data } = await postJson("/login", { username, password });
    if (ok) {
      startSession({ username, role: data.role === "admin" ? "admin" : "student", name: data.name || username, last_name: data.last_name || "", first_name: data.first_name || "",
                     middle_name: data.middle_name || "", verified: !!data.verified, studentId: data.student_id });
    } else {
      markInvalid(userInput);
      markInvalid(passInput);
      showToast(data.message || "Wrong username or password.", "error");
    }
  } catch {
    showToast("Cannot reach the server.", "error");
  } finally {
    submitBtn.disabled = false;
  }
});

/* ---------- SIGN UP ---------- */
const NAME_OK = /^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u;   // letters, spaces and . ' - (no digits)
registerForm.addEventListener("submit", async e => {
  e.preventDefault();
  clearInvalid(registerForm);

  const lastInput = registerForm.last_name;
  const firstInput = registerForm.first_name;
  const middleInput = registerForm.middle_name;
  const passInput = registerForm.password;
  const pass2Input = registerForm.password2;

  const last_name = lastInput.value.trim();
  const first_name = firstInput.value.trim();
  const middle_name = middleInput.value.trim();   // optional
  const name = composeName({ last_name, first_name, middle_name });
  const password = passInput.value;

  markInvalid(lastInput, !last_name);
  markInvalid(firstInput, !first_name);
  markInvalid(passInput, !password);
  markInvalid(pass2Input, !pass2Input.value);

  if (!last_name || !first_name || !password || !pass2Input.value) {
    showToast("Fill in the fields marked in red.", "error");
    focusFirstInvalid(registerForm);
    return;
  }
  for (const [input, v] of [[lastInput, last_name], [firstInput, first_name], [middleInput, middle_name]]) {
    if (v && !NAME_OK.test(v)) {
      markInvalid(input);
      showToast("Names can only have letters, spaces and . ' -", "error");
      input.focus();
      return;
    }
  }
  const problems = passwordProblems(password);   // 8+ characters, uppercase, number, special character
  if (problems.length) {
    markInvalid(passInput);
    showToast(passwordProblemsText(problems), "error", 4500);
    passInput.focus();
    return;
  }
  if (password !== pass2Input.value) {
    markInvalid(passInput);
    markInvalid(pass2Input);
    showToast("Passwords do not match.", "error");
    pass2Input.focus();
    return;
  }

  // The username is made automatically (year + surname + random number, e.g. 2026Pogi32198) and shown on the profile page
  let username = generateUsername(last_name);

  if (DEMO_MODE) {
    // Demo: the account (with a hashed password) is saved in this browser so Sign in can check it. A new account is not verified yet.
    while (getDemoAccount(username)) username = generateUsername(last_name);   // keep the username unique
    const acct = await createDemoAccount(username, password, getDemoStudentId(username));   // the Student ID is assigned automatically
    startSession({ username, name, last_name, first_name, middle_name, verified: false, studentId: acct.studentId });
    return;
  }

  const submitBtn = registerForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    let { ok, status, data } = await postJson("/register", { name, last_name, first_name, middle_name, username, password });
    // 409 = that username is already taken: make another one (new random number) a few times
    for (let tries = 0; !ok && status === 409 && tries < 5; tries++) {
      username = generateUsername(last_name);
      ({ ok, status, data } = await postJson("/register", { name, last_name, first_name, middle_name, username, password }));
    }
    if (ok) {
      registerForm.reset();
      showForm("login");
      loginForm.username.value = username;   // the student signs in with this username
      showToast(`Account created. Your username is ${username}` + (data.student_id ? ` and your Student ID is ${data.student_id}` : "") + ". You can sign in now.", "ok", 10000);
    } else {
      showToast(data.message || "Could not create the account.", "error");
    }
  } catch {
    showToast("Cannot reach the server.", "error");
  } finally {
    submitBtn.disabled = false;
  }
});

/* ---------- Reset password ----------
   Step 1 (request): the person types their username, Student ID or email.
     Real backend: POST API_BASE_URL + "/forgot-password" with { identifier }. YOU add this endpoint: it sends an email with a link like
     https://your-site/index.html?token=THE_TOKEN#reset-password. Always answer 200 with the same message, so nobody can find out which accounts exist.
   Step 2 (set): the link above opens this same form with the new password fields (the token is read from ?token=).
     Real backend: POST API_BASE_URL + "/reset-password" with { token, password }. YOU add this endpoint: check the token (one use, short expiry)
     and the same password rules as sign up. Answer 400 or 410 when the token is wrong or expired.
   Demo mode: no email is sent. The account must exist in this browser, then the new password fields open right away. */
const resetRequest = document.getElementById("resetRequest");
const resetSet = document.getElementById("resetSet");
const resetSubmit = document.getElementById("resetSubmit");
const resetId = document.getElementById("resetId");
const resetNew = document.getElementById("resetNew");
const resetNew2 = document.getElementById("resetNew2");
const resetToken = new URLSearchParams(location.search).get("token") || "";
let resetDemoUser = null;   // demo mode: the account found in step 1

bindPasswordChecklist(resetNew, document.getElementById("resetRules"));

function setResetStep(step) {
  resetRequest.hidden = step !== "request";
  resetSet.hidden = step !== "set";
  resetSubmit.textContent = step === "set" ? "Save new password" : "Send reset link";
  (step === "set" ? resetNew : resetId).focus({ preventScroll: true });
}

function openReset() {
  resetDemoUser = null;
  setResetStep(resetToken ? "set" : "request");
  showForm("reset");
}
document.getElementById("forgotBtn").addEventListener("click", openReset);

resetForm.addEventListener("submit", async e => {
  e.preventDefault();
  clearInvalid(resetForm);
  const step = resetSet.hidden ? "request" : "set";
  resetSubmit.disabled = true;
  try {
    if (step === "request") {
      const identifier = resetId.value.trim();
      markInvalid(resetId, !identifier);
      if (!identifier) { focusFirstInvalid(resetForm); return showToast("Enter your username, Student ID or email.", "error"); }
      if (DEMO_MODE) {
        const acct = getDemoAccount(identifier);
        if (!acct) return showToast("No account with that username or Student ID in this browser.", "error");
        resetDemoUser = acct.username;
        setResetStep("set");
        return showToast("Demo mode: no email is sent. Choose a new password.", "info", 6000);
      }
      const { ok, data } = await postJson("/forgot-password", { identifier });
      if (!ok) return showToast(data.message || "Could not send the reset link. Try again.", "error");
      showToast("If an account matches, we sent a reset link to its email.", "ok", 9000);
      return;
    }

    const password = resetNew.value;
    const problems = passwordProblems(password);
    const mismatch = password !== resetNew2.value;
    markInvalid(resetNew, problems.length > 0);
    markInvalid(resetNew2, !problems.length && mismatch);
    if (problems.length) { focusFirstInvalid(resetForm); return showToast(passwordProblemsText(problems), "error"); }
    if (mismatch) { focusFirstInvalid(resetForm); return showToast("The passwords do not match.", "error"); }

    if (DEMO_MODE) {
      if (!resetDemoUser || !(await setDemoPassword(resetDemoUser, password))) return showToast("Could not save the new password.", "error");
    } else {
      const { ok, data } = await postJson("/reset-password", { token: resetToken, password });
      if (!ok) return showToast(data.message || "This reset link is invalid or has expired. Ask for a new one.", "error");
    }
    resetForm.reset();
    resetNew.dispatchEvent(new Event("input"));   // reset the checklist
    history.replaceState(null, "", location.pathname);   // remove ?token= from the address
    showForm("login");
    showToast("Password updated. Sign in with your new password.", "ok", 8000);
  } catch {
    showToast("Cannot reach the server.", "error");
  } finally {
    resetSubmit.disabled = false;
  }
});

/* The address decides the view: ...#reset-password opens the reset form (also from the email link, and with the Back button) */
function syncWithAddress() {
  if (location.hash === RESET_HASH) { setResetStep(resetToken || resetDemoUser ? "set" : "request"); showForm("reset", false); }
  else showForm("login", false);
}
window.addEventListener("popstate", syncWithAddress);
if (location.hash === RESET_HASH) syncWithAddress();
