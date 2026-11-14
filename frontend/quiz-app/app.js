/* ==========================================================================
   app.js  -  The dashboard (dashboard.html)
   --------------------------------------------------------------------------
   Admin, teacher and student all use this file. What you see depends on the role.
   Everybody has the menu (burger) button at the top left and their name at the top right.
   The Sign out button is inside the menu (it asks "Are you sure?" first). Cards open when you press them (no "Open" button).
   The teacher edits things with the three dots on a card (Edit / Delete).

     ADMIN   Overview + the TEACHER CODE (people type it to sign up as a teacher).
             Menu tabs: Dashboard, Teachers, Students (all of them), Reports
             (messages that students and teachers reported in the chat).
     TEACHER Subject > Category > Quiz > add / delete questions,
             decide under Students who may take the quizzes (Quizzes: On / Allow quizzes),
             see student results, reset a student's attempt.
             EACH SUBJECT has its own CLASS CODE (open the subject: the code is at the top, above the
             categories). Students type it to join that subject.
             Menu tabs: Dashboard, Requests, Students (only the ones in their class), Messages.
     STUDENT First types a subject's class code (like Google Classroom). The teacher must APPROVE
             the request (Requests > Request student) before the student gets in.
             Can join MORE subjects later ("Join another subject"), also from other teachers
             (each subject card says "Teacher: ...").
             Then: Subject > Category > pick a quiz and answer it ONCE.
             Menu: Messages, teachers, subjects and classmates (5 each, then "See more").
             Chat: student <-> teacher of their class, and student <-> classmate (see chat.js).

   How it works: the page is drawn by renderPage(). Every button has
     data-action="..."  what to do   (open, go, add, delete, take...)
     data-value="..."   which item   (an id or a position)
   and one click listener (near the bottom) reads those two attributes.

   Needs: utils.js (escapeHtml), db.js (database, saveDatabase, makeId,
   getCurrentUser, getDisplayName, SESSION_KEY), toast.js (showToast) and chat.js (the Messages tab).

   Parts of this file:
     1. Settings and setup
     2. Helpers to find things
     3. Drawing the page
     4. Adding things (teacher)
     5. Class: joining, side menu and rules
     6. Navigation and the browser's Back button
     7. Button clicks
     8. Taking a quiz (student)
   ========================================================================== */


/* ---------- 1. Settings and setup ---------- */

/* If a student leaves the quiz tab, the quiz is cancelled and this message pops up
   when they come back. They are sent back to the list of quizzes to start again. */
const LEFT_TAB_MESSAGE = "You left the tab. You need to do it again.";
const LEFT_TAB_TOAST_TIME = 6000;   // how long that message stays (milliseconds)

/* The place on the page where everything is drawn */
const mainContent = document.getElementById("main-content");

/* Who is logged in? If nobody, go back to the sign in page. */
let currentUser = getCurrentUser();   // "let" because refreshFromStorage() below can replace it with a fresh copy
if (!currentUser) location.replace("index.html");

/* The three roles */
const isAdmin   = currentUser.role === "admin";
const isTeacher = currentUser.role === "teacher";
const isStudent = currentUser.role === "student";   // students also get the rules box and the class code screen

/* Inside the menu (burger): the FULL NAME (not the username) with the role, and the Sign out button */
const userNameLabel = document.getElementById("user-name-label");
userNameLabel.innerHTML = `${escapeHtml(getDisplayName(currentUser))} <span class="muted">(${escapeHtml(currentUser.role)})</span>`;

/* Top right: "name (student)", and for a student "section (section)" on the line under it. It is drawn again when the section changes. */
function updateUserBar() {
  const section = isStudent && currentUser.section
    ? `<span class="user-bar-section">${escapeHtml(currentUser.section)} <span class="muted">(section)</span></span>`
    : "";
  document.getElementById("user-bar-name").innerHTML = userNameLabel.innerHTML + section;
}
updateUserBar();
document.getElementById("sign-out-button").onclick = () => {
  /* Ask first, so nobody signs out by accident (admin, teacher and student) */
  askConfirm({
    title: "Sign out?",
    message: "Are you sure you want to sign out?",
    confirmText: "Sign out",
    onConfirm: () => {
      clearSessionUser();
      location.href = "index.html";
    }
  });
};

/* A small question box in the center of the screen (instead of the browser's plain confirm box).
   Cancel, the Escape key, or a click outside the box close it without doing anything.
   Use it for EVERY "Are you sure?" in the app (never confirm()).
   askConfirm({ title, message, confirmText, danger, onConfirm })   danger = true makes the Yes button red (for deletes) */
function askConfirm({ title, message, confirmText = "Yes", danger = false, onConfirm }) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop confirm-backdrop";
  backdrop.innerHTML = `
    <div class="modal-box confirm-box" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
      <h2 id="confirm-title">${escapeHtml(title)}</h2>
      <p id="confirm-message" class="confirm-message">${escapeHtml(message)}</p>
      <div class="confirm-actions">
        <button type="button" class="btn ghost" data-confirm="cancel">Cancel</button>
        <button type="button" class="btn${danger ? " deny" : ""}" data-confirm="yes">${escapeHtml(confirmText)}</button>
      </div>
    </div>`;

  const close = () => {
    document.removeEventListener("keydown", onKey, true);
    backdrop.remove();
  };
  const onKey = event => {
    if (event.key !== "Escape") return;
    event.stopImmediatePropagation();     // so the menu behind does not also react
    close();
  };
  backdrop.onclick = event => {
    if (event.target === backdrop) close();                          // clicked outside the box
    const choice = event.target.closest("[data-confirm]");
    if (!choice) return;
    close();
    if (choice.dataset.confirm === "yes") onConfirm();
  };
  document.addEventListener("keydown", onKey, true);
  document.body.appendChild(backdrop);
  backdrop.querySelector('[data-confirm="cancel"]').focus();          // Enter = the safe choice (Cancel)
}

/* The parts of the page that app.js controls (see the ids in dashboard.html) */
const menuButton        = document.getElementById("menu-button");           // the burger button
const sideDrawer        = document.getElementById("side-drawer");           // the menu that slides in
const drawerBackdrop    = document.getElementById("drawer-backdrop");
const drawerContent     = document.getElementById("drawer-content");
const drawerCloseButton = document.getElementById("drawer-close-button");
const rulesModal        = document.getElementById("rules-modal");           // the floating rules box
const drawerTitle       = document.getElementById("drawer-title");
const editModal         = document.getElementById("edit-modal");           // the box to edit a name / time
const editForm          = document.getElementById("edit-form");
const editTitle         = document.getElementById("edit-title");
const editNameLabel     = document.getElementById("edit-name-label");
const editNameInput     = document.getElementById("edit-name");
const editSectionField  = document.getElementById("edit-section-field");
const editSectionInput  = document.getElementById("edit-section");
const editMinutesField  = document.getElementById("edit-minutes-field");
const editCloseField    = document.getElementById("edit-close-field");     // quizzes only: close automatically at...
const editCloseInput    = document.getElementById("edit-close");
const editMinutesInput  = document.getElementById("edit-minutes");
const editError         = document.getElementById("edit-error");
const rulesOkButton     = document.getElementById("rules-ok-button");
const rulesDontShowButton = document.getElementById("rules-dont-show-button");
const showRulesButton   = document.getElementById("show-rules-button");     // "View quiz rules" at the bottom

/* Where are we? A list of ids, one for each level we opened.
     []                         -> the list of subjects
     [subjectId]                -> the categories of that subject
     [subjectId, categoryId]    -> the quizzes of that category
     [..., quizId]              -> the manage page of that quiz (admin) */
let selectedIds = [];

/* Which tab of the menu is open? Only the admin and the teacher have tabs.
     "home"     the dashboard (subjects for a teacher, the overview for the admin)
     "students" the list of students (admin and teacher)
     "retakes"  the retake requests waiting for the teacher (teacher only)
     "joins"    the students waiting to be let into the class (teacher only)
     "teachers" the list of teachers (admin: all of them, student: the ones they joined)
     "classmates" the students who share a teacher with this student (student only)
     "chat"     messages between a student and their teachers or classmates (teacher and student, drawn by chat.js)
     "reports"  the reported chat messages (admin only, drawn by chat.js)
     "subjects" all the subjects of this student, in a grid (student only) */
let view = "home";

/* Only allow tabs that the role really has (a student always stays on "home") */
function normalizeView(name) {
  const allowed = isAdmin ? ["home", "teachers", "students", "reports"]
    : isTeacher ? ["home", "retakes", "joins", "students", "chat"]
    : ["home", "subjects", "teachers", "classmates", "chat"];   // student: full lists behind "See more" in the menu
  return allowed.includes(name) ? name : "home";
}

/* Names for each level, so the code reads better than 0, 1, 2, 3 */
const LEVEL = { SUBJECTS: 0, CATEGORIES: 1, QUIZZES: 2, MANAGE_QUIZ: 3 };
const LEVEL_NAMES_SINGULAR = ["subject", "category", "quiz"];    // used in "Add subject", "New quiz name"...
const LEVEL_NAMES_PLURAL   = ["Subjects", "Categories", "Quizzes"];  // used as the title of each list

function getLevel() {
  return selectedIds.length;
}


/* ---------- 2. Helpers to find things ---------- */

/* The teachers a student joined (only teachers that still exist), A to Z */
function getMyTeachers() {
  const joined = currentUser.teachers || [];
  return database.users
    .filter(user => user.role === "teacher" && joined.includes(user.username))
    .sort((first, second) => getDisplayName(first).localeCompare(getDisplayName(second)));
}

/* The subjects THIS person can see:
     teacher = the ones they made, student = the subjects they joined with a class code */
function getVisibleSubjects() {
  if (isTeacher) return database.subjects.filter(subject => subject.owner === currentUser.username);
  if (isStudent) {
    const myIds = currentUser.subjectIds || [];
    /* Only the subjects I joined with their class code, and only when MY section is one of its sections.
       (An old subject with no sections yet is still shown to the whole class.) */
    return database.subjects.filter(subject => myIds.includes(subject.id)
      && subjectHasSection(subject, currentUser.section));
  }
  return [];
}

/* The name of the teacher who owns a subject ("-" if that teacher is gone) */
function getOwnerName(subject) {
  const owner = database.users.find(user => user.role === "teacher" && user.username === subject.owner);
  return owner ? getDisplayName(owner) : "-";
}

/* Find the subject, category and quiz we opened (each one is undefined if not opened yet) */
function getSelection() {
  const subject  = getVisibleSubjects().find(item => item.id === selectedIds[0]);
  const category = subject && subject.categories.find(item => item.id === selectedIds[1]);
  const quiz     = category && category.quizzes.find(item => item.id === selectedIds[2]);
  return { subject, category, quiz };
}

/* The list shown on the current level: subjects, categories or quizzes */
function getCurrentList() {
  const { subject, category } = getSelection();
  if (getLevel() === LEVEL.SUBJECTS) return getVisibleSubjects();
  if (getLevel() === LEVEL.CATEGORIES) return subject.categories;
  return category.quizzes;
}

/* Sort helper: put names in A to Z order (not case sensitive). Used for every list of people. */
function byName(first, second) {
  return String(first).localeCompare(String(second), undefined, { sensitivity: "base", numeric: true });
}

/* ----- Quiz access: the TEACHER decides which students may take THEIR quizzes -----
   Saved on the student: student.quizBlockedBy = [usernames of the teachers who turned quizzes off for them].
   Nothing saved = allowed (every student can take quizzes until the teacher turns it off). */
function isQuizBlocked(student, teacherUsername) {
  return (student.quizBlockedBy || []).includes(teacherUsername);
}

/* Teacher: allow or block ONE student (allow = true / false). Changes the data only: the caller
   calls refreshFromStorage() before and saveAndRender() after. Gives back true if something was set. */
function setQuizAccess(username, allow) {
  if (!isTeacher) return false;
  const student = database.users.find(user => user.username === username && user.role === "student");
  if (!student || !(student.teachers || []).includes(currentUser.username)) return false;
  const rest = (student.quizBlockedBy || []).filter(name => name !== currentUser.username);
  student.quizBlockedBy = allow ? rest : rest.concat(currentUser.username);
  if (!student.quizBlockedBy.length) delete student.quizBlockedBy;
  return true;
}

/* ----- Score colors: red 74% and below, orange 75% to 85%, green 86% to 100% -----
   The percent is rounded first (74.6% counts as 75%). The colors are in quiz.css (.score-low, .score-mid, .score-high). */
const SCORE_ORANGE_FROM = 75;
const SCORE_GREEN_FROM = 86;

function getScoreClass(score, total) {
  const percent = total > 0 ? Math.round((score / total) * 100) : 0;
  if (percent >= SCORE_GREEN_FROM) return "score-high";
  if (percent >= SCORE_ORANGE_FROM) return "score-mid";
  return "score-low";
}

/* The logged-in student's result for a quiz (undefined if they have not started it) */
function getMyResult(quizId) {
  return database.results.find(result =>
    result.username === currentUser.username && result.quizId === quizId
  );
}

/* ----- Retake requests -----
   A student can take each quiz only once. If they need another try they press "Request retake".
   The teacher approves (the old result is deleted, so "Take quiz" comes back) or denies. */

/* The logged-in student's retake request for a quiz (undefined if they never asked) */
function getMyRetake(quizId) {
  return database.retakes.find(request =>
    request.username === currentUser.username && request.quizId === quizId
  );
}

/* The student pressed "Request retake" (or "Request again") */
function requestRetake(quizId) {
  if (!refreshFromStorage()) return;
  const result = getMyResult(quizId);
  if (!result || !result.finished) return;      // only a finished quiz can be retaken

  const old = getMyRetake(quizId);
  if (old && old.status === "pending") return;  // already asked
  database.retakes = database.retakes.filter(request => request !== old);
  database.retakes.push({
    id: makeId(),
    username: currentUser.username,
    studentName: getDisplayName(currentUser),
    quizId: quizId,
    status: "pending"
  });
  saveDatabase(database);
  showToast("Retake request sent to your teacher.", "success");
  renderPage();
}

