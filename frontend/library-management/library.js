/* Library Management - demo mode: everything is kept in the browser (localStorage).
   To use a real backend, replace the load()/save() functions and the auth checks below with API calls. */
const LOAN_DAYS = 14;                                   // how long a book can be borrowed
const ADMIN = { username: "admin", password: "Admin@12345" }; // demo only: change or remove before sharing
const KEY = "hyd-library-v1";
/* The lock: a book with no copies left is locked (cannot be requested). Change how it looks here. */
const LIBRARY_LOCK = {
  enabled: true,                    // false = never lock (the button just says "Unavailable")
  icon: "🔒",                       // any emoji or short text, shown on the book
  label: "All copies borrowed",     // the words shown on the locked book
  canOpen: true                     // false = a locked book's cover cannot be opened
};
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const SEED = {
  users: [],
  books: [
    { id: 1, title: "Noli Me Tangere", author: "José Rizal", category: "Classics", copies: 3, description: "A novel that exposes the abuses of Spanish colonial rule through Crisostomo Ibarra, who returns home to the Philippines and falls in love with María Clara." },
    { id: 2, title: "El Filibusterismo", author: "José Rizal", category: "Classics", copies: 2, description: "The sequel to Noli Me Tangere. Years later, Ibarra returns in disguise as the rich jeweler Simoun and plots revenge on the colonial order." },
    { id: 3, title: "Clean Code", author: "Robert C. Martin", category: "Technology", copies: 2, description: "A guide to writing code that is easy to read and maintain. It covers how to structure code with clear names, small functions and tidy design, so other programmers can understand and change it." },
    { id: 4, title: "Introduction to Algorithms", author: "Cormen et al.", category: "Technology", copies: 1, description: "A comprehensive textbook on the algorithms and data structures behind computer science, such as sorting, searching and graphs, and how to measure how fast they run." },
    { id: 5, title: "A Brief History of Time", author: "Stephen Hawking", category: "Science", copies: 2, description: "Stephen Hawking explains big ideas about the universe, such as the Big Bang, black holes and the nature of time, in language for everyday readers." },
    { id: 6, title: "Florante at Laura", author: "Francisco Balagtas", category: "Classics", copies: 2, description: "A classic Filipino narrative poem about Prince Florante, betrayed and left tied to a tree, and the love, loyalty and war that follow." }
  ],
  loans: []
};

/* A loan goes: pending (member asked) -> borrowed (admin accepted) -> returning (member pressed "Return book") -> returned (admin accepted the return),
   or pending -> rejected (admin said no). Older saved data without a status is upgraded here. */
function load() {
  let d;
  try { d = JSON.parse(localStorage.getItem(KEY)) || structuredClone(SEED); } catch { d = structuredClone(SEED); }
  delete d.session; delete d.notifs;               // the signed-in user is kept per tab, not in the shared data (old saved notifications are dropped)
  d.books.forEach(b => { if (b.description === undefined) { const s = SEED.books.find(x => x.id === b.id); if (s) b.description = s.description; } });   // older saved books get the description too
  d.loans.forEach(l => { if (!l.status) l.status = l.returnedAt ? "returned" : "borrowed"; if (!l.requestedAt) l.requestedAt = l.borrowedAt; });
  return d;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {} }
let db = load();

/* Who is signed in lives in sessionStorage, so every browser tab has its own account.
   (Books and loans are shared between tabs through localStorage.) */
let session = null;
try { session = JSON.parse(sessionStorage.getItem(KEY + "-session")); } catch {}
const setSession = s => { session = s; try { s ? sessionStorage.setItem(KEY + "-session", JSON.stringify(s)) : sessionStorage.removeItem(KEY + "-session"); } catch {} };
const isAdmin = () => !!session && session.role === "admin";
/* A copy is only taken once the librarian accepts the request (borrowed), and it stays taken until the return is accepted (returning).
   A pending request does NOT reduce the copies: it still has to be approved. */
const isOut = l => l.status === "borrowed" || l.status === "returning";
const holds = l => l.status === "pending" || isOut(l);               // a member can have only one open request/loan per book
const available = b => b.copies - db.loans.filter(l => l.bookId === b.id && isOut(l)).length;
const fmt = t => new Date(t).toLocaleDateString();


/* ---------- toast: top center on desktop/tablet, bottom right on phones (see CSS) ---------- */
function toast(msg, kind = "") {
  const t = document.createElement("div");
  t.className = "toast " + kind; t.textContent = msg; $("toasts").appendChild(t);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 300); }, 3500);
}

