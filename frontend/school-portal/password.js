/* Password rules (used by sign up and by "Change password" in the dashboard)
   + DEMO_MODE accounts: so that sign in matches sign up even without a backend.

   With a real backend the server must enforce the same rules (the browser check is only for the user's convenience). */

/* ---------- Rules ---------- */
const PASSWORD_MAX = 128;
const PASSWORD_RULES = [
  { id: "len",     label: "At least 8 characters", test: p => p.length >= 8 },
  { id: "upper",   label: "Uppercase letter",      test: p => /[A-Z]/.test(p) },
  { id: "number",  label: "Number",                test: p => /[0-9]/.test(p) },
  { id: "special", label: "Special character",     test: p => /[^\p{L}\p{N}\s]/u.test(p) }   // ! @ # $ % ^ & * ...
];

/* The rules this password does NOT pass yet (empty array = strong enough) */
function passwordProblems(password) {
  const p = String(password || "");
  const failed = PASSWORD_RULES.filter(r => !r.test(p));
  if (p.length > PASSWORD_MAX) failed.push({ id: "max", label: `At most ${PASSWORD_MAX} characters` });
  return failed;
}

/* "Password needs: at least 8 characters, uppercase letter and number." */
function passwordProblemsText(problems) {
  const list = problems.map(r => r.label.toLowerCase());
  const last = list.pop();
  return "Password needs: " + (list.length ? list.join(", ") + " and " + last : last) + ".";
}

/* Live checklist: fills the <ul> and ticks each rule while the user types */
function bindPasswordChecklist(input, listEl) {
  if (!input || !listEl) return;
  listEl.classList.add("pw-rules");
  listEl.innerHTML = PASSWORD_RULES.map(r => `<li data-rule="${r.id}">${r.label}</li>`).join("");
  const update = () => {
    const p = input.value;
    PASSWORD_RULES.forEach(r => {
      const li = listEl.querySelector(`[data-rule="${r.id}"]`);
      const ok = r.test(p);
      li.classList.toggle("ok", ok);
      li.setAttribute("aria-label", `${r.label}: ${ok ? "done" : "not yet"}`);
    });
  };
  input.addEventListener("input", update);
  update();
}

/* ---------- DEMO_MODE accounts (kept in this browser's localStorage) ----------
   The password is never stored as plain text: it is salted and hashed (PBKDF2). With a real backend none of this is used. */
const DEMO_ACCOUNT_PREFIX = "portalAccount:";

function randomHex(bytes = 16) {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password, salt) {
  if (window.crypto && crypto.subtle) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: enc.encode(salt), iterations: 100000, hash: "SHA-256" }, key, 256);
    return "pbkdf2$" + [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, "0")).join("");
  }
  // Fallback for pages that are not "secure" (plain http on a LAN address): a simple demo-only hash.
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (const ch of salt + password) {
    const c = ch.charCodeAt(0);
    h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return "demo$" + (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

/* Find an account by username OR Student ID (case-insensitive) */
function getDemoAccount(idOrUsername) {
  const q = String(idOrUsername || "").trim().toLowerCase();
  if (!q) return null;
  try {
    const direct = localStorage.getItem(DEMO_ACCOUNT_PREFIX + q);
    if (direct) return JSON.parse(direct);
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(DEMO_ACCOUNT_PREFIX)) continue;
      const a = JSON.parse(localStorage.getItem(k));
      if (a && String(a.studentId || "").toLowerCase() === q) return a;
    }
  } catch {}
  return null;
}

async function createDemoAccount(username, password, studentId) {
  const salt = randomHex();
  const acct = { username, studentId, salt, hash: await hashPassword(password, salt) };
  try { localStorage.setItem(DEMO_ACCOUNT_PREFIX + username.toLowerCase(), JSON.stringify(acct)); } catch {}
  return acct;
}

async function verifyDemoPassword(acct, password) {
  return !!acct && (await hashPassword(password, acct.salt)) === acct.hash;
}

async function setDemoPassword(username, newPassword) {
  const acct = getDemoAccount(username);
  if (!acct) return false;
  acct.salt = randomHex();
  acct.hash = await hashPassword(newPassword, acct.salt);
  try { localStorage.setItem(DEMO_ACCOUNT_PREFIX + acct.username.toLowerCase(), JSON.stringify(acct)); return true; }
  catch { return false; }
}
