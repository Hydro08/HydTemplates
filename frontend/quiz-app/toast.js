/* ==========================================================================
   toast.js  -  The small pop-up messages ("toasts")
   --------------------------------------------------------------------------
   Used by auth.js (sign in / sign up) and app.js (dashboard).
   Load this file BEFORE them. You do not need to add anything to the HTML:
   the box that holds the toast is created here the first time it is needed.

   How to use:
       showToast("Saved!", "success");           // green
       showToast("Something is wrong");          // red (the default)
       showToast("Read this", "error", 8000);    // stays 8 seconds

   There is only ONE toast at a time, so spamming never piles them up:
     - same message again    -> the toast SHAKES (and stays a bit longer)
     - a different message   -> the toast changes to the new message
   Click the toast to close it.

   Where it shows: top center on computers and tablets, bottom right on
   phones. The look and position are in the "Toast" section of quiz.css.
   ========================================================================== */

const TOAST_SHOW_TIME = 3500;   // how long a toast stays, in milliseconds
let currentToast = null;        // the toast on screen right now (or null)
let toastTimerId = null;        // the timer that will close it

/* The box that holds the toast. Created once, the first time we need it. */
function getToastContainer() {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    container.setAttribute("role", "status");
    container.setAttribute("aria-live", "polite");
    document.body.append(container);
  }
  return container;
}

/* text = the message, type = "error" (red) or "success" (green),
   showTime = how long it stays (milliseconds) */
function showToast(text, type = "error", showTime = TOAST_SHOW_TIME) {
  const toastClass = "toast toast-" + type;

  if (currentToast) {
    const isSameMessage = currentToast.textContent === text && currentToast.dataset.type === type;
    currentToast.textContent = text;
    currentToast.dataset.type = type;
    currentToast.className = toastClass;
    /* Restart the animation: shake for the same message, slide in for a new one */
    void currentToast.offsetWidth;   // (makes the browser notice the class change)
    currentToast.classList.add(isSameMessage ? "toast-shake" : "toast-new");
  } else {
    currentToast = document.createElement("div");
    currentToast.className = toastClass + " toast-new";
    currentToast.dataset.type = type;
    currentToast.textContent = text;
    currentToast.onclick = closeToast;
    getToastContainer().append(currentToast);
  }

  /* Restart the countdown to close */
  clearTimeout(toastTimerId);
  toastTimerId = setTimeout(closeToast, showTime);
}

function closeToast() {
  clearTimeout(toastTimerId);
  if (currentToast) currentToast.remove();
  currentToast = null;
}