/* ---------- red badges: Manage = borrow requests waiting, My Loans = overdue books ---------- */
function updateBadge() {
  const n = isAdmin() ? pending().length + returning().length : mine().filter(isLate).length, txt = n > 99 ? "99+" : String(n);
  [$("manageCount"), $("loansCount"), $("burgerCount")].forEach(el => { el.hidden = !n; el.textContent = txt; });
  if (isAdmin()) $("loansCount").hidden = true; else $("manageCount").hidden = true;
}

/* ---------- auth ---------- */
let signUp = false;
const HINT_IN = 'Sign in to browse and borrow books.<br><small>Demo admin: admin / Admin@12345</small>';
const HINT_UP = "Create an account to borrow books.";
/* Switching between Sign in and Sign up clears every field, the error and the password, like a real site. */
function setMode(up) {
  signUp = up;
  $("authForm").reset();
  $("fullName").closest("label").hidden = !up; $("fullName").required = up;
  $("authBtn").textContent = up ? "Sign up" : "Sign in";
  $("toggleAuth").textContent = up ? "Have an account? Sign in" : "No account? Sign up";
  $("authHint").innerHTML = up ? HINT_UP : HINT_IN;
  $("authError").textContent = "";
}
$("toggleAuth").onclick = e => { e.preventDefault(); setMode(!signUp); };
setMode(false);
$("authForm").onsubmit = async e => {
  e.preventDefault();
  db = load();                                        // pick up accounts made in another tab
  const username = $("username").value.trim(), password = $("password").value;
  const err = m => $("authError").textContent = m;
  if (signUp) {
    if (db.users.some(u => u.username === username) || username === ADMIN.username) return err("Username is taken.");
    db.users.push({ username, name: $("fullName").value.trim(), hash: await hash(password) });
    save(); setMode(false);
    return toast("Account created. You can sign in now.", "ok");
  }
  if (username === ADMIN.username && password === ADMIN.password) setSession({ username, name: "Librarian", role: "admin" });
  else {
    const u = db.users.find(x => x.username === username);
    if (!u || u.hash !== await hash(password)) return err("Wrong username or password.");
    setSession({ username, name: u.name, role: "member" });
  }
  err(""); start();
};
async function hash(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
}
$("logout").onclick = () => { setSession(null); location.reload(); };

/* ---------- views ---------- */
const TITLES = { dashboard: "Dashboard", books: "Books", loans: "My Loans", admin: "Manage", history: "History" };
const DAY = 864e5, SOON = 3, RECENT = 7 * DAY;           // "due soon" = within 3 days; rejected notices last 7 days
const mine = () => db.loans.filter(l => l.username === session.username);
/* My Loans only lists what is still going on: a returned book leaves the shelf (it stays in the librarian's History); a rejected request goes after 7 days. */
const onShelf = l => l.status !== "returned" && !(l.status === "rejected" && Date.now() - (l.decidedAt || 0) > RECENT);
const bookOf = l => db.books.find(x => x.id === l.bookId) || { title: "(deleted book)" };
const nameOf = u => (db.users.find(x => x.username === u) || { name: u }).name;
const pending = () => db.loans.filter(l => l.status === "pending");
const returning = () => db.loans.filter(l => l.status === "returning");
const borrowed = () => db.loans.filter(l => l.status === "borrowed");
const isLate = l => l.status === "borrowed" && Date.now() > l.due;
const dash = t => t ? fmt(t) : "-";
const badge = l => l.status === "pending" ? '<span class="badge warn">Pending</span>'
  : l.status === "rejected" ? '<span class="badge bad">Rejected</span>'
  : l.status === "returned" ? '<span class="badge ok">Returned</span>'
  : l.status === "returning" ? '<span class="badge warn">Returning</span>'
  : isLate(l) ? '<span class="badge bad">Overdue</span>' : '<span class="badge">Borrowed</span>';
function table(head, rows, cap) {                                       // cap = max rows shown before the table gets its own scrollbar
  if (!rows.length) return '<p class="muted">Nothing here yet.</p>';
  return `<div class="wrap${cap && rows.length > cap ? " scroll" : ""}"><table><tr>${head.map(x => `<th>${x}</th>`).join("")}</tr>` +
    rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("") + "</table></div>";
}

