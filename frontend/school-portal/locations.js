/* Cascading Philippine address pickers on the profile page:
     Province -> City / Municipality -> Barangay -> (House No. / Street, ZIP code)
   Type a letter and every place that starts with it is suggested. Each field stays locked until the one before it is chosen,
   and changing a field clears and locks the ones after it.
   Data comes from PH_API_BASE (shared/js/config.js). If it cannot be reached, the fields fall back to plain typing
   so the form still works. */

const NCR = { code: "130000000", name: "Metro Manila (NCR)", ncr: true };
const byName = (a, b) => a.name.localeCompare(b.name);
const placeCache = new Map();

async function fetchPlaces(path) {
  if (placeCache.has(path)) return placeCache.get(path);
  const res = await fetch(PH_API_BASE.replace(/\/$/, "") + path);
  if (!res.ok) throw new Error("HTTP " + res.status);
  const data = await res.json();
  const list = (Array.isArray(data) ? data : (data && data.data) || [])
    .filter(x => x && x.code && x.name)
    .map(x => ({ code: String(x.code), name: String(x.name).trim() }))
    .sort(byName);
  if (!list.length) throw new Error("empty list");
  placeCache.set(path, list);
  return list;
}

async function loadProvinces() {
  const list = await fetchPlaces("/provinces/");
  const hasNcr = list.some(p => p.code === NCR.code || /metro manila|national capital|\bncr\b/i.test(p.name));
  return hasNcr ? list : [...list, NCR].sort(byName); // Metro Manila has no province in PSGC, so it is added here
}
const loadCities = prov => fetchPlaces(
  prov.ncr || prov.code === NCR.code
    ? `/regions/${NCR.code}/cities-municipalities/`
    : `/provinces/${prov.code}/cities-municipalities/`
);
const loadBarangays = city => fetchPlaces(`/cities-municipalities/${city.code}/barangays/`);

/* ---------- A plain field that is locked until the field before it is chosen (street, ZIP) ---------- */
class Gate {
  constructor(input, parentLabel) {
    this.input = input;
    this.placeholder = input.placeholder;
    this.parentLabel = parentLabel;
    this.parent = null;
    this.children = [];
  }
  lock() {
    const i = this.input;
    const had = i.value !== "";
    i.disabled = true;
    i.value = "";
    i.placeholder = `Select a ${this.parentLabel} first`;
    if (had) i.dispatchEvent(new Event("input", { bubbles: true })); // updates progress / draft / errors
  }
  unlock() { this.input.disabled = false; this.input.placeholder = this.placeholder; }
  reset() { this.lock(); }
}

/* ---------- Autocomplete field ---------- */
class Combo extends Gate {
  constructor(input, { label, load, parentLabel, onManual }) {
    super(input, parentLabel);
    this.label = label;       // e.g. "province", used in messages
    this.load = load;         // (selected item of the parent) => Promise<[{code, name}]>
    this.onManual = onManual;
    this.items = null;
    this.selected = null;
    this.manual = false;      // true when the list could not be loaded: plain typing
    this.active = -1;
    this.token = 0;

    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    input.autocomplete = "off";
    this.list = document.createElement("ul");
    this.list.className = "combo-list";
    this.list.id = input.id + "-list";
    this.list.setAttribute("role", "listbox");
    this.list.hidden = true;
    input.setAttribute("aria-controls", this.list.id);
    input.parentNode.classList.add("combo");
    input.after(this.list);

    input.addEventListener("focus", () => this.open());
    input.addEventListener("click", () => this.open());
    input.addEventListener("input", () => this.onType());
    input.addEventListener("keydown", e => this.onKey(e));
    input.addEventListener("blur", () => this.commit());
    this.list.addEventListener("mousedown", e => {       // mousedown, so the input keeps focus
      const li = e.target.closest("[data-i]");
      if (!li) return;
      e.preventDefault();
      this.select(this.shown[+li.dataset.i]);
    });
  }

  /* --- locking --- */
  lock() {
    this.token++;                       // ignore any list that is still loading
    this.items = null;
    this.selected = null;
    this.manual = false;
    this.close();
    super.lock();
    this.children.forEach(c => c.lock());
  }
  reset() { this.lock(); }

  /* --- loading --- */
  async ensureItems() {
    if (this.items) return;
    if (this.parent && this.parent.manual) { this.setManual(); return; }
    const token = ++this.token;
    this.showMessage("Loading…");
    try {
      const items = await this.load(this.parent ? this.parent.selected : null);
      if (token === this.token) this.items = items;
    } catch {
      if (token === this.token) this.setManual();
    }
  }

  setManual() {
    this.manual = true;
    this.items = [];
    this.close();
    this.input.placeholder = this.placeholder;
    this.children.forEach(c => { c.unlock(); if (c instanceof Combo) c.setManual(); });  // the rest of the chain is typed too
    if (this.onManual) this.onManual();
  }

  /* --- typing, list, selection --- */
  onType() {
    if (this.silent) return;
    if (this.selected) {                // editing a chosen value: the fields after it are no longer valid
      this.selected = null;
      this.children.forEach(c => c.lock());
    }
    this.open();
  }

  async open() {
    if (this.input.disabled || this.input.readOnly) return;
    await this.ensureItems();
    if (this.manual || document.activeElement !== this.input) return;
    this.render();
  }