/* The teacher pressed Approve or Deny */
function answerRetake(requestId, approve) {
  if (!isTeacher || !refreshFromStorage()) return;
  const request = database.retakes.find(item => item.id === requestId);
  if (!request) return;

  if (approve) {
    /* A closed quiz cannot be taken: the teacher must reopen it first */
    const retakeQuiz = findQuizById(request.quizId);
    if (retakeQuiz && isQuizClosed(retakeQuiz)) {
      showToast("This quiz is closed. Reopen it first, then approve the retake.");
      return;
    }
    /* Delete the old result: the student can take the quiz again. The request is done. */
    database.results = database.results.filter(result =>
      !(result.username === request.username && result.quizId === request.quizId)
    );
    database.retakes = database.retakes.filter(item => item.id !== requestId);
    showToast(`${request.studentName} can retake the quiz.`, "success");
  } else {
    request.status = "denied";
    showToast(`Retake denied for ${request.studentName}.`);
  }
  saveAndRender();
}

/* Every retake request that waits for THIS teacher, with the quiz it is about.
   (Only the quizzes in the teacher's own subjects count.) */
function getMyPendingRetakes() {
  if (!isTeacher) return [];
  const quizzes = {};   // quiz id -> { path: "Subject / Category / Quiz" }
  database.subjects.filter(subject => subject.owner === currentUser.username).forEach(subject => {
    subject.categories.forEach(category => {
      category.quizzes.forEach(quiz => {
        quizzes[quiz.id] = `${getSubjectTitle(subject)} / ${category.name} / ${quiz.name}`;
      });
    });
  });
  return database.retakes
    .filter(request => request.status === "pending" && quizzes[request.quizId])
    .map(request => ({ request, quizPath: quizzes[request.quizId] }))
    .sort((first, second) => byName(first.request.studentName, second.request.studentName) || byName(first.quizPath, second.quizPath));   // A to Z
}

/* The menu tab "Retake requests": every waiting request, with Approve and Deny */
function buildRetakeRequestsPage() {
  const pending = getMyPendingRetakes();
  let content;
  if (pending.length) {
    const rows = pending.map(({ request, quizPath }) => {
      const result = database.results.find(item => item.username === request.username && item.quizId === request.quizId);
      const scoreText = result && result.finished
        ? ` &middot; <span class="${getScoreClass(result.score, result.total)}">Score ${result.score}/${result.total}</span>` : "";
      return `
        <li class="retake-item">
          <span>
            <strong>${escapeHtml(request.studentName)}</strong>
            <span class="muted">${scoreText}</span><br>
            <span class="muted">${escapeHtml(quizPath)}</span>
          </span>
          <span class="action-row">
            <button class="btn" data-action="approve-retake" data-value="${request.id}">Approve</button>
            <button class="btn deny" data-action="deny-retake" data-value="${request.id}">Deny</button>
          </span>
        </li>`;
    }).join("");
    content = `<ul class="retake-list">${rows}</ul>`;
  } else {
    content = `<p class="muted">No retake requests right now.</p>`;
  }
  return `
    <section class="card">
      <h2>Request retake (${pending.length})</h2>
      <p class="muted">Approve to delete the student\u2019s old result so they can take the quiz again. Deny keeps their score.</p>
      ${content}
    </section>`;
}

/* ----- Join requests (student approval) -----
   A class code alone does not let a student in. They send a request and the teacher approves it. */

/* Teacher: the students waiting to be let into THIS teacher's class */
function getMyPendingJoins() {
  if (!isTeacher) return [];
  return database.joinRequests.filter(request =>
    request.status === "pending" && request.teacher === currentUser.username &&
    database.subjects.some(subject => subject.id === request.subjectId) &&
    database.users.some(user => user.username === request.username && user.role === "student"))
    .sort((first, second) => byName(first.studentName, second.studentName));   // A to Z
}

/* Student: their own requests (pending or denied) to teachers that still exist */
function getMyJoinRequests() {
  return database.joinRequests.filter(request =>
    request.username === currentUser.username &&
    database.subjects.some(subject => subject.id === request.subjectId) &&
    database.users.some(user => user.username === request.teacher && user.role === "teacher"));
}

/* Everything that waits for this person: retakes + students (teacher) + unread messages (teacher and student) + reports (admin).
   Shown on the burger button. */
function getPendingCount() {
  return getMyPendingRetakes().length + getMyPendingJoins().length + chatUnreadCount() + chatOpenReportCount();
}

/* The teacher pressed Approve or Deny on a student */
function answerJoin(requestId, approve) {
  if (!isTeacher || !refreshFromStorage()) return;
  const request = database.joinRequests.find(item => item.id === requestId && item.teacher === currentUser.username);
  if (!request) return;

  if (approve) {
    const student = database.users.find(user => user.username === request.username && user.role === "student");
    const requestedSubject = database.subjects.find(subject => subject.id === request.subjectId);
    /* The student may have changed their section after sending the request */
    if (student && requestedSubject && !subjectHasSection(requestedSubject, student.section)) {
      database.joinRequests = database.joinRequests.filter(item => item.id !== requestId);
      saveAndRender();
      showToast(`${request.studentName} is not in a section of ${getSubjectTitle(requestedSubject)}.`);
      return;
    }
    if (student) {
      const joinedSubjects = student.subjectIds || [];
      if (!joinedSubjects.includes(request.subjectId)) student.subjectIds = [...joinedSubjects, request.subjectId];
      const joined = student.teachers || [];
      if (!joined.includes(currentUser.username)) student.teachers = [...joined, currentUser.username];
    }
    const joinedSubject = database.subjects.find(subject => subject.id === request.subjectId);
    database.joinRequests = database.joinRequests.filter(item => item.id !== requestId);
    showToast(`${request.studentName} joined ${joinedSubject ? getSubjectTitle(joinedSubject) : "your subject"}.`, "success");
  } else {
    request.status = "denied";
    showToast(`Denied ${request.studentName}.`);
  }
  saveAndRender();
}

/* The student takes back a waiting request, or dismisses a denied one */
function cancelJoin(requestId) {
  if (!isStudent || !refreshFromStorage()) return;
  database.joinRequests = database.joinRequests.filter(item =>
    !(item.id === requestId && item.username === currentUser.username));
  saveAndRender();
}

/* The card under "Retake requests" in the Requests tab: students waiting for the teacher's OK */
function buildStudentApprovalCard() {
  const pending = getMyPendingJoins();
  let content;
  if (pending.length) {
    const rows = pending.map(request => {
      const student = database.users.find(user => user.username === request.username);
      const requestSubject = database.subjects.find(subject => subject.id === request.subjectId);
      return `
        <li class="retake-item">
          <span>
            <strong>${escapeHtml(student ? getDisplayName(student) : request.studentName)}</strong><br>
            <span class="muted">${escapeHtml(request.username)}</span><br>
            <span class="muted">${escapeHtml(requestSubject ? requestSubject.name : "")}${student && student.section ? ` (${escapeHtml(student.section)})` : ""}</span>
          </span>
          <span class="action-row">
            <button class="btn" data-action="approve-join" data-value="${request.id}">Approve</button>
            <button class="btn deny" data-action="deny-join" data-value="${request.id}">Deny</button>
          </span>
        </li>`;
    }).join("");
    content = `<ul class="retake-list">${rows}</ul>`;
  } else {
    content = `<p class="muted">No students are waiting.</p>`;
  }
  return `
    <section class="card">
      <h2>Request student (${pending.length})</h2>
      <p class="muted">These students typed the class code of one of your subjects. Approve to let them into that subject. Deny to keep them out.</p>
      ${content}
    </section>`;
}

/* A small number on the burger button: waiting requests and unread messages */
function updateMenuBadge() {
  let badge = menuButton.querySelector(".menu-badge");
  const count = getPendingCount();
  if (!count) {
    if (badge) badge.remove();
    return;
  }
  if (!badge) {
    badge = document.createElement("span");
    badge.className = "menu-badge";
    badge.setAttribute("aria-hidden", "true");
    menuButton.appendChild(badge);
  }
  badge.textContent = count > 9 ? "9+" : String(count);
  menuButton.setAttribute("aria-label", `Open menu (${count} waiting)`);
}

/* Has this person joined a subject? The admin and the teachers are always "in".
   A student is in when at least one subject they joined still exists. */
function hasJoinedClass() {
  if (!isStudent) return true;
  const myIds = currentUser.subjectIds || [];
  return database.subjects.some(subject => myIds.includes(subject.id));
}

/* Small helper: save the database and draw the page again */
/* Read the newest data from the browser's storage.
   WHY: every tab keeps its own copy of the database in memory. If the teacher makes a new class code
   in one tab, a student tab (same browser) still holds the OLD copy, so the old code "ABC123" kept
   working, and saving from the old copy could even bring the old code back. Calling this first fixes both. */
function refreshFromStorage() {
  database = loadDatabase();
  const freshUser = getCurrentUser();
  if (!freshUser) {            // the account was deleted or signed out in another tab
    location.replace("index.html");
    return false;
  }
  currentUser = freshUser;
  return true;
}

/* When ANOTHER tab saves, update this tab too (but never redraw the screen during a quiz) */
window.addEventListener("storage", event => {
  if (event.key !== STORAGE_KEY) return;
  if (!refreshFromStorage()) return;
  if (!quizInProgress) renderPage();
});

function saveAndRender() {
  saveDatabase(database);
  renderPage();
}

/* Same, but the page AND the students list stay where they are (no jump back to the top / to the letter A),
   and the button you pressed keeps the focus.
   (For buttons in the middle of a long list, like Quizzes On / Off in the Students tab.) */
function saveAndRenderInPlace() {
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  /* The students list scrolls INSIDE the page (see .student-list in quiz.css), so its position is saved too */
  const lists = [...mainContent.querySelectorAll(".student-list")].map(list => list.scrollTop);
  const active = document.activeElement;
  const action = active && active.dataset ? active.dataset.action : null;
  const value = active && active.dataset ? active.dataset.value : null;

  saveAndRender();

  const restore = () => {
    window.scrollTo(scrollX, scrollY);
    mainContent.querySelectorAll(".student-list").forEach((list, index) => {
      if (lists[index] !== undefined) list.scrollTop = lists[index];
    });
  };
  restore();
  if (action) {
    const same = [...mainContent.querySelectorAll("[data-action]")].find(item =>
      item.dataset.action === action && item.dataset.value === value);
    if (same) same.focus({ preventScroll: true });
  }
  restore();
  requestAnimationFrame(restore);   // once more after the browser finished drawing
}


/* ---------- 3. Drawing the page ---------- */

/* How many different students finished at least one of these quizzes (a student counts once) */
function countFinishedStudents(quizIds) {
  const students = new Set();
  database.results.forEach(result => {
    if (result.finished && quizIds.includes(result.quizId)) students.add(result.username);
  });
  return students.size;
}

/* The sections of a subject, a list like ["BSIT 2-1", "BSIT 2-2"] (older subjects may have none: then it is empty) */
function getSections(subject) {
  return subject && Array.isArray(subject.sections) ? subject.sections : [];
}

/* The sections as one line for the screen: "BSIT 2-1, BSIT 2-2" */
function getSection(subject) {
  return getSections(subject).join(", ");
}

/* Turn what the teacher typed ("BSIT 2-1, BSIT 2-2") into a clean list: split on commas (or semicolons / new lines),
   no empty ones, extra spaces removed, the same section twice kept once. */
function parseSections(text) {
  const list = [];
  String(text || "").split(/[,;\n]/).forEach(part => {
    const section = part.trim().replace(/\s+/g, " ");
    if (section && !list.some(item => normalizeSection(item) === normalizeSection(section))) list.push(section);
  });
  return list;
}

/* Can a student of this section be in this subject? Only when the subject lists the section.
   (An old subject with no sections yet is open to every section.) */
function subjectHasSection(subject, section) {
  const sections = getSections(subject);
  if (!sections.length) return true;
  return sections.some(item => normalizeSection(item) === normalizeSection(section));
}

/* Sections are compared without capital letters and spaces ("BSIT 2-1" = "bsit 2-1" = "BSIT2-1") */
function normalizeSection(section) {
  return String(section || "").toLowerCase().replace(/\s+/g, "");
}

/* "Science (BSIT 2-1)" - the subject name with its section, for the trail, the menu and the lists */
function getSubjectTitle(subject) {
  const section = getSection(subject);
  return section ? `${subject.name} (${section})` : subject.name;
}

/* ----- Closing a quiz -----
   A quiz is CLOSED when the teacher closed it by hand (quiz.closed) or when its automatic close time has come
   (quiz.closeAt). A closed quiz cannot be started. A student who already started it may finish it. */
function isQuizClosed(quiz) {
  return Boolean(quiz && (quiz.closed || (quiz.closeAt && Date.now() >= quiz.closeAt)));
}

