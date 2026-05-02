// CRM Analytics Showcase — client-side app.
// Loads docs/data.json, renders Plotly charts and a paginated/filterable customer table.

const TIER_ORDER  = ["Diamond", "Platinum", "Gold", "Silver", "Bronze", "Passive"];
const EVENT_ORDER = ["New", "Reactivated", "Lost"];

const TIER_COLORS = {
  Diamond:  "#67E8F9",
  Platinum: "#94A3B8",
  Gold:     "#FBBF24",
  Silver:   "#CBD5E1",
  Bronze:   "#D97706",
  Passive:  "#6B7280",
};
const EVENT_COLORS    = { New: "#22C55E", Lost: "#EF4444", Reactivated: "#3B82F6" };
const ACTIVITY_COLORS = { Active: "#10B981", "Not Active": "#6B7280" };

const DARK_LAYOUT = {
  template:      "plotly_dark",
  paper_bgcolor: "#1E293B",
  plot_bgcolor:  "#1E293B",
  font:          { color: "#E2E8F0", family: "Inter, system-ui, sans-serif", size: 12 },
  margin:        { l: 50, r: 20, t: 10, b: 50 },
};

const PAGE_SIZE = 50;

// State held in this object; mutated by event handlers.
const state = {
  data: null,
  month: null,
  filters: { activity: new Set(["Active"]), tier: new Set(), event: new Set(), group: new Set() },
  page: 0,
};

// ==================================================================== boot
async function init() {
  try {
    const resp = await fetch("data.json");
    state.data = await resp.json();
  } catch (e) {
    document.body.innerHTML = `<pre style="color:#fff;padding:32px">Failed to load data.json: ${e}\n\nRun: python scripts/build_report.py</pre>`;
    return;
  }
  state.month = state.data.latest_month;
  buildMonthSelect();
  buildFilters();
  bindTabs();
  bindPager();
  bindCsvDownload();
  render();
}

document.addEventListener("DOMContentLoaded", init);

// ==================================================================== controls
function buildMonthSelect() {
  const sel = document.getElementById("month-select");
  // Reverse so newest month is at the top.
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
    state.filters.activity = new Set(["Active"]);
    state.filters.tier  = new Set();
    state.filters.event = new Set();
    state.filters.group = new Set();
    state.page = 0;
    document.querySelectorAll(".chip-set").forEach(set => {
      set.querySelectorAll(".chip").forEach(chip => {
        const which = set.id.replace("filter-", "");
        chip.classList.toggle("on", state.filters[which].has(chip.dataset.value));
      });
    });
    renderSegments();
  });
}

function buildChips(containerId, values, currentSet) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  const which = containerId.replace("filter-", "");
  values.forEach(v => {
    const chip = document.createElement("button");
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

function bindTabs() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
      // Plotly needs a redraw when made visible from display:none.
      window.dispatchEvent(new Event("resize"));
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
    rows.forEach(r => {
      lines.push(cols.map(c => csvCell(r[c])).join(","));
    });
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

  // Tier donut
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

  // Events bar
  const evtData = EVENT_ORDER.map(e => ({ event: e, n: agg.events[e] || 0 }));
  Plotly.newPlot("chart-events-bar", [{
    type: "bar",
    x: evtData.map(x => x.event),
    y: evtData.map(x => x.n),
    marker: { color: evtData.map(x => EVENT_COLORS[x.event]) },
    text: evtData.map(x => x.n.toLocaleString()),
    textposition: "outside",
  }], { ...DARK_LAYOUT, yaxis: { title: "customers" }, showlegend: false },
     { responsive: true, displayModeBar: false });

  // KPI table
  const tbody = document.querySelector("#kpi-table tbody");
  tbody.innerHTML = "";
  TIER_ORDER.forEach(t => {
    const k = agg.kpi_by_tier[t];
    if (!k) return;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="tier-pill" data-tier="${t}">${t}</span></td>
      <td class="num">${k.n.toLocaleString()}</td>
      <td class="num">${k.amc !== null ? k.amc.toFixed(1) : "—"}</td>
      <td class="num">${k.aos !== null ? k.aos.toFixed(1) : "—"}</td>
      <td class="num">${k.o6  !== null ? k.o6.toFixed(1)  : "—"}</td>
      <td class="num">${k.tenure !== null ? k.tenure.toFixed(1) : "—"}</td>
    `;
    tbody.appendChild(tr);
  });
}

// -------------------------------------------------------------------- Segments
function filteredCustomers() {
  const f = state.filters;
  return state.data.customers.filter(c => {
    if (f.activity.size && !f.activity.has(c.activity))                return false;
    if (f.tier.size     && (c.tier === null || !f.tier.has(c.tier)))   return false;
    if (f.event.size    && (c.event === null || !f.event.has(c.event))) return false;
    if (f.group.size    && !f.group.has(c.group))                      return false;
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
      <td class="num">${c.customer_id}</td>
      <td>${escapeHtml(c.name)}</td>
      <td>${escapeHtml(c.group || "")}</td>
      <td>${escapeHtml(c.city || "")}</td>
      <td>${c.activity}</td>
      <td>${c.tier ? `<span class="tier-pill" data-tier="${c.tier}">${c.tier}</span>` : "—"}</td>
      <td>${c.event ? `<span class="event-pill" data-event="${c.event}">${c.event}</span>` : ""}</td>
      <td class="num">${c.tenure_months !== null ? c.tenure_months : "—"}</td>
      <td class="num">${c.amc !== null ? c.amc.toFixed(1) : "—"}</td>
      <td class="num">${c.aos !== null ? c.aos.toFixed(1) : "—"}</td>
      <td class="num">${c.o6}</td>
      <td>${c.first_purchase || "—"}</td>
      <td>${c.last_purchase  || "—"}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById("page-info").textContent =
    `Page ${state.page + 1} of ${totalPages} (${rows.length.toLocaleString()} rows)`;
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

  // Stacked tier mix
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
    yaxis:   { title: "active customers" },
    legend:  { orientation: "h", y: -0.18 },
  }, { responsive: true, displayModeBar: false });

  // Activity area
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
    yaxis:  { title: "customers" },
    legend: { orientation: "h", y: -0.22 },
  }, { responsive: true, displayModeBar: false });

  // Events line
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
    yaxis:  { title: "customers" },
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
    marker: { color: "#67E8F9" },
    text: brand.map(b => b.units.toLocaleString()),
    textposition: "outside",
  }], { ...DARK_LAYOUT, yaxis: { title: "units" }, showlegend: false },
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
