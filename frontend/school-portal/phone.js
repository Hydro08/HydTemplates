/* International phone fields: a flag + country code picker in front of the number.
   Any <input type="tel" data-phone> is upgraded. The input itself (same name / id) becomes hidden and holds the full
   number, e.g. "+63 9171234567", so validation, drafts and saving keep working on one value. What you type goes in a
   visible box next to the flag (el.ui, see profile.js). Flags come from flagcdn.com. */

const DEFAULT_COUNTRY = "PH";

/* ISO code | name | dial code (digits). Countries that share +1 with area codes get their own entry (e.g. Jamaica 1876). */
const COUNTRIES = `
PH|Philippines|63
AF|Afghanistan|93
AL|Albania|355
DZ|Algeria|213
AS|American Samoa|1684
AD|Andorra|376
AO|Angola|244
AI|Anguilla|1264
AG|Antigua and Barbuda|1268
AR|Argentina|54
AM|Armenia|374
AW|Aruba|297
AU|Australia|61
AT|Austria|43
AZ|Azerbaijan|994
BS|Bahamas|1242
BH|Bahrain|973
BD|Bangladesh|880
BB|Barbados|1246
BY|Belarus|375
BE|Belgium|32
BZ|Belize|501
BJ|Benin|229
BM|Bermuda|1441
BT|Bhutan|975
BO|Bolivia|591
BA|Bosnia and Herzegovina|387
BW|Botswana|267
BR|Brazil|55
IO|British Indian Ocean Territory|246
VG|British Virgin Islands|1284
BN|Brunei|673
BG|Bulgaria|359
BF|Burkina Faso|226
BI|Burundi|257
KH|Cambodia|855
CM|Cameroon|237
CA|Canada|1
CV|Cape Verde|238
KY|Cayman Islands|1345
CF|Central African Republic|236
TD|Chad|235
CL|Chile|56
CN|China|86
CX|Christmas Island|61
CC|Cocos (Keeling) Islands|61
CO|Colombia|57
KM|Comoros|269
CK|Cook Islands|682
CR|Costa Rica|506
HR|Croatia|385
CU|Cuba|53
CW|Curaçao|599
CY|Cyprus|357
CZ|Czechia|420
CD|DR Congo|243
DK|Denmark|45
DJ|Djibouti|253
DM|Dominica|1767
DO|Dominican Republic|1809
EC|Ecuador|593
EG|Egypt|20
SV|El Salvador|503
GQ|Equatorial Guinea|240
ER|Eritrea|291
EE|Estonia|372
SZ|Eswatini|268
ET|Ethiopia|251
FK|Falkland Islands|500
FO|Faroe Islands|298
FJ|Fiji|679
FI|Finland|358
FR|France|33
GF|French Guiana|594
PF|French Polynesia|689
GA|Gabon|241
GM|Gambia|220
GE|Georgia|995
DE|Germany|49
GH|Ghana|233
GI|Gibraltar|350
GR|Greece|30
GL|Greenland|299
GD|Grenada|1473
GP|Guadeloupe|590
GU|Guam|1671
GT|Guatemala|502
GG|Guernsey|44
GN|Guinea|224
GW|Guinea-Bissau|245
GY|Guyana|592
HT|Haiti|509
HN|Honduras|504
HK|Hong Kong|852
HU|Hungary|36
IS|Iceland|354
IN|India|91
ID|Indonesia|62
IR|Iran|98
IQ|Iraq|964
IE|Ireland|353
IM|Isle of Man|44
IL|Israel|972
IT|Italy|39
CI|Ivory Coast|225
JM|Jamaica|1876
JP|Japan|81
JE|Jersey|44
JO|Jordan|962
KZ|Kazakhstan|7
KE|Kenya|254
KI|Kiribati|686
XK|Kosovo|383
KW|Kuwait|965
KG|Kyrgyzstan|996
LA|Laos|856
LV|Latvia|371
LB|Lebanon|961
LS|Lesotho|266
LR|Liberia|231
LY|Libya|218
LI|Liechtenstein|423
LT|Lithuania|370
LU|Luxembourg|352
MO|Macao|853
MG|Madagascar|261
MW|Malawi|265
MY|Malaysia|60
MV|Maldives|960
ML|Mali|223
MT|Malta|356
MH|Marshall Islands|692
MQ|Martinique|596
MR|Mauritania|222
MU|Mauritius|230
YT|Mayotte|262
MX|Mexico|52
FM|Micronesia|691
MD|Moldova|373
MC|Monaco|377
MN|Mongolia|976
ME|Montenegro|382
MS|Montserrat|1664
MA|Morocco|212
MZ|Mozambique|258
MM|Myanmar|95
NA|Namibia|264
NR|Nauru|674
NP|Nepal|977
NL|Netherlands|31
NC|New Caledonia|687
NZ|New Zealand|64
NI|Nicaragua|505
NE|Niger|227
NG|Nigeria|234
NU|Niue|683
NF|Norfolk Island|672
KP|North Korea|850
MK|North Macedonia|389
MP|Northern Mariana Islands|1670
NO|Norway|47
OM|Oman|968
PK|Pakistan|92
PW|Palau|680
PS|Palestine|970
PA|Panama|507
PG|Papua New Guinea|675
PY|Paraguay|595
PE|Peru|51
PL|Poland|48
PT|Portugal|351
PR|Puerto Rico|1787
QA|Qatar|974
CG|Republic of the Congo|242
RE|Réunion|262
RO|Romania|40
RU|Russia|7
RW|Rwanda|250
BL|Saint Barthélemy|590
SH|Saint Helena|290
KN|Saint Kitts and Nevis|1869
LC|Saint Lucia|1758
MF|Saint Martin|590
PM|Saint Pierre and Miquelon|508
VC|Saint Vincent and the Grenadines|1784
WS|Samoa|685
SM|San Marino|378
ST|São Tomé and Príncipe|239
SA|Saudi Arabia|966
SN|Senegal|221
RS|Serbia|381
SC|Seychelles|248
SL|Sierra Leone|232
SG|Singapore|65
SX|Sint Maarten|1721
SK|Slovakia|421
SI|Slovenia|386
SB|Solomon Islands|677
SO|Somalia|252
ZA|South Africa|27
KR|South Korea|82
SS|South Sudan|211
ES|Spain|34
LK|Sri Lanka|94
SD|Sudan|249
SR|Suriname|597
SE|Sweden|46
CH|Switzerland|41
SY|Syria|963
TW|Taiwan|886
TJ|Tajikistan|992
TZ|Tanzania|255
TH|Thailand|66
TL|Timor-Leste|670
TG|Togo|228
TK|Tokelau|690
TO|Tonga|676
TT|Trinidad and Tobago|1868
TN|Tunisia|216
TR|Türkiye|90
TM|Turkmenistan|993
TC|Turks and Caicos Islands|1649
TV|Tuvalu|688
UG|Uganda|256
UA|Ukraine|380
AE|United Arab Emirates|971
GB|United Kingdom|44
US|United States|1
UY|Uruguay|598
VI|US Virgin Islands|1340
UZ|Uzbekistan|998
VU|Vanuatu|678
VA|Vatican City|379
VE|Venezuela|58
VN|Vietnam|84
WF|Wallis and Futuna|681
EH|Western Sahara|212
YE|Yemen|967
ZM|Zambia|260
ZW|Zimbabwe|263
`.trim().split("\n").map(line => {
  const [iso, name, dial] = line.split("|");
  return { iso, name, dial };
});