/* "Nov 20, 3:00 PM" */
function formatCloseTime(timestamp) {
  return new Date(timestamp).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/* The little status text of a quiz: "Closed", "Closes Nov 20, 3:00 PM", or "" (open, no close time) */
function describeQuizStatus(quiz) {
  if (isQuizClosed(quiz)) return "Closed";
  return quiz.closeAt ? `Closes ${formatCloseTime(quiz.closeAt)}` : "";
}

/* The value for <input type="datetime-local"> in the local time zone ("2026-11-20T15:00") */
function toLocalInputValue(timestamp) {
  const date = new Date(timestamp);
  const pad = number => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/* Find a quiz by its id in any subject (or null) */
function findQuizById(quizId) {
  for (const subject of database.subjects) {
    for (const category of subject.categories) {
      const quiz = category.quizzes.find(item => item.id === quizId);
      if (quiz) return quiz;
    }
  }
  return null;
}

/* When a quiz closes by itself, redraw the page at that moment so the "Take quiz" button turns into "Closed".
   (Not during a quiz, and not while the edit box or the close date box is open.) */
let closeRefreshTimer = null;
function scheduleCloseRefresh() {
  clearTimeout(closeRefreshTimer);
  if (getLevel() !== LEVEL.QUIZZES || view !== "home") return;
  const { category } = getSelection();
  if (!category) return;
  const now = Date.now();
  const next = category.quizzes.map(quiz => quiz.closeAt).filter(time => time && time > now).sort((a, b) => a - b)[0];
  if (!next) return;
  closeRefreshTimer = setTimeout(() => {
    if (!quizInProgress && editModal.hidden && closeModal.hidden) renderPage();
  }, Math.min(next - now + 300, 2147000000));
}

/* The small gray text under each item's name, like "3 categories" */
function describeItem(item) {
  /* Teacher: "count | how many students finished answering" on every level */
  if (isTeacher) {
    const level = getLevel();
    let quizIds, countText;
    if (level === LEVEL.SUBJECTS) {
      quizIds = item.categories.flatMap(category => category.quizzes.map(quiz => quiz.id));
      countText = `${item.categories.length} ${item.categories.length === 1 ? "category" : "categories"}`;
    } else if (level === LEVEL.CATEGORIES) {
      quizIds = item.quizzes.map(quiz => quiz.id);
      countText = `${item.quizzes.length} ${item.quizzes.length === 1 ? "quiz" : "quizzes"}`;
    } else {
      quizIds = [item.id];
      countText = `${item.questions.length} ${item.questions.length === 1 ? "question" : "questions"}`;
    }
    const done = countFinishedStudents(quizIds);
    const finishedText = `${done} ${done === 1 ? "student" : "students"} finished`;
    const minutesText = level === LEVEL.QUIZZES ? ` <span class="item-sep">|</span> ${item.minutes} min` : "";
    const status = level === LEVEL.QUIZZES ? describeQuizStatus(item) : "";
    const statusText = status ? ` <span class="item-sep">|</span> ${escapeHtml(status)}` : "";
    return `${countText}${minutesText} <span class="item-sep">|</span> ${finishedText}${statusText}`;
  }
  if (getLevel() === LEVEL.SUBJECTS)   return `${item.categories.length} ${item.categories.length === 1 ? "category" : "categories"}`;
  if (getLevel() === LEVEL.CATEGORIES) return `${item.quizzes.length} ${item.quizzes.length === 1 ? "quiz" : "quizzes"}`;
  const studentStatus = describeQuizStatus(item);
  return `${item.questions.length} questions, ${item.minutes} min${studentStatus ? ` <span class="item-sep">|</span> ${escapeHtml(studentStatus)}` : ""}`;
}

/* The three vertical dots. They open a small menu with Edit and Delete.
   editAction / deleteAction are the data-action names (see section 7, Button clicks). */
const DOTS_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
  <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>`;

function buildDotsMenu(editAction, deleteAction, value, extraItems = "") {
  return `
    <div class="item-menu-wrap" data-action="none">
      <button type="button" class="dots-button" data-action="toggle-menu"
              aria-label="More options" aria-haspopup="menu" aria-expanded="false">${DOTS_ICON}</button>
      <div class="item-menu" role="menu" hidden>
        ${extraItems}
        <button type="button" role="menuitem" data-action="${editAction}" data-value="${value}">Edit</button>
        <button type="button" role="menuitem" class="danger" data-action="${deleteAction}" data-value="${value}">Delete</button>
      </div>
    </div>`;
}

/* The part on the right side of each card */
function buildItemButtons(item) {
  /* Teacher: the three dots (Edit / Delete). The card itself opens when pressed. */
  if (isTeacher) {
    /* A quiz also gets "Close quiz" / "Reopen quiz" in its menu */
    const closeItem = getLevel() === LEVEL.QUIZZES
      ? `<button type="button" role="menuitem" data-action="toggle-close-quiz" data-value="${item.id}">${isQuizClosed(item) ? "Reopen quiz" : "Close quiz"}</button>
         <button type="button" role="menuitem" data-action="set-close-date" data-value="${item.id}">${item.closeAt ? "Change close date" : "Set close date"}</button>`
      : "";
    return buildDotsMenu("edit", "delete", item.id, closeItem);
  }

  /* Student, subjects and categories: the whole card opens, so only a small arrow */
  if (getLevel() < LEVEL.QUIZZES) return `<span class="card-arrow" aria-hidden="true">\u203A</span>`;

  /* Student looking at a quiz: show the score, or the Take quiz button */
  const result = getMyResult(item.id);
  if (result) {
    const badgeClass = result.finished ? getScoreClass(result.score, result.total) : "progress";
    const badgeText = result.finished ? `Score ${result.score}/${result.total}` : "Incomplete";
    const scoreBadge = `<span class="badge ${badgeClass}">${badgeText}</span>`;
    return scoreBadge;   // the score stays on the right side of the quiz name; the retake part is in the middle (buildRetakeRow)
  }
  if (item.questions.length) {
    const { subject } = getSelection();
    if (subject && isQuizBlocked(currentUser, subject.owner)) return `<span class="badge" title="Your teacher turned quizzes off for you">Quizzes off</span>`;
    if (isQuizClosed(item)) return `<span class="badge" title="This quiz is closed">Closed</span>`;
    return `<button class="btn" data-action="take" data-value="${item.id}">Take quiz</button>`;
  }
  return `<span class="badge">No questions yet</span>`;
}

/* Student, a finished quiz: the retake part sits in the middle of the card, under the name and the score.
   (ask for a retake, wait for the answer, or ask again after a "no") */
function buildRetakeRow(item) {
  if (!isStudent || getLevel() !== LEVEL.QUIZZES) return "";
  const result = getMyResult(item.id);
  if (!result || !result.finished) return "";
  if (isQuizClosed(item)) return "";   // a closed quiz cannot be taken again, so no retake request

  const retake = getMyRetake(item.id);
  if (retake && retake.status === "pending") return `<span class="badge progress">Retake requested</span>`;
  if (retake && retake.status === "denied") {
    return `<span class="badge">Retake denied</span>
      <button class="btn ghost" data-action="request-retake" data-value="${item.id}">Request again</button>`;
  }
  return `<button class="btn ghost" data-action="request-retake" data-value="${item.id}">Request retake</button>`;
}

/* The Back button: goes up ONE level, and says where it goes ("Back to Categories").
   It is not shown on the first screen (the list of subjects), because there is nowhere to go back to. */
function buildBackButton() {
  if (getLevel() === LEVEL.SUBJECTS) return "";
  const placeName = LEVEL_NAMES_PLURAL[getLevel() - 1];   // the list we will go back to
  return `<button type="button" class="btn ghost back-button" data-action="back">\u2190 Back to ${placeName}</button>`;
}

/* The trail at the top: Dashboard / Science / Basics. Every part except the last one is clickable. */
function buildBreadcrumbs() {
  const { subject, category, quiz } = getSelection();
  const names = ["Dashboard", subject && getSubjectTitle(subject), category && category.name, quiz && quiz.name]
    .filter(Boolean);   // remove the levels we have not opened

  const parts = names.map((name, position) => {
    const isLast = position === names.length - 1;
    return isLast
      ? `<strong>${escapeHtml(name)}</strong>`
      : `<button type="button" class="link-button" data-action="go" data-value="${position}">${escapeHtml(name)}</button>`;
  });
  return `<nav class="breadcrumbs">${parts.join(" / ")}</nav>`;
}

/* The list of subjects / categories / quizzes, as cards.
   Pressing a card opens it (there is no Open button). A student's quiz card is the exception:
   it has its own Take quiz button. */
function buildItemList() {
  const list = getCurrentList();
  const levelName = LEVEL_NAMES_SINGULAR[getLevel()];

  if (!list.length) {
    if (isTeacher) return `<p class="muted">No ${levelName} yet. Add one below.</p>`;
    if (getLevel() === LEVEL.SUBJECTS) {
      return currentUser.section
        ? `<p class="muted">No subjects for your section yet. Check back soon.</p>`
        : `<p class="muted">Set your section above to see your subjects.</p>`;
    }
    return `<p class="muted">Nothing here yet. Check again later.</p>`;
  }

  const isOpenable = getLevel() < LEVEL.QUIZZES || isTeacher;

  /* Student, first screen: only the first 8 subjects (the rest are behind "See more") */
  const limitSubjects = isStudent && getLevel() === LEVEL.SUBJECTS && list.length > getSubjectLimit();
  const shownItems = limitSubjects ? list.slice(0, getSubjectLimit()) : list;

  const rows = shownItems.map(item => {
    /* A student sees which teacher each subject belongs to */
    const teacherLine = isStudent && getLevel() === LEVEL.SUBJECTS
      ? `<span class="muted">Teacher: ${escapeHtml(getOwnerName(item))}</span>`
      : "";
    /* Subject card:  Subject / Section / "3 categories | 2 students finished" */
    const sectionLine = getLevel() === LEVEL.SUBJECTS && getSection(item)
      ? `<span class="item-section">${escapeHtml(getSection(item))}</span>`
      : "";
    const text = `<strong>${escapeHtml(item.name)}</strong>${sectionLine}
        <span class="muted">${describeItem(item)}</span>${teacherLine}`;
    const main = isOpenable
      ? `<button type="button" class="card-main" data-action="open" data-value="${item.id}">${text}</button>`
      : `<div class="card-static">${text}</div>`;

    const retakeRow = buildRetakeRow(item);
    return `
    <li class="list-item${isOpenable ? " clickable" : ""}">
      ${main}
      <div class="action-row">${buildItemButtons(item)}</div>
      ${retakeRow ? `<div class="action-row item-center">${retakeRow}</div>` : ""}
    </li>`;
  }).join("");
  const seeMore = limitSubjects
    ? `<div class="see-more-row"><button type="button" class="link-button" data-action="show-subjects">See more</button></div>`
    : "";
  return `<ul class="item-list">${rows}</ul>${seeMore}`;
}

/* Student dashboard: only the first 5 (phone) or 8 (computer) subjects show, then "See more" (right side) opens all of them */
/* Phones (under 640px wide): 5 subjects. Tablets and computers: 8. */
const phoneScreen = window.matchMedia("(max-width: 639px)");
function getSubjectLimit() {
  return phoneScreen.matches ? 5 : 8;
}
/* If the screen changes size (turning the phone, resizing the window), draw the dashboard again */
phoneScreen.addEventListener("change", () => {
  if (isStudent && view === "home" && getLevel() === LEVEL.SUBJECTS && !quizInProgress) renderPage();
});

/* The form to add a subject, category or quiz (teacher). Every box has a label on top. */
const LEVEL_EXAMPLES = ["Science", "Basics", "Quiz 2"];   // the gray example text in the name box

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function buildAddItemRow() {
  const levelName = LEVEL_NAMES_SINGULAR[getLevel()];
  /* Only quizzes have a time limit, so only they get the time box */
  const minutesField = getLevel() === LEVEL.QUIZZES
    ? `<div class="field field-small">
         <label for="new-quiz-minutes">Time (minutes)</label>
         <input id="new-quiz-minutes" type="number" min="1" value="10">
       </div>`
    : "";

  /* Only subjects have sections (Subject + Sections, like "Science" + "BSIT 2-1, BSIT 2-2") */
  const sectionField = getLevel() === LEVEL.SUBJECTS
    ? `<div class="field">
         <label for="new-item-section">Sections (separate with a comma)</label>
         <input id="new-item-section" placeholder="e.g. BSIT 2-1, BSIT 2-2" autocomplete="off">
       </div>`
    : "";

  return `
    <div class="add-item-row">
      <div class="field">
        <label for="new-item-name">${capitalize(levelName)} name</label>
        <input id="new-item-name" placeholder="e.g. ${LEVEL_EXAMPLES[getLevel()]}" autocomplete="off">
      </div>
      ${sectionField}
      ${minutesField}
      <button class="btn" data-action="add">Add ${levelName}</button>
    </div>`;
}

/* Draw the whole page for the current tab and level */
function renderPage() {
  /* Leaving the manage page also cancels an unfinished question edit */
  if (getLevel() !== LEVEL.MANAGE_QUIZ) editingQuestion = null;

  updateUserBar();     // the name (and the student's section) at the top right
  scheduleCloseRefresh();   // redraw when a quiz on this screen closes by itself
  chatNotifyNew();     // a small pop-up when a new message arrived
  updateMenuBadge();   // the number of waiting requests and unread messages on the burger button

  /* A student who has not joined the class sees the join screen and nothing else */
  if (!hasJoinedClass()) {
    mainContent.innerHTML = buildJoinClassCard();
    return;
  }

  /* The tabs and the "See more" pages */
  if (view === "chat") {
    renderChat();   // chat.js
    return;
  }
  if (view === "reports" && isAdmin) {
    mainContent.innerHTML = buildReportsPage();   // chat.js
    return;
  }
  if (view === "students") {
    mainContent.innerHTML = buildStudentsPage();
    return;
  }
  if (view === "retakes") {
    mainContent.innerHTML = buildRetakeRequestsPage();
    return;
  }
  if (view === "joins") {
    mainContent.innerHTML = buildStudentApprovalCard();
    return;
  }
  if (view === "teachers") {
    mainContent.innerHTML = isAdmin ? buildTeachersPage() : buildMyTeachersPage();
    return;
  }
  if (view === "classmates") {
    mainContent.innerHTML = buildClassmatesPage();
    return;
  }
  if (view === "subjects") {
    mainContent.innerHTML = buildAllSubjectsPage();
    return;
  }
  /* The admin's dashboard is an overview. Quizzes belong to the teachers. */
  if (isAdmin) {
    mainContent.innerHTML = buildAdminOverview();
    return;
  }

  const { quiz } = getSelection();
  const breadcrumbs = buildBackButton() + buildBreadcrumbs();   // Back button first, then the trail

  /* Level 3 is the quiz manage page, which has its own layout */
  if (getLevel() === LEVEL.MANAGE_QUIZ) {
    mainContent.innerHTML = breadcrumbs + buildManageQuizPage(quiz);
    return;
  }

  /* The teacher sees the subject's class code at the top, above the categories (when a subject is open) */
  const { subject: openSubject } = getSelection();
  const classCodeCard = isTeacher && getLevel() === LEVEL.CATEGORIES && openSubject
    ? buildClassCodeCard(openSubject)
    : "";

  /* A student can add another teacher's subjects from the first screen */
  const joinAnotherCard = isStudent && getLevel() === LEVEL.SUBJECTS
    ? buildJoinAnotherCard()
    : "";

  /* A student sees (and can change) their section at the top of the first screen */
  const mySectionCard = isStudent && getLevel() === LEVEL.SUBJECTS
    ? buildMySectionCard()
    : "";

  mainContent.innerHTML = `${breadcrumbs}${classCodeCard}${mySectionCard}
    <section class="card">
      <h2>${LEVEL_NAMES_PLURAL[getLevel()]}</h2>
      ${buildItemList()}
      ${isTeacher ? buildAddItemRow() : ""}
    </section>
    ${joinAnotherCard}`;
}

/* ----- The manage page of one quiz (admin) ----- */

/* Which question is being edited right now? null = none (the form adds a new question) */
let editingQuestion = null;

/* Card 1: the form to add a question with 4 choices.
   When a question is being edited, the same form is filled with it and saves the changes. */
function buildAddQuestionCard(quiz) {
  const editing = editingQuestion !== null ? quiz.questions[editingQuestion] : null;
  const values = editing ? editing.choices : ["", "", "", ""];

  const choiceInputs = [0, 1, 2, 3].map(position =>
    `<input class="choice-input" placeholder="Choice ${"ABCD"[position]}" value="${escapeHtml(values[position])}">`
  ).join("");
  const answerOptions = [..."ABCD"].map((letter, position) =>
    `<option value="${position}"${editing && editing.answer === position ? " selected" : ""}>${letter}</option>`
  ).join("");

  const buttons = editing
    ? `<div class="action-row">
         <button class="btn" data-action="save-question">Save changes</button>
         <button class="btn ghost" data-action="cancel-edit-question">Cancel</button>
       </div>`
    : `<button class="btn" data-action="add-question">Add question</button>`;

  return `
    <section class="card">
      <h2>${editing ? `Edit question ${editingQuestion + 1}` : "Add question"}</h2>
      <input id="question-text-input" placeholder="Question" value="${editing ? escapeHtml(editing.text) : ""}">
      ${choiceInputs}
      <label>Correct answer <select id="correct-answer-select">${answerOptions}</select></label>
      <p class="muted">Choices are mixed for every student. If a choice says &ldquo;All of the above&rdquo; or &ldquo;Both A and B&rdquo;, that question keeps the order you typed.</p>
      <p id="question-error" class="message error" role="alert"></p>
      ${buttons}
    </section>`;
}

/* Card 2: the questions already in the quiz. The correct choice has a check mark.
   Each question has the three dots (Edit / Delete). */
function buildQuestionListCard(quiz) {
  let content;
  if (quiz.questions.length) {
    const items = quiz.questions.map((question, position) => {
      const choiceText = question.choices
        .map((choice, choicePosition) => (choicePosition === question.answer ? "✔ " : "") + escapeHtml(choice))
        .join(" | ");
      return `
        <li>
          <div class="question-item${position === editingQuestion ? " editing" : ""}">
            <span class="question-number">${position + 1}.</span>
            <div class="question-text">
              <strong>${escapeHtml(question.text)}</strong>
              <div class="muted">${choiceText}</div>
              ${choicesPointAtEachOther(question.choices) ? '<span class="badge">Choices keep their order</span>' : ""}
            </div>
            ${buildDotsMenu("edit-question", "delete-question", position)}
          </div>
        </li>`;
    }).join("");
    content = `<div class="scroll-box" data-limit-rows="li">
        <ol class="numbered-list">${items}</ol>
      </div>`;
  } else {
    content = `<p class="muted">No questions yet.</p>`;
  }
  return `<section class="card"><h2>Questions (${quiz.questions.length})</h2>${content}</section>`;
}

/* Card 3: a table with every student's result. "Reset" lets the student try again. */
function buildResultsCard(quiz) {
  const results = database.results.filter(result => result.quizId === quiz.id)
    .sort((first, second) => byName(first.studentName, second.studentName));   // A to Z
  let content;

  if (results.length) {
    const rows = results.map(result => {
      const scoreText = result.finished
        ? `<span class="badge ${getScoreClass(result.score, result.total)}">${result.score}/${result.total}</span>` : "-";
      let statusText = "Incomplete";
      if (result.finished) statusText = result.autoSubmitted ? "Auto-submitted (time ran out)" : "Submitted";
      const myRequest = database.retakes.find(request => request.quizId === quiz.id && request.username === result.username);
      if (myRequest && myRequest.status === "pending") statusText += " (retake requested)";

      return `
        <tr>
          <td>${escapeHtml(result.studentName)}</td>
          <td>${scoreText}</td>
          <td>${statusText}</td>
          <td><button class="btn ghost" data-action="delete-result" data-value="${result.id}">Reset</button></td>
        </tr>`;
    }).join("");
    content = `
      <div class="table-scroll scroll-box" data-limit-rows="tbody tr">
        <table class="results-table">
          <thead><tr><th>Student</th><th>Score</th><th>Status</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  } else {
    content = `<p class="muted">No one has taken this quiz yet.</p>`;
  }
  return `<section class="card"><h2>Student results</h2>${content}</section>`;
}

