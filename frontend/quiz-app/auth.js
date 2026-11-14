/* ==========================================================================
   auth.js  -  What happens on the sign in / sign up page (index.html)
   --------------------------------------------------------------------------
   Needs db.js (database, saveDatabase, getCurrentUser, SESSION_KEY) and
   toast.js (showToast) to be loaded first.

   Parts of this file:
     1. Small helpers
     2. Field checking
     3. Switching between the two pages of the book
     4. Show / hide password
     5. Sign in
     6. Sign up (students and teachers)
   ========================================================================== */


/* ---------- Setting ---------- */

/* true  = DEMO: any username and password signs in as a student.
           (A new username becomes a new student account automatically, and a known
           student can be opened with ANY password. Not safe!)
   false = STRICT: only accounts that already exist can sign in, with the right password.
           New students use "Create an account". */
const ANY_USER_CAN_SIGN_IN = false;


/* ---------- 1. Small helpers ---------- */

/* Shortcut: getById("signin-form") is the same as document.getElementById("signin-form") */
function getById(id) {
  return document.getElementById(id);
}

/* Already signed in? Go straight to the dashboard. */
if (getCurrentUser()) location.replace("dashboard.html");

/* The two pages of the book (see the ids in index.html) */
const signinPage = getById("signin-page");
const signupPage = getById("signup-page");


/* ---------- 2. Field checking ---------- */

/* (Toast messages like showToast(...) come from toast.js) */

/* How long the red error look stays on an input box (milliseconds) */
const INPUT_ERROR_TIME = 1500;
const inputErrorTimers = new Map();   // remembers each box's "remove the red look" timer

/* Put the red error look on an input box. It removes itself after INPUT_ERROR_TIME. */
function markInputInvalid(input) {
  clearTimeout(inputErrorTimers.get(input));            // restart the countdown if it was already red
  input.classList.add("invalid");
  input.setAttribute("aria-invalid", "true");
  inputErrorTimers.set(input, setTimeout(() => clearInputError(input), INPUT_ERROR_TIME));
}

/* Remove the red error look from an input box right now */
function clearInputError(input) {
  clearTimeout(inputErrorTimers.get(input));
  inputErrorTimers.delete(input);
  input.classList.remove("invalid");
  input.removeAttribute("aria-invalid");
}

/* Check some input boxes. Each rule looks like:
     { input: theInputBox, isInvalid: true or false, message: "text to show" }
   Boxes with a problem turn red for 1.5 seconds, and the FIRST problem is shown as a toast.
   Returns true when everything is fine, false when something is wrong. */
function validateFields(rules) {
  rules.forEach(rule => {
    if (rule.isInvalid) markInputInvalid(rule.input);
    else clearInputError(rule.input);
  });

  const firstProblem = rules.find(rule => rule.isInvalid);
  if (firstProblem) {
    showToast(firstProblem.message);
    firstProblem.input.focus();
  }
  return !firstProblem;
}

/* When the user types in a box, remove its red error look right away */
document.addEventListener("input", event => clearInputError(event.target));


/* ---------- 3. Switching between the two pages of the book ---------- */

/* Make one page active (usable) or inactive (blurred, cannot be typed in) */
function setPageActive(page, isActive) {
  page.classList.toggle("inactive", !isActive);
  page.querySelector("form").inert = !isActive;   // "inert" = cannot be clicked or tabbed into

  if (isActive) {
    page.tabIndex = -1;
    page.removeAttribute("role");
  } else {
    page.tabIndex = 0;                            // the blurred page works like a button
    page.setAttribute("role", "button");
  }
}

/* Show the sign up page (true) or the sign in page (false) */
function showPage(showSignup) {
  setPageActive(signinPage, !showSignup);
  setPageActive(signupPage, showSignup);

  /* Clear red error looks from the page we are leaving */
  document.querySelectorAll(".invalid").forEach(clearInputError);

  /* Focus the page itself, not an input, so nothing starts typing
     and the phone keyboard does not pop up */
  const newPage = showSignup ? signupPage : signinPage;
  newPage.focus({ preventScroll: true });
}

/* The links for phones: "Create an account" and "I already have an account" */
document.querySelectorAll("[data-switch-to]").forEach(link => {
  link.onclick = event => {
    event.stopPropagation();   // otherwise the click also reaches the page and switches back
    showPage(link.dataset.switchTo === "signup");
  };
});

/* Click (or press Enter on) the blurred page to switch to it */
[signinPage, signupPage].forEach(page => {
  const isInactive = () => page.classList.contains("inactive");
  const switchToThisPage = () => showPage(page === signupPage);

  /* Stop the mouse from focusing a field under the blurred page */
  page.addEventListener("mousedown", event => {
    if (isInactive()) event.preventDefault();
  });
  page.addEventListener("click", () => {
    if (isInactive()) switchToThisPage();
  });
  page.addEventListener("keydown", event => {
    if (event.key === "Enter" && event.target === page && isInactive()) switchToThisPage();
  });
});


/* ---------- 4. Show / hide password ---------- */

/* The eye button next to each password box.
   data-toggle-password="..." holds the id of the box it controls. */
document.querySelectorAll("[data-toggle-password]").forEach(button => {
  button.onclick = () => {
    const passwordInput = getById(button.dataset.togglePassword);
    const willShow = passwordInput.type === "password";

    passwordInput.type = willShow ? "text" : "password";
    button.setAttribute("aria-pressed", willShow);
    button.setAttribute("aria-label", willShow ? "Hide password" : "Show password");
  };
});


/* ---------- 5. Sign in ---------- */

/* The one and only admin account (set in db.js) */
function getAdminAccount() {
  return database.users.find(account => account.role === "admin");
}

