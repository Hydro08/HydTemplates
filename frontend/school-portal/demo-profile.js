/* DEMO_MODE only (no backend): the profile is saved in the browser's localStorage.
   With a real backend it is saved in the database instead (see /api/profile). */
const DEMO_PROFILE_PREFIX = "portalProfile:";

/* Required profile fields. Keep in sync with the inputs in profile.html and FIELDS in api/profile.php. */
const PROFILE_FIELDS = [
  "last_name", "first_name",            // middle_name is optional
  "gender", "civil_status",
  "birthdate", "year_level", "section",
  "email", "phone", "street", "barangay", "city", "province", "zip",
  "prov_street", "prov_barangay", "prov_city", "prov_province", "prov_zip",   // Province address (a copy of the home address when "Same as home address" is checked)
  "father_name", "father_occupation", "father_phone",
  "mother_name", "mother_occupation", "mother_phone",
  "guardian_name", "guardian_occupation", "guardian_phone"
];

/* "Juan Santos Dela Cruz" from the three name parts (the middle name may be empty) */
function composeName(p) {
  return [p.first_name, p.middle_name, p.last_name].map(v => String(v || "").trim()).filter(Boolean).join(" ");
}

function getDemoProfile(username) {
  try { return JSON.parse(localStorage.getItem(DEMO_PROFILE_PREFIX + String(username).toLowerCase())); }
  catch { return null; }
}

function saveDemoProfile(username, profile) {
  try { localStorage.setItem(DEMO_PROFILE_PREFIX + String(username).toLowerCase(), JSON.stringify(profile)); }
  catch {}
}

/* An account is verified only when every required field has a value. */
function isProfileComplete(profile) {
  return !!profile && PROFILE_FIELDS.every(f => String(profile[f] ?? "").trim() !== "");
}

/* STUDENT ID: how IDs are made is up to you (the school). This template hands out a random one when the account
   is created: the current year + 5 random digits, e.g. 2026-48213. Replace this function with your own rule
   (sequential numbers, a school-issued list, ...). In demo mode the ID is remembered per username in localStorage. */
function generateStudentId() {
  return new Date().getFullYear() + "-" + String(Math.floor(Math.random() * 100000)).padStart(5, "0");
}

/* USERNAME: made automatically when the account is created: current year + surname + a random 5-digit number (10000 to 99999),
   for example 2026Pogi32198. The surname keeps only letters and digits (no spaces), because the backends accept
   letters, numbers, . _ - only (3-50 characters). Change this function if your school wants another rule. */
function generateUsername(surname) {
  const clean = String(surname || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]/g, "").slice(0, 40);
  return new Date().getFullYear() + (clean || "Student") + (Math.floor(Math.random() * 90000) + 10000);
}

/* The Student ID uses the SAME number as the username: 2026Pogi32198 -> 2026-32198.
   (A username that does not end in 5 digits gets a random ID.) */
function studentIdFromUsername(username) {
  const m = /^(\d{4}).*?(\d{5})$/.exec(String(username || ""));
  return m ? m[1] + "-" + m[2] : null;
}

function getDemoStudentId(username) {
  const key = "portalStudentId:" + String(username).toLowerCase();
  try {
    let id = localStorage.getItem(key);
    if (!id) { id = studentIdFromUsername(username) || generateStudentId(); localStorage.setItem(key, id); }
    return id;
  } catch { return generateStudentId(); }
}
