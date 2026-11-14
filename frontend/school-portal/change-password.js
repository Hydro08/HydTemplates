/* Change password (profile page). Needs password.js and session.js (for `user`).
   Demo mode: checks the current password of the account made in Sign up and saves the new one (hashed) in this browser.
   Real backend: POST API_BASE_URL + "/change-password" with { current_password, new_password } (you add this endpoint;
   it must check the session, the current password, and the same password rules). */
const pwForm = document.getElementById("passwordForm");
const curInput = document.getElementById("curPass");
const newInput = document.getElementById("newPass");
const new2Input = document.getElementById("newPass2");
const pwMsg = document.getElementById("pwMsg");
const pwInputs = [curInput, newInput, new2Input];

bindPasswordChecklist(newInput, document.getElementById("newRules"));

function pwMessage(text, kind = "") {
  pwMsg.textContent = text;
  pwMsg.className = "form-msg " + kind;
}
function pwInvalid(...inputs) {
  pwInputs.forEach(i => i.removeAttribute("aria-invalid"));
  inputs.forEach(i => i.setAttribute("aria-invalid", "true"));
  if (inputs[0]) inputs[0].focus();
}
pwInputs.forEach(i => i.addEventListener("input", () => { i.removeAttribute("aria-invalid"); pwMessage(""); }));

document.getElementById("showPw").addEventListener("change", e => {
  pwInputs.forEach(i => { i.type = e.target.checked ? "text" : "password"; });
});

pwForm.addEventListener("submit", async e => {
  e.preventDefault();
  const current = curInput.value, next = newInput.value, again = new2Input.value;
  pwMessage("");

  if (!current || !next || !again) {
    pwInvalid(...pwInputs.filter(i => !i.value));
    return pwMessage("Fill in all the fields.", "error");
  }
  const problems = passwordProblems(next);
  if (problems.length) {
    pwInvalid(newInput);
    return pwMessage(passwordProblemsText(problems), "error");
  }
  if (next !== again) {
    pwInvalid(newInput, new2Input);
    return pwMessage("The new passwords do not match.", "error");
  }
  if (next === current) {
    pwInvalid(newInput);
    return pwMessage("The new password must be different from your current password.", "error");
  }

  const btn = pwForm.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    if (DEMO_MODE) {
      const acct = getDemoAccount(user.username);
      if (!acct) return pwMessage("No saved account for this username. Sign out and sign up again.", "error");
      let okPass = false;
      try { okPass = await verifyDemoPassword(acct, current); } catch {}
      if (!okPass) {
        pwInvalid(curInput);
        return pwMessage("Your current password is incorrect.", "error");
      }
      if (!(await setDemoPassword(acct.username, next))) return pwMessage("Could not save the new password.", "error");
    } else {
      const res = await fetch(`${API_BASE_URL}/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: current, new_password: next })
      });
      let data = {};
      try { data = await res.json(); } catch {}
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) pwInvalid(curInput);
        return pwMessage(data.message || "Could not change the password.", "error");
      }
    }
    pwForm.reset();
    pwInputs.forEach(i => { i.type = "password"; });
    newInput.dispatchEvent(new Event("input"));   // reset the checklist
    pwMessage("Password updated. Use your new password the next time you sign in.", "ok");
  } catch {
    pwMessage("Cannot reach the server.", "error");
  } finally {
    btn.disabled = false;
  }
});