function start() {
  document.body.classList.remove("in-auth"); window.scrollTo(0, 0);   // the sign in page may have scrolled (keyboard / zoom on phones)
  $("auth").hidden = true; $("app").hidden = false;
  $("who").textContent = session.name + (isAdmin() ? " (admin)" : "");
  $("adminLink").hidden = !isAdmin(); $("historyLink").hidden = !isAdmin(); $("loansLink").hidden = isAdmin();   // the admin manages, members borrow
  refreshCategories(); renderAll(); show("dashboard");
  LibraryTheme.init(session.username);
  openDeepLink();
}
function refreshCategories() {
  const cats = [...new Set(db.books.map(b => b.category))].sort();
  $("category").innerHTML = '<option value="all">All categories</option>' + cats.map(c => `<option>${esc(c)}</option>`).join("");
}
let currentView = "dashboard";
function renderAll() { renderDashboard(); renderBooks(); renderLoans(); if (isAdmin()) renderAdmin(); updateBadge(); }

function show(view) {
  currentView = view;
  document.querySelectorAll(".view").forEach(v => v.hidden = v.id !== "v-" + view);
  document.querySelectorAll("#nav a").forEach(a => a.classList.toggle("active", a.dataset.view === view));
  $("pageTitle").textContent = TITLES[view]; closeMenu();
}

function renderDashboard() {
  const now = Date.now(), stat = (n, t) => `<div class="stat"><b>${n}</b><span class="muted">${t}</span></div>`;
  const books = stat(db.books.length, "Book titles") + stat(db.books.reduce((n, b) => n + available(b), 0), "Copies available");
  $("hello").textContent = "Hello, " + session.name;
  if (isAdmin()) {
    $("stats").innerHTML = books + stat(pending().length, "Pending requests") + stat(returning().length, "Return requests") + stat(borrowed().length + returning().length, "Borrowed now") + stat(borrowed().filter(isLate).length, "Overdue");
    $("dueTitle").textContent = "Needs attention";
    const items = pending().map(l => `<div class="note warn"><span><b>${esc(nameOf(l.username))}</b> wants to borrow ${esc(bookOf(l).title)}</span></div>`)
      .concat(returning().map(l => `<div class="note warn"><span><b>${esc(nameOf(l.username))}</b> wants to return ${esc(bookOf(l).title)}</span></div>`))
      .concat(borrowed().filter(isLate).map(l => `<div class="note bad"><span>${esc(bookOf(l).title)} (${esc(nameOf(l.username))}) is overdue since ${fmt(l.due)}</span></div>`));
    $("dueSoon").innerHTML = items.join("") || '<p class="muted">Nothing needs your attention.</p>';
    return;
  }
  const my = mine(), act = my.filter(l => l.status === "borrowed");
  $("stats").innerHTML = books + stat(act.length, "Your active loans") + stat(my.filter(l => l.status === "pending").length, "Pending requests") + stat(act.filter(isLate).length, "Overdue");
  $("dueTitle").textContent = "Due soon";
  const soon = act.filter(l => l.due >= now && l.due - now <= SOON * DAY);
  $("dueSoon").innerHTML = soon.length ? soon.map(l => `<div class="note warn">${esc(bookOf(l).title)} <span class="muted">due ${fmt(l.due)}</span></div>`).join("") : '<p class="muted">Nothing due soon.</p>';
}

let openBookId = null;
const isLocked = b => LIBRARY_LOCK.enabled && available(b) < 1;

function renderBooks() {
  const q = $("search").value.toLowerCase(), cat = $("category").value;
  const list = db.books.filter(b => (cat === "all" || b.category === cat) && (b.title + " " + b.author).toLowerCase().includes(q));
  $("books").innerHTML = list.map(b => {
    const left = available(b);
    const mineNow = isAdmin() ? null : db.loans.find(l => l.bookId === b.id && l.username === session.username && holds(l));
    const btn = isAdmin() ? "" : `<button class="btn" data-borrow="${b.id}" ${left && !mineNow ? "" : "disabled"}>${
      mineNow ? (mineNow.status === "pending" ? "Request pending" : "Already borrowed") : left ? "Request to borrow" : "Unavailable"}</button>`;
    const locked = isLocked(b);
    return `<article class="book${locked ? " locked" : ""}" data-open="${b.id}" tabindex="0" style="${coverStyle(b.title, b.color)}"><h3>${esc(b.title)}</h3><span class="muted">${esc(b.author)}</span>
      <span class="tags"><span class="badge">${esc(b.category)}</span><span class="badge ${left ? "ok" : "bad"}">${left} / ${b.copies} available</span></span>${btn}${isAdmin() ? `<button class="btn edit-btn" data-edit="${b.id}" aria-label="Edit ${esc(b.title)}">✎ Edit</button>` : ""}${locked ? `<div class="lockwrap"><span class="biglock" aria-hidden="true">${esc(LIBRARY_LOCK.icon)}</span><span class="locktext">${esc(LIBRARY_LOCK.label)}</span></div>` : ""}</article>`;
  }).join("") + (list.length ? "" : '<p class="muted none">No books found.</p>')
    + (isAdmin() ? '<article class="book add-book" data-add tabindex="0" role="button" aria-label="Add a book">+<span>Add a book</span></article>' : "");
  if (openBookId != null) { const t = document.querySelector(`.book[data-open="${openBookId}"]`); if (t) t.classList.add("away"); }   // keep the open book's shelf copy hidden
}

