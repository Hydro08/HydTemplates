/* ==========================================================================
   theme.js - the color circle (palette) at the top right: background, text, buttons.
   Same idea as the Quiz App and the School Portal:
     1) LIBRARY_THEME below = starting colors for everybody (the school / library)
     2) the circle = each user's own choice, saved in the browser per username. "Reset" goes back to 1).
   It changes the CSS variables of library.css (--bg, --card, --ink, --muted, --line, --accent),
   so cards, lines and gray text always match. Loaded before library.js; library.js calls LibraryTheme.init() after sign in.
   ========================================================================== */
const LIBRARY_THEME = {
  colors: {},                 // starting colors, e.g. { background: "#fef3c7", text: "#1f2937", button: "#b45309" }. {} = the normal colors
  allowColorPicker: true,     // false = hide the circle, everybody sees the colors above
  presets: [
    { name: "Default",      background: "#f5f6fa", text: "#1d2433", button: "#2f5bea" },
    { name: "Black & White", background: "#ffffff", text: "#000000", button: "#000000" },
    { name: "Inverted",     background: "#000000", text: "#ffffff", button: "#ffffff" },
    { name: "Ocean",        background: "#e0f2fe", text: "#0c4a6e", button: "#0369a1" },
    { name: "Sepia",        background: "#f5ecd9", text: "#4a3728", button: "#b45309" },
    { name: "Forest",       background: "#ecfdf5", text: "#064e3b", button: "#047857" },
    { name: "Lavender",     background: "#f3e8ff", text: "#3b0764", button: "#7e22ce" },
    { name: "Rose",         background: "#fff1f2", text: "#881337", button: "#be123c" },
    { name: "Midnight",     background: "#0f172a", text: "#e2e8f0", button: "#38bdf8" },
    { name: "Sunset",       background: "#fff7ed", text: "#7c2d12", button: "#ea580c" },
    { name: "Graphite",     background: "#1f2937", text: "#f3f4f6", button: "#f59e0b" },
    { name: "Berry Night",  background: "#2e1065", text: "#f3e8ff", button: "#e879f9" }
  ]
};

const LibraryTheme = (function () {
  const circle = document.getElementById("theme-button"), box = document.getElementById("theme-box");
  const presetRow = document.getElementById("theme-presets"), warning = document.getElementById("theme-warning");
  const root = document.documentElement, FIELDS = ["background", "text", "button"];
  const inputs = { background: document.getElementById("theme-background"), text: document.getElementById("theme-text"), button: document.getElementById("theme-button-color") };
  const VARS = ["--bg", "--card", "--ink", "--muted", "--line", "--accent", "--accent-ink"];
  let storageKey = "hyd-library-v1-theme.";

  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  /* ----- color helpers ----- */
  const isColor = v => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
  const toRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const toHex = a => "#" + a.map(n => Math.round(n).toString(16).padStart(2, "0")).join("");
  const mix = (a, b, t) => { const x = toRgb(a), y = toRgb(b); return toHex(x.map((n, i) => n * (1 - t) + y[i] * t)); };
  const lum = h => { const [r, g, b] = toRgb(h).map(n => { n /= 255; return n <= .03928 ? n / 12.92 : Math.pow((n + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
  const contrast = (a, b) => (Math.max(lum(a), lum(b)) + .05) / (Math.min(lum(a), lum(b)) + .05);
  function resolve(name) {   // the color the page uses now for a CSS variable
    const p = document.createElement("span");
    p.style.cssText = `position:absolute;visibility:hidden;color:var(${name})`;
    document.body.appendChild(p);
    const c = (getComputedStyle(p).color.match(/\d+(\.\d+)?/g) || [0, 0, 0]).slice(0, 3).map(Number);
    p.remove();
    return toHex(c);
  }

  /* ----- saved choice (only the fields the user changed; a missing field = use the normal color) ----- */
  const clean = t => { const o = {}; FIELDS.forEach(f => { if (t && isColor(t[f])) o[f] = t[f]; }); return o; };
  const load = () => { try { return clean(JSON.parse(localStorage.getItem(storageKey))); } catch { return {}; } };
  const save = t => { try { Object.keys(t).length ? localStorage.setItem(storageKey, JSON.stringify(t)) : localStorage.removeItem(storageKey); } catch {} };
  const site = clean(LIBRARY_THEME.colors);

  function apply(t) {
    VARS.forEach(v => root.style.removeProperty(v));
    root.style.removeProperty("color-scheme");
    if (t.background || t.text) {
      const bg = t.background || resolve("--bg"), tx = t.text || resolve("--ink"), dark = lum(bg) < .18;
      root.style.setProperty("--bg", bg);
      root.style.setProperty("--ink", tx);
      root.style.setProperty("--card", mix(bg, "#ffffff", dark ? .1 : .55));
      root.style.setProperty("--line", mix(bg, tx, .2));
      root.style.setProperty("--muted", mix(tx, bg, .35));
      root.style.setProperty("color-scheme", dark ? "dark" : "light");
    }
    if (t.button) {
      root.style.setProperty("--accent", t.button);
      root.style.setProperty("--accent-ink", lum(t.button) > .18 ? "#111111" : "#ffffff");   // readable text on the button
    }
    circle.style.setProperty("--circle-bg", resolve("--bg"));     // the circle: inside = background, ring = text
    circle.style.setProperty("--circle-ink", resolve("--ink"));
  }
  const show = () => apply({ ...site, ...load() });
  function fill() {
    inputs.background.value = resolve("--bg"); inputs.text.value = resolve("--ink"); inputs.button.value = resolve("--accent");
    warning.hidden = contrast(inputs.background.value, inputs.text.value) >= 4.5;
  }

  /* ----- the box ----- */
  const presets = LIBRARY_THEME.presets || [];
  presetRow.innerHTML = presets.map((p, i) => `
    <button type="button" class="theme-preset-item" data-preset="${i}" title="${esc(p.name)}" aria-label="${esc(p.name)}">
      <span class="theme-preset" aria-hidden="true" style="background:${isColor(p.background) ? p.background : "#fff"};border-color:${isColor(p.text) ? p.text : "#000"}"></span>
      <span class="theme-preset-name">${esc(p.name)}</span>
    </button>`).join("");
  presetRow.hidden = !presets.length;

  const openBox = () => { fill(); box.hidden = false; circle.setAttribute("aria-expanded", "true"); };
  const closeBox = () => { box.hidden = true; circle.setAttribute("aria-expanded", "false"); };
  circle.onclick = () => (box.hidden ? openBox() : closeBox());
  presetRow.onclick = e => {
    const b = e.target.closest("[data-preset]");
    if (!b) return;
    save(clean(presets[Number(b.dataset.preset)]));
    show(); fill();
  };
  FIELDS.forEach(f => {
    inputs[f].oninput = () => {
      save({ ...load(), [f]: inputs[f].value });
      show();
      warning.hidden = contrast(inputs.background.value, inputs.text.value) >= 4.5;
    };
  });
  document.getElementById("theme-reset").onclick = () => { save({}); show(); fill(); };
  document.addEventListener("click", e => { if (!box.hidden && !box.contains(e.target) && !circle.contains(e.target)) closeBox(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !box.hidden) { closeBox(); circle.focus(); } });

  /* Called by library.js once someone is signed in: load THEIR saved colors. */
  return {
    init(username) {
      storageKey = "hyd-library-v1-theme." + String(username || "").toLowerCase();
      if (LIBRARY_THEME.allowColorPicker === false) { document.querySelector(".theme-wrap").hidden = true; apply(site); }
      else show();
    }
  };
})();
