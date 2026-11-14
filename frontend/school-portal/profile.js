/* Profile form. All required fields must be filled in for the account to be verified.
   The user, sign out and verifySession live in session.js. In DEMO_MODE the profile is saved in localStorage (demo-profile.js). */

const form = document.getElementById("profileForm");
const saveBtn = document.getElementById("saveBtn");
const editBtn = document.getElementById("editBtn");
const cancelBtn = document.getElementById("cancelBtn");
const formActions = document.getElementById("formActions");

/* A verified student sees the profile locked. "Edit" (after a confirmation) unlocks it.
   A student who is not verified yet fills it in right away, nothing is locked. */
let editing = true;          // true = the form can be typed in
let savedProfile = {};       // the last saved values (Discard puts these back)
let snapshot = null;         // the values when editing started (to know if something changed)
let pushedState = false;     // true while we added one history entry for the edit mode (so the Back button can be caught)
let ignorePop = false;       // true when WE moved the history, so the popstate is not the student's Back button
let leaving = false;         // true while the page is really being left (no more questions)
const fields = [...form.elements].filter(el => el.name);
const todayStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
form.birthdate.max = todayStr;

/* ---------- Validation (keep in sync with api/profile.php) ---------- */
const phoneRule = phoneProblem;   // phone.js: "+<country code> <number>"
const NAME_OK = /^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u;   // letters, spaces and . ' -
const nameRule = v => v.length <= 100 && NAME_OK.test(v) ? "" : "Letters only, up to 100 characters.";
const oneOf = list => v => list.includes(v) ? "" : "Choose one from the list.";
const textRule = (min, max) => v => (v.length >= min && v.length <= max) ? "" : `Must be ${min}-${max} characters.`;

const RULES = {
  last_name: nameRule,
  first_name: nameRule,
  middle_name: v => v ? nameRule(v) : "",   // optional
  gender: oneOf(["Male", "Female", "Prefer not to say"]),
  civil_status: oneOf(["Single", "Married", "Widowed", "Separated", "Divorced"]),
  birthdate: v => (v >= "1900-01-01" && v <= todayStr) ? "" : "Enter a valid birthdate.",
  section: textRule(1, 100),
  email: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 200 ? "" : "Enter a valid email address.",
  phone: phoneRule,
  street: textRule(3, 150),
  barangay: textRule(2, 100),
  city: textRule(2, 100),
  province: textRule(2, 100),
  zip: v => /^[A-Za-z0-9 -]{3,10}$/.test(v) ? "" : "Enter a valid ZIP code.",
  father_name: textRule(2, 200),
  father_occupation: textRule(2, 100),
  father_phone: phoneRule,
  mother_name: textRule(2, 200),
  mother_occupation: textRule(2, 100),
  mother_phone: phoneRule,
  guardian_name: textRule(2, 200),
  guardian_occupation: textRule(2, 100),
  guardian_phone: phoneRule
};

function problem(el) {
  const v = el.value.trim();
  if (sameBox.checked && el.name.startsWith("prov_")) return "";   // the Province address is a copy of the home address
  if (el.disabled) return el.placeholder;                       // e.g. "Select a province first"
  if (!v) return "optional" in el.dataset ? "" : "This field is required.";
  if (el.combo && !el.combo.valid) return `Choose a ${el.combo.label} from the list.`;
  return RULES[el.name] ? RULES[el.name](v) : "";
}

["street", "barangay", "city", "province", "zip"].forEach(k => { RULES["prov_" + k] = RULES[k]; });   // same rules for the Province address

/* A red error disappears by itself after 3 seconds (or sooner, as soon as you type in the field) */
const ERROR_MS = 3000;
const errorTimers = new Map();

function setError(el, message) {
  const err = document.getElementById("err-" + el.name);
  const box = el.ui ? el.ui.box : el;   // phone fields: the box around flag + number is what turns red
  clearTimeout(errorTimers.get(el));
  if (message) box.setAttribute("aria-invalid", "true"); else box.removeAttribute("aria-invalid");
  if (err) err.textContent = message || "";
  if (message) errorTimers.set(el, setTimeout(() => setError(el, ""), ERROR_MS));
}