/* Long lists scroll after 5 rows (phone and computer). The box is made exactly as tall as its first 5 rows,
   so it works for short and long questions alike. data-limit-rows = which elements are the rows. */
const ROWS_BEFORE_SCROLL = 5;
function limitListHeights() {
  mainContent.querySelectorAll("[data-limit-rows]").forEach(box => {
    const rows = box.querySelectorAll(box.dataset.limitRows);
    box.style.maxHeight = "";
    if (rows.length <= ROWS_BEFORE_SCROLL) return;
    const lastVisible = rows[ROWS_BEFORE_SCROLL - 1];
    const table = lastVisible.closest("table");
    const top = table ? table.offsetTop : 0;
    box.style.maxHeight = (top + lastVisible.offsetTop + lastVisible.offsetHeight + 8) + "px";
  });
}
new MutationObserver(limitListHeights).observe(mainContent, { childList: true });
window.addEventListener("resize", limitListHeights);
window.addEventListener("load", limitListHeights);

/* The whole manage page = the cards above */
/* Teacher: is the quiz open or closed? One button to close it by hand or reopen it.
   (The automatic close date is set with Set close date, here or in the three dots of the quiz card.) */
function buildQuizStatusCard(quiz) {
  const closed = isQuizClosed(quiz);
  const statusText = closed
    ? (quiz.closed ? "Closed. Students cannot start this quiz." : `Closed since ${formatCloseTime(quiz.closeAt)}. Students cannot start this quiz.`)
    : (quiz.closeAt ? `Open. It closes by itself on ${formatCloseTime(quiz.closeAt)}.` : "Open. Students can start this quiz.");
  return `
    <section class="card">
      <h2>Quiz status</h2>
      <p class="muted">${escapeHtml(statusText)} A student who already started can still finish.</p>
      <div class="action-row">
        <button class="btn ${closed ? "" : "ghost"}" data-action="toggle-close-quiz" data-value="${quiz.id}">${closed ? "Reopen quiz" : "Close quiz"}</button>
        <button class="btn ghost" data-action="set-close-date" data-value="${quiz.id}">${quiz.closeAt ? "Change close date" : "Set close date"}</button>
      </div>
    </section>`;
}

function buildManageQuizPage(quiz) {
  return buildQuizStatusCard(quiz)
    + `<div class="card-grid">${buildAddQuestionCard(quiz)}${buildQuestionListCard(quiz)}</div>`
    + buildResultsCard(quiz);
}


/* ---------- 4. Adding things (admin) ---------- */

/* Add a new subject, category or quiz, depending on the current level */
function addItem() {
  const name = document.getElementById("new-item-name").value.trim();
  if (!name) {
    showToast("Type a name first.");
    return;
  }

  const newItem = { id: makeId(), name };
  if (getLevel() === LEVEL.SUBJECTS) {
    const sections = parseSections(document.getElementById("new-item-section").value);
    if (!sections.length) {
      showToast("Type at least one section too.");
      return;
    }
    /* The same subject + the same section twice would only confuse the students */
    const sameOne = database.subjects.some(subject => subject.owner === currentUser.username
      && subject.name.toLowerCase() === name.toLowerCase()
      && getSections(subject).some(item => sections.some(typed => normalizeSection(typed) === normalizeSection(item))));
    if (sameOne) {
      showToast("You already have that subject for one of those sections.");
      return;
    }
    newItem.sections = sections;
    newItem.categories = [];
    newItem.owner = currentUser.username;
    newItem.classCode = makeUniqueClassCode();   // every subject has its own class code
  }
  if (getLevel() === LEVEL.CATEGORIES) newItem.quizzes = [];
  if (getLevel() === LEVEL.QUIZZES) {
    newItem.questions = [];
    const minutes = Number(document.getElementById("new-quiz-minutes").value);
    newItem.minutes = Math.max(1, minutes || 10);   // at least 1 minute, 10 if empty
  }

  /* Subjects are saved in the main list (the list on screen only has MY subjects) */
  if (getLevel() === LEVEL.SUBJECTS) database.subjects.push(newItem);
  else getCurrentList().push(newItem);
  saveAndRender();
}

/* Read the question form. Returns the question, or null (with an error line) if something is empty. */
function readQuestionForm() {
  const text = document.getElementById("question-text-input").value.trim();
  const choices = [...document.querySelectorAll(".choice-input")].map(input => input.value.trim());

  /* The question and all 4 choices must be filled in */
  if (!text || choices.some(choice => !choice)) {
    document.getElementById("question-error").textContent = "Fill in the question and all 4 choices.";
    return null;
  }
  const answer = Number(document.getElementById("correct-answer-select").value);
  return { text, choices, answer };
}

/* Add the question typed in the form to the quiz we are managing */
function addQuestion() {
  const question = readQuestionForm();
  if (!question) return;
  getSelection().quiz.questions.push(question);
  saveAndRender();
}

/* Edit (from the three dots): load the question into the form */
function startEditQuestion(position) {
  editingQuestion = position;
  renderPage();
  const input = document.getElementById("question-text-input");
  input.scrollIntoView({ block: "center" });
  input.focus();
}

/* "Save changes": replace the question with what is in the form */
function saveQuestion() {
  const question = readQuestionForm();
  if (!question || editingQuestion === null) return;
  getSelection().quiz.questions[editingQuestion] = question;
  editingQuestion = null;
  saveAndRender();
  showToast("Question updated.", "success");
}


/* ---------- 5. Class: joining, side menu and rules ---------- */

/* ----- Joining the class (student) ----- */

/* What a student sees until they join: a box to type the teacher's class code */
function buildJoinClassCard() {
  return `
    <section class="card join-class">
      <h2>Join a subject</h2>
      <p>You need to attend your teacher\u2019s subject first. Ask your teacher for the class code of that subject and type it below. Your teacher must approve you before you get in.</p>
      <div class="action-row">
        <input id="class-code-input" class="code-input" placeholder="Class code" maxlength="12"
               autocomplete="off" aria-label="Class code">
        <button class="btn" data-action="join-class">Join subject</button>
      </div>
      <p id="join-error" class="message error" role="alert"></p>
      ${buildMyJoinRequestsHtml()}
    </section>`;
}

/* The student's own requests: waiting for approval, or denied */
function buildMyJoinRequestsHtml() {
  const requests = getMyJoinRequests();
  if (!requests.length) return "";
  const rows = requests.map(request => {
    const teacher = database.users.find(user => user.username === request.teacher);
    const name = escapeHtml(getDisplayName(teacher));
    const requestSubject = database.subjects.find(subject => subject.id === request.subjectId);
    const subjectName = escapeHtml(requestSubject ? getSubjectTitle(requestSubject) : "the subject");
    const text = request.status === "pending"
      ? `Waiting for ${name} to approve you in ${subjectName}`
      : `${name} denied your request for ${subjectName}`;
    const buttonText = request.status === "pending" ? "Cancel request" : "Dismiss";
    return `
      <li class="retake-item">
        <span>${text}</span>
        <button class="btn ghost" data-action="cancel-join" data-value="${request.id}">${buttonText}</button>
      </li>`;
  }).join("");
  return `<ul class="retake-list">${rows}</ul>`;
}

/* The same box for a student who is already in a class: a NEW teacher? Add their subjects here. */
/* The student's section. No section yet (or "Change" pressed): a box to type it. Otherwise: the section and a Change button. */
let changingMySection = false;
function buildMySectionCard() {
  const hasSection = Boolean(currentUser.section);
  if (hasSection && !changingMySection) {
    return `
    <section class="card my-section">
      <div class="action-row">
        <span>Your section: <strong>${escapeHtml(currentUser.section)}</strong></span>
        <button class="btn ghost" data-action="change-my-section">Change</button>
      </div>
    </section>`;
  }
  return `
    <section class="card my-section">
      <h2>${hasSection ? "Change your section" : "Set your section"}</h2>
      <p class="muted">You only see the subjects of your section.</p>
      <div class="add-item-row">
        <div class="field">
          <label for="my-section-input">Section</label>
          <input id="my-section-input" placeholder="e.g. BSIT 2-1" autocomplete="off" value="${escapeHtml(currentUser.section || "")}">
        </div>
        <button class="btn" data-action="save-my-section">Save</button>
        ${hasSection ? `<button class="btn ghost" data-action="cancel-my-section">Cancel</button>` : ""}
      </div>
      <p id="my-section-error" class="message error" role="alert"></p>
    </section>`;
}