/* Several countries share a code (+7, +44, ...): when reading a saved number, the main one is shown */
const PREFERRED = ["US", "PH", "RU", "GB", "AU", "MA", "RE", "GP"];
const COUNTRY_BY_ISO = new Map(COUNTRIES.map(c => [c.iso, c]));
const dialLabel = c => "+" + (c.dial.length === 4 && c.dial[0] === "1" ? c.dial[0] + " " + c.dial.slice(1) : c.dial);
const flagUrl = (c, w) => `https://flagcdn.com/w${w}/${c.iso.toLowerCase()}.png`;
const flagImg = c => {
  const img = document.createElement("img");
  img.className = "flag";
  img.alt = "";
  img.width = 20; img.height = 15;
  img.loading = "lazy";
  img.src = flagUrl(c, 20);
  img.srcset = flagUrl(c, 40) + " 2x";
  img.onerror = () => { img.replaceWith(Object.assign(document.createElement("span"), { className: "flag flag-code", textContent: c.iso })); };
  return img;
};

/* Example of how a number looks in each country (what you type after the code, without the leading 0). Others get a generic example. */
const PHONE_EXAMPLES = {
  PH: "9XX XXX XXXX", GB: "7XXX XXXXXX", GG: "7XXX XXXXXX", JE: "7XXX XXXXXX", IM: "7XXX XXXXXX", US: "XXX XXX XXXX", CA: "XXX XXX XXXX",
  AU: "4XX XXX XXX", NZ: "2X XXX XXXX", SG: "8XXX XXXX", MY: "1X XXX XXXX", JP: "90 XXXX XXXX", KR: "10 XXXX XXXX", CN: "1XX XXXX XXXX",
  HK: "XXXX XXXX", MO: "6XXX XXXX", TW: "9XX XXX XXX", IN: "9XXXX XXXXX", AE: "5X XXX XXXX", SA: "5X XXX XXXX", QA: "XXXX XXXX",
  KW: "XXXX XXXX", BH: "XXXX XXXX", OM: "XXXX XXXX", DE: "15X XXXXXXXX", FR: "6 XX XX XX XX", ES: "6XX XXX XXX", IT: "3XX XXX XXXX",
  NL: "6 XXXXXXXX", BE: "4XX XX XX XX", CH: "7X XXX XX XX", AT: "6XX XXXXXXX", SE: "7X XXX XX XX", NO: "XXX XX XXX", DK: "XX XX XX XX",
  FI: "4X XXX XXXX", IE: "8X XXX XXXX", PT: "9XX XXX XXX", PL: "XXX XXX XXX", RU: "9XX XXX XX XX", KZ: "7XX XXX XX XX", UA: "XX XXX XXXX",
  TR: "5XX XXX XX XX", GR: "69X XXX XXXX", BR: "XX 9XXXX XXXX", MX: "XX XXXX XXXX", AR: "9 XX XXXX XXXX", CL: "9 XXXX XXXX",
  CO: "3XX XXX XXXX", PE: "9XX XXX XXX", ZA: "XX XXX XXXX", NG: "8XX XXX XXXX", KE: "7XX XXX XXX", EG: "1X XXXX XXXX", ID: "8XX XXXX XXXX",
  TH: "8X XXX XXXX", VN: "9X XXX XXXX", PK: "3XX XXXXXXX", BD: "1XXX XXXXXX", LK: "7X XXX XXXX", NP: "98X XXX XXXX", IL: "5X XXX XXXX",
  CZ: "XXX XXX XXX", HU: "XX XXX XXXX", RO: "7XX XXX XXX", KH: "XX XXX XXX", MM: "9XX XXX XXX", LA: "20 XXXX XXXX", BN: "XXX XXXX",
  JO: "7X XXX XXXX", LB: "XX XXX XXX", IQ: "7XX XXX XXXX", IR: "9XX XXX XXXX", GH: "XX XXX XXXX", ET: "9X XXX XXXX", TZ: "7XX XXX XXX", UG: "7XX XXX XXX",
};
/* Caribbean +1 countries carry their area code in the dial code, so only 7 digits follow */
const phoneExample = c => PHONE_EXAMPLES[c.iso] || (c.dial.length === 4 && c.dial[0] === "1" ? "XXX XXXX" : "XXX XXX XXX");