/* ---------- Address: Province -> City / Municipality -> Barangay -> Street, ZIP (see locations.js) ---------- */
const HOME_KEYS = ["province", "city", "barangay", "street", "zip"];
const ADDRESS_KEYS = [...HOME_KEYS, ...HOME_KEYS.map(k => "prov_" + k)];
const showAddressNotice = () => { document.getElementById("addressNotice").hidden = false; };
const address = setupAddress({ onManual: showAddressNotice });
const provAddress = setupAddress({ onManual: showAddressNotice, prefix: "prov_" });   // the Province address
const sameBox = document.getElementById("sameAddress");
const provBox = document.getElementById("provFields");

/* "Same as home address": the Province address fields are hidden and copy the home address. Unchecked: the student types their own. */
function syncProv() {
  if (!sameBox.checked) return;
  HOME_KEYS.forEach(k => { form.elements["prov_" + k].value = form.elements[k].value; });
}
sameBox.addEventListener("change", () => {
  provBox.hidden = sameBox.checked;
  if (sameBox.checked) syncProv(); else provAddress.clear();
  updateProgress();
  saveDraft();
});
/* Saved / draft values: the box is checked when the Province address is empty or equal to the home address */
async function restoreProv(v) {
  const norm = x => String(x ?? "").trim().toLowerCase();
  const hasProv = HOME_KEYS.some(k => norm(v["prov_" + k]));
  const same = !hasProv || HOME_KEYS.every(k => norm(v["prov_" + k]) === norm(v[k]));
  sameBox.checked = same;
  provBox.hidden = same;
  if (same) syncProv();
  else await provAddress.restore(Object.fromEntries(HOME_KEYS.map(k => [k, v["prov_" + k]])));
}
[address.province, address.city, address.barangay, provAddress.province, provAddress.city, provAddress.barangay].forEach(c =>
  c.input.addEventListener("blur", () => { if (c.input.value.trim()) setError(c.input, problem(c.input)); })
);
let restoring = false;   // true while saved values are being put back (so the draft is not overwritten)

/* ---------- Age (read-only, calculated from the birthdate) ---------- */
const ageInput = document.getElementById("age");

function updateAge() {
  const v = form.birthdate.value;
  if (!v || v < "1900-01-01" || v > todayStr) { ageInput.value = ""; return; }
  const [y, m, d] = v.split("-").map(Number);
  const [ty, tm, td] = todayStr.split("-").map(Number);
  let age = ty - y;
  if (tm < m || (tm === m && td < d)) age--;
  ageInput.value = `${age} year${age === 1 ? "" : "s"} old`;
}

/* ---------- Progress and status ---------- */
function updateProgress() {
  const required = fields.filter(el => !("optional" in el.dataset));
  const filled = required.filter(el => el.value.trim() !== "").length;
  document.getElementById("progressText").textContent =
    filled === required.length ? "All required fields are filled in."
                               : `${filled} of ${required.length} required fields filled in.`;
  document.getElementById("progressBar").style.width = (filled / required.length * 100) + "%";
}

function renderStatus() {
  const ok = !!user.verified;
  const badge = document.getElementById("statusBadge");
  badge.textContent = ok ? "Verified" : "Not verified";
  badge.className = "badge " + (ok ? "ready" : "progress");
  document.getElementById("verifyNotice").hidden = ok;
  document.getElementById("security").hidden = !ok;   // Account security is not shown while the account is being verified
  document.querySelectorAll("#sideMenu .needs-verified").forEach(a => { a.hidden = !ok; });   // the portal pages open after verification
  document.getElementById("menuUserName").textContent = user.name || user.username || "";
  editBtn.hidden = !(ok && !editing);   // the Edit button sits right after the Verified badge
  saveBtn.textContent = ok ? "Save changes" : "Save and verify";
}

