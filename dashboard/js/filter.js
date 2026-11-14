function applyFilters(list, { query = "", type = "all", backend = "all" } = {}) {
  const q = query.trim().toLowerCase();
  return list.filter(t => {
    const text = [t.name, t.type, t.description, ...(t.tags || [])].join(" ").toLowerCase();
    const matchQuery = !q || text.includes(q);
    const matchType = type === "all" || t.type === type;
    const matchBackend = backend === "all" || (t.backends || []).includes(backend);
    return matchQuery && matchType && matchBackend;
  });
}

function fillFilterOptions(list, typeSelect, backendSelect) {
  const types = [...new Set(list.map(t => t.type))].sort();
  const backends = [...new Set(list.flatMap(t => t.backends || []))].filter(b => b !== "none");

  types.forEach(type => typeSelect.add(new Option(type, type)));
  backends.forEach(b => backendSelect.add(new Option(BACKEND_LABELS[b] || b, b)));
}
