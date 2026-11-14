/* ==========================================================================
   theme.js - the color circle (palette) in the header: background, text, buttons, links.
   Same idea as the Quiz App: 1) PORTAL_THEME below = starting colors for everybody (the school),
   2) the circle = each user's own choice, saved in the browser per username. "Reset" goes back to 1).
   It changes the CSS variables of shared/css/variable.css, so cards and lines always match.
   Used by portal.html, profile.html and admin.html. Loaded after session.js.
   ========================================================================== */
const PORTAL_THEME = {
  colors: {},                 // starting colors, e.g. { background: "#fef3c7", text: "#1f2937", button: "#b45309", link: "#b45309" }. {} = the normal colors
  allowColorPicker: true,     // false = hide the circle, everybody sees the colors above
  presets: [
    { name: "Default",      background: "#f4f6f8", text: "#16222e", button: "#0f766e", link: "#0f766e" },
    { name: "Black & White", background: "#ffffff", text: "#000000", button: "#000000", link: "#000000" },
    { name: "Inverted",     background: "#000000", text: "#ffffff", button: "#ffffff", link: "#ffffff" },
    { name: "Ocean",        background: "#e0f2fe", text: "#0c4a6e", button: "#0369a1", link: "#0369a1" },
    { name: "Sepia",        background: "#f5ecd9", text: "#4a3728", button: "#b45309", link: "#92400e" },
    { name: "Forest",       background: "#ecfdf5", text: "#064e3b", button: "#047857", link: "#047857" },
    { name: "Lavender",     background: "#f3e8ff", text: "#3b0764", button: "#7e22ce", link: "#7e22ce" },
    { name: "Rose",         background: "#fff1f2", text: "#881337", button: "#be123c", link: "#be123c" },
    { name: "Midnight",     background: "#0f172a", text: "#e2e8f0", button: "#38bdf8", link: "#38bdf8" },
    { name: "Sunset",       background: "#fff7ed", text: "#7c2d12", button: "#ea580c", link: "#c2410c" },
    { name: "Graphite",     background: "#1f2937", text: "#f3f4f6", button: "#f59e0b", link: "#fbbf24" },
    { name: "Berry Night",  background: "#2e1065", text: "#f3e8ff", button: "#e879f9", link: "#e879f9" }
  ]
};

(function () {
  const circle = document.getElementById("theme-button");
  if (!circle) return;
  const box = document.getElementById("theme-box");
  const presetRow = document.getElementById("theme-presets");
  const warning = document.getElementById("theme-warning");
  const root = document.documentElement;
  const FIELDS = ["background", "text", "button", "link"];
  const inputs = { background: "theme-background", text: "theme-text", button: "theme-button-color", link: "theme-link" };
  Object.keys(inputs).forEach(k => { inputs[k] = document.getElementById(inputs[k]); });
  const VARS = ["--paper", "--ink", "--surface", "--line", "--muted", "--accent", "--accent-ink", "--link"];

  let who = "";
  try { who = JSON.parse(sessionStorage.getItem("portalUser")).username || ""; } catch {}
  const storageKey = "portalApp.theme." + who.toLowerCase();
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

  /* ----- saved choice ----- */
  const clean = t => { const o = {}; FIELDS.forEach(f => { if (t && isColor(t[f])) o[f] = t[f]; }); return o; };
  const load = () => { try { return clean(JSON.parse(localStorage.getItem(storageKey))); } catch { return {}; } };
  const save = t => { try { Object.keys(t).length ? localStorage.setItem(storageKey, JSON.stringify(t)) : localStorage.removeItem(storageKey); } catch {} };
  const site = clean(PORTAL_THEME.colors);

  function apply(t) {
    VARS.forEach(v => root.style.removeProperty(v));
    root.style.removeProperty("color-scheme");
    if (t.background || t.text) {
      const bg = t.background || resolve("--paper"), tx = t.text || resolve("--ink"), dark = lum(bg) < .18;
      root.style.setProperty("--paper", bg);
      root.style.setProperty("--ink", tx);
      root.style.setProperty("--surface", mix(bg, "#ffffff", dark ? .1 : .55));
      root.style.setProperty("--line", mix(bg, tx, .2));
      root.style.setProperty("--muted", mix(tx, bg, .35));
      root.style.setProperty("color-scheme", dark ? "dark" : "light");
    }
    if (t.button) {
      root.style.setProperty("--accent", t.button);
      root.style.setProperty("--accent-ink", lum(t.button) > .18 ? "#111111" : "#ffffff");
    }
    if (t.link) root.style.setProperty("--link", t.link);
    circle.style.setProperty("--circle-background", resolve("--paper"));
    circle.style.setProperty("--circle-text", resolve("--ink"));
  }
  const show = () => apply({ ...site, ...load() });
  function fill() {
    inputs.background.value = resolve("--paper");
    inputs.text.value = resolve("--ink");
    inputs.button.value = resolve("--accent");
    inputs.link.value = resolve("--link");
    warning.hidden = contrast(inputs.background.value, inputs.text.value) >= 4.5;
  }

  /* ----- the box ----- */
  const presets = PORTAL_THEME.presets || [];
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

  if (PORTAL_THEME.allowColorPicker === false) { document.querySelector(".theme-wrap").hidden = true; apply(site); }
  else show();
})();