/* ---------- Draft: keeps what was typed (even unsaved) when the page reloads or you come back to it ---------- */
const DRAFT_KEY = "portalProfileDraft:" + String(user.username || "").toLowerCase();

function saveDraft() {
  if (restoring || user.verified) return;   // a verified profile asks "save or discard" instead of keeping a draft
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(Object.fromEntries(fields.map(el => [el.name, el.value])))); }
  catch {}
}
function loadDraft() {
  try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY)); } catch { return null; }
}
function clearDraft() {
  try { sessionStorage.removeItem(DRAFT_KEY); } catch {}
}

fields.forEach(el => {
  const onChange = () => { setError(el, ""); syncProv(); updateProgress(); updateAge(); saveDraft(); };
  el.addEventListener("input", onChange);
  el.addEventListener("change", onChange);
});

/* ---------- Toast ---------- */
const toastBox = document.getElementById("toasts");
function showToast(text, kind = "info") {
  const el = document.createElement("div");
  el.className = "toast " + kind;
  el.textContent = text;
  toastBox.append(el);
  setTimeout(() => el.remove(), 2500);
}

/* ---------- Load ---------- */
function fillForm(values) {
  if (!values) return;
  fields.forEach(el => {
    if (ADDRESS_KEYS.includes(el.name) || values[el.name] == null) return;
    el.value = values[el.name];
    if (el.ui) el.ui.setFull(el.value);   // phone fields: show the flag and the number
  });
}

async function loadProfile() {
  if (DEMO_MODE) {
    const profile = getDemoProfile(user.username);
    return { verified: isProfileComplete(profile), profile };
  }
  try {
    const res = await fetch(`${API_BASE_URL}/profile`);
    if (res.status === 401) { signOutLocal(); return null; }
    if (!res.ok) throw new Error();
    return await res.json();
  } catch {
    showToast("Cannot reach the server.", "error");
    return { verified: !!user.verified, profile: null };
  }
}

(async () => {
  if (!DEMO_MODE) {   // refresh the role from the server first: an admin goes to admin.html
    const me = await verifySession();
    if (!me) return;
    if (me.role === "admin") { location.replace("admin.html"); return; }
  }
  const data = await loadProfile();
  if (!data) return;
  if (!!data.verified !== !!user.verified) saveUser({ ...user, verified: !!data.verified });
  document.getElementById("username").value = user.username || "";   // made at sign up, read-only
  document.getElementById("student_id").value =
    data.student_id || user.studentId || (DEMO_MODE ? getDemoStudentId(user.username) : "");
  const names = { last_name: user.last_name || "", first_name: user.first_name || "", middle_name: user.middle_name || "" };  // from sign up
  if (data.verified) clearDraft();   // a verified profile is shown as saved, never as an old draft
  const values = { ...names, ...(data.profile || {}), ...(data.verified ? {} : loadDraft() || {}) };  // sign-up name, saved profile, then anything typed but not saved
  savedProfile = { ...names, ...(data.profile || {}) };
  fillForm(values);
  if (data.verified) { editing = false; setLocked(true); }   // locked until the student chooses Edit
  renderStatus();
  updateAge();
  updateProgress();
  restoring = true;
  try { await address.restore(values); await restoreProv(values); } finally { restoring = false; }  // the address chains are filled level by level
  updateProgress();
})();

/* ---------- Save ---------- */
form.addEventListener("submit", e => { e.preventDefault(); saveProfile(); });

/* Enter inside a field only saves when everything is filled in and correct. Before that it does nothing (no red errors, no toast),
   so it does not get in the way while typing. The Save button still shows what is missing when you press it. */
form.addEventListener("keydown", e => {
  if (e.key !== "Enter" || e.defaultPrevented) return;                      // a list (province, city...) already used the Enter key
  if (e.target.tagName !== "INPUT" || e.target.type === "checkbox" || e.target.type === "button") return;
  if (fields.some(el => problem(el))) e.preventDefault();                    // something is empty or wrong: do not submit
});

