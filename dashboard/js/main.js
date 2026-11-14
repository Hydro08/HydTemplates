const grid = document.getElementById("templateGrid");
const countEl = document.getElementById("count");
const searchEl = document.getElementById("search");
const typeEl = document.getElementById("typeFilter");
const backendEl = document.getElementById("backendFilter");
const dialog = document.getElementById("backendDialog");
const optionsEl = document.getElementById("backendOptions");
const dialogName = document.getElementById("dialogTemplateName");
const dialogMsg = document.getElementById("dialogMessage");

let templates = [];

async function loadTemplates() {
  try {
    const res = await fetch("templates.json");
    if (!res.ok) throw new Error("HTTP " + res.status);
    templates = await res.json();
  } catch (err) {
    grid.innerHTML = `<p class="empty">Could not load templates.json. Make sure you open this page through a local server (XAMPP or Live Server), not file://.</p>`;
    return;
  }
  fillFilterOptions(templates, typeEl, backendEl);
  render();
}

function cardHtml(t) {
  const ready = t.status === "ready";
  const initials = escapeHtml(t.name.split(" ").map(w => w[0]).join("").slice(0, 2));
  return `
    <article class="card">
      <div class="thumb">
        <img src="${escapeHtml(t.thumbnail)}" alt="" loading="lazy"
             onerror="this.remove()">
        <span>${initials}</span>
      </div>
      <div class="body">
        <h3>${escapeHtml(t.name)}</h3>
        <p class="muted">${escapeHtml(t.description)}</p>
        <div class="meta">
          <span class="badge">${escapeHtml(t.type)}</span>
          <span class="badge ${ready ? "ready" : "progress"}">${ready ? "Ready" : "In progress"}</span>
        </div>
        <div class="actions">
          <a class="btn" href="${escapeHtml(t.path)}" target="_blank" rel="noopener"
             ${ready ? "" : 'aria-disabled="true" tabindex="-1"'}>Open</a>
          <button type="button" class="btn ghost" data-download="${escapeHtml(t.id)}"
                  ${ready ? "" : "disabled"}>Download</button>
        </div>
      </div>
    </article>`;
}

function render() {
  const result = applyFilters(templates, {
    query: searchEl.value,
    type: typeEl.value,
    backend: backendEl.value
  });
  countEl.textContent = `${result.length} template${result.length === 1 ? "" : "s"}`;
  grid.innerHTML = result.length
    ? result.map(cardHtml).join("")
    : `<p class="empty">No results. Try a different search or filter.</p>`;
}

/* Download: choose a backend first, then fetch the pre-made zip */
function openBackendPicker(t) {
  dialogName.textContent = t.name;
  dialogMsg.textContent = "";
  optionsEl.innerHTML = t.backends.map(b =>
    `<button type="button" class="btn ghost" data-backend="${escapeHtml(b)}">${escapeHtml(BACKEND_LABELS[b] || b)}</button>`
  ).join("");
  optionsEl.dataset.template = t.id;
  dialog.showModal();
}

async function downloadZip(templateId, backend) {
  const file = `downloads/${templateId}-${backend}.zip`;
  dialogMsg.textContent = "Checking the file…";
  try {
    const head = await fetch(file, { method: "HEAD" });
    if (!head.ok) throw new Error("missing");
  } catch {
    dialogMsg.textContent = `${file} does not exist yet. Zip the folder first and put it in downloads/.`;
    return;
  }
  const a = document.createElement("a");
  a.href = file;
  a.download = "";
  a.click();
  dialog.close();
}

grid.addEventListener("click", e => {
  const btn = e.target.closest("[data-download]");
  if (!btn) return;
  const t = templates.find(x => x.id === btn.dataset.download);
  if (t) openBackendPicker(t);
});

optionsEl.addEventListener("click", e => {
  const btn = e.target.closest("[data-backend]");
  if (btn) downloadZip(optionsEl.dataset.template, btn.dataset.backend);
});

document.getElementById("cancelBtn").addEventListener("click", () => dialog.close());
searchEl.addEventListener("input", debounce(render, 150));
typeEl.addEventListener("change", render);
backendEl.addEventListener("change", render);

loadTemplates();
