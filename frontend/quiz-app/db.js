/* ==========================================================================
   db.js  -  The "database" of the quiz app
   --------------------------------------------------------------------------
   This is a DEMO. Everything is saved in the browser (localStorage), so the
   data stays only on this computer. Replace this file with real backend
   calls (PHP, Node, Flask...) when you are ready.

   Shape of the data (what is saved):

   database = {
     teacherCode: "TEACHER1", // the code a person must type to sign up as a TEACHER
     users:    [ { username, password, role, name,
                   section,     // students only: their section, like "BSIT 2-1". A student only sees the subjects of that section.
                   subjectIds,  // students only: ids of the SUBJECTS they joined (they see only these)
                   teachers,    // students only: usernames of the teachers of those subjects (kept in sync; used by chat and classmates)
                   quizBlockedBy } ],// students only, optional: teachers who turned quizzes OFF for this student.
                                // Not there = allowed. The teacher changes it on the Students tab.
                                // role is "admin", "teacher" or "student"
     subjects: [ {
       id, name,
       sections,                // the sections of the subject: a LIST like ["BSIT 2-1", "BSIT 2-2"]. Only students of those
                                // sections can join it (older subjects may have none: then every section can join)
       classCode,               // the code students type to join THIS subject (each subject has its own)
       owner,                   // username of the teacher who made it
       categories: [ {
         id, name,
         quizzes: [ {
           id, name, minutes,
           closed,    // optional: true = the teacher closed the quiz by hand (students cannot start it)
           closeAt,   // optional: a time (Date.now() milliseconds). From that moment the quiz closes by itself.
           questions: [ { text, choices: ["A", "B", ...], answer: 0 } ]
         } ]
       } ]
     } ],
     results:  [ { id, username, studentName, quizId, score, total,
                   finished, autoSubmitted } ],
     retakes:  [ { id, username, studentName, quizId,
                   status } ]   // a student asked to take a quiz again. status: "pending" or "denied".
                                // The teacher approves (the old result is deleted, the student can retake)
                                // or denies (the student sees "Retake denied" and may ask again).
     joinRequests: [ { id, username, studentName, teacher, subjectId,
                       status } ] // a student typed a SUBJECT's class code. status: "pending" or "denied".
                                // A class code alone does NOT let anybody in: the teacher must approve
                                // (Requests > Request student). Approve = the student joins that subject.
     messages: [ { id, from, to, text,
                   time,        // when it was sent (Date.now(), milliseconds)
                   read } ]     // chat between a student and a teacher of their class, or between two classmates (see chat.js).
                                // from / to are usernames. read = the person it was sent TO has opened it.
                                // Message fields that are only there when they are used:
                                //   replyTo    id of the message this one answers
                                //   forwarded  true = a copy that was forwarded
                                //   reactions  { username: "emoji" }  (one per person)
                                //   deleted    true = unsent (text is "" ), removed = true when the admin did it
     reports:  [ { id, messageId, reporter, reported, text, reason, time,
                   status } ]   // a message somebody reported. status: "open", "dismissed" or "removed".
                                // "text" is a copy of the message. The admin reviews them under Reports.
   }

   "answer" is the position of the correct choice (0 = first choice).

   THREE ROLES:
     admin    the one and only admin. Sees all teachers and students, and owns the
              TEACHER CODE (people type it when they sign up as a teacher).
     teacher  signs up with the teacher code. Has their own subjects (each subject has
              its own class code), quizzes and students.
     student  signs up freely. Sees nothing until they type a subject's class code
              (see the join screen in app.js). Then they see that subject.
   ========================================================================== */

/* Names used to save things in the browser.
   Change STORAGE_KEY to start fresh with an empty database. */
const STORAGE_KEY = "quizApp.db.v3";      // where the whole database is saved
const SESSION_KEY = "quizApp.user";       // where the logged-in username is saved (sessionStorage = EACH TAB has its own sign in)


/* Make a short random id like "k3j9x2a". Used for subjects, categories, quizzes... */
function makeId() {
  return Math.random().toString(36).slice(2, 9);
}

/* The codes the demo starts with. They can be changed on the dashboard
   (the teacher changes the class code, the admin changes the teacher code). */
const DEFAULT_CLASS_CODE = "ABC123";
const DEFAULT_TEACHER_CODE = "TEACHER1";

/* Make a new class code: 6 letters and numbers like "K7P2QX".
   Letters and numbers that look alike (O and 0, I and 1) are left out. */
function makeClassCode() {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
}

/* A class code that no other SUBJECT is using yet. Pass the list of subjects to check
   (loadDatabase uses it before "database" exists). */
function makeUniqueClassCode(subjects = database.subjects) {
  let code;
  do {
    code = makeClassCode();
  } while (subjects.some(subject => subject.classCode === code));
  return code;
}

/* Save the database to the browser. The try/catch keeps the app working
   even if the browser blocks storage (for example, private mode). */
function saveDatabase(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    /* storage is blocked: do nothing */
  }
}