/* Checks the form and saves it. Gives back true if it was saved. */
async function saveProfile() {
  syncProv();
  let firstBad = null;
  fields.forEach(el => {
    const msg = problem(el);
    setError(el, msg);
    if (msg && !firstBad) firstBad = el;
  });
  if (firstBad) {
    showToast("Fill in or fix the fields marked in red.", "error");
    (firstBad.ui || firstBad).focus();
    return false;
  }

  const body = Object.fromEntries(fields.map(el => [el.name, el.value.trim()]));
  const wasVerified = !!user.verified;

  saveBtn.disabled = true;
  try {
    if (DEMO_MODE) {
      saveDemoProfile(user.username, body);
    } else {
      const res = await fetch(`${API_BASE_URL}/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      let data = {};
      try { data = await res.json(); } catch {}
      if (res.status === 401) { signOutLocal(); return false; }
      if (!res.ok) {
        const el = data.field && form.elements[data.field];
        if (el) { setError(el, data.message || "Something is wrong here."); (el.ui || el).focus(); }
        showToast(data.message || "Could not save your profile.", "error");
        return false;
      }
    }

    clearDraft();
    savedProfile = body;
    saveUser({ ...user, verified: true, name: composeName(body) || user.name,
               last_name: body.last_name, first_name: body.first_name, middle_name: body.middle_name });
    renderUser();   // the name in the header / welcome follows the edited name
    if (wasVerified) {
      stopEditing({ consumeHistory: !pendingLeave });   // back to the locked profile
      showToast("Profile saved.", "ok");
    } else {
      leaving = true;   // the next page is not "leaving with unsaved changes"
      renderStatus();
      showToast("Your account is verified!", "ok");
      setTimeout(() => location.href = "portal.html", 1000);
    }
    return true;
  } catch {
    showToast("Cannot reach the server.", "error");
    return false;
  } finally {
    saveBtn.disabled = false;
  }
}

/* ---------- Locked profile, Edit, and leaving while editing ---------- */
const currentValues = () => JSON.stringify(fields.map(el => el.value.trim()));
const isDirty = () => editing && user.verified && snapshot !== null && currentValues() !== snapshot;

/* Lock / unlock every field (a disabled fieldset disables the phone and address boxes too) */
function setLocked(lock) {
  form.querySelectorAll("fieldset").forEach(box => { box.disabled = lock; });
  form.classList.toggle("viewing", lock);
  formActions.hidden = lock;
  if (lock) document.querySelectorAll(".combo-list, .cc-panel").forEach(box => { box.hidden = true; });
}

function startEditing() {
  editing = true;
  snapshot = currentValues();
  setLocked(false);
  cancelBtn.hidden = false;
  renderStatus();
  /* One extra history entry, so the phone / browser Back button can ask "save or discard?" instead of leaving */
  history.pushState({ profileEdit: true }, "");
  pushedState = true;
  form.last_name.focus();
}

/* Back to the locked profile. consumeHistory: also remove the extra history entry we added. */
function stopEditing({ consumeHistory = true } = {}) {
  editing = false;
  snapshot = null;
  setLocked(true);
  cancelBtn.hidden = true;
  fields.forEach(el => setError(el, ""));
  renderStatus();
  if (consumeHistory && pushedState) { ignorePop = true; history.back(); }
  pushedState = false;
}

/* Put the last saved values back (Discard) */
async function restoreSaved() {
  restoring = true;
  try {
    fillForm(savedProfile);
    updateAge();
    updateProgress();
    await address.restore(savedProfile);
    await restoreProv(savedProfile);
  } finally { restoring = false; }
  updateProgress();
}

/* --- the two questions (modals) --- */
const editConfirm = document.getElementById("editConfirm");
const leaveModal = document.getElementById("leaveModal");
let pendingLeave = null;   // what the student wanted to do (open a link, go back, sign out) when we asked

function openModal(box, focusEl) {
  closeMenu();
  box.hidden = false;
  document.documentElement.classList.add("modal-open");
  focusEl.focus();
}
function closeModal(box) {
  box.hidden = true;
  if (!document.querySelector(".modal-backdrop:not([hidden])")) document.documentElement.classList.remove("modal-open");
}

editBtn.addEventListener("click", () => openModal(editConfirm, document.getElementById("editConfirmYes")));
document.getElementById("editConfirmNo").addEventListener("click", () => { closeModal(editConfirm); editBtn.focus(); });
document.getElementById("editConfirmYes").addEventListener("click", () => { closeModal(editConfirm); startEditing(); });

function askLeave(action) {
  pendingLeave = action;
  openModal(leaveModal, document.getElementById("leaveSave"));
}
/* X: nothing is decided, the student goes back to editing */
function keepEditing() {
  closeModal(leaveModal);
  pendingLeave = null;
}
function runPending() {
  const action = pendingLeave;
  pendingLeave = null;
  if (action) action();
}
document.getElementById("leaveX").addEventListener("click", keepEditing);
document.getElementById("leaveDiscard").addEventListener("click", async () => {
  closeModal(leaveModal);
  stopEditing({ consumeHistory: !pendingLeave });
  await restoreSaved();
  runPending();
});
document.getElementById("leaveSave").addEventListener("click", async () => {
  closeModal(leaveModal);
  if (await saveProfile()) runPending(); else pendingLeave = null;   // not saved (red fields): stay in edit mode
});

/* Cancel button (under the form): same questions as leaving, but nothing is left afterwards */
cancelBtn.addEventListener("click", () => {
  if (isDirty()) askLeave(null);
  else stopEditing();
});

/* Esc = X on the question, Cancel on the confirmation. Tab stays inside the box. */
document.addEventListener("keydown", e => {
  const open = [editConfirm, leaveModal].find(box => !box.hidden);
  if (!open) return;
  if (e.key === "Escape") {
    e.preventDefault();
    if (open === leaveModal) keepEditing(); else { closeModal(editConfirm); editBtn.focus(); }
  } else if (e.key === "Tab") {
    const items = [...open.querySelectorAll("button")];
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

/* The phone / browser Back button while editing */
window.addEventListener("popstate", () => {
  if (ignorePop) { ignorePop = false; return; }
  if (leaving || !editing || !user.verified) return;
  pushedState = false;
  if (!leaveModal.hidden) {                       // the question is already open: just keep the page
    history.pushState({ profileEdit: true }, ""); pushedState = true;
    return;
  }
  if (!isDirty()) { stopEditing({ consumeHistory: false }); return; }   // nothing changed: Back only closes edit mode
  history.pushState({ profileEdit: true }, ""); pushedState = true;     // stay here and ask
  askLeave(() => leaveForReal(() => history.go(-2)));                   // -2 = the entry we just added + the one Back removed
});

/* Links and Sign out while there are unsaved changes */
document.addEventListener("click", e => {
  if (leaving || !isDirty()) return;
  const link = e.target.closest("a[href]");
  const signOut = e.target.closest("#logoutBtn");
  if (!link && !signOut) return;
  if (link) {
    const href = link.getAttribute("href") || "";
    if (href.startsWith("#") || link.pathname === location.pathname) return;   // the page we are on
  }
  e.preventDefault();
  e.stopImmediatePropagation();
  askLeave(() => leaveForReal(() => { if (signOut) signOut.click(); else location.href = link.href; }));
}, true);

function leaveForReal(go) {
  leaving = true;
  go();
  setTimeout(() => { leaving = false; }, 800);   // if the browser stayed on this page, the questions work again
}

/* Closing or reloading the tab with unsaved changes: the browser asks (its own text) */
window.addEventListener("beforeunload", e => {
  if (!leaving && isDirty()) { e.preventDefault(); e.returnValue = ""; }
});