/* Is this username the admin's? (Admin, ADMIN and admin all count.) */
function isAdminUsername(username) {
  const admin = getAdminAccount();
  return Boolean(admin) && username.toLowerCase() === admin.username.toLowerCase();
}

/* Find the account that matches what was typed, following the rules:
     - the admin and every teacher need the exact password
     - a student: in DEMO mode (ANY_USER_CAN_SIGN_IN) any password works,
       and a username that does not exist yet becomes a new student account
     - in STRICT mode the username AND password must match an existing account
   Returns the account, or undefined when sign in is not allowed. */
function findAccountForSignIn(username, password) {
  if (isAdminUsername(username)) {
    const admin = getAdminAccount();
    return admin.password === password ? admin : undefined;
  }

  const existing = database.users.find(account => account.username === username);

  /* A teacher account is never opened with just any password */
  if (existing && existing.role !== "student") {
    return existing.password === password ? existing : undefined;
  }

  if (!ANY_USER_CAN_SIGN_IN) {
    return existing && existing.password === password ? existing : undefined;
  }

  if (existing) return existing;   // known student: let them in

  /* New name: make a student account for it */
  const newStudent = { username, password, name: prettifyName(username), role: "student", teachers: [] };
  database.users.push(newStudent);
  saveDatabase(database);
  return newStudent;
}

getById("signin-form").onsubmit = event => {
  event.preventDefault();   // do not reload the page

  const usernameInput = getById("signin-username");
  const passwordInput = getById("signin-password");

  /* Step 1: both boxes must be filled in */
  const filledIn = validateFields([
    { input: usernameInput, isInvalid: !usernameInput.value.trim(), message: "Enter your username." },
    { input: passwordInput, isInvalid: !passwordInput.value,        message: "Enter your password." }
  ]);
  if (!filledIn) return;

  /* Step 2: is this person allowed in? (see findAccountForSignIn above) */
  const user = findAccountForSignIn(usernameInput.value.trim(), passwordInput.value);
  const accountFound = validateFields([
    { input: usernameInput, isInvalid: !user, message: "Wrong username or password." },
    { input: passwordInput, isInvalid: !user, message: "Wrong username or password." }
  ]);
  if (!accountFound) return;

  /* Success: remember who is logged in, then open the dashboard */
  setSessionUser(user.username);
  location.href = "dashboard.html";
};


/* ---------- 6. Sign up (students and teachers) ---------- */

/* Which one is picked: "student" or "teacher"? */
function getSelectedRole() {
  return document.querySelector('input[name="signup-role"]:checked').value;
}

/* Codes are compared without spaces or dashes, in capital letters ("teacher-1" = "TEACHER1") */
function normalizeCode(code) {
  return code.replace(/[\s-]/g, "").toUpperCase();
}

/* The teacher code box only shows when "Teacher" is picked */
const teacherCodeField = getById("teacher-code-field");
const studentSectionField = getById("student-section-field");   // the Section box only shows for students
document.querySelectorAll('input[name="signup-role"]').forEach(radio => {
  radio.onchange = () => {
    teacherCodeField.hidden = getSelectedRole() !== "teacher";
    studentSectionField.hidden = getSelectedRole() !== "student";
  };
});

getById("signup-form").onsubmit = event => {
  event.preventDefault();

  const role = getSelectedRole();
  const teacherCodeInput   = getById("signup-teacher-code");
  const sectionInput         = getById("signup-section");
  const fullNameInput        = getById("signup-fullname");
  const usernameInput        = getById("signup-username");
  const passwordInput        = getById("signup-password");
  const confirmPasswordInput = getById("signup-confirm-password");

  const section = sectionInput.value.trim().replace(/\s+/g, " ");
  const typedTeacherCode = normalizeCode(teacherCodeInput.value);
  const teacherCodeWrong = role === "teacher" && typedTeacherCode !== normalizeCode(database.teacherCode);
  const fullName = fullNameInput.value.trim();
  const username = usernameInput.value.trim();
  /* The admin name can never be taken, even as Admin or ADMIN */
  const usernameTaken = isAdminUsername(username)
    || database.users.some(account => account.username === username);

  /* Check every box. The first problem is shown as a toast. */
  const allGood = validateFields([
    { input: teacherCodeInput, isInvalid: teacherCodeWrong,
      message: typedTeacherCode ? "That teacher code is not right. Ask the admin for it." : "Enter the teacher code." },
    { input: sectionInput, isInvalid: role === "student" && !section,
      message: "Enter your section." },
    { input: fullNameInput, isInvalid: !fullName,
      message: "Enter your full name." },
    { input: usernameInput, isInvalid: !username || usernameTaken,
      message: username ? "That username is taken." : "Enter a username." },
    { input: passwordInput, isInvalid: passwordInput.value.length < 6,
      message: "Password must be at least 6 characters." },
    { input: confirmPasswordInput,
      isInvalid: !confirmPasswordInput.value || confirmPasswordInput.value !== passwordInput.value,
      message: confirmPasswordInput.value ? "Passwords do not match." : "Confirm your password." }
  ]);
  if (!allGood) return;

  /* Save the new account and log them in.
     A teacher has no subjects yet (each subject gets its own class code). A student has not joined a subject yet. */
  const newAccount = { username, password: passwordInput.value, name: fullName, role };
  if (role === "student") { newAccount.teachers = []; newAccount.subjectIds = []; newAccount.section = section; }
  database.users.push(newAccount);
  saveDatabase(database);
  setSessionUser(username);

  showToast("Account created. Welcome!", "success");
  setTimeout(() => location.href = "dashboard.html", 800);   // wait a moment so the toast can be seen
};
