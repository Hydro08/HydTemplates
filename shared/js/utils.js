function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function debounce(fn, wait = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

const BACKEND_LABELS = {
  "none": "Frontend only",
  "php-sqlite": "PHP + SQLite",
  "php-mysql": "PHP + MySQL",
  "node-express": "Node + Express",
  "flask": "Python Flask"
};
