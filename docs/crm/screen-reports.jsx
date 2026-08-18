// ── Reports export + Audit log ──────────────────────────────────
const { useState } = React;

const REPORT_TEMPLATES = [
  { name: "Full client base", desc: "All clients with category, status, contact & consent fields", fields: "24 columns" },
  { name: "Inactive XL+ clients", desc: "Win-back list: XL, XXL & VIP with no purchase in the chosen window", fields: "12 columns" },
  { name: "Category movement summary", desc: "Transition matrix + biggest up/down moves for the period", fields: "matrix + 2 tables" },
  { name: "Boutique performance", desc: "Revenue, clients, avg order and retention per boutique", fields: "9 columns" },
  { name: "Consent & opt-in register", desc: "Per-channel opt-in status with last change date and source — for compliance", fields: "10 columns" },
  { name: "New clients cohort", desc: "First-purchase cohort with repeat-purchase behaviour", fields: "14 columns" },
];

function ReportsScreen() {
  const [sel, setSel] = useState(0);
  const [format, setFormat] = useState("CSV");
  const [range, setRange] = useState("Trailing 12 months");
  const [queued, setQueued] = useState(false);

  return (
    <div className="screen" data-screen-label="Reports">
      <header className="screen-head">
        <div>
          <h1>Reports &amp; export</h1>
          <p className="muted">Run a saved report or schedule it — exports are logged to the audit trail</p>
        </div>
      </header>

      <div className="grid-2-1">
        <section className="card">
          <div className="card-head"><h2>Report templates</h2></div>
          <div className="report-list">
            {REPORT_TEMPLATES.map((r, i) => (
              <button key={i} className={"report-row" + (sel === i ? " on" : "")} onClick={() => { setSel(i); setQueued(false); }}>
                <div className="rep-main">
                  <b>{r.name}</b>
                  <span className="muted sm">{r.desc}</span>
                </div>
                <span className="muted sm rep-fields">{r.fields}</span>
              </button>
            ))}
          </div>
        </section>

        <div className="stack">
          <section className="card">
            <div className="card-head"><h2>Export “{REPORT_TEMPLATES[sel].name}”</h2></div>
            <div className="export-form">
              <label className="form-label">Period</label>
              <select className="select wide" value={range} onChange={(e) => setRange(e.target.value)}>
                {["Trailing 12 months", "Q2 2026", "May 2026", "Year to date", "All time"].map((r) => <option key={r}>{r}</option>)}
              </select>
              <label className="form-label">Format</label>
              <div className="chip-group">
                {["CSV", "XLSX", "PDF"].map((f) => (
                  <button key={f} className={"chip" + (format === f ? " on" : "")} onClick={() => setFormat(f)}>{f}</button>
                ))}
              </div>
              <button className="btn primary wide" onClick={() => setQueued(true)}>Generate export</button>
              {queued && <p className="picked">Export queued — you'll get it by email and in the history below. <span className="muted">(prototype: no real file, no email)</span></p>}
              <button className="btn ghost wide">Schedule weekly…</button>
            </div>
          </section>

          <section className="card">
            <div className="card-head"><h2>Recent exports</h2></div>
            <div className="export-history">
              {CRM.EXPORTS.map((e, i) => (
                <div key={i} className="exp-row">
                  <span className={"fmt-tag " + e.format.toLowerCase()}>{e.format}</span>
                  <div className="exp-main">
                    <b>{e.name}</b>
                    <span className="muted sm">{e.range} · {e.by} · {e.date}</span>
                  </div>
                  <a className="link sm">{e.size} ↓</a>
                </div>
              ))}
            </div>
            <p className="seg-note">A generated history. Nothing here is a downloadable file.</p>
          </section>
        </div>
      </div>
    </div>
  );
}

// ── Audit log ───────────────────────────────────────────────────
function AuditScreen() {
  const [who, setWho] = useState("All");
  const [q, setQ] = useState("");
  const users = ["All", ...new Set(CRM.AUDIT.map((a) => a.user))];
  const rows = CRM.AUDIT.filter((a) =>
    (who === "All" || a.user === who) &&
    (!q || (a.action + a.target + a.detail).toLowerCase().includes(q.toLowerCase()))
  );
  return (
    <div className="screen" data-screen-label="Audit log">
      <header className="screen-head">
        <div>
          <h1>Audit log</h1>
          <p className="muted">Every change to data, settings, keys and consent — immutable, retained 7 years</p>
        </div>
        <input className="search" placeholder="Search actions…" value={q} onChange={(e) => setQ(e.target.value)} />
      </header>

      <div className="filter-bar">
        <div className="chip-group">
          {users.map((u) => (
            <button key={u} className={"chip" + (who === u ? " on" : "")} onClick={() => setWho(u)}>{u}</button>
          ))}
        </div>
      </div>

      <section className="card">
        <div className="audit-list">
          {rows.map((a, i) => (
            <div key={i} className="audit-row">
              <span className={"avatar" + (a.user === "System" ? " corp" : "")}>{a.user === "System" ? "⚙" : a.user.split(" ").map((w) => w[0]).join("")}</span>
              <div className="audit-main">
                <p><b>{a.user}</b> · {a.action} — <span className="audit-target">{a.target}</span></p>
                <p className="audit-detail muted">{a.detail}</p>
              </div>
              <span className="muted sm audit-ts">{a.ts}</span>
            </div>
          ))}
          {rows.length === 0 && <p className="muted" style={{ padding: "12px 4px" }}>No entries match.</p>}
        </div>
      </section>

      <p className="muted sm">Sample entries. The staff named here are invented, and no action listed ever took place.</p>
    </div>
  );
}

Object.assign(window, { ReportsScreen, AuditScreen });
