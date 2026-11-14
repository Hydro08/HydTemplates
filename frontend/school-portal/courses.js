/* Course / Strand suggestions on the profile page (the "section" field).
   Type a letter and the courses / strands that start with it are suggested, for example "In" -> Information Technology.
   The student can also type anything that is not on the list (it is only a suggestion box).
   To change the list, edit COURSES below: "Name|CODE" (the code is optional and can also be typed to find the course). */

const COURSES = `
Science, Technology, Engineering and Mathematics|STEM
Accountancy, Business and Management|ABM
Humanities and Social Sciences|HUMSS
General Academic Strand|GAS
Technical-Vocational-Livelihood|TVL
TVL - Information and Communications Technology|TVL-ICT
TVL - Home Economics|TVL-HE
TVL - Industrial Arts|TVL-IA
TVL - Agri-Fishery Arts|TVL-AFA
Arts and Design
Sports
Information Technology|BSIT
Information Systems|BSIS
Computer Science|BSCS
Computer Engineering|BSCpE
Civil Engineering|BSCE
Electrical Engineering|BSEE
Electronics Engineering|BSECE
Mechanical Engineering|BSME
Industrial Engineering|BSIE
Chemical Engineering|BSChE
Architecture|BSArch
Interior Design|BSID
Nursing|BSN
Midwifery
Medical Technology|BSMT
Pharmacy|BSPharm
Physical Therapy|BSPT
Radiologic Technology|BSRT
Biology|BSBio
Psychology|BSPsy
Criminology|BSCrim
Social Work|BSSW
Accountancy|BSA
Accounting Information System|BSAIS
Management Accounting|BSMA
Business Administration|BSBA
Entrepreneurship|BSEntrep
Marketing Management
Financial Management
Hospitality Management|BSHM
Tourism Management|BSTM
Office Administration|BSOA
Public Administration|BPA
Political Science|BSPolSci
International Studies|BAIS
Communication|BACom
Journalism|BAJ
Multimedia Arts|BMMA
Fine Arts|BFA
Elementary Education|BEEd
Secondary Education|BSEd
Early Childhood Education|BECEd
Physical Education|BPEd
Special Needs Education|BSNEd
Mathematics|BSMath
Environmental Science|BSES
Agriculture|BSAgri
Agribusiness
Fisheries
Forestry|BSF
Marine Transportation|BSMarT
Marine Engineering|BSMarE
Customs Administration|BSCA
Library and Information Science|BLIS
`.trim().split("\n").map(line => {
  const [name, code = ""] = line.split("|");
  return { name, code, lname: name.toLowerCase(), lcode: code.toLowerCase() };
});

const COURSE_MAX = 8;   // how many suggestions are shown at once

/* Where in the name does a word start with q? (-1 = nowhere) */
function wordStart(lname, q) {
  for (let i = lname.indexOf(q); i >= 0; i = lname.indexOf(q, i + 1)) {
    if (i === 0 || /[\s,(\-]/.test(lname[i - 1])) return i;
  }
  return -1;
}

/* Names that START with the text come first, then codes (BSIT), then names that have a word starting with it */
function matchCourses(text) {
  const q = text.trim().toLowerCase();
  if (!q) return [];
  return COURSES
    .map((c, i) => ({ c, i, rank: c.lname.startsWith(q) ? 0 : c.lcode.startsWith(q) ? 1 : wordStart(c.lname, q) >= 0 ? 2 : 9 }))
    .filter(x => x.rank < 9)
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map(x => x.c);
}

function setupCourseSuggest(input) {
  const list = document.createElement("ul");
  list.className = "combo-list";
  list.id = input.id + "-list";
  list.setAttribute("role", "listbox");
  list.hidden = true;

  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-controls", list.id);
  input.autocomplete = "off";
  input.parentNode.classList.add("combo");
  input.after(list);

  let shown = [], active = -1;

  function close() {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    active = -1;
  }

  function render() {
    const text = input.value.trim();
    if (!text || input.disabled || input.readOnly) { close(); return; }
    const q = text.toLowerCase();
    shown = matchCourses(text).slice(0, COURSE_MAX);
    list.replaceChildren();
    shown.forEach((c, i) => {
      const li = document.createElement("li");
      li.id = `${list.id}-${i}`;
      li.dataset.i = i;
      li.setAttribute("role", "option");
      li.className = "has-code";
      const label = document.createElement("span");
      const at = c.lname.startsWith(q) ? 0 : wordStart(c.lname, q);
      if (at >= 0) {
        const b = document.createElement("strong");
        b.textContent = c.name.slice(at, at + q.length);
        label.append(c.name.slice(0, at), b, c.name.slice(at + q.length));
      } else label.textContent = c.name;
      li.append(label);
      if (c.code) li.append(Object.assign(document.createElement("span"), { className: "combo-code", textContent: c.code }));
      list.append(li);
    });
    if (!shown.length) {
      const note = document.createElement("li");
      note.className = "combo-note";
      note.textContent = "No suggestion. You can type your own course or strand.";
      list.append(note);
    }
    active = -1;
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  function move(step) {
    if (list.hidden) { render(); return; }
    const n = shown.length;
    if (!n) return;
    active = (active + step + n) % n;
    [...list.querySelectorAll("[data-i]")].forEach((li, i) => {
      li.setAttribute("aria-selected", String(i === active));
      if (i === active) { li.scrollIntoView({ block: "nearest" }); input.setAttribute("aria-activedescendant", li.id); }
    });
  }

  function choose(c) {
    if (!c) return;
    input.value = c.name;
    close();
    input.dispatchEvent(new Event("input", { bubbles: true }));   // progress / draft / clear the error
  }

  input.addEventListener("input", render);
  input.addEventListener("blur", close);
  input.addEventListener("keydown", e => {
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Escape") { if (!list.hidden) { e.preventDefault(); close(); } }
    else if (e.key === "Enter" && !list.hidden && active >= 0) { e.preventDefault(); choose(shown[active]); }   // Enter only picks when a suggestion is highlighted
  });
  list.addEventListener("mousedown", e => {          // mousedown, so the input keeps focus
    const li = e.target.closest("[data-i]");
    if (!li) return;
    e.preventDefault();
    choose(shown[+li.dataset.i]);
  });
}

document.querySelectorAll("input[data-courses]").forEach(setupCourseSuggest);
