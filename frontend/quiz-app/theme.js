/* ==========================================================================
   theme.js  -  Colors of the dashboard + the color circle next to the user's name
   --------------------------------------------------------------------------
   FIVE colors can be changed: background, text, buttons, links and the title shadow.
   Two places decide the colors (the second one wins):
     1. site.config.js  "colors"   the starting colors for everybody (the site owner)
     2. the color circle           each user's own choice, saved in their browser per username
   "Reset" in the circle goes back to the colors of site.config.js.

   How it works: the page colors in shared/css/variable.css are CSS variables
   (--paper, --ink, --accent, --link ...). This file changes those variables.
   Cards, lines and gray text are made from the background and text colors,
   so they always match.
   Needs site.config.js and db.js (getSessionUser). Loaded before app.js.
   ========================================================================== */

(function () {
  const config = (typeof SITE_CONFIG !== "undefined" && SITE_CONFIG) || {};
  const username = getSessionUser();
  if (!username) return;                       // not signed in: app.js sends them to the sign in page
  const storageKey = "quizApp.theme." + username;

  const FIELDS = ["background", "text", "button", "link", "shadow"];
  const root = document.documentElement;
  const circle = document.getElementById("theme-button");
  const box = document.getElementById("theme-box");
  const presetRow = document.getElementById("theme-presets");
  const resetButton = document.getElementById("theme-reset");
  const warning = document.getElementById("theme-warning");
  /* The "Title shadow" row lives in dashboard.html. If this page is an older copy without it, add the row here. */
  if (box && !document.getElementById("theme-shadow")) {
    const row = document.createElement("label");
    row.className = "theme-row";
    row.htmlFor = "theme-shadow";
    row.innerHTML = '<span>Title shadow</span><input type="color" id="theme-shadow" value="#8a8f98">';
    box.insertBefore(row, warning);
  }
  const inputs = {
    background: document.getElementById("theme-background"),
    text: document.getElementById("theme-text"),
    button: document.getElementById("theme-button-color"),
    link: document.getElementById("theme-link"),
    shadow: document.getElementById("theme-shadow")   // the 3D shadow of the title
  };
  const presets = Array.isArray(config.presets) ? config.presets : [];

  /* ----- small color helpers ----- */
  const isColor = value => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

  function hexToRgb(hex) {
    const value = hex.replace("#", "");
    return [0, 2, 4].map(start => parseInt(value.slice(start, start + 2), 16));
  }
  function rgbToHex(rgb) {
    return "#" + rgb.map(part => Math.round(part).toString(16).padStart(2, "0")).join("");
  }
  /* Mix two colors. amount 0 = all of "from", 1 = all of "to". */
  function mix(from, to, amount) {
    const a = hexToRgb(from), b = hexToRgb(to);
    return rgbToHex(a.map((part, i) => part * (1 - amount) + b[i] * amount));
  }
  /* How bright a color is (0 = black, 1 = white) */
  function brightness(hex) {
    const [r, g, b] = hexToRgb(hex).map(part => {
      const x = part / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function contrast(first, second) {
    const light = Math.max(brightness(first), brightness(second));
    const dark = Math.min(brightness(first), brightness(second));
    return (light + 0.05) / (dark + 0.05);
  }

  /* The color the page is using right now for a CSS variable, as #rrggbb.
     (A small invisible element lets the browser work out var(--x) for us.) */
  function resolveColor(variableName) {
    const probe = document.createElement("span");
    probe.style.cssText = `position:absolute;visibility:hidden;color:var(${variableName})`;
    document.body.appendChild(probe);
    const parts = getComputedStyle(probe).color.match(/\d+(\.\d+)?/g) || [0, 0, 0];
    probe.remove();
    return rgbToHex(parts.slice(0, 3).map(Number));
  }

  /* ----- saving and loading the user's own choice ----- */
  /* Only the fields the user really changed are kept (a field left out = "use the site color") */
  function cleanTheme(theme) {
    const clean = {};
    FIELDS.forEach(field => { if (theme && isColor(theme[field])) clean[field] = theme[field]; });
    return clean;
  }
  function loadUserTheme() {
    try {
      return cleanTheme(JSON.parse(localStorage.getItem(storageKey)));
    } catch (error) { return {}; }             // nothing saved, or storage is blocked
  }
  function saveUserTheme(theme) {
    try {
      if (Object.keys(theme).length) localStorage.setItem(storageKey, JSON.stringify(theme));
      else localStorage.removeItem(storageKey);
    } catch (error) { /* storage is blocked: the choice only lasts until refresh */ }
  }

  /* ----- putting the colors on the page ----- */
  const THEME_VARIABLES = ["--paper", "--ink", "--surface", "--line", "--muted", "--accent", "--accent-ink", "--link", "--logo-shadow"];
  const siteTheme = cleanTheme(config.colors);   // colors from site.config.js

  /* Show these colors on the page. Fields that are missing keep the stylesheet's normal color. */
  function applyTheme(theme) {
    THEME_VARIABLES.forEach(name => root.style.removeProperty(name));
    root.style.removeProperty("color-scheme");

    if (theme.background || theme.text) {
      const background = theme.background || resolveColor("--paper");
      const text = theme.text || resolveColor("--ink");
      const isDark = brightness(background) < 0.4;
      root.style.setProperty("--paper", background);
      root.style.setProperty("--ink", text);
      /* Cards: a little lighter than the page */
      root.style.setProperty("--surface", mix(background, "#ffffff", isDark ? 0.1 : 0.55));
      root.style.setProperty("--line", mix(background, text, 0.2));
      root.style.setProperty("--muted", mix(text, background, 0.35));
      root.style.setProperty("color-scheme", isDark ? "dark" : "light");   // native inputs follow the theme
    }
    if (theme.button) {
      root.style.setProperty("--accent", theme.button);
      root.style.setProperty("--accent-ink", brightness(theme.button) > 0.45 ? "#111111" : "#ffffff");   // readable text on the button
    }
    if (theme.link) root.style.setProperty("--link", theme.link);
    if (theme.shadow) root.style.setProperty("--logo-shadow", theme.shadow);   // quiz.css uses it for the title

    /* The circle shows the page colors: inside = background, ring = text */
    circle.style.setProperty("--circle-background", resolveColor("--paper"));
    circle.style.setProperty("--circle-text", resolveColor("--ink"));
  }

  /* What is shown now = the site colors, then the user's own on top */
  function showCurrent() {
    applyTheme({ ...siteTheme, ...loadUserTheme() });
  }

  function fillBox() {
    inputs.background.value = resolveColor("--paper");
    inputs.text.value = resolveColor("--ink");
    inputs.button.value = resolveColor("--accent");
    inputs.link.value = resolveColor("--link");
    /* The title shadow: the chosen color, or the automatic gray (a mix of the page and text colors, as in quiz.css) */
    const chosen = { ...siteTheme, ...loadUserTheme() }.shadow;
    inputs.shadow.value = chosen || mix(resolveColor("--paper"), resolveColor("--ink"), 0.45);
    warning.hidden = contrast(inputs.background.value, inputs.text.value) >= 4.5;
  }

  /* ----- the box ----- */
  presetRow.innerHTML = presets.map((preset, position) => `
    <button type="button" class="theme-preset-item" data-preset="${position}" title="${escapeHtml(preset.name || "")}" aria-label="${escapeHtml(preset.name || "Colors")}">
      <span class="theme-preset" aria-hidden="true"
            style="background:${isColor(preset.background) ? preset.background : "#ffffff"};border-color:${isColor(preset.text) ? preset.text : "#000000"}"></span>
      <span class="theme-preset-name">${escapeHtml(preset.name || "")}</span>
    </button>`).join("");
  presetRow.hidden = !presets.length;

  function openBox() {
    fillBox();
    box.hidden = false;
    circle.setAttribute("aria-expanded", "true");
  }
  function closeBox() {
    box.hidden = true;
    circle.setAttribute("aria-expanded", "false");
  }

  circle.onclick = () => (box.hidden ? openBox() : closeBox());

  /* A ready-made set: all four colors (the ones the preset leaves out use the site color) */
  presetRow.onclick = event => {
    const button = event.target.closest("[data-preset]");
    if (!button) return;
    saveUserTheme(cleanTheme(presets[Number(button.dataset.preset)]));
    showCurrent();
    fillBox();
  };

  /* One color changed: keep only that field as the user's choice */
  FIELDS.forEach(field => {
    inputs[field].oninput = () => {
      saveUserTheme({ ...loadUserTheme(), [field]: inputs[field].value });
      showCurrent();
      warning.hidden = contrast(inputs.background.value, inputs.text.value) >= 4.5;
    };
  });

  resetButton.onclick = () => {
    saveUserTheme({});
    showCurrent();
    fillBox();
  };

  /* Close when pressing outside the box or Escape */
  document.addEventListener("click", event => {
    if (!box.hidden && !box.contains(event.target) && !circle.contains(event.target)) closeBox();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !box.hidden) {
      closeBox();
      circle.focus();
    }
  });

  /* Start. If the owner turned the circle off (allowColorPicker: false), hide it and ignore saved choices. */
  if (config.allowColorPicker === false) {
    document.querySelector(".theme-wrap").hidden = true;
    applyTheme(siteTheme);
  } else {
    showCurrent();
  }
})();
