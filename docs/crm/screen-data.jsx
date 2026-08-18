// ── Data Sources: manual uploads + API ──────────────────────────
const { useState } = React;

function DataScreen({ go }) {
  const [tab, setTab] = useState("uploads");
  return (
    <div className="screen" data-screen-label="Data sources">
      <header className="screen-head">
        <div>
          <h1>Data sources</h1>
          <p className="muted">How client &amp; transaction data enters the system — manual uploads or the integration API</p>
        </div>
        <div className="chip-group">
          <button className={"chip" + (tab === "uploads" ? " on" : "")} onClick={() => setTab("uploads")}>Manual uploads</button>
          <button className={"chip" + (tab === "api" ? " on" : "")} onClick={() => setTab("api")}>API integration</button>
        </div>
      </header>
      {tab === "uploads" ? <UploadsTab /> : <ApiTab />}
    </div>
  );
}

// ── Uploads tab ─────────────────────────────────────────────────
function UploadsTab() {
  const [drag, setDrag] = useState(false);
  const [picked, setPicked] = useState(null);
  return (
    <React.Fragment>
      <div className={"dropzone" + (drag ? " drag" : "")}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); setPicked(e.dataTransfer.files[0] ? e.dataTransfer.files[0].name : null); }}>
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5M4 20h16"></path></svg>
        <p><b>Drop a CSV or XLSX here</b> or <label className="link">browse files<input type="file" hidden onChange={(e) => setPicked(e.target.files[0] ? e.target.files[0].name : null)} /></label></p>
        <p className="muted sm">Accepted: Clients, Transactions, Opt-ins, Loyalty · max 50 MB · template headers required</p>
        <p className="muted sm"><b>Nothing is uploaded.</b> This prototype reads the file name only — the file never leaves your browser.</p>
        {picked && <p className="picked">“{picked}” queued — <b>validation starts automatically</b> (prototype: no actual upload)</p>}
      </div>

      <section className="card table-card">
        <div className="card-head"><h2>Upload history</h2><a className="link sm">Download templates →</a></div>
        <table className="table">
          <thead>
            <tr><th>File</th><th>Data type</th><th className="num">Rows</th><th className="num">Imported</th><th>Status</th><th>Uploaded by</th><th>Date</th><th>Notes</th></tr>
          </thead>
          <tbody>
            {CRM.UPLOADS.map((u, i) => (
              <tr key={i}>
                <td><b className="mono">{u.file}</b></td>
                <td><span className="kind-tag">{u.kind}</span></td>
                <td className="num">{u.rows.toLocaleString()}</td>
                <td className="num">{u.ok.toLocaleString()}</td>
                <td><span className={"status-pill " + (u.status === "Processed" ? "act" : "bad")}><i></i>{u.status}</span></td>
                <td className="muted">{u.by}</td>
                <td className="muted">{u.date}</td>
                <td className="muted sm">{u.note || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </React.Fragment>
  );
}

// ── API tab ─────────────────────────────────────────────────────
const API_ENDPOINTS = [
  { m: "POST", path: "/v1/clients", desc: "Create or upsert a client (match on external_id or phone)" },
  { m: "GET", path: "/v1/clients/{id}", desc: "Fetch a client with category, status, consent and KPIs" },
  { m: "POST", path: "/v1/transactions", desc: "Push POS transactions (batch up to 500)" },
  { m: "PATCH", path: "/v1/clients/{id}/consent", desc: "Update phone / SMS / email opt-in status" },
  { m: "GET", path: "/v1/categories/movements", desc: "Category transitions for a date range" },
  { m: "GET", path: "/v1/reports/{slug}", desc: "Run a saved report, returns CSV or JSON" },
];

function ApiTab() {
  const [sel, setSel] = useState(0);
  const ep = API_ENDPOINTS[sel];
  const SAMPLES = {
    "/v1/clients": `curl -X POST https://api.alwaha.example/v1/clients \\
  -H "Authorization: Bearer ak_live_••••" \\
  -d '{
    "external_id": "POS-88412",
    "name": "Reem Al Zaabi",
    "phone": "+971 50 123 4567",
    "email": "reem@example.com",
    "home_boutique": "dxm",
    "consent": { "email": true, "sms": true, "phone": false }
  }'`,
    "/v1/clients/{id}": `curl https://api.alwaha.example/v1/clients/C1042 \\
  -H "Authorization: Bearer ak_live_••••"

// 200 OK
{
  "id": "C1042",
  "category": "XL",          // VIP · XXL · XL · L · M · S · XS · XXS
  "status": "active",        // no purchase in 180d → "inactive"
  "first_purchase": "2021-03-14",
  "last_purchase": "2026-05-28",
  "avg_order_aed": 412,
  "orders_12m": 19,
  "consent": { "email": true, "sms": true, "phone": false }
}`,
    "/v1/transactions": `curl -X POST https://api.alwaha.example/v1/transactions \\
  -H "Authorization: Bearer ak_live_••••" \\
  -d '{
    "batch": [{
      "client_id": "C1042",
      "boutique": "moe",
      "total_aed": 386.50,
      "items": 4,
      "ts": "2026-06-09T18:21:00+04:00"
    }]
  }'`,
    "/v1/clients/{id}/consent": `curl -X PATCH https://api.alwaha.example/v1/clients/C1042/consent \\
  -H "Authorization: Bearer ak_live_••••" \\
  -d '{ "sms": false, "source": "unsubscribe_link" }'

// Consent changes are written to the audit log automatically.`,
    "/v1/categories/movements": `curl "https://api.alwaha.example/v1/categories/movements?from=2026-04-01&to=2026-06-10" \\
  -H "Authorization: Bearer ak_live_••••"

// 200 OK
{ "moves": [ { "from": "L", "to": "XL", "count": 38 }, … ] }`,
    "/v1/reports/{slug}": `curl "https://api.alwaha.example/v1/reports/inactive-xl-plus?format=csv" \\
  -H "Authorization: Bearer ak_live_••••" \\
  -o report.csv`,
  };

  return (
    <div className="grid-2-1">
      <section className="card">
        <div className="card-head"><h2>Endpoints</h2><span className="muted sm">base: api.alwaha.example · JSON · rate limit 120 req/min</span></div>
        <div className="ep-list">
          {API_ENDPOINTS.map((e, i) => (
            <button key={i} className={"ep-row" + (sel === i ? " on" : "")} onClick={() => setSel(i)}>
              <span className={"method " + e.m.toLowerCase()}>{e.m}</span>
              <span className="mono ep-path">{e.path}</span>
              <span className="muted sm ep-desc">{e.desc}</span>
            </button>
          ))}
        </div>
        <div className="code-block">
          <div className="code-head"><span className="mono">{ep.m} {ep.path}</span><button className="btn ghost sm-btn">Copy</button></div>
          <pre>{SAMPLES[ep.path]}</pre>
        </div>
        <p className="seg-note">This API is illustrative. <span className="mono">api.alwaha.example</span> is a reserved
          documentation domain and does not resolve — the samples show the interface a system like this would expose,
          not one you can call.</p>
      </section>

      <div className="stack">
        <section className="card">
          <div className="card-head"><h2>API keys</h2><button className="btn ghost sm-btn">+ New key</button></div>
          <div className="key-list">
            <div className="key-row">
              <div><b>POS Bridge</b><span className="muted sm"> · production</span><span className="mono muted key-mask">ak_live_••••2f8a</span></div>
              <span className="status-pill act"><i></i>Active</span>
            </div>
            <div className="key-row">
              <div><b>Staging sandbox</b><span className="muted sm"> · test</span><span className="mono muted key-mask">ak_test_••••91bc</span></div>
              <span className="status-pill act"><i></i>Active</span>
            </div>
            <div className="key-row">
              <div><b>Legacy ERP sync</b><span className="muted sm"> · revoked 2 Jun</span><span className="mono muted key-mask">ak_live_••••8d31</span></div>
              <span className="status-pill inact"><i></i>Revoked</span>
            </div>
          </div>
          <p className="seg-note">Masked placeholders, not credentials — there is no key behind them.</p>
        </section>
        <section className="card">
          <div className="card-head"><h2>Last 24h</h2></div>
          <div className="api-stats">
            <div><b>18,422</b><span className="muted sm">requests</span></div>
            <div><b>99.97%</b><span className="muted sm">success</span></div>
            <div><b>84 ms</b><span className="muted sm">median latency</span></div>
          </div>
          <p className="seg-note">Webhooks available for <span className="mono">client.category_changed</span> and <span className="mono">client.became_inactive</span>.</p>
        </section>
      </div>
    </div>
  );
}

Object.assign(window, { DataScreen });
