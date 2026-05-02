// CRM Analytics dashboard — client-side app.
// Loads docs/data.json, renders Plotly charts and a paginated/filterable customer table.

const TIER_ORDER  = ["Diamond", "Platinum", "Gold", "Silver", "Bronze", "Passive"];
const EVENT_ORDER = ["New", "Reactivated", "Lost"];

const TIER_COLORS = {
  Diamond:  "#22D3EE",
  Platinum: "#94A3B8",
  Gold:     "#F59E0B",
  Silver:   "#CBD5E1",
  Bronze:   "#B45309",
  Passive:  "#64748B",
};
const EVENT_COLORS    = { New: "#22C55E", Lost: "#EF4444", Reactivated: "#3B82F6" };
const ACTIVITY_COLORS = { Active: "#10B981", "Not Active": "#64748B" };

// Plotly layout that matches the Bootstrap dark theme used by the page.
const DARK_LAYOUT = {
  paper_bgcolor: "rgba(0,0,0,0)",
  plot_bgcolor:  "rgba(0,0,0,0)",
  font:          { color: "#E2E8F0", family: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif", size: 12 },
  margin:        { l: 50, r: 20, t: 10, b: 50 },
  xaxis:         { gridcolor: "rgba(148,163,184,0.15)", zerolinecolor: "rgba(148,163,184,0.25)" },
  yaxis:         { gridcolor: "rgba(148,163,184,0.15)", zerolinecolor: "rgba(148,163,184,0.25)" },
};

const PAGE_SIZE = 50;

const state = {
  data: null,
  month: null,
  filters: { activity: new Set(["Active"]), tier: new Set(), event: new Set(), group: new Set() },
  page: 0,
};

// ==================================================================== boot
async function init() {
  try {
    const resp = await fetch("data.json", { cache: "no-cache" });
    state.data = await resp.json();
  } catch (e) {
    document.body.innerHTML =
      `<div class="container py-5">
        <div class="alert alert-danger">
          <h4 class="alert-heading">Failed to load <code>data.json</code></h4>
          <p class="mb-0">${e}</p>
          <hr>
          <p class="mb-0 small">Run <code>python scripts/build_report.py</code> in the repo root.</p>
        </div>
      </div>`;
    return;
  }
  state.month = state.data.latest_month;
  buildMonthSelect();
  buildFilters();
  bindTabResize();
  bindPager();
  bindCsvDownload();
  render();
}

document.addEventListener("DOMContentLoaded", init);

// ==================================================================== controls
function buildMonthSelect() {
  const sel = document.getElementById("month-select");
  state.data.report_months.slice().reverse().forEach(m => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    sel.appendChild(opt);
  });
  sel.value = state.month;
  sel.addEventListener("change", () => {
    state.month = sel.value;
    state.page  = 0;
    render();
  });
}

function buildFilters() {
  const groups = Array.from(new Set(state.data.customers.map(c => c.group))).sort();
  buildChips("filter-activity", ["Active", "Not Active"], state.filters.activity);
  buildChips("filter-tier",     TIER_ORDER,                state.filters.tier);
  buildChips("filter-event",    EVENT_ORDER,               state.filters.event);
  buildChips("filter-group",    groups,                    state.filters.group);

  document.getElementById("filter-reset").addEventListener("click", () => {
    state.filters.activity.clear(); state.filters.activity.add("Active");
    state.filters.tier.clear();
    state.filters.event.clear();
    state.filters.group.clear();
    state.page = 0;
    document.querySelectorAll(".chip-set").forEach(set => {
      const which = set.id.replace("filter-", "");
      set.querySelectorAll(".chip").forEach(chip => {
        chip.classList.toggle("on", state.filters[which].has(chip.dataset.value));
      });
    });
    renderSegments();
  });
}

function buildChips(containerId, values, currentSet) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  values.forEach(v => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip" + (currentSet.has(v) ? " on" : "");
    chip.textContent = v;
    chip.dataset.value = v;
    chip.addEventListener("click", () => {
      if (currentSet.has(v)) currentSet.delete(v); else currentSet.add(v);
      chip.classList.toggle("on");
      state.page = 0;
      renderSegments();
    });
    container.appendChild(chip);
  });
}

function bindTabResize() {
  // Bootstrap fires `shown.bs.tab` on the activated tab button after the
  // panel is visible. Resize any charts in the now-visible panel so Plotly
  // re-measures their containers (charts created while display:none keep
  // zero width forever otherwise).
  document.querySelectorAll('[data-bs-toggle="tab"]').forEach(btn => {
    btn.addEventListener("shown.bs.tab", () => {
      const target = document.querySelector(btn.getAttribute("data-bs-target"));
      if (!target) return;
      target.querySelectorAll(".chart").forEach(div => {
        if (div._fullLayout) Plotly.Plots.resize(div);
      });
    });
  });
}

