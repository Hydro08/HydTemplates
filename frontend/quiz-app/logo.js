/* ==========================================================================
   logo.js  -  The big typing title at the top of every page
   --------------------------------------------------------------------------
   The title types itself letter by letter, waits, erases, then repeats.
   Pages can turn the typing off: write data-logo="static" on the logo
   (dashboard.html does this) and the full title just stays on screen
   as 3D text, with no typing and no blinking cursor.
   To change the title, edit "title" in site.config.js. It is used on every page.
   For the size and 3D look, see the "Logo" section of quiz.css.
   ========================================================================== */

const APP_TITLE = (typeof SITE_CONFIG !== "undefined" && SITE_CONFIG.title) || "Quizzlet";   // change it in site.config.js

/* Titles longer than this many characters are cut and end with "...".
   (The letters also shrink to fit small screens.) */
const LOGO_MAX_LETTERS = 16;

/* Typing speed, in milliseconds per letter */
const TYPING_SPEED = 170; // typing is slower...
const ERASING_SPEED = 70; // ...than erasing
const HOLD_FULL_TITLE = 1800; // how long the full title stays on screen
const HOLD_EMPTY = 500; // pause before typing starts again

(function setupLogo() {
  /* Find the logo on this page. Stop if the page has none. */
  const logoText = document.querySelector("[data-logo]");
  if (!logoText) return;

  /* Cut the title if it is too long */
  const title =
    APP_TITLE.length > LOGO_MAX_LETTERS
      ? APP_TITLE.slice(0, LOGO_MAX_LETTERS).trimEnd() + "\u2026"
      : APP_TITLE;

  /* Screen readers read the full title, not the half-typed one */
  logoText.parentElement.setAttribute("aria-label", APP_TITLE);

  /* Two layers stacked on top of each other:
     - hiddenTitle: the full title, invisible. It keeps the logo's width fixed while typing.
     - typedTitle: the visible text that is typed and erased. */
  logoText.innerHTML =
    '<span class="logo-hidden"></span><span class="logo-typed"></span>';
  const hiddenTitle = logoText.firstChild;
  const typedTitle = logoText.lastChild;
  hiddenTitle.textContent = title;

  /* Make the text smaller if the title is wider than the screen, so it always fits a phone
     (nobody has to zoom out). The size goes down one step at a time until the whole title fits. */
  function shrinkToFit() {
    logoText.style.fontSize = ""; // start again from the size in the CSS
    let size = parseFloat(getComputedStyle(logoText).fontSize);
    const availableWidth = document.documentElement.clientWidth - 40;
    /* The real width of the title (the box itself is capped at the screen width, so measure the text) */
    const titleWidth = () => Math.max(hiddenTitle.scrollWidth, hiddenTitle.getBoundingClientRect().width, logoText.scrollWidth);
    while (titleWidth() > availableWidth && size > 14) {
      size -= 2;
      logoText.style.fontSize = size + "px";
    }
  }
  shrinkToFit();
  window.addEventListener("resize", shrinkToFit);
  if (document.fonts) document.fonts.ready.then(shrinkToFit); // measure again when the font has loaded

  /* No typing when: the page asked for a static logo (data-logo="static"),
     or the person turned off animations in their system */
  const isStatic = logoText.dataset.logo === "static";
  if (isStatic || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    typedTitle.textContent = title;
    typedTitle.classList.add("no-cursor");
    return;
  }

  /* The typing loop */
  let letterCount = 0; // how many letters are showing right now
  let direction = 1; // 1 = typing, -1 = erasing

  function step() {
    typedTitle.textContent = title.slice(0, letterCount);
    let wait = direction > 0 ? TYPING_SPEED : ERASING_SPEED;

    if (direction > 0 && letterCount === title.length) {
      direction = -1; // full title is showing: hold, then start erasing
      wait = HOLD_FULL_TITLE;
    } else if (direction < 0 && letterCount === 0) {
      direction = 1; // all erased: pause, then type again
      wait = HOLD_EMPTY;
    } else {
      letterCount += direction;
    }
    setTimeout(step, wait);
  }
  step();
})();