/* Member: their own requests and loans (read only, except cancelling a pending request). */
function renderLoans() {
  const list = mine().filter(onShelf).reverse();
  $("myLoans").innerHTML = list.length ? `<div class="shelf">${list.map(l => {
    const b = bookOf(l);
    return `<article class="mybook" data-loan="${l.id}" tabindex="0" style="${coverStyle(b.title, b.color)}"><h3>${esc(b.title)}</h3>${b.author ? `<p>${esc(b.author)}</p>` : ""}</article>`;
  }).join("")}</div>` : '<p class="muted">Nothing here yet.</p>';
  if (openLoanId != null) { fillLoan(); const t = document.querySelector(`.mybook[data-loan="${openLoanId}"]`); if (t) t.classList.add("away"); }   // keep an open popup up to date
}

/* Admin: accept or reject requests, mark books returned, see the history. */
function renderAdmin() {
  const n = pending().length, r = returning().length;
  $("reqTitle").textContent = "Borrow requests" + (n ? ` (${n})` : "");
  $("retTitle").textContent = "Return requests" + (r ? ` (${r})` : "");
  $("requests").innerHTML = table(["Book", "Member", "Requested", ""], pending().reverse().map(l =>
    [esc(bookOf(l).title), esc(nameOf(l.username)), fmt(l.requestedAt),
     `<button class="btn" data-accept="${l.id}" ${(b => b && available(b) > 0)(db.books.find(x => x.id === l.bookId)) ? "" : 'disabled title="No copies left"'}>Accept</button> <button class="btn ghost" data-reject="${l.id}">Reject</button>`]), 10);
  /* a member pressed "Return book" in My Loans: the librarian accepts it once the book is really handed back, or declines it if it never arrived */
  $("returns").innerHTML = table(["Book", "Member", "Asked", ""], returning().reverse().map(l =>
    [esc(bookOf(l).title), esc(nameOf(l.username)), fmt(l.returnRequestedAt),
     `<button class="btn" data-return="${l.id}">Accept</button> <button class="btn ghost" data-return-decline="${l.id}">Decline</button>`]), 10);
  $("activeLoans").innerHTML = table(["Book", "Member", "Borrowed", "Due", "Status"], borrowed().reverse().map(l =>
    [esc(bookOf(l).title), esc(nameOf(l.username)), fmt(l.borrowedAt), fmt(l.due), badge(l)]), 10);
  $("history").innerHTML = table(["Book", "Member", "Requested", "Result", "Date"], db.loans.filter(l => l.status === "returned" || l.status === "rejected").reverse().map(l =>
    [esc(bookOf(l).title), esc(nameOf(l.username)), fmt(l.requestedAt), badge(l), fmt(l.returnedAt || l.decidedAt)]));
}

/* ---------- book front page: just the title and author on a colored cover ---------- */
/* A book's cover color: the librarian can pick one (book.color, a #hex); with none it is made from the title, so the same title always gets the same color.
   The picked color is the light end of the gradient, c2 is a darker shade next to it. */