function saveMySection() {
  if (!refreshFromStorage()) return;
  const section = document.getElementById("my-section-input").value.trim().replace(/\s+/g, " ");
  if (!section) {
    document.getElementById("my-section-error").textContent = "Type your section first.";
    return;
  }
  currentUser.section = section;
  changingMySection = false;
  saveAndRender();
  showToast("Section saved.", "success");
}

function buildJoinAnotherCard() {
  return `
    <section class="card join-another">
      <h2>Join another subject</h2>
      <p class="muted">Is there a new subject or a new teacher? Type the class code of that subject. The teacher must approve you before you see it.</p>
      <div class="action-row">
        <input id="class-code-input" class="code-input" placeholder="Class code" maxlength="12"
               autocomplete="off" aria-label="Class code">
        <button class="btn" data-action="join-class">Join subject</button>
      </div>
      <p id="join-error" class="message error" role="alert"></p>
      ${buildMyJoinRequestsHtml()}
    </section>`;
}

/* Make codes easy to compare: no spaces or dashes, all capital letters ("abc 123" = "ABC123") */
function normalizeClassCode(code) {
  return code.replace(/[\s-]/g, "").toUpperCase();
}

/* Show a red error under the class code box. It goes away by itself after 1.5 seconds. */
let joinErrorTimer = null;
function showJoinError(text) {
  const line = document.getElementById("join-error");
  if (!line) return;
  line.textContent = text;
  clearTimeout(joinErrorTimer);
  joinErrorTimer = setTimeout(() => {
    const current = document.getElementById("join-error");   // the page may have been drawn again: look it up now
    if (current && current.textContent === text) current.textContent = "";
  }, 1500);
}

/* The student pressed "Join class" */
function joinClass() {
  if (!refreshFromStorage()) return;   // compare against the NEWEST class codes, not an old copy
  const codeInput = document.getElementById("class-code-input");
  const typedCode = normalizeClassCode(codeInput.value);

  if (!typedCode) {
    showJoinError("Type the class code first.");
    return;
  }

  /* The code belongs to one SUBJECT (and so to the teacher who owns it) */
  const subject = database.subjects.find(item => normalizeClassCode(item.classCode || "") === typedCode);
  const teacher = subject && database.users.find(user => user.role === "teacher" && user.username === subject.owner);
  if (!subject || !teacher) {
    showJoinError("That class code is not right. Ask your teacher for the correct code.");
    return;
  }

  if ((currentUser.subjectIds || []).includes(subject.id)) {
    showJoinError("You already joined this subject.");
    return;
  }

  /* The subject must be for MY section. A different section cannot get in, even with the right code. */
  if (!currentUser.section) {
    showJoinError("Set your section first, then type the class code.");
    return;
  }
  if (!subjectHasSection(subject, currentUser.section)) {
    showJoinError(`This subject is not for your section (${currentUser.section}). Ask your teacher.`);
    return;
  }

  /* Correct code, but the code alone is not enough: send a request. The teacher must approve it. */
  const old = database.joinRequests.find(request =>
    request.username === currentUser.username && request.subjectId === subject.id);
  if (old && old.status === "pending") {
    showJoinError("You already sent a request for this subject. Wait for approval.");
    return;
  }
  database.joinRequests = database.joinRequests.filter(request => request !== old);   // a denied request is replaced
  database.joinRequests.push({
    id: makeId(),
    username: currentUser.username,
    studentName: getDisplayName(currentUser),
    teacher: teacher.username,
    subjectId: subject.id,
    status: "pending"
  });
  saveDatabase(database);
  showToast(`Request sent to ${getDisplayName(teacher)} for ${getSubjectTitle(subject)}. Wait for approval.`, "success");
  renderPage();
}

/* ----- The class code (teacher) ----- */

/* A card with THIS subject's class code in big letters, and a button to make a new one.
   It is drawn at the top of the subject's page, above the categories. */
function buildClassCodeCard(subject) {
  const joinedCount = database.users.filter(user =>
    user.role === "student" && (user.subjectIds || []).includes(subject.id)).length;
  const studentWord = joinedCount === 1 ? "student" : "students";

  return `
    <section class="card">
      <h2>Class code</h2>
      <p class="muted">Give this code to the students of ${escapeHtml(getSubjectTitle(subject))}. They type it to ask to join this subject, and you approve them under Requests > Request student.</p>
      <p class="class-code">${escapeHtml(subject.classCode || "")}</p>
      <div class="action-row">
        <span class="muted">${joinedCount} ${studentWord} joined</span>
        <button class="btn ghost" data-action="new-class-code" data-value="${subject.id}">Make a new code</button>
      </div>
    </section>`;
}

/* Make a new class code for ONE subject. Students who already joined stay in the subject. */
function makeNewClassCode(subjectId) {
  askConfirm({
    title: "Make a new class code?",
    message: "The old code will stop working for this subject. Students who already joined stay in the subject.",
    confirmText: "Make new code",
    onConfirm: () => {
      if (!refreshFromStorage()) return;
      const subject = database.subjects.find(item => item.id === subjectId && item.owner === currentUser.username);
      if (!subject) return;
      subject.classCode = makeUniqueClassCode();
      saveAndRender();
      showToast("New class code made.", "success");
    }
  });
}

/* After subjects changed: keep each student's "teachers" list equal to the owners of the subjects they are in.
   (The chat, the classmates and the Students tab use that list.) */
function syncStudentTeachers() {
  database.users.forEach(user => {
    if (user.role !== "student") return;
    const myIds = (user.subjectIds || []).filter(id => database.subjects.some(subject => subject.id === id));
    user.subjectIds = myIds;
    user.teachers = [...new Set(database.subjects.filter(subject => myIds.includes(subject.id)).map(subject => subject.owner))];
  });
}

/* ----- The Students tab (teacher and admin) ----- */

/* Teacher: the students in their class. Admin: every student. A to Z. */
function getStudentsToShow() {
  if (!isAdmin) return getClassmates();
  return database.users
    .filter(user => user.role === "student")
    .sort((first, second) => getDisplayName(first).localeCompare(getDisplayName(second)));
}

/* The small gray line under a student's name */
function describeStudent(student) {
  /* Username on the first line, the section BELOW it (the admin also gets the teachers on a third line) */
  const sectionText = student.section ? escapeHtml(student.section) : "No section";
  const lines = [escapeHtml(student.username), sectionText];
  if (isAdmin) {
    const names = database.users
      .filter(user => user.role === "teacher" && (student.teachers || []).includes(user.username))
      .map(teacher => getDisplayName(teacher));
    lines.push(names.length ? `Teachers: ${escapeHtml(names.join(", "))}` : "Not in a class");
  }
  return lines.join("<br>");
}

/* A to Z list: puts a letter heading (A, B, C...) above the first person whose name starts with it.
   Names that do not start with a letter go under "#". makeRow draws one person. */
function buildLetterRows(people, makeRow) {
  const sorted = people.slice().sort((first, second) => getDisplayName(first).localeCompare(getDisplayName(second), undefined, { sensitivity: "base" }));
  let lastLetter = "";
  return sorted.map(person => {
    const first = getDisplayName(person).trim().charAt(0).toUpperCase();
    const letter = /[A-Z]/.test(first) ? first : "#";
    const heading = letter !== lastLetter ? `<li class="letter-heading" aria-hidden="true">${letter}</li>` : "";
    lastLetter = letter;
    return heading + makeRow(person);
  }).join("");
}

/* A page with the students, so the teacher knows who is in (the admin sees everybody) */
function buildStudentsPage() {
  const students = getStudentsToShow();
  let content;

  if (students.length) {
    const rows = buildLetterRows(students, student => {
      const username = escapeHtml(student.username);
      const inAnyClass = (student.teachers || []).length > 0;
      const removeButton = inAnyClass
        ? `<button class="btn ghost" data-action="remove-student" data-value="${username}">${isAdmin ? "Remove from classes" : "Remove"}</button>`
        : "";
      const deleteButton = isAdmin
        ? `<button class="btn ghost" data-action="delete-account" data-value="${username}">Delete account</button>`
        : "";
      /* Teacher: one button to allow or block quizzes for this student */
      const blocked = isTeacher && isQuizBlocked(student, currentUser.username);
      const accessButton = isTeacher
        ? `<button class="btn ${blocked ? "" : "ghost"}" data-action="toggle-quiz-access" data-value="${username}" aria-pressed="${blocked ? "false" : "true"}">${blocked ? "Allow quizzes" : "Quizzes: On"}</button>`
        : "";
      const blockedBadge = blocked ? ` <span class="badge">Quizzes off</span>` : "";
      return `
      <li class="list-item">
        <div>
          <strong>${escapeHtml(getDisplayName(student))}</strong>${blockedBadge}
          <div class="muted">${describeStudent(student)}</div>
        </div>
        <div class="action-row">${accessButton}${removeButton}${deleteButton}</div>
      </li>`;
    });
    content = `<ul class="item-list student-list">${rows}</ul>`;
  } else {
    content = isAdmin
      ? `<p class="muted">No students have signed up yet.</p>`
      : `<p class="muted">No students have joined yet. Give them the class code.</p>`;
  }
  /* Teacher: allow or block quizzes for the whole class at once */
  const bulk = isTeacher && students.length
    ? `<div class="action-row">
         <button class="btn ghost" data-action="quiz-access-all" data-value="allow">Allow quizzes for all</button>
         <button class="btn ghost" data-action="quiz-access-all" data-value="block">Block quizzes for all</button>
       </div>
       <p class="muted">You decide who can take your quizzes. A student with quizzes off still sees your subjects, but cannot start a quiz.</p>`
    : "";
  return `<section class="card"><h2>Students (${students.length})</h2>${bulk}${content}</section>`;
}

/* Take a student out of the class. They need a class code to join again. Their results are kept.
   Asks first with the custom box, then performRemoveStudent() does the work. */
function removeStudent(username) {
  const student = database.users.find(user => user.username === username && user.role === "student");
  if (!student) return;
  /* A teacher can only remove their own students */
  if (isTeacher && !(student.teachers || []).includes(currentUser.username)) return;
  const where = isAdmin ? "all classes" : "your class";
  askConfirm({
    title: "Remove student?",
    message: `${getDisplayName(student)} will be removed from ${where}. They will need a class code to join again. Their results are kept.`,
    confirmText: "Remove",
    danger: true,
    onConfirm: () => performRemoveStudent(username)
  });
}

function performRemoveStudent(username) {
  if (!refreshFromStorage()) return;   // work on the NEWEST data
  const student = database.users.find(user => user.username === username && user.role === "student");
  if (!student) return;
  if (isTeacher && !(student.teachers || []).includes(currentUser.username)) return;
  /* Teacher: only out of THIS teacher's subjects. Admin: out of every class. */
  if (isTeacher) {
    const myIds = database.subjects.filter(subject => subject.owner === currentUser.username).map(subject => subject.id);
    student.subjectIds = (student.subjectIds || []).filter(id => !myIds.includes(id));
  } else {
    student.subjectIds = [];
  }
  syncStudentTeachers();
  saveAndRender();
  showToast(`${getDisplayName(student)} was removed.`, "success");
}

/* ----- Student pages behind "See more" in the menu ----- */

/* The teachers this student joined */
function buildMyTeachersPage() {
  const teachers = getMyTeachers();
  const rows = teachers.map(teacher => {
    const subjectCount = database.subjects.filter(subject => subject.owner === teacher.username).length;
    return `
      <li class="list-item">
        <div class="card-static">
          <strong>${escapeHtml(getDisplayName(teacher))}</strong>
          <span class="muted">${subjectCount} ${subjectCount === 1 ? "subject" : "subjects"}</span>
        </div>
      </li>`;
  }).join("");
  return `<section class="card"><h2>My teachers (${teachers.length})</h2><ul class="item-list student-list">${rows}</ul></section>`;
}

/* Every subject of this student in a grid (5 columns on computers, 2 on phones - see .subject-grid in quiz.css).
   The whole card opens the subject. */
function buildAllSubjectsPage() {
  const subjects = getVisibleSubjects();
  const cards = subjects.map(subject => `
    <li class="list-item clickable">
      <button type="button" class="card-main" data-action="open" data-value="${subject.id}">
        <strong>${escapeHtml(subject.name)}</strong>
        ${getSection(subject) ? `<span class="item-section">${escapeHtml(getSection(subject))}</span>` : ""}
        <span class="muted">${subject.categories.length} ${subject.categories.length === 1 ? "category" : "categories"}</span>
        <span class="muted">Teacher: ${escapeHtml(getOwnerName(subject))}</span>
      </button>
    </li>`).join("");
  const content = subjects.length
    ? `<ul class="item-list subject-grid">${cards}</ul>`
    : `<p class="muted">No subjects yet.</p>`;
  return `
    <div class="action-row back-row"><button type="button" class="btn ghost" data-action="show-home">\u2190 Back to dashboard</button></div>
    <section class="card"><h2>Subjects (${subjects.length})</h2>${content}</section>`;
}

/* Every classmate: the students who share at least one teacher with this student */
function buildClassmatesPage() {
  const classmates = getClassmates();
  const rows = classmates.map(student => {
    const youTag = student.username === currentUser.username ? ` <span class="muted">(you)</span>` : "";
    return `
      <li class="list-item">
        <div class="card-static"><strong>${escapeHtml(getDisplayName(student))}${youTag}</strong></div>
      </li>`;
  }).join("");
  return `<section class="card"><h2>Classmates (${classmates.length})</h2><ul class="item-list student-list">${rows}</ul></section>`;
}

/* ----- The admin pages: overview, Teachers tab, teacher code ----- */