  render() {
    const q = this.input.value.trim().toLowerCase();
    const items = this.items || [];
    // Places that START with what was typed come first. "City of Manila" also counts as "Manila".
    // Only when nothing starts with it, places with a word that starts with it are shown (e.g. "Cruz" -> "Santa Cruz").
    const keys = i => [i.name.toLowerCase(), i.name.toLowerCase().replace(/^city of\s+/, "")];
    let shown;
    if (!q) shown = items;
    else {
      shown = items.filter(i => keys(i).some(k => k.startsWith(q)));
      if (!shown.length) shown = items.filter(i => i.name.toLowerCase().split(/[\s,()-]+/).some(w => w.startsWith(q)));
    }
    this.total = shown.length;
    this.shown = shown.slice(0, 100);
    this.list.replaceChildren();
    this.shown.forEach((item, i) => {
      const li = document.createElement("li");
      li.id = `${this.list.id}-${i}`;
      li.dataset.i = i;
      li.setAttribute("role", "option");
      const at = q ? item.name.toLowerCase().indexOf(q) : -1;
      if (at >= 0) {
        const b = document.createElement("strong");
        b.textContent = item.name.slice(at, at + q.length);
        li.append(item.name.slice(0, at), b, item.name.slice(at + q.length));
      } else li.textContent = item.name;
      this.list.append(li);
    });
    if (!this.shown.length) this.showMessage(`No ${this.label} matches "${this.input.value.trim()}"`);
    else if (this.total > this.shown.length) {
      const more = document.createElement("li");
      more.className = "combo-note";
      more.textContent = `${this.total - this.shown.length} more… keep typing to narrow the list`;
      this.list.append(more);
    }
    this.active = -1;
    this.list.hidden = false;
    this.input.setAttribute("aria-expanded", "true");
  }

  showMessage(text) {
    if (document.activeElement !== this.input) return;
    this.shown = [];
    const li = document.createElement("li");
    li.className = "combo-note";
    li.textContent = text;
    this.list.replaceChildren(li);
    this.list.hidden = false;
    this.input.setAttribute("aria-expanded", "true");
  }

  close() {
    this.list.hidden = true;
    this.input.setAttribute("aria-expanded", "false");
    this.input.removeAttribute("aria-activedescendant");
    this.active = -1;
  }

  move(step) {
    if (this.list.hidden) { this.open(); return; }
    const n = this.shown.length;
    if (!n) return;
    this.active = (this.active + step + n) % n;
    [...this.list.querySelectorAll("[data-i]")].forEach((li, i) => {
      li.setAttribute("aria-selected", String(i === this.active));
      if (i === this.active) { li.scrollIntoView({ block: "nearest" }); this.input.setAttribute("aria-activedescendant", li.id); }
    });
  }

  onKey(e) {
    if (e.key === "ArrowDown") { e.preventDefault(); this.move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); this.move(-1); }
    else if (e.key === "Escape") { if (!this.list.hidden) { e.preventDefault(); this.close(); } }
    else if (e.key === "Enter" && !this.list.hidden) {
      e.preventDefault();               // do not submit the form while choosing
      if (this.active >= 0) this.select(this.shown[this.active]);
      else if (this.shown.length === 1) this.select(this.shown[0]);
    }
  }

  select(item) {
    if (!item) return;
    this.selected = item;
    this.input.value = item.name;
    this.close();
    this.silent = true;                 // so our own "input" listener does not treat this as typing
    this.input.dispatchEvent(new Event("input", { bubbles: true }));  // progress / draft / clear error
    this.silent = false;
    this.children.forEach(c => { c.lock(); c.unlock(); });
  }

  /* When the field loses focus, text that exactly matches a place becomes the choice */
  commit() {
    this.close();
    if (this.manual || this.selected || !this.items) return;
    const t = this.input.value.trim().toLowerCase();
    const hit = t && this.items.find(i => i.name.toLowerCase() === t);
    if (hit) this.select(hit);
  }

  /* Used to restore a saved / draft value. Returns true when the value is accepted. */
  async setValue(name) {
    if (this.input.disabled || !name) return false;
    await this.ensureItems();
    if (this.manual) { this.input.value = name; return true; }
    const hit = (this.items || []).find(i => i.name.toLowerCase() === String(name).toLowerCase());
    if (hit) { this.select(hit); return true; }
    this.input.value = name;            // not in the list: shown, but must be chosen again
    return false;
  }

  /* Valid when a place was chosen from the list (or typed, when the list could not be loaded) */
  get valid() { return this.manual ? this.input.value.trim().length >= 2 : !!this.selected; }
}

/* ---------- Wire the chain used by profile.html ---------- */
function setupAddress({ onManual, prefix = "" } = {}) {   // prefix "prov_": the Province address uses the ids prov_province, prov_city...
  const $ = id => document.getElementById(prefix + id);
  const province = new Combo($("province"), { label: "province", load: loadProvinces, onManual });
  const city = new Combo($("city"), { label: "city or municipality", load: loadCities, parentLabel: "province", onManual });
  const barangay = new Combo($("barangay"), { label: "barangay", load: loadBarangays, parentLabel: "city or municipality", onManual });
  const street = new Gate($("street"), "barangay");
  const zip = new Gate($("zip"), "barangay");

  [[province, city], [city, barangay], [barangay, street], [barangay, zip]].forEach(([p, c]) => {
    p.children.push(c);
    c.parent = p;
    c.lock();
  });
  [province, city, barangay].forEach(c => { c.input.combo = c; });

  /* Fill the whole chain from saved values, one level at a time (each level needs the one before it) */
  async function restore(v) {
    for (const [combo, key] of [[province, "province"], [city, "city"], [barangay, "barangay"]]) {
      if (!v[key]) return;
      if (!(await combo.setValue(v[key]))) return;
    }
    if (v.street) street.input.value = v.street;
    if (v.zip) zip.input.value = v.zip;
  }
  /* Empty the whole chain (used when "Same as home address" is unchecked) */
  function clear() {
    province.selected = null;
    province.manual = false;
    province.input.value = "";
    province.children.forEach(c => c.lock());
  }
  return { province, city, barangay, street, zip, restore, clear };
}