function titleHue(title) { let h = 0; for (const ch of title || "") h = (h * 31 + ch.charCodeAt(0)) % 360; return h; }
function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let h = 0, s = 0;
  if (d) { s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = (mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60; }
  return [h, s * 100, l * 100];
}
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return "#" + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
}
const autoColor = title => hslToHex(titleHue(title), 60, 42);
function coverStyle(title, color) {
  if (/^#[0-9a-f]{6}$/i.test(color || "")) {
    const [h, s, l] = hexToHsl(color), l1 = Math.min(l, 46);               // keep it dark enough for the white title
    return `--c1:hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l1)}%);--c2:hsl(${Math.round((h + 40) % 360)} ${Math.round(s * .9)}% ${Math.round(l1 * .52)}%)`;
  }
  const h = titleHue(title);
  return `--c1:hsl(${h} 60% 42%);--c2:hsl(${(h + 40) % 360} 55% 22%)`;
}
const calmMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
/* While a popup is open the page behind it cannot scroll. */
function syncLock() { document.documentElement.classList.toggle("modal-open", !$("coverWrap").hidden || !$("loanWrap").hidden || !$("editWrap").hidden); }

/* ---------- the flying + opening book (used by Books and by My Loans) ----------
   Click a book: it flies from where it is to the center and gets bigger, then the cover swings open.
   Close: the cover swings shut, then the book flies back. The swinging cover itself is in library.css (.lc).
   exact = true when the clicked thing is book shaped (My Loans), false for a wide card (Books): then the book grows out of the card. */
function flyFrame(el, modal, exact) {
  const a = el.getBoundingClientRect(), z = modal.getBoundingClientRect();    // a = where it is now, z = where the big book is
  if (exact) return { transform: `translate(${a.left - z.left}px, ${a.top - z.top}px) scale(${a.width / z.width})` };
  const s = Math.min(a.width / z.width, a.height / z.height);
  return { transform: `translate(${a.left + a.width / 2 - z.left - z.width * s / 2}px, ${a.top + a.height / 2 - z.top - z.height * s / 2}px) scale(${s})`, opacity: 0 };
}
function flyIn(wrap, modal, from, exact) {
  modal.getAnimations().forEach(x => x.cancel());
  wrap.hidden = false; syncLock();
  if (from && !calmMotion()) modal.animate(exact ? [flyFrame(from, modal, true), { transform: "none" }] : [flyFrame(from, modal, false), { opacity: 1, offset: .5 }, { transform: "none", opacity: 1 }], { duration: 650, easing: "cubic-bezier(.2,.8,.2,1)" });
}
let closing = false;
function flyOut(p, to, exact) {                                            // p = { wrap, modal, cover (optional), x, finish }
  if (p.wrap.hidden || closing) return;
  const done = () => {
    [p.wrap, p.modal, p.cover, p.x].forEach(e => e && e.getAnimations().forEach(x => x.cancel()));
    p.wrap.hidden = true; closing = false; syncLock(); p.finish();
  };
  if (calmMotion()) return done();
  closing = true;
  p.x.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, fill: "forwards" });
  const back = () => {
    if (!to) return void (p.wrap.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" }).onfinish = done);   // nothing to fly back to: just fade
    const end = flyFrame(to, p.modal, exact);
    p.wrap.animate([{ backgroundColor: "rgb(0 0 0 / .6)" }, { backgroundColor: "rgb(0 0 0 / 0)" }], { duration: 550, fill: "forwards" });
    p.modal.animate([{ transform: "none", opacity: 1 }, end], { duration: 550, easing: "cubic-bezier(.5,0,.2,1)", fill: "forwards" }).onfinish = done;
  };
  if (p.cover) p.cover.animate([{ transform: "rotateY(-168deg)" }, { transform: "rotateY(0deg)" }], { duration: 750, easing: "cubic-bezier(.45,0,.25,1)", fill: "forwards" }).onfinish = back;   // My Loans: the cover swings shut first
  else back();                                                                                                                                                                                  // Books: it only zooms back
}


/* ---------- QR code of a book ----------
   Each book has a link: this page + ?book=<id>. Its QR is shown in the book popup and printed for the shelf. A student who scans it lands on
   this page, signs in if needed, and the book opens straight away. The link only works where the same book list is available: with the demo
   (data in each browser) that is the librarian's own browser; connect a real backend so every phone sees the same books. */