/* The admin's dashboard: the teacher code and a few numbers */
function buildAdminOverview() {
  const teacherCount = database.users.filter(user => user.role === "teacher").length;
  const studentCount = database.users.filter(user => user.role === "student").length;

  return `
    <div class="card-grid">
      <section class="card">
        <h2>Teacher code</h2>
        <p class="muted">Give this code to teachers. They type it when they sign up as a teacher.</p>
        <p class="class-code">${escapeHtml(database.teacherCode)}</p>
        <div class="action-row">
          <button class="btn ghost" data-action="new-teacher-code">Make a new code</button>
        </div>
      </section>
      <section class="card">
        <h2>Overview</h2>
        <div class="stat-row">
          <div><span class="stat-number">${teacherCount}</span><span class="muted">teachers</span></div>
          <div><span class="stat-number">${studentCount}</span><span class="muted">students</span></div>
          <div><span class="stat-number">${database.subjects.length}</span><span class="muted">subjects</span></div>
        </div>
      </section>
    </div>`;
}

/* Make a new teacher code. Teachers who already signed up are not affected. */
function makeNewTeacherCode() {
  askConfirm({
    title: "Make a new teacher code?",
    message: "The old code will stop working for new sign ups. Teachers who already signed up are not affected.",
    confirmText: "Make new code",
    onConfirm: () => {
      if (!refreshFromStorage()) return;
      database.teacherCode = makeClassCode();
      saveAndRender();
      showToast("New teacher code made.", "success");
    }
  });
}

/* The Teachers tab: every teacher, with how many students and subjects they have */
function buildTeachersPage() {
  const teachers = database.users
    .filter(user => user.role === "teacher")
    .sort((first, second) => getDisplayName(first).localeCompare(getDisplayName(second)));
  let content;

  if (teachers.length) {
    const rows = buildLetterRows(teachers, teacher => {
      const studentCount = database.users.filter(user => user.role === "student" && (user.teachers || []).includes(teacher.username)).length;
      const subjectCount = database.subjects.filter(subject => subject.owner === teacher.username).length;
      return `
      <li class="list-item">
        <div>
          <strong>${escapeHtml(getDisplayName(teacher))}</strong>
          <div class="muted">${escapeHtml(teacher.username)} &middot; ${studentCount} students &middot; ${subjectCount} subjects</div>
        </div>
        <button class="btn ghost" data-action="delete-account" data-value="${escapeHtml(teacher.username)}">Delete account</button>
      </li>`;
    });
    content = `<ul class="item-list student-list">${rows}</ul>`;
  } else {
    content = `<p class="muted">No teachers yet. Give them the teacher code.</p>`;
  }
  return `<section class="card"><h2>Teachers (${teachers.length})</h2>${content}</section>`;
}

/* Delete a teacher or a student account (admin only).
   A teacher's subjects, quizzes and results go too, and their students are left without a class. */
function deleteAccount(username) {
  if (!isAdmin) return;
  const user = database.users.find(item => item.username === username && item.role !== "admin");
  if (!user) return;

  const what = user.role === "teacher"
    ? `${getDisplayName(user)} and all their subjects, quizzes and results`
    : `${getDisplayName(user)} and their results`;
  askConfirm({
    title: user.role === "teacher" ? "Delete teacher account?" : "Delete student account?",
    message: `${what.charAt(0).toUpperCase()}${what.slice(1)} will be deleted. This cannot be undone.`,
    confirmText: "Delete",
    danger: true,
    onConfirm: () => performDeleteAccount(username)
  });
}

function performDeleteAccount(username) {
  if (!isAdmin || !refreshFromStorage()) return;   // work on the NEWEST data
  const user = database.users.find(item => item.username === username && item.role !== "admin");
  if (!user) return;

  if (user.role === "teacher") {
    const ownedSubjects = database.subjects.filter(subject => subject.owner === username);
    const quizIds = ownedSubjects.flatMap(subject => subject.categories.flatMap(category => category.quizzes.map(quiz => quiz.id)));
    database.results  = database.results.filter(result => !quizIds.includes(result.quizId));
    database.retakes  = database.retakes.filter(request => !quizIds.includes(request.quizId));
    database.subjects = database.subjects.filter(subject => subject.owner !== username);
    database.joinRequests = database.joinRequests.filter(request => request.teacher !== username);
    database.users.forEach(item => {
      if (Array.isArray(item.teachers)) item.teachers = item.teachers.filter(name => name !== username);
    });
    syncStudentTeachers();
  } else {
    database.results = database.results.filter(result => result.username !== username);
    database.retakes = database.retakes.filter(request => request.username !== username);
    database.joinRequests = database.joinRequests.filter(request => request.username !== username);
  }
  database.messages = database.messages.filter(message => message.from !== username && message.to !== username);
  database.messages.forEach(message => { if (message.reactions) delete message.reactions[username]; });   // their emojis go too
  database.users = database.users.filter(item => item.username !== username);
  saveAndRender();
}

/* ----- The side menu (student): teacher, subjects, classmates ----- */

/* The students of ONE class, in A to Z order.
   Teacher: their own students. Student: everybody who shares at least one teacher with them. */
function getClassmates() {
  const teacherNames = isTeacher ? [currentUser.username] : (currentUser.teachers || []);
  return database.users
    .filter(user => user.role === "student" && (user.teachers || []).some(name => teacherNames.includes(name)))
    /* A student's classmates are the students of the SAME section (a teacher sees every section) */
    .filter(user => !isStudent || normalizeSection(user.section) === normalizeSection(currentUser.section))
    .sort((first, second) => getDisplayName(first).localeCompare(getDisplayName(second)));
}

/* The tabs in the menu of the admin and the teacher.
   The teacher has a "Requests" group with two tabs inside: Request retake and Request student. */
function buildTabsMenu() {
  const tabButton = (name, label, count = 0) => {
    const countTag = count ? ` <span class="tab-count">${count}</span>` : "";
    return `<button type="button" data-view="${name}"${view === name ? ' aria-current="page"' : ""}>${label}${countTag}</button>`;
  };

  if (isAdmin) {
    const tabs = [["home", "Dashboard"], ["teachers", "Teachers"], ["students", "Students"], ["reports", "Reports", chatOpenReportCount()]];
    return `<ul class="drawer-list">${tabs.map(([name, label, count]) => `<li>${tabButton(name, label, count)}</li>`).join("")}</ul>`;
  }

  const retakeCount = getMyPendingRetakes().length;
  const joinCount = getMyPendingJoins().length;
  const groupCount = retakeCount + joinCount;
  return `
    <ul class="drawer-list">
      <li>${tabButton("home", "Dashboard")}</li>
      <li>
        <p class="drawer-group-label">Requests${groupCount ? ` <span class="tab-count">${groupCount}</span>` : ""}</p>
        <ul class="drawer-list drawer-sublist">
          <li>${tabButton("retakes", "Request retake", retakeCount)}</li>
          <li>${tabButton("joins", "Request student", joinCount)}</li>
        </ul>
      </li>
      <li>${tabButton("students", "Students")}</li>
      <li>${chatTabButton()}</li>
    </ul>`;
}

/* How many names / subjects the menu lists before "See more" */
const DRAWER_LIMIT = 5;

/* The "See more" link. It only shows when there are more than DRAWER_LIMIT. It opens the full list
   in the main window (viewName = the tab to open: "subjects" = all subjects, "classmates", "teachers"). */
function buildSeeMore(total, viewName) {
  if (total <= DRAWER_LIMIT) return "";
  return `<button type="button" class="link-button see-more" data-view="${viewName}">See more</button>`;
}

/* Fill the menu with the latest information. Runs every time the menu opens. */
function renderDrawer() {
  drawerTitle.textContent = isAdmin ? "Admin menu" : isTeacher ? "Teacher menu" : "My class";

  /* Admin and teacher: just the tabs */
  if (!isStudent) {
    drawerContent.innerHTML = buildTabsMenu();
    return;
  }

  if (!hasJoinedClass()) {
    drawerContent.innerHTML = `<p class="muted">Join your teacher\u2019s class to see your subjects and classmates.</p>`;
    return;
  }

  const teachers = getMyTeachers();
  const classmates = getClassmates();
  const subjects = getVisibleSubjects();

  /* Each list shows only the first 5. Past that, "See more" opens the full list in the main window. */
  const teachersHtml = `<ul class="drawer-list">${teachers.slice(0, DRAWER_LIMIT).map(teacher =>
    `<li class="classmate">${escapeHtml(getDisplayName(teacher))}</li>`).join("")}</ul>${buildSeeMore(teachers.length, "teachers")}`;

  const subjectsHtml = subjects.length
    ? `<ul class="drawer-list">${subjects.slice(0, DRAWER_LIMIT).map(subject => `
        <li><button type="button" data-subject-id="${subject.id}">${escapeHtml(getSubjectTitle(subject))}</button></li>`).join("")}</ul>${buildSeeMore(subjects.length, "subjects")}`
    : `<p class="muted">No subjects yet.</p>`;

  const classmatesHtml = `<ul class="drawer-list">${classmates.slice(0, DRAWER_LIMIT).map(student => {
    const youTag = student.username === currentUser.username ? ` <span class="muted">(you)</span>` : "";
    return `<li class="classmate">${escapeHtml(getDisplayName(student))}${youTag}</li>`;
  }).join("")}</ul>${buildSeeMore(classmates.length, "classmates")}`;

  drawerContent.innerHTML = `
    <ul class="drawer-list chat-menu"><li>${chatTabButton()}</li></ul>
    <h3>${teachers.length === 1 ? "Teacher" : `Teachers (${teachers.length})`}</h3>
    ${teachersHtml}
    <h3>Subjects (${subjects.length})</h3>
    ${subjectsHtml}
    <h3>Classmates (${classmates.length})</h3>
    ${classmatesHtml}`;
}

function openDrawer() {
  renderDrawer();
  sideDrawer.removeAttribute("inert");               // "inert" = cannot be clicked or tabbed into
  sideDrawer.setAttribute("aria-hidden", "false");
  sideDrawer.classList.add("open");
  drawerBackdrop.hidden = false;
  menuButton.setAttribute("aria-expanded", "true");
  lockPageScroll(true);   // the page behind stays still, only the menu scrolls
  drawerCloseButton.focus();
}

/* Freeze (or free) the page behind the menu. On computers the page gets the width of the
   disappearing scrollbar as padding, so nothing jumps sideways. */
function lockPageScroll(lock) {
  const root = document.documentElement;
  if (lock) {
    const scrollbar = window.innerWidth - root.clientWidth;
    if (scrollbar > 0) document.body.style.paddingRight = scrollbar + "px";
  } else {
    document.body.style.paddingRight = "";
  }
  root.classList.toggle("drawer-open", lock);
}

function closeDrawer() {
  sideDrawer.classList.remove("open");
  sideDrawer.setAttribute("aria-hidden", "true");
  sideDrawer.setAttribute("inert", "");
  drawerBackdrop.hidden = true;
  menuButton.setAttribute("aria-expanded", "false");
  lockPageScroll(false);
}

/* Show or hide the burger button. It is hidden during a quiz so nobody leaves by accident. */
function setMenuAvailable(isAvailable) {
  menuButton.hidden = !isAvailable;
}

menuButton.onclick = openDrawer;
drawerCloseButton.onclick = closeDrawer;
drawerBackdrop.onclick = closeDrawer;

/* Click in the menu: a tab (admin, teacher) or a subject (student). Then the menu closes. */
drawerContent.onclick = event => {
  const tabButton = event.target.closest("[data-view]");
  if (tabButton) {
    showView(tabButton.dataset.view);
    closeDrawer();
    return;
  }

  const subjectButton = event.target.closest("[data-subject-id]");
  if (!subjectButton) return;
  navigateTo([subjectButton.dataset.subjectId]);
  closeDrawer();
};

/* Click on the "Quiz" title (top of the page): back to the dashboard from any page (Classmates, Teachers...) */
(function setupLogoLink() {
  const logo = document.querySelector(".logo-bar .logo");
  if (!logo) return;
  logo.setAttribute("role", "link");
  logo.setAttribute("tabindex", "0");
  logo.title = "Dashboard";
  function goHome() {
    if (quizInProgress) {
      showToast("You can\u2019t leave during a quiz. Submit it first.");
      return;
    }
    closeDrawer();
    showView("home");
  }
  logo.addEventListener("click", goHome);
  logo.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      goHome();
    }
  });
})();

/* ----- The floating rules box (student) ----- */

/* "Don't show again" is remembered in the browser, separately for each username */
const RULES_HIDDEN_KEY = "quizApp.hideRules." + currentUser.username;

function isRulesHidden() {
  try {
    return localStorage.getItem(RULES_HIDDEN_KEY) === "yes";
  } catch (error) {
    return false;   // storage is blocked: always show the rules
  }
}

function hideRulesForever() {
  try {
    localStorage.setItem(RULES_HIDDEN_KEY, "yes");
  } catch (error) {
    /* storage is blocked: skip it */
  }
}

/* While the rules box is open, nothing behind it can be clicked or tabbed into */
function setPageBehindRulesInert(isInert) {
  document.querySelectorAll(".logo-bar, .user-bar, .dashboard-main, .page-footer").forEach(part => {
    part.inert = isInert;
  });
}

function openRulesModal() {
  rulesDontShowButton.hidden = isRulesHidden();   // no need for this button if they already chose it
  rulesModal.hidden = false;
  setPageBehindRulesInert(true);
  rulesOkButton.focus();
}

function closeRulesModal() {
  rulesModal.hidden = true;
  setPageBehindRulesInert(false);
}

/* The student tried to close the box some other way (clicked outside, pressed Escape):
   the box shakes to say "press Got it or Don't show again" */
function shakeRulesModal() {
  const box = rulesModal.querySelector(".modal-box");
  box.classList.remove("shake");
  void box.offsetWidth;            // restart the animation if it was already shaking
  box.classList.add("shake");
  rulesOkButton.focus();
}

/* Show the rules box on its own, as soon as a student opens the dashboard.
   It does not show if the student chose "Don't show again". */
function maybeShowRules() {
  if (isStudent && !isRulesHidden()) openRulesModal();
}

rulesOkButton.onclick = closeRulesModal;
rulesDontShowButton.onclick = () => {
  hideRulesForever();
  closeRulesModal();
};
showRulesButton.onclick = openRulesModal;   // the "View quiz rules" link at the very bottom