/* "+63 9171234567", "+1 868 5551234" or an old "09171234567" -> { country, national } */
function parsePhone(full) {
  const raw = String(full || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) {
    for (let len = 4; len >= 1; len--) {
      const hit = COUNTRIES.filter(c => c.dial === digits.slice(0, len));
      if (hit.length) {
        const c = hit.find(x => PREFERRED.includes(x.iso)) || hit[0];
        return { country: c, national: digits.slice(len) };
      }
    }
  }
  return { country: COUNTRY_BY_ISO.get(DEFAULT_COUNTRY), national: digits.replace(/^0/, "") };
}

/* Rules per country for the digits after the country code (without the 0 in front):
   [the digit every number starts with ("" = any), fewest digits, most digits].
   The first digit is filled in for you (Philippines: 9, so you only type the rest). Countries that are not listed
   accept 6 digits up to what the international standard allows (15 in total with the country code).
   Add or change a country here. */
const PHONE_SPECS = {
  PH: ["9", 10, 10],
  GB: ["7", 10, 10], GG: ["7", 10, 10], JE: ["7", 10, 10], IM: ["7", 10, 10], AU: ["4", 9, 9], CN: ["1", 11, 11], TW: ["9", 9, 9],
  MY: ["1", 9, 10], KR: ["1", 9, 10], ID: ["8", 9, 12], PT: ["9", 9, 9], RU: ["9", 10, 10], KZ: ["7", 10, 10], TR: ["5", 10, 10],
  SA: ["5", 9, 9], AE: ["5", 9, 9], IL: ["5", 9, 9], IT: ["3", 9, 10], NL: ["6", 9, 9], BE: ["4", 9, 9], CH: ["7", 9, 9],
  AT: ["6", 10, 12], SE: ["7", 9, 9], IE: ["8", 9, 9], GR: ["6", 10, 10], PK: ["3", 10, 10], BD: ["1", 10, 10], LK: ["7", 9, 9],
  NP: ["9", 10, 10], MM: ["9", 9, 10], EG: ["1", 10, 10], KE: ["7", 9, 9], UG: ["7", 9, 9],
  US: ["", 10, 10], CA: ["", 10, 10], MX: ["", 10, 10], AR: ["", 10, 10], CO: ["", 10, 10], BR: ["", 10, 11], CL: ["", 9, 9], PE: ["", 9, 9],
  HK: ["", 8, 8], SG: ["", 8, 8], JP: ["", 10, 10], IN: ["", 10, 10], TH: ["", 9, 9], VN: ["", 9, 10], LA: ["", 10, 10], KH: ["", 8, 9],
  NZ: ["", 8, 10], QA: ["", 8, 8], KW: ["", 8, 8], BH: ["", 8, 8], OM: ["", 8, 8], JO: ["", 9, 9], LB: ["", 7, 8], IQ: ["", 10, 10], IR: ["", 10, 10],
  DE: ["", 10, 11], FR: ["", 9, 9], ES: ["", 9, 9], PL: ["", 9, 9], DK: ["", 8, 8], NO: ["", 8, 8], CZ: ["", 9, 9], HU: ["", 9, 9], RO: ["", 9, 9], UA: ["", 9, 9],
  ZA: ["", 9, 9], NG: ["", 10, 10], GH: ["", 9, 9], ET: ["", 9, 9], TZ: ["", 9, 9]
};
function phoneSpec(c) {
  const s = PHONE_SPECS[c.iso];
  if (s) return { prefix: s[0], min: s[1], max: s[2] };
  if (c.dial.length === 4 && c.dial[0] === "1") return { prefix: "", min: 7, max: 7 };   // +1 countries with their area code in the dial code
  return { prefix: "", min: 6, max: 15 - c.dial.length };
}