const bookLink = id => location.href.split(/[?#]/)[0] + "?book=" + encodeURIComponent(id);
function qrSvg(text) {
  let q = null;
  for (let type = 3; type <= 12 && !q; type++) {                       // smallest QR size that fits the link
    try { const t = new QRCode(type, QRErrorCorrectLevel.M); t.addData(text); t.make(); q = t; } catch {}
  }
  if (!q) return "";
  const n = q.getModuleCount(), pad = 4;                              // 4 empty modules around it, as the QR standard asks
  let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + pad} ${r + pad}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + pad * 2} ${n + pad * 2}" role="img" aria-label="QR code of this book" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
let deepBook = new URLSearchParams(location.search).get("book");        // set when the page was opened from a book's QR code
if (deepBook != null) $("deepHint").hidden = false;
function openDeepLink() {                                              // called once the user is signed in
  if (deepBook == null) return;
  const id = deepBook; deepBook = null;
  try { history.replaceState(null, "", location.href.split(/[?#]/)[0]); } catch {}   // so a refresh does not open it again
  const b = db.books.find(x => x.id == id);
  if (!b) return toast("That book is not in this library list.", "bad");
  show("books");
  setTimeout(() => openCover(b.id), 200);                              // let the shelf lay out first, so the book flies out of its card
}
function printShelfQr(id) {                                            // librarian: print the label with the same QR
  const b = db.books.find(x => x.id == id); if (!b) return;
  $("plTitle").textContent = b.title; $("plAuthor").textContent = b.author; $("plQr").innerHTML = qrSvg(bookLink(b.id));
  window.print();
}

/* ---------- Books: click a book card ---------- */
function openCover(id) {
  if (closing) return;
  const b = db.books.find(x => x.id == id); if (!b) return;
  const locked = isLocked(b); if (locked && !LIBRARY_LOCK.canOpen) return;
  openBookId = id;
  $("bookModal").style.cssText = coverStyle(b.title, b.color); $("bcTitle").textContent = b.title; $("bcAuthor").textContent = b.author;
  $("bcDesc").textContent = b.description || ""; $("bcDesc").hidden = !b.description;
  $("bcQrBox").innerHTML = qrSvg(bookLink(b.id)); $("bcQrPrint").hidden = !isAdmin();
  $("coverLockIcon").textContent = LIBRARY_LOCK.icon; $("coverLockText").textContent = LIBRARY_LOCK.label; $("coverLock").hidden = !locked;
  const tile = document.querySelector(`.book[data-open="${id}"]`);
  flyIn($("coverWrap"), $("bookModal"), tile, true);
  if (tile) tile.classList.add("away");
  $("coverClose").focus();
}
function closeCover() {
  const id = openBookId; openBookId = null;
  flyOut({ wrap: $("coverWrap"), modal: $("bookModal"), x: $("coverClose"), finish() { document.querySelectorAll(".book.away").forEach(t => t.classList.remove("away")); } }, id != null && document.querySelector(`.book[data-open="${id}"]`), true);
}

/* ---------- My Loans: only the books are listed; click one to see its details ---------- */
let openLoanId = null;
function fillLoan() {
  const l = db.loans.find(x => x.id == openLoanId && x.username === session.username);
  if (!l || !onShelf(l)) return closeLoan();                                         // cancelled or removed
  $("loanCover").style.cssText = coverStyle(bookOf(l).title, bookOf(l).color); $("lcTitle").textContent = bookOf(l).title; $("lcAuthor").textContent = bookOf(l).author || "";
  const cell = (k, v) => `<div class="loan-cell"><small>${k}</small><b>${v}</b></div>`;
  $("loanGrid").innerHTML = cell("Book", esc(bookOf(l).title)) + cell("Requested", fmt(l.requestedAt)) + cell("Due", dash(l.due)) + cell("Status", badge(l));
  $("loanFoot").innerHTML = l.status === "pending" ? `<button class="btn" data-cancel="${l.id}">Cancel reservation</button>`
    : l.status === "borrowed" ? (l.returnDeclinedAt ? '<div class="note bad"><span>The librarian did not receive this book yet. Hand it in at the library, then press Return book again.</span></div>' : "")
        + `<button class="btn" data-return-request="${l.id}">Return book</button>` : "";
}
function openLoan(id) {
  if (closing) return;
  openLoanId = id; fillLoan(); if (openLoanId == null) return;
  const tile = document.querySelector(`.mybook[data-loan="${id}"]`);
  flyIn($("loanWrap"), $("loanModal"), tile, true);
  if (tile) tile.classList.add("away");                                // the shelf copy hides while its twin flies
  $("loanClose").focus();
}
function closeLoan() {
  const id = openLoanId; openLoanId = null;
  flyOut({ wrap: $("loanWrap"), modal: $("loanModal"), cover: $("loanCover"), x: $("loanClose"), finish() { document.querySelectorAll(".mybook.away").forEach(t => t.classList.remove("away")); } },
    id != null && document.querySelector(`.mybook[data-loan="${id}"]`), true);
}
$("loanClose").onclick = closeLoan;
$("loanWrap").onclick = e => { if (e.target === $("loanWrap")) closeLoan(); };
$("myLoans").onclick = e => { const c = e.target.closest("[data-loan]"); if (c) openLoan(c.dataset.loan); };
$("myLoans").onkeydown = e => { const c = e.target.closest("[data-loan]"); if (c && e.target === c && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openLoan(c.dataset.loan); } };
$("bcQrPrint").onclick = () => printShelfQr(openBookId);
$("coverClose").onclick = closeCover;
$("coverWrap").onclick = e => { if (e.target === $("coverWrap")) closeCover(); };
$("books").onclick = e => {
  const ed = e.target.closest("[data-edit]"); if (ed) return openEdit(ed.dataset.edit);
  if (e.target.closest("[data-add]")) return openEdit(null);
  const c = e.target.closest("[data-open]"); if (c && !e.target.closest("button")) openCover(c.dataset.open);
};
$("books").onkeydown = e => {
  const c = e.target.closest("[data-open],[data-add]"); if (!c || e.target !== c || (e.key !== "Enter" && e.key !== " ")) return;
  e.preventDefault(); c.hasAttribute("data-add") ? openEdit(null) : openCover(c.dataset.open);
};


/* ---------- librarian: add a book / edit a book (one modal for both) ---------- */
let editId = null, autoCol = true;                                   // editId = null means "adding"; autoCol = the cover color comes from the title
function paintEdit() {
  const t = $("eTitle").value.trim();
  if (autoCol) $("eColor").value = autoColor(t);
  $("editHead").style.cssText = coverStyle(t, autoCol ? null : $("eColor").value);
  $("ehTitle").textContent = t || "Book name"; $("ehAuthor").textContent = $("eAuthor").value.trim() || "Author";
  $("eColorHint").textContent = autoCol ? "(automatic)" : "(custom)";
}
function openEdit(id) {
  if (!isAdmin() || closing) return;
  const b = id == null ? null : db.books.find(x => x.id == id); if (id != null && !b) return;
  editId = b ? b.id : null;
  $("editTitle").textContent = b ? "Edit book" : "Add a book";
  $("eTitle").value = b ? b.title : ""; $("eAuthor").value = b ? b.author : ""; $("eCategory").value = b ? b.category : "";
  $("eCopies").value = b ? b.copies : 1; $("eDesc").value = b ? b.description || "" : "";
  autoCol = !(b && b.color); if (!autoCol) $("eColor").value = b.color;
  $("catList").innerHTML = [...new Set(db.books.map(x => x.category))].sort().map(c => `<option value="${esc(c)}"></option>`).join("");
  $("editError").textContent = ""; paintEdit();
  $("editWrap").hidden = false; syncLock(); $("eTitle").focus();
}
function closeEdit() { if ($("editWrap").hidden) return; $("editWrap").hidden = true; editId = null; syncLock(); }
["eTitle", "eAuthor"].forEach(id => $(id).oninput = paintEdit);
$("eColor").oninput = () => { autoCol = false; paintEdit(); };
$("eAuto").onclick = () => { autoCol = true; paintEdit(); };
$("editClose").onclick = $("editCancel").onclick = closeEdit;
$("editForm").onsubmit = e => {
  e.preventDefault();
  if (!isAdmin()) return;
  db = load();
  const err = m => $("editError").textContent = m;
  const title = $("eTitle").value.trim(), author = $("eAuthor").value.trim(), category = $("eCategory").value.trim(), description = $("eDesc").value.trim();
  const copies = Number($("eCopies").value), color = autoCol ? "" : $("eColor").value, adding = editId == null;
  if (!title || !author || !category) return err("Please fill in the book name, author and category.");
  if (!Number.isInteger(copies) || copies < 1) return err("Quantity must be a whole number, 1 or more.");
  if (adding) db.books.push({ id: Date.now(), title, author, category, copies, description, color });
  else {
    const b = db.books.find(x => x.id === editId); if (!b) return err("This book no longer exists.");
    const used = db.loans.filter(l => l.bookId === b.id && isOut(l)).length;
    if (copies < used) return err(`${used} cop${used > 1 ? "ies are" : "y is"} out with members, so the quantity cannot be lower than ${used}.`);
    Object.assign(b, { title, author, category, copies, description, color });
  }
  save(); closeEdit(); refreshCategories(); renderAll(); toast(adding ? "Book added." : "Book updated.", "ok");
};

/* ---------- burger menu ---------- */
function openMenu() { $("side").classList.add("open"); $("side").setAttribute("aria-hidden", "false"); $("backdrop").hidden = false; $("menuBtn").setAttribute("aria-expanded", "true"); document.documentElement.classList.add("menu-open"); }
function closeMenu() { $("side").classList.remove("open"); $("side").setAttribute("aria-hidden", "true"); $("backdrop").hidden = true; $("menuBtn").setAttribute("aria-expanded", "false"); document.documentElement.classList.remove("menu-open"); }
$("menuBtn").onclick = openMenu; $("menuClose").onclick = closeMenu; $("backdrop").onclick = closeMenu;
document.addEventListener("keydown", e => { if (e.key === "Escape") { closeMenu(); closeCover(); closeLoan(); closeEdit(); } });
$("nav").onclick = e => { const a = e.target.closest("[data-view]"); if (a) { e.preventDefault(); show(a.dataset.view); } };

/* ---------- actions ---------- */
document.addEventListener("click", e => {
  const t = s => e.target.closest(s), now = Date.now();
  if (!session) return;
  db = load();                                                       // always work on the latest shared data
  const find = id => db.loans.find(x => x.id == id), title = l => esc(bookOf(l).title);
  let el, l, msg;
  if ((el = t("[data-borrow]")) && !isAdmin()) {                     // member asks to borrow: it waits for the admin
    const b = db.books.find(x => x.id == el.dataset.borrow);
    const has = b && db.loans.some(x => x.bookId === b.id && x.username === session.username && holds(x));
    if (!b || has || available(b) < 1) return;
    l = { id: now + Math.random(), bookId: b.id, username: session.username, status: "pending", requestedAt: now, borrowedAt: null, due: null, decidedAt: null, returnedAt: null };
    db.loans.push(l);
    msg = "Request sent. Waiting for the librarian.";
  } else if ((el = t("[data-cancel]"))) {                             // member cancels their own pending request
    l = find(el.dataset.cancel);
    if (!l || l.status !== "pending" || l.username !== session.username) return;
    db.loans = db.loans.filter(x => x !== l);
    msg = "Request cancelled.";
  } else if (isAdmin() && (el = t("[data-accept]"))) {
    l = find(el.dataset.accept); if (!l || l.status !== "pending") return;
    const bk = db.books.find(x => x.id === l.bookId);
    if (!bk || available(bk) < 1) { toast("No copies left to lend. Wait for a return first.", "bad"); return; }   // other requests may have taken the last copy
    Object.assign(l, { status: "borrowed", decidedAt: now, borrowedAt: now, due: now + LOAN_DAYS * DAY });
    msg = "Request accepted.";
  } else if (isAdmin() && (el = t("[data-reject]"))) {
    l = find(el.dataset.reject); if (!l || l.status !== "pending") return;
    Object.assign(l, { status: "rejected", decidedAt: now });
    msg = "Request rejected.";
  } else if (!isAdmin() && (el = t("[data-return-request]"))) {       // member says they are returning the book: it waits for the librarian
    l = find(el.dataset.returnRequest);
    if (!l || l.status !== "borrowed" || l.username !== session.username) return;
    Object.assign(l, { status: "returning", returnRequestedAt: now, returnDeclinedAt: null });
    msg = "Return request sent. Hand the book to the librarian.";
  } else if (isAdmin() && (el = t("[data-return-decline]"))) {        // the book never reached the library: the member still has it
    l = find(el.dataset.returnDecline); if (!l || l.status !== "returning") return;
    Object.assign(l, { status: "borrowed", returnRequestedAt: null, returnDeclinedAt: now });
    msg = "Return declined. The loan is back to Borrowed.";
  } else if (isAdmin() && (el = t("[data-return]"))) {                // librarian accepts the return
    l = find(el.dataset.return); if (!l || l.status !== "returning") return;
    Object.assign(l, { status: "returned", returnedAt: now });
    msg = "Return accepted.";
  } else return;
  save(); renderAll(); toast(msg, "ok");
});
$("search").oninput = renderBooks; $("category").onchange = renderBooks;

/* Another tab changed the shared data: refresh this tab (its own signed-in account stays as it is). */
window.addEventListener("storage", e => { if (e.key === KEY && session) { db = load(); renderAll(); } });
setInterval(() => { if (session) { db = load(); renderAll(); } }, 60000);   // keeps Due / Overdue fresh
if (session) start(); else document.body.classList.add("in-auth");