function bindPager() {
  document.getElementById("page-prev").addEventListener("click", () => {
    if (state.page > 0) { state.page -= 1; renderSegments(); }
  });
  document.getElementById("page-next").addEventListener("click", () => {
    state.page += 1;
    renderSegments();
  });
}

function bindCsvDownload() {
  document.getElementById("csv-download").addEventListener("click", () => {
    const rows = filteredCustomers();
    const cols = ["customer_id","name","group","city","activity","tier","event",
                  "tenure_months","amc","aos","o6","first_purchase","last_purchase"];
    const lines = [cols.join(",")];
    rows.forEach(r => lines.push(cols.map(c => csvCell(r[c])).join(",")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `crm_customers_${state.month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

function csvCell(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ==================================================================== render
function render() {
  document.getElementById("month-meta").textContent =
    `${state.data.report_months.length} months loaded · ${state.data.customers.length.toLocaleString()} customers in latest month`;
  renderOverview();
  renderSegments();
  renderLifecycle();
  renderProducts();
}

function getMonthAggregate(m) {
  return state.data.monthly.find(x => x.month === m);
}

// -------------------------------------------------------------------- Overview
function renderOverview() {
  const agg = getMonthAggregate(state.month);
  if (!agg) return;

  const total  = agg.total_customers;
  const active = agg.activity.Active || 0;
  const events = (agg.events.New || 0) + (agg.events.Lost || 0) + (agg.events.Reactivated || 0);

  document.getElementById("kpi-total").textContent  = total.toLocaleString();
  document.getElementById("kpi-active").textContent = active.toLocaleString();
  document.getElementById("kpi-active-pct").textContent =
    total ? `${(active / total * 100).toFixed(1)}% of total` : "";
  document.getElementById("kpi-events").textContent = events.toLocaleString();
  document.getElementById("kpi-tenure").textContent =
    agg.avg_tenure_months !== null ? agg.avg_tenure_months.toFixed(1) : "—";

  const tierData = TIER_ORDER
    .map(t => ({ tier: t, n: agg.tier_mix[t] || 0 }))
    .filter(x => x.n > 0);
  Plotly.newPlot("chart-tier-donut", [{
    type:   "pie",
    labels: tierData.map(x => x.tier),
    values: tierData.map(x => x.n),
    hole:   0.55,
    marker: { colors: tierData.map(x => TIER_COLORS[x.tier]) },
    textinfo: "label+percent",
    sort: false,
  }], { ...DARK_LAYOUT, showlegend: false }, { responsive: true, displayModeBar: false });

  const evtData = EVENT_ORDER.map(e => ({ event: e, n: agg.events[e] || 0 }));
  Plotly.newPlot("chart-events-bar", [{
    type: "bar",
    x: evtData.map(x => x.event),
    y: evtData.map(x => x.n),
    marker: { color: evtData.map(x => EVENT_COLORS[x.event]) },
    text: evtData.map(x => x.n.toLocaleString()),
    textposition: "outside",
  }], { ...DARK_LAYOUT, yaxis: { ...DARK_LAYOUT.yaxis, title: "customers" }, showlegend: false },
     { responsive: true, displayModeBar: false });

  const tbody = document.querySelector("#kpi-table tbody");
  tbody.innerHTML = "";
  TIER_ORDER.forEach(t => {
    const k = agg.kpi_by_tier[t];
    if (!k) return;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="tier-pill" data-tier="${t}">${t}</span></td>
      <td class="text-end">${k.n.toLocaleString()}</td>
      <td class="text-end">${k.amc !== null ? k.amc.toFixed(1) : "—"}</td>
      <td class="text-end">${k.aos !== null ? k.aos.toFixed(1) : "—"}</td>
      <td class="text-end">${k.o6  !== null ? k.o6.toFixed(1)  : "—"}</td>
      <td class="text-end">${k.tenure !== null ? k.tenure.toFixed(1) : "—"}</td>
    `;
    tbody.appendChild(tr);
  });
}

// -------------------------------------------------------------------- Segments
function filteredCustomers() {
  const f = state.filters;
  return state.data.customers.filter(c => {
    if (f.activity.size && !f.activity.has(c.activity))                  return false;
    if (f.tier.size     && (c.tier === null || !f.tier.has(c.tier)))     return false;
    if (f.event.size    && (c.event === null || !f.event.has(c.event)))  return false;
    if (f.group.size    && !f.group.has(c.group))                        return false;
    return true;
  });
}

function renderSegments() {
  const rows = filteredCustomers();
  document.getElementById("filter-count").textContent = rows.length.toLocaleString();

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  if (state.page >= totalPages) state.page = totalPages - 1;
  const startIx = state.page * PAGE_SIZE;
  const slice = rows.slice(startIx, startIx + PAGE_SIZE);

  const tbody = document.querySelector("#customer-table tbody");
  tbody.innerHTML = "";
  slice.forEach(c => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="text-muted small">${c.customer_id}</td>
      <td>${escapeHtml(c.name)}</td>
      <td>${escapeHtml(c.group || "")}</td>
      <td>${escapeHtml(c.city || "")}</td>
      <td>${c.activity}</td>
      <td>${c.tier ? `<span class="tier-pill" data-tier="${c.tier}">${c.tier}</span>` : "—"}</td>
      <td>${c.event ? `<span class="event-pill" data-event="${c.event}">${c.event}</span>` : ""}</td>
      <td class="text-end">${c.tenure_months !== null ? c.tenure_months : "—"}</td>
      <td class="text-end">${c.amc !== null ? c.amc.toFixed(1) : "—"}</td>
      <td class="text-end">${c.aos !== null ? c.aos.toFixed(1) : "—"}</td>
      <td class="text-end">${c.o6}</td>
      <td class="text-muted small">${c.first_purchase || "—"}</td>
      <td class="text-muted small">${c.last_purchase  || "—"}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById("page-info").textContent =
    `Page ${state.page + 1} of ${totalPages} · ${rows.length.toLocaleString()} rows`;
  document.getElementById("page-prev").disabled = state.page === 0;
  document.getElementById("page-next").disabled = state.page >= totalPages - 1;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// -------------------------------------------------------------------- Lifecycle
function renderLifecycle() {
  const months = state.data.monthly.map(m => m.month);

  const tierTraces = TIER_ORDER.map(t => ({
    type: "bar",
    name: t,
    x: months,
    y: state.data.monthly.map(m => m.tier_mix[t] || 0),
    marker: { color: TIER_COLORS[t] },
  }));
  Plotly.newPlot("chart-tier-trend", tierTraces, {
    ...DARK_LAYOUT,
    barmode: "stack",
    yaxis: { ...DARK_LAYOUT.yaxis, title: "active customers" },
    legend: { orientation: "h", y: -0.18 },
  }, { responsive: true, displayModeBar: false });

  const activityTraces = ["Active", "Not Active"].map(s => ({
    type: "scatter",
    mode: "lines",
    name: s,
    stackgroup: "one",
    x: months,
    y: state.data.monthly.map(m => m.activity[s] || 0),
    line: { width: 0.5, color: ACTIVITY_COLORS[s] },
    fillcolor: ACTIVITY_COLORS[s],
  }));
  Plotly.newPlot("chart-activity-trend", activityTraces, {
    ...DARK_LAYOUT,
    yaxis:  { ...DARK_LAYOUT.yaxis, title: "customers" },
    legend: { orientation: "h", y: -0.22 },
  }, { responsive: true, displayModeBar: false });

  const eventTraces = EVENT_ORDER.map(e => ({
    type: "scatter",
    mode: "lines+markers",
    name: e,
    x: months,
    y: state.data.monthly.map(m => m.events[e] || 0),
    line: { color: EVENT_COLORS[e], width: 2 },
    marker: { size: 8 },
  }));
  Plotly.newPlot("chart-events-trend", eventTraces, {
    ...DARK_LAYOUT,
    yaxis:  { ...DARK_LAYOUT.yaxis, title: "customers" },
    legend: { orientation: "h", y: -0.22 },
  }, { responsive: true, displayModeBar: false });
}

// -------------------------------------------------------------------- Products
function renderProducts() {
  const brand = state.data.brand_units;
  Plotly.newPlot("chart-brand-units", [{
    type: "bar",
    x: brand.map(b => b.brand),
    y: brand.map(b => b.units),
    marker: { color: "#22D3EE" },
    text: brand.map(b => b.units.toLocaleString()),
    textposition: "outside",
  }], { ...DARK_LAYOUT, yaxis: { ...DARK_LAYOUT.yaxis, title: "units" }, showlegend: false },
     { responsive: true, displayModeBar: false });

  const cat = state.data.category_lines;
  Plotly.newPlot("chart-category-mix", [{
    type:   "pie",
    labels: cat.map(c => c.category),
    values: cat.map(c => c.n_lines),
    hole:   0.45,
    textinfo: "label+percent",
  }], { ...DARK_LAYOUT, showlegend: false },
     { responsive: true, displayModeBar: false });
}