/* The starting data: 3 demo accounts (admin, teacher, student) and 1 sample quiz. Used the very first time. */
function createSeedData() {
  const demoSubjectId = makeId();
  const data = {
    teacherCode: DEFAULT_TEACHER_CODE,
    users: [
      { username: "admin",   password: "admin123",   role: "admin",   name: "Admin" },
      { username: "teacher", password: "teacher123", role: "teacher", name: "Demo Teacher" },
      /* The demo student is already in the demo subject, so they can try the quiz right away */
      { username: "student", password: "student123", role: "student", name: "Demo Student", section: "Section A", subjectIds: [demoSubjectId], teachers: ["teacher"] }
    ],
    subjects: [
      {
        id: demoSubjectId,
        name: "Science",
        sections: ["Section A"],
        classCode: DEFAULT_CLASS_CODE,
        owner: "teacher",
        categories: [
          {
            id: makeId(),
            name: "Basics",
            quizzes: [
              {
                id: makeId(),
                name: "Quiz 1",
                minutes: 5,
                questions: [
                  { text: "What is the chemical formula of water?",
                    choices: ["CO2", "H2O", "O2", "NaCl"], answer: 1 },
                  { text: "Which planet is closest to the Sun?",
                    choices: ["Venus", "Earth", "Mercury", "Mars"], answer: 2 }
                ]
              }
            ]
          }
        ]
      }
    ],
    results: [],
    retakes: [],
    joinRequests: [],
    messages: [],
    reports: []
  };
  saveDatabase(data);
  return data;
}

/* Read the database from the browser. If nothing is saved yet, create the starting data. */
function loadDatabase() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) {
      /* Data saved without a teacher code yet: add one */
      if (!saved.teacherCode) {
        saved.teacherCode = DEFAULT_TEACHER_CODE;
        saveDatabase(saved);
      }
      /* Data saved before retake requests existed: add the empty list */
      if (!Array.isArray(saved.retakes)) {
        saved.retakes = [];
        saveDatabase(saved);
      }
      /* Data saved before join approval existed: add the empty list */
      if (!Array.isArray(saved.joinRequests)) {
        saved.joinRequests = [];
        saveDatabase(saved);
      }
      /* Data saved before chat existed: add the empty list */
      if (!Array.isArray(saved.messages)) {
        saved.messages = [];
        saveDatabase(saved);
      }
      /* Data saved before message reports existed: add the empty list */
      if (!Array.isArray(saved.reports)) {
        saved.reports = [];
        saveDatabase(saved);
      }
      /* Older data: a student had ONE teacher ("teacher"). Now a student has a list ("teachers"). */
      let changed = false;
      saved.users.forEach(user => {
        if (user.role === "student" && !Array.isArray(user.teachers)) {
          user.teachers = user.teacher ? [user.teacher] : [];
          delete user.teacher;
          changed = true;
        }
      });
      /* Older data: the class code belonged to the TEACHER. Now every SUBJECT has its own code.
         A teacher's first subject keeps the old code (so a code you already gave out still works);
         the other subjects get new ones. */
      saved.users.forEach(user => {
        if (user.role !== "teacher") return;
        let oldCode = user.classCode;
        saved.subjects.filter(subject => subject.owner === user.username && !subject.classCode).forEach(subject => {
          const free = oldCode && !saved.subjects.some(other => other.classCode === oldCode);
          subject.classCode = free ? oldCode : makeUniqueClassCode(saved.subjects);
          oldCode = null;
          changed = true;
        });
        if ("classCode" in user) { delete user.classCode; changed = true; }
      });
      /* Older data: a subject had ONE section ("section"). Now it has a list ("sections"). */
      saved.subjects.forEach(subject => {
        if (!Array.isArray(subject.sections)) {
          subject.sections = subject.section ? [subject.section] : [];
          delete subject.section;
          changed = true;
        }
      });
      /* Older data: a student joined a whole teacher. Now they join subjects, so give them every
         subject of the teachers they were already in (nothing disappears for them). */
      saved.users.forEach(user => {
        if (user.role === "student" && !Array.isArray(user.subjectIds)) {
          user.subjectIds = saved.subjects
            .filter(subject => (user.teachers || []).includes(subject.owner))
            .map(subject => subject.id);
          changed = true;
        }
      });
      if (changed) saveDatabase(saved);
      return saved;
    }
  } catch (error) {
    /* saved data is broken: fall through and create new data */
  }
  return createSeedData();
}

/* The one shared copy of the data. Other files read and change this, then call saveDatabase(database). */
let database = loadDatabase();

/* Who is logged in? The username is kept in sessionStorage, so EVERY TAB has its own account:
   you can be a teacher in one tab and a student in another. The person stays signed in after a
   refresh, but must sign in again in a new tab or after closing the tab. (The data itself stays in localStorage.) */
function getSessionUser() {
  try { return sessionStorage.getItem(SESSION_KEY); } catch (error) { return null; }
}
function setSessionUser(username) {
  try { sessionStorage.setItem(SESSION_KEY, username); } catch (error) { /* storage is blocked */ }
}
function clearSessionUser() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch (error) { /* storage is blocked */ }
}

/* Who is logged in right now? Returns the user object, or undefined if nobody is. */
function getCurrentUser() {
  const username = getSessionUser();
  return database.users.find(user => user.username === username);
}

/* Turn a username into a nicer name: "juan.delacruz" -> "Juan Delacruz".
   Used for students who signed in with just a username (no full name was typed). */
function prettifyName(username) {
  return username
    .replace(/[._-]+/g, " ")        // dots, underscores and dashes become spaces
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/* The name to SHOW for a user: their full name if we have one,
   otherwise a nicer version of their username. */
function getDisplayName(user) {
  if (user.name && user.name !== user.username) return user.name;
  return prettifyName(user.username);
}