/* The rules box does NOT close when the dark area around it is clicked.
   The student must press "Got it" or "Don't show again". */
rulesModal.onclick = event => {
  if (event.target === rulesModal) shakeRulesModal();
};

/* The Escape key does not close the rules box either. It only closes the menu. */
document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  if (!rulesModal.hidden) shakeRulesModal();
  else if (!editModal.hidden) closeEditModal();
  else if (!closeModal.hidden) hideCloseModal();
  else if (sideDrawer.classList.contains("open")) closeDrawer();
  else closeItemMenus();
});


/* ----- The three dots menus and the edit box (teacher) ----- */

/* Close every open three-dots menu (except the one given) */
function closeItemMenus(except) {
  document.querySelectorAll(".item-menu:not([hidden])").forEach(menu => {
    if (menu === except) return;
    menu.hidden = true;
    menu.previousElementSibling.setAttribute("aria-expanded", "false");
  });
}

/* Press the dots: open that menu (and close the others), or close it if it was open */
function toggleItemMenu(dotsButton) {
  const menu = dotsButton.nextElementSibling;
  const willOpen = menu.hidden;
  closeItemMenus(menu);
  menu.hidden = !willOpen;
  dotsButton.setAttribute("aria-expanded", String(willOpen));
  menu.classList.remove("open-up");

  /* Near the bottom of a scrolling list (or of the screen)? Open the menu UPWARD so nobody has to scroll to see it */
  if (willOpen) {
    const box = dotsButton.closest(".scroll-box");
    const edge = box ? box.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
    const button = dotsButton.getBoundingClientRect();
    const spaceBelow = Math.min(edge.bottom, window.innerHeight) - button.bottom;
    const spaceAbove = button.top - Math.max(edge.top, 0);
    if (spaceBelow < menu.offsetHeight + 8 && spaceAbove > spaceBelow) menu.classList.add("open-up");
  }
}

/* Pressing anywhere else closes the menus */
document.addEventListener("click", event => {
  if (!event.target.closest(".item-menu-wrap")) closeItemMenus();
});

/* Which subject, category or quiz is in the edit box? */
let editingItemId = null;

function openEditModal(itemId) {
  const item = getCurrentList().find(entry => entry.id === itemId);
  if (!item) return;

  const levelName = LEVEL_NAMES_SINGULAR[getLevel()];
  const isQuiz = getLevel() === LEVEL.QUIZZES;

  editingItemId = itemId;
  editTitle.textContent = `Edit ${levelName}`;
  editNameLabel.textContent = `${capitalize(levelName)} name`;
  editNameInput.value = item.name;
  editSectionField.hidden = getLevel() !== LEVEL.SUBJECTS;   // only subjects have a section
  if (getLevel() === LEVEL.SUBJECTS) editSectionInput.value = getSections(item).join(", ");
  editMinutesField.hidden = !isQuiz;            // only quizzes have a time
  if (isQuiz) editMinutesInput.value = item.minutes;
  editCloseField.hidden = !isQuiz;              // only quizzes can close automatically
  if (isQuiz) editCloseInput.value = item.closeAt ? toLocalInputValue(item.closeAt) : "";
  editError.textContent = "";

  editModal.hidden = false;
  editNameInput.focus();
  editNameInput.select();
}

function closeEditModal() {
  editModal.hidden = true;
  editingItemId = null;
}

editForm.onsubmit = event => {
  event.preventDefault();
  const item = getCurrentList().find(entry => entry.id === editingItemId);
  if (!item) { closeEditModal(); return; }

  const name = editNameInput.value.trim();
  if (!name) {
    editError.textContent = "The name cannot be empty.";
    return;
  }
  if (getLevel() === LEVEL.SUBJECTS) {
    const sections = parseSections(editSectionInput.value);
    if (!sections.length) {
      editError.textContent = "Type at least one section.";
      return;
    }
    item.sections = sections;
    delete item.section;
  }
  if (getLevel() === LEVEL.QUIZZES) {
    const minutes = Number(editMinutesInput.value);
    if (!minutes || minutes < 1) {
      editError.textContent = "Time must be at least 1 minute.";
      return;
    }
    item.minutes = Math.floor(minutes);

    /* Automatic close time (optional). Empty = no automatic closing. */
    if (editCloseInput.value) {
      const closeTime = new Date(editCloseInput.value).getTime();
      const unchanged = item.closeAt && toLocalInputValue(item.closeAt) === editCloseInput.value;   // an old time that was not touched
      if (Number.isNaN(closeTime)) {
        editError.textContent = "That close time is not valid.";
        return;
      }
      if (!unchanged && closeTime <= Date.now()) {
        editError.textContent = "Pick a close time in the future.";
        return;
      }
      if (!unchanged) item.closeAt = closeTime;
    } else {
      delete item.closeAt;
    }
  }
  item.name = name;
  closeEditModal();
  saveAndRender();
  showToast("Saved.", "success");
};

document.getElementById("edit-cancel-button").onclick = closeEditModal;
editModal.onclick = event => {
  if (event.target === editModal) closeEditModal();   // unlike the rules box, this one closes when you click outside
};


/* ----- The close date box (teacher): from the three dots of a quiz -> "Set close date" ----- */
const closeModal      = document.getElementById("close-modal");
const closeForm       = document.getElementById("close-form");
const closeDateInput  = document.getElementById("close-date");
const closeError      = document.getElementById("close-error");
const closeQuizName   = document.getElementById("close-quiz-name");
const closeRemoveButton = document.getElementById("close-remove-button");
let closingQuizId = null;   // the quiz in the box

function findQuizOnScreen(quizId) {
  const { category } = getSelection();
  return category ? category.quizzes.find(item => item.id === quizId) : null;
}

function openCloseModal(quizId) {
  const quiz = findQuizOnScreen(quizId);
  if (!quiz) return;
  closingQuizId = quizId;
  closeQuizName.textContent = quiz.name;
  closeDateInput.value = quiz.closeAt ? toLocalInputValue(quiz.closeAt) : "";
  closeRemoveButton.hidden = !quiz.closeAt;   // "Remove date" only when there is a date
  closeError.textContent = "";
  closeModal.hidden = false;
  closeDateInput.focus();
}

function hideCloseModal() {
  closeModal.hidden = true;
  closingQuizId = null;
}

closeForm.onsubmit = event => {
  event.preventDefault();
  if (!refreshFromStorage()) return;   // the newest data first
  const quiz = findQuizOnScreen(closingQuizId);
  if (!quiz) { hideCloseModal(); return; }

  if (!closeDateInput.value) {
    closeError.textContent = "Pick a date and time first.";
    return;
  }
  const closeTime = new Date(closeDateInput.value).getTime();
  if (Number.isNaN(closeTime)) {
    closeError.textContent = "That date is not valid.";
    return;
  }
  const unchanged = quiz.closeAt && toLocalInputValue(quiz.closeAt) === closeDateInput.value;   // the old date, not touched
  if (!unchanged && closeTime <= Date.now()) {
    closeError.textContent = "Pick a date and time in the future.";
    return;
  }
  if (!unchanged) quiz.closeAt = closeTime;
  hideCloseModal();
  saveAndRender();
  showToast(quiz.closed
    ? "Date saved. The quiz is still closed. Reopen it to let students in."
    : `The quiz will close on ${formatCloseTime(quiz.closeAt)}.`, "success");
};

closeRemoveButton.onclick = () => {
  if (!refreshFromStorage()) return;
  const quiz = findQuizOnScreen(closingQuizId);
  if (quiz) delete quiz.closeAt;
  hideCloseModal();
  saveAndRender();
  showToast("The automatic close date was removed.", "success");
};

document.getElementById("close-cancel-button").onclick = hideCloseModal;
closeModal.onclick = event => {
  if (event.target === closeModal) hideCloseModal();   // click outside the box
};


/* ---------- 6. Navigation and the browser's Back button ---------- */

/* Every time a new screen is opened, we add an entry to the browser history.
   That is why the Back button of the mouse, the Back gesture of a phone and
   Alt + Left on the keyboard all work: they go to the screen you were on
   before (for example from Categories back to the dashboard).

   Each history entry remembers:
     ids              where we were (the same list as selectedIds)
     cameFromParent   true when the entry before it is the screen right above it */

let quizInProgress = false;   // true while a student is answering a quiz (see section 8)

/* Open a screen: change selectedIds, add a history entry and draw the page */
function navigateTo(ids, cameFromParent = false) {
  selectedIds = ids;
  view = "home";   // subjects, categories and quizzes live on the dashboard tab
  history.pushState({ ids: ids.slice(), view: view, cameFromParent: cameFromParent }, "");
  renderPage();
}

/* Open a tab of the menu (Dashboard, Teachers, Students) */
function showView(name) {
  name = normalizeView(name);
  if (name === view && !selectedIds.length) {   // already there: just draw it again
    renderPage();
    return;
  }
  view = name;
  selectedIds = [];
  history.pushState({ ids: [], view: view, cameFromParent: false }, "");
  renderPage();
}

/* The Back button on the page: go up one level.
   When the screen before this one is the screen above it, we use the real
   browser Back, so the history does not fill up with copies. */
function goUpOneLevel() {
  if (history.state && history.state.cameFromParent) history.back();
  else navigateTo(selectedIds.slice(0, -1));
}

/* Go to a level (the links of the trail at the top, "Back to quizzes"...) */
function goToLevel(level) {
  if (level === getLevel()) renderPage();                     // already there: just draw it again
  else if (level === getLevel() - 1) goUpOneLevel();
  else navigateTo(selectedIds.slice(0, level));
}

/* Keep only the ids that still exist. (Things can be deleted after the history entry was made.) */
function getValidIds(ids) {
  const valid = [];
  let subject, category, quiz;

  subject = getVisibleSubjects().find(item => item.id === ids[0]);
  if (subject) valid.push(subject.id);
  category = subject && subject.categories.find(item => item.id === ids[1]);
  if (category) valid.push(category.id);
  quiz = category && isTeacher && category.quizzes.find(item => item.id === ids[2]);   // only the teacher has this screen
  if (quiz) valid.push(quiz.id);
  return valid;
}

/* The person pressed Back or Forward (mouse, phone, keyboard...) */
window.addEventListener("popstate", event => {
  const ids = (event.state && event.state.ids) || [];

  /* During a quiz Back is not allowed: go forward again, so the quiz stays on screen */
  if (quizInProgress) {
    if (JSON.stringify(ids) === JSON.stringify(selectedIds)) return;   // we are back on the quiz's own entry
    history.go(1);
    showToast("You can\u2019t go back during a quiz. Submit it first.");
    return;
  }

  selectedIds = getValidIds(ids);
  view = normalizeView(event.state && event.state.view);
  closeDrawer();
  closeEditModal();
  renderPage();
});

/* When the page opens (or is refreshed), stay on the screen we were on */
selectedIds = getValidIds((history.state && history.state.ids) || []);
view = normalizeView(history.state && history.state.view);
history.replaceState({ ids: selectedIds.slice(), view: view, cameFromParent: Boolean(history.state && history.state.cameFromParent) }, "");


/* ---------- 7. Button clicks ---------- */

/* One listener for the whole page. It finds the button that was clicked
   and does the job named in its data-action. */
mainContent.onclick = event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const action = button.dataset.action;
  const value = button.dataset.value;

  /* The three dots: open or close their menu. Any other button closes the open menus first. */
  if (action === "none") return;
  if (action === "toggle-menu") {
    toggleItemMenu(button);
    return;
  }
  closeItemMenus();

  if (action === "join-class") {
    joinClass();
  } else if (action === "new-class-code") {
    makeNewClassCode(value);
  } else if (action === "new-teacher-code") {
    makeNewTeacherCode();
  } else if (action === "remove-student") {
    removeStudent(value);
  } else if (action === "delete-account") {
    deleteAccount(value);
  } else if (action === "back") {
    /* Back button: go up one level */
    goUpOneLevel();
  } else if (action === "go") {
    /* Link in the trail at the top: go to that level */
    goToLevel(Number(value));
  } else if (action === "open") {
    /* Open a subject, category or quiz */
    navigateTo([...selectedIds, value], true);
  } else if (action === "change-my-section") {
    changingMySection = true;
    renderPage();
    document.getElementById("my-section-input").focus();
  } else if (action === "cancel-my-section") {
    changingMySection = false;
    renderPage();
  } else if (action === "save-my-section") {
    saveMySection();
  } else if (action === "show-subjects") {
    showView("subjects");
  } else if (action === "show-home") {
    showView("home");
  } else if (action === "take") {
    startQuizAttempt(value);
  } else if (action === "toggle-quiz-access") {
    if (isTeacher && refreshFromStorage()) {
      const student = database.users.find(user => user.username === value);
      if (student && setQuizAccess(value, isQuizBlocked(student, currentUser.username))) saveAndRenderInPlace();   // blocked -> allow, allowed -> block
    }
  } else if (action === "quiz-access-all") {
    if (isTeacher && refreshFromStorage()) {
      getStudentsToShow().forEach(student => setQuizAccess(student.username, value === "allow"));
      showToast(value === "allow" ? "Quizzes are on for the whole class." : "Quizzes are off for the whole class.", "success");
      saveAndRenderInPlace();
    }
  } else if (action === "add") {
    addItem();
  } else if (action === "toggle-close-quiz") {
    if (!isTeacher || !refreshFromStorage()) return;
    const { category } = getSelection();
    const quiz = category && category.quizzes.find(item => item.id === value);
    if (!quiz) return;
    if (isQuizClosed(quiz)) {
      quiz.closed = false;
      if (quiz.closeAt && quiz.closeAt <= Date.now()) delete quiz.closeAt;   // the time already passed: remove it, or it would close again
      showToast("Quiz reopened.", "success");
    } else {
      quiz.closed = true;
      showToast("Quiz closed. Students cannot start it.", "success");
    }
    saveAndRender();
  } else if (action === "set-close-date") {
    openCloseModal(value);
  } else if (action === "edit") {
    openEditModal(value);
  } else if (action === "add-question") {
    addQuestion();
  } else if (action === "edit-question") {
    startEditQuestion(Number(value));
  } else if (action === "save-question") {
    saveQuestion();
  } else if (action === "cancel-edit-question") {
    editingQuestion = null;
    renderPage();
  } else if (action === "delete-question") {
    askConfirm({
      title: "Delete this question?",
      message: "This question will be removed from the quiz.",
      confirmText: "Delete",
      danger: true,
      onConfirm: () => {
        const { quiz } = getSelection();
        if (!quiz) return;
        quiz.questions.splice(Number(value), 1);   // value = position of the question
        editingQuestion = null;
        saveAndRender();
      }
    });
  } else if (action === "request-retake") {
    requestRetake(value);
  } else if (action === "approve-join") {
    answerJoin(value, true);
  } else if (action === "deny-join") {
    answerJoin(value, false);
  } else if (action === "cancel-join") {
    cancelJoin(value);
  } else if (action === "approve-retake") {
    answerRetake(value, true);
  } else if (action === "deny-retake") {
    answerRetake(value, false);
  } else if (action === "delete-result") {
    /* Ask first (modal), so a student's score is not wiped by an accidental click */
    const target = database.results.find(result => result.id === value);
    if (target) {
      askConfirm({
        title: "Reset attempt?",
        message: `${target.studentName}'s score will be deleted and they can take this quiz again. This cannot be undone.`,
        confirmText: "Reset",
        onConfirm: () => {
          /* Reset also clears that student's retake request for the quiz */
          database.retakes = database.retakes.filter(request =>
            !(request.username === target.username && request.quizId === target.quizId));
          database.results = database.results.filter(result => result.id !== value);
          saveAndRender();
          showToast("Attempt reset.", "success");
        }
      });
    }
  } else if (action === "delete") {
    const levelWord = LEVEL_NAMES_SINGULAR[getLevel()] || "item";   // subject, category or quiz
    askConfirm({
      title: `Delete this ${levelWord}?`,
      message: `This ${levelWord} and everything inside it will be deleted. This cannot be undone.`,
      confirmText: "Delete",
      danger: true,
      onConfirm: () => {
        if (getLevel() === LEVEL.SUBJECTS) {
          database.subjects = database.subjects.filter(item => item.id !== value);   // (the list on screen is only a copy of MY subjects)
          database.joinRequests = database.joinRequests.filter(request => request.subjectId !== value);
          syncStudentTeachers();   // students lose the deleted subject
        } else {
          const list = getCurrentList();
          const position = list.findIndex(item => item.id === value);
          if (position !== -1) list.splice(position, 1);
        }
        saveAndRender();
      }
    });
  }
};