/* Is the number complete for its country? Gives back an error message, or "" when it is fine */
function phoneProblem(full) {
  const { country, national } = parsePhone(full);
  const s = phoneSpec(country);
  if (national.length < s.min || national.length > s.max) {
    const digits = s.min === s.max ? `${s.max} digits` : `${s.min}-${s.max} digits`;
    return `Enter a valid number: ${digits} after ${dialLabel(country)}.`;
  }
  if (s.prefix && !national.startsWith(s.prefix)) return `The number must start with ${s.prefix}.`;
  return "";
}

function setupPhone(hidden) {
  const country0 = COUNTRY_BY_ISO.get(DEFAULT_COUNTRY);
  let country = country0;

  const wrap = document.createElement("div");
  wrap.className = "phone-field";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "cc-btn";
  btn.setAttribute("aria-haspopup", "listbox");
  btn.setAttribute("aria-expanded", "false");

  const local = document.createElement("input");
  local.type = "tel";
  local.id = hidden.id + "_local";
  local.className = "phone-local";
  local.autocomplete = hidden.autocomplete === "tel" ? "tel-national" : "off";
  local.inputMode = "numeric";
  local.pattern = "[0-9]*";
  local.setAttribute("aria-describedby", hidden.getAttribute("aria-describedby") || "");
  local.required = hidden.required;

  const panel = document.createElement("div");
  panel.className = "cc-panel";
  panel.hidden = true;
  const search = document.createElement("input");
  search.type = "search";
  search.className = "cc-search";
  search.placeholder = "Search country or code";
  search.autocomplete = "off";
  search.setAttribute("aria-label", "Search country");
  const list = document.createElement("ul");
  list.className = "cc-list";
  list.setAttribute("role", "listbox");
  panel.append(search, list);

  wrap.append(btn, local, panel);
  hidden.type = "hidden";
  hidden.insertAdjacentElement("afterend", wrap);
  const label = document.querySelector(`label[for="${hidden.id}"]`);
  if (label) label.htmlFor = local.id;

  /* ----- value ----- */
  const spec = () => phoneSpec(country);
  const digitsOf = v => v.replace(/\D/g, "").replace(/^0+/, "");
  function fit(d) {                        // what the box may hold for this country: starts with its first digit, not too long
    const s = spec();
    if (s.prefix && d && !d.startsWith(s.prefix)) d = s.prefix + d;
    return d.slice(0, s.max);
  }
  function show(d) {                       // an empty box always shows the country's first digit (e.g. 9 for the Philippines)
    const v = fit(d) || spec().prefix;
    if (local.value !== v) local.value = v;
  }
  function compose() {
    const national = digitsOf(local.value);
    return national && national !== spec().prefix ? "+" + country.dial + " " + national : "";   // only the first digit = still empty
  }
  function push() {
    hidden.value = compose();
    hidden.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function renderButton() {
    btn.replaceChildren(flagImg(country), Object.assign(document.createElement("span"), { className: "cc-dial", textContent: dialLabel(country) }),
      Object.assign(document.createElement("span"), { className: "cc-caret", textContent: "▾", ariaHidden: "true" }));
    local.placeholder = phoneExample(country);
    const sp = spec();
    local.title = `${country.name}: ${sp.min === sp.max ? sp.max : sp.min + "-" + sp.max} digits after ${dialLabel(country)}` + (sp.prefix ? `, starts with ${sp.prefix}` : "");
    btn.setAttribute("aria-label", `Country code: ${country.name} ${dialLabel(country)}`);
  }
  function choose(c) {
    const typed = digitsOf(local.value);
    const untouched = !typed || typed === spec().prefix;   // nothing typed yet: start fresh with the new country's first digit
    country = c;
    renderButton();
    if (untouched) show(""); else local.value = typed.slice(0, spec().max);
    close();
    push();
    local.focus();
  }

  /* ----- picker ----- */
  let shown = [], active = -1;
  function renderList() {
    const q = search.value.trim().toLowerCase().replace(/^\+/, "");
    shown = COUNTRIES.filter(c => !q || c.name.toLowerCase().includes(q) || c.iso.toLowerCase() === q || c.dial.startsWith(q));
    list.replaceChildren();
    shown.forEach((c, i) => {
      const li = document.createElement("li");
      li.setAttribute("role", "option");
      li.id = `${hidden.id}-cc-${c.iso}`;
      li.setAttribute("aria-selected", c === country ? "true" : "false");
      li.append(flagImg(c), Object.assign(document.createElement("span"), { className: "cc-name", textContent: c.name }),
        Object.assign(document.createElement("span"), { className: "cc-code", textContent: dialLabel(c) }));
      li.addEventListener("mousedown", e => { e.preventDefault(); choose(c); });
      list.append(li);
    });
    if (!shown.length) list.append(Object.assign(document.createElement("li"), { className: "cc-none", textContent: "No country found." }));
    setActive(shown.indexOf(country) >= 0 && !q ? shown.indexOf(country) : (shown.length ? 0 : -1));
  }
  function setActive(i) {
    active = i;
    [...list.children].forEach((li, k) => li.classList.toggle("active", k === i));
    const li = list.children[i];
    if (li && li.scrollIntoView) li.scrollIntoView({ block: "nearest" });
  }
  function open() {
    if (!panel.hidden) return;
    search.value = "";
    renderList();
    panel.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    search.focus();
  }
  function close() {
    panel.hidden = true;
    btn.setAttribute("aria-expanded", "false");
  }
  btn.addEventListener("click", () => panel.hidden ? open() : close());
  search.addEventListener("input", renderList);
  search.addEventListener("keydown", e => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(Math.min(active + 1, shown.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(Math.max(active - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (shown[active]) choose(shown[active]); }
    else if (e.key === "Escape") { e.preventDefault(); close(); btn.focus(); }
  });
  document.addEventListener("mousedown", e => { if (!wrap.contains(e.target)) close(); });
  wrap.addEventListener("focusout", () => setTimeout(() => { if (!wrap.contains(document.activeElement)) close(); }, 0));

  /* ----- typing: digits only (numeric keypad on phones), limited to the country's length.
     A pasted "+63 917…" or "0917…" is understood ----- */
  local.addEventListener("input", e => {
    e.stopPropagation();   // only the hidden field reports changes to the form
    const typed = local.value.trim();
    if (typed.startsWith("+") && typed.replace(/\D/g, "").length >= 3) {
      const p = parsePhone(typed);
      country = p.country;
      renderButton();
      show(p.national);
    } else {
      show(digitsOf(local.value));
    }
    push();
  });
  local.addEventListener("paste", e => {
    const text = (e.clipboardData && e.clipboardData.getData("text")) || "";
    const d = digitsOf(text);
    const s = spec();
    if (!text.trim().startsWith("+") && s.prefix && d.length > 1 && d.startsWith(s.prefix)) {   // a whole number "917…" / "0917…": replaces what is there
      e.preventDefault();
      show(d);
      push();
    }
  });

  /* ----- used by profile.js ----- */
  hidden.ui = {
    focus: () => local.focus(),
    box: wrap,
    setFull(full) {                      // put a saved / draft value back on screen
      const p = parsePhone(full);
      country = p.country;
      renderButton();
      show(p.national);
      hidden.value = compose();          // normalised, no event
    }
  };
  renderButton();
  show("");   // starts with the country's first digit (9 for the Philippines)
}

document.querySelectorAll("input[data-phone]").forEach(setupPhone);