/* Pressing Enter in the class code box works like "Join class".
   Enter in the name or time box of the add form works like "Add". */
mainContent.onkeydown = event => {
  if (event.key !== "Enter") return;
  if (event.target.id === "class-code-input") joinClass();
  else if (event.target.id === "my-section-input") saveMySection();
  else if (event.target.id === "new-item-name" || event.target.id === "new-item-section" || event.target.id === "new-quiz-minutes") addItem();
};


/* ---------- 8. Taking a quiz (student) ---------- */

/* A fair random order (Fisher-Yates). Gives back a NEW list and leaves the original alone.
   (Sorting with Math.random() looks random but favors some orders, so we do not use it.) */
function shuffleList(list) {
  const mixed = [...list];
  for (let last = mixed.length - 1; last > 0; last--) {
    const other = Math.floor(Math.random() * (last + 1));
    [mixed[last], mixed[other]] = [mixed[other], mixed[last]];
  }
  return mixed;
}

/* Does one of the choices point at the OTHER choices?  Examples: "All of the above", "None of the above",
   "Both A and B", "A and C only", "A, B and C".
   Mixing the choices would make those wrong ("the above" would be something else), so a question like this
   keeps the teacher's order of choices. (The order of the QUESTIONS is still random.)
   If a normal choice is caught by mistake (for example "Vitamin A and D"), nothing breaks: that question just keeps its order. */
function choicesPointAtEachOther(choices) {
  const wordsPattern = /\b(all|none|neither|both)\s+(of\s+)?(the\s+)?(above|these|them)\b/i;   // All of the above...
  const lettersPattern = /(^|[\s(])[A-D]\)?\s*(,|and|&|or|\+)\s*\(?[A-D]\b/;                      // Both A and B, A, B and C...
  return choices.some(choice => wordsPattern.test(choice) || lettersPattern.test(choice));
}

/* Start a quiz for the student. The quiz shows ONE question at a time.

   How it works:
     - Pick an answer and the Next button appears. You can change your pick
       until you press Next. There is no going back to an earlier question.
     - The questions and their choices are in a random order for every attempt.
     - Copy, paste, right-click and some keyboard shortcuts are blocked.
     - Leaving the tab CANCELS the quiz. The student goes back to the list
       of quizzes, sees a message, and has to start again.
     - When the time runs out, the quiz is submitted with the answers so far.
     - The attempt is saved at the start, so refreshing the page does not
       give a second try (the admin can press "Reset" to allow one).
   These rules work in the browser only, so a determined person can bypass them. */
function startQuizAttempt(quizId) {
  if (!refreshFromStorage()) return;   // newest data first: the teacher may have just turned quizzes off
  const { subject, category } = getSelection();
  if (!subject || !category) return;
  if (isQuizBlocked(currentUser, subject.owner)) {
    showToast("Your teacher turned quizzes off for you.");
    renderPage();
    return;
  }
  const quiz = category.quizzes.find(item => item.id === quizId);
  if (!quiz) return;
  if (getMyResult(quizId)) return;   // already tried this quiz
  if (isQuizClosed(quiz)) {          // closed by the teacher, or its close time has come
    showToast("This quiz is closed.");
    renderPage();
    return;
  }

  /* Anti-cheating: every attempt gets its OWN random order. The questions are mixed AND the
     4 choices of each question are mixed too, so two students sitting next to each other
     (or the same student on a retake) do not see the same screen. The right answer follows
     its choice (answer = the new position of the right choice). The quiz itself is not changed.
     Exception: a question with "All of the above" / "Both A and B" keeps its choices in order. */
  const questions = shuffleList(quiz.questions).map(question => {
    const positions = question.choices.map((choice, position) => position);               // [0, 1, 2, 3]
    const keepOrder = choicesPointAtEachOther(question.choices);   // "All of the above", "Both A and B"...
    const newOrder = keepOrder ? positions : shuffleList(positions);                      // e.g. [2, 0, 3, 1]
    return {
      text: question.text,
      choices: newOrder.map(position => question.choices[position]),
      answer: newOrder.indexOf(question.answer)
    };
  });

  /* Save the attempt right now as "not finished" */
  const result = {
    id: makeId(),
    username: currentUser.username,
    studentName: getDisplayName(currentUser),
    quizId: quizId,
    score: 0,
    total: questions.length,
    finished: false,
    autoSubmitted: false    // true only when the time ran out
  };
  database.results.push(result);
  saveDatabase(database);

  setMenuAvailable(false);   // no menu during the quiz, so nobody leaves by accident
  quizInProgress = true;     // the browser's Back button is blocked until the quiz ends

  /* State of this attempt */
  let questionNumber = 0;           // which question is showing (0 = the first one)
  const pickedAnswers = [];         // pickedAnswers[0] = the choice picked for question 1, and so on
  let quizEnded = false;            // true once the quiz is submitted or cancelled
  let secondsLeft = quiz.minutes * 60;
  let timerId;

  /* Draw the quiz screen. The question itself is drawn by showQuestion() below. */
  mainContent.innerHTML = `
    <section class="card quiz-attempt">
      <div class="quiz-header">
        <strong>${escapeHtml(quiz.name)}</strong>
        <span id="timer-label" class="badge" role="timer"></span>
      </div>
      <p id="question-counter" class="question-counter" aria-live="polite"></p>
      <div id="question-area"></div>
      <button class="btn" id="next-button" hidden></button>
    </section>`;

  const questionCounter = document.getElementById("question-counter");
  const questionArea = document.getElementById("question-area");
  const nextButton = document.getElementById("next-button");

  /* --- Showing one question --- */
  function showQuestion() {
    const question = questions[questionNumber];
    const isLastQuestion = questionNumber === questions.length - 1;

    questionCounter.textContent = `Question ${questionNumber + 1} of ${questions.length}`;

    const choicesHtml = question.choices.map((choice, position) => `
      <label class="answer-option">
        <input type="radio" name="answer" value="${position}"> <strong>${"ABCD"[position]}.</strong> ${escapeHtml(choice)}
      </label>`).join("");
    questionArea.innerHTML = `<fieldset><legend>${escapeHtml(question.text)}</legend>${choicesHtml}</fieldset>`;

    /* The Next button stays hidden until the student picks an answer */
    nextButton.hidden = true;
    nextButton.textContent = isLastQuestion ? "Submit quiz" : "Next question";
  }

  /* The student picked (or changed) an answer: now the Next button can show */
  questionArea.addEventListener("change", () => { nextButton.hidden = false; });

  /* Remember which choice is selected right now for the question on screen */
  function rememberCurrentChoice() {
    const picked = questionArea.querySelector('input[name="answer"]:checked');
    if (picked) pickedAnswers[questionNumber] = Number(picked.value);
  }

  /* Next button: save the pick, then show the next question (or finish) */
  nextButton.onclick = () => {
    rememberCurrentChoice();
    questionNumber++;
    if (questionNumber < questions.length) showQuestion();
    else finishQuiz(false);
  };

  /* --- Rules: block copy, paste, right-click, shortcuts --- */
  const blockEvent = event => event.preventDefault();
  const blockedEvents = ["copy", "cut", "paste", "contextmenu", "selectstart", "dragstart"];

  /* Blocks Ctrl/Cmd + C, V, X, A, U, P, S and also F12 and PrintScreen */
  const blockShortcuts = event => {
    const usesCtrl = event.ctrlKey || event.metaKey;
    if ((usesCtrl && "cvxaups".includes(event.key.toLowerCase())) || event.key === "F12" || event.key === "PrintScreen") {
      event.preventDefault();
    }
  };

  /* --- Rules: leaving the tab cancels the quiz --- */
  const handleLeave = () => cancelQuizBecauseTabWasLeft();
  const handleVisibilityChange = () => { if (document.hidden) handleLeave(); };

  /* Turn all the rules on */
  blockedEvents.forEach(name => document.addEventListener(name, blockEvent));
  document.addEventListener("keydown", blockShortcuts);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("blur", handleLeave);

  /* Turn all the rules off and stop the timer (used when the quiz ends) */
  function stopQuizRules() {
    quizEnded = true;
    quizInProgress = false;   // Back works again
    clearInterval(timerId);
    setMenuAvailable(true);   // the menu is back
    blockedEvents.forEach(name => document.removeEventListener(name, blockEvent));
    document.removeEventListener("keydown", blockShortcuts);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("blur", handleLeave);
  }

  /* --- Countdown timer, shown as 4:59 --- */
  const showTime = () => {
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = String(secondsLeft % 60).padStart(2, "0");
    document.getElementById("timer-label").textContent = `${minutes}:${seconds}`;
  };
  showTime();
  timerId = setInterval(() => {
    secondsLeft--;
    showTime();
    if (secondsLeft <= 0) {
      rememberCurrentChoice();   // count the answer on screen even if Next was not pressed
      finishQuiz(true);          // time is up
    }
  }, 1000);

  /* --- Cancel: the student left the tab ---
     The attempt is deleted so they can start again, and they are sent back to
     the list of quizzes. (To send them to the very first screen instead, use
     navigateTo([]) instead of renderPage().) */
  function cancelQuizBecauseTabWasLeft() {
    if (quizEnded) return;
    stopQuizRules();

    database.results = database.results.filter(item => item.id !== result.id);
    saveDatabase(database);

    renderPage();                 // we are still inside the category, so this shows its quizzes
    showMessageWhenBack();
  }

  /* Show the "you left the tab" toast. If the student is still away, wait
     until they come back to this tab so they actually see it. */
  function showMessageWhenBack() {
    const isBack = () => !document.hidden && document.hasFocus();
    const showIt = () => showToast(LEFT_TAB_MESSAGE, "error", LEFT_TAB_TOAST_TIME);

    if (isBack()) { showIt(); return; }

    const waitForReturn = () => {
      if (!isBack()) return;
      document.removeEventListener("visibilitychange", waitForReturn);
      window.removeEventListener("focus", waitForReturn);
      showIt();
    };
    document.addEventListener("visibilitychange", waitForReturn);
    window.addEventListener("focus", waitForReturn);
  }

  /* --- Submit: count the score, show the result ---
     autoSubmitted is true when the time ran out. */
  function finishQuiz(autoSubmitted) {
    if (quizEnded) return;
    stopQuizRules();

    /* Score = number of questions where the picked choice is the right one */
    result.score = questions.reduce((total, question, number) => {
      return total + (pickedAnswers[number] === question.answer ? 1 : 0);
    }, 0);

    /* Save the final result */
    Object.assign(result, { finished: true, autoSubmitted: autoSubmitted === true });
    saveDatabase(database);

    /* Show the score */
    const autoMessage = autoSubmitted === true
      ? `<p class="muted">Your quiz was submitted automatically because the time ran out.</p>`
      : "";
    mainContent.innerHTML = `
      <section class="card quiz-result">
        <h2>Quiz submitted</h2>
        <p class="score-number ${getScoreClass(result.score, result.total)}">${result.score} / ${result.total}</p>
        ${autoMessage}
        <button class="btn" data-action="go" data-value="2">Back to quizzes</button>
      </section>`;
  }

  showQuestion();
}


/* ---------- Start: draw the page for the first time ---------- */

/* Everybody gets the menu button. Students also get the "View quiz rules" link. */
setMenuAvailable(true);
if (isStudent) showRulesButton.hidden = false;

renderPage();
maybeShowRules();   // the floating rules box pops up right away (students only)
