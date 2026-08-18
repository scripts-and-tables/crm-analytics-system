// ── Clients list + 360° profile ─────────────────────────────────
const { useState, useMemo, useEffect } = React;

function ClientsScreen({ params, go, activeDays }) {
  const C = CRM;
  const [q, setQ] = useState("");
  const [seg, setSeg] = useState(params.seg || "All");
  const [status, setStatus] = useState(params.status || "All");
  const [type, setType] = useState("All");
  const [loc, setLoc] = useState("All");
  const [sort, setSort] = useState({ key: "spend12m", dir: -1 });
  const [openId, setOpenId] = useState(params.open || null);

  useEffect(() => { if (params.seg) setSeg(params.seg); if (params.status) setStatus(params.status); if (params.open) setOpenId(params.open); }, [params]);

  const isActive = (c) => c.lastDays <= activeDays;

  const rows = useMemo(() => {
    let r = C.clients.filter((c) =>
      (seg === "All" || c.seg === seg) &&
      (status === "All" || (status === "Active") === isActive(c)) &&
      (type === "All" || c.type === type) &&
      (loc === "All" || c.loc === loc) &&
      (!q || c.name.toLowerCase().includes(q.toLowerCase()) || c.id.toLowerCase().includes(q.toLowerCase()))
    );
    r.sort((a, b) => (a[sort.key] > b[sort.key] ? 1 : -1) * sort.dir * (typeof a[sort.key] === "string" ? -1 : 1));
    return r;
  }, [q, seg, status, type, loc, sort, activeDays]);

  const th = (label, key, num) => (
    <th className={num ? "num" : ""} onClick={() => setSort((s) => ({ key, dir: s.key === key ? -s.dir : -1 }))}>
      {label}{sort.key === key && <span className="sort-arrow">{sort.dir === -1 ? "↓" : "↑"}</span>}
    </th>
  );

  const open = openId && C.clients.find((c) => c.id === openId);
  const nActive = C.clients.filter(isActive).length;

  return (
    <div className="screen" data-screen-label="Clients">
      <header className="screen-head">
        <div>
          <h1>Clients</h1>
          <p className="muted">{fmtNum(rows.length)} shown · {fmtNum(nActive)} active / {fmtNum(C.clients.length - nActive)} inactive (no purchase in {activeDays}d) · <b>sample data</b></p>
        </div>
        <input className="search" placeholder="Search name or ID…" value={q} onChange={(e) => setQ(e.target.value)} />
      </header>

      <div className="filter-bar">
        <div className="chip-group">
          {["All", ...C.SEGMENTS].map((s) => (
            <button key={s} className={"chip" + (seg === s ? " on" : "")} style={s !== "All" ? { "--seg": C.SEG_META[s].color } : {}} onClick={() => setSeg(s)} title={s !== "All" ? C.SEG_META[s].desc : "All categories"}>
              {s !== "All" && <i className="chip-dot"></i>}{s}
            </button>
          ))}
        </div>
        <div className="chip-group">
          {["All", "Active", "Inactive"].map((s) => (
            <button key={s} className={"chip" + (status === s ? " on" : "")} onClick={() => setStatus(s)}>{s}</button>
          ))}
        </div>
        <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="All">All types</option>
          {C.TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select className="select" value={loc} onChange={(e) => setLoc(e.target.value)}>
          <option value="All">All boutiques</option>
          {C.LOCATIONS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      <section className="card table-card">
        <table className="table">
          <thead>
            <tr>
              {th("Client", "name")}
              <th>Category</th>
              {th("Status", "lastDays")}
              {th("12-mo spend", "spend12m", true)}
              {th("Avg order", "avgOrder", true)}
              {th("Orders / yr", "orders12m", true)}
              {th("First purchase", "sinceYear", true)}
              {th("Last purchase", "lastDays", true)}
              <th>Opt-ins</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 40).map((c) => (
              <tr key={c.id} onClick={() => setOpenId(c.id)}>
                <td><div className="cell-client"><Avatar name={c.name} type={c.type} /><div><span className="cl-name">{c.name}</span><span className="cl-id muted">{c.id} · {c.type}</span></div></div></td>
                <td><SegBadge seg={c.seg} small /></td>
                <td><StatusPill active={isActive(c)} /></td>
                <td className="num"><b>{fmtAED(c.spend12m)}</b></td>
                <td className="num">{fmtAED(c.avgOrder)}</td>
                <td className="num">{c.orders12m}</td>
                <td className="num muted">{c.firstStr}</td>
                <td className="num"><Recency days={c.lastDays} /></td>
                <td><OptIns optIn={c.optIn} labels={false} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 40 && <div className="table-foot muted">Showing 40 of {rows.length} — refine filters to narrow down</div>}
        {rows.length === 0 && <div className="table-foot muted">No clients match these filters.</div>}
      </section>

      {open && <ClientProfile client={open} onClose={() => setOpenId(null)} go={go} active={isActive(open)} />}
    </div>
  );
}

// ── 360° profile drawer ─────────────────────────────────────────
function ClientProfile({ client: c, onClose, go, active }) {
  useEffect(() => {
    const fn = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);
  const loc = CRM.LOCATIONS.find((l) => l.id === c.loc);
  const months = CRM.MONTHS.slice(-12);
  const max = Math.max(...c.monthly, 1);
  const moved = c.prevSeg !== c.seg;
  return (
    <div className="drawer-veil" onClick={onClose}>
      <aside className="drawer" data-screen-label="Client profile" onClick={(e) => e.stopPropagation()}>
        <button className="drawer-x" onClick={onClose} aria-label="Close">✕</button>
        <div className="profile-head">
          <Avatar name={c.name} type={c.type} />
          <div>
            <h2>{c.name}</h2>
            <p className="muted sm">{c.id} · {c.type} · first purchase {c.firstStr}</p>
          </div>
        </div>
        <div className="profile-seg">
          <SegBadge seg={c.seg} />
          <StatusPill active={active} />
          {moved && <span className="moved-note muted sm">was {c.prevSeg} last quarter</span>}
        </div>

        <div className="profile-kpis">
          <div><span className="pk-label">12-mo spend</span><b>{fmtAED(c.spend12m)}</b></div>
          <div><span className="pk-label">Avg order</span><b>{fmtAED(c.avgOrder)}</b></div>
          <div><span className="pk-label">Orders / yr</span><b>{c.orders12m}</b></div>
          <div><span className="pk-label">Loyalty points</span><b>{fmtNum(c.points)}</b></div>
        </div>

        <div className="profile-section">
          <h3>Monthly spend · last 12 months</h3>
          <div className="mini-bars">
            {c.monthly.map((v, i) => (
              <div key={i} className="mb-col" title={`${months[i]}: ${fmtAED(v)}`}>
                <i style={{ height: `${Math.max((v / max) * 100, v > 0 ? 6 : 2)}%`, opacity: v > 0 ? 1 : 0.25 }}></i>
                {i % 3 === 0 && <span>{months[i].split(" ")[0]}</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="profile-section">
          <h3>Contact &amp; marketing consent</h3>
          <dl className="detail-list">
            <div><dt>Phone</dt><dd>{c.phone}</dd></div>
            <div><dt>Email</dt><dd>{c.email}</dd></div>
          </dl>
          <div className="consent-row"><OptIns optIn={c.optIn} /></div>
        </div>

        <div className="profile-section">
          <h3>Details</h3>
          <dl className="detail-list">
            <div><dt>Home boutique</dt><dd>{loc.name}, {loc.city}</dd></div>
            <div><dt>First purchase</dt><dd>{c.firstStr}</dd></div>
            <div><dt>Last purchase</dt><dd>{c.lastStr} (<Recency days={c.lastDays} />)</dd></div>
            <div><dt>Favourite product</dt><dd>{c.favorite}</dd></div>
            <div><dt>Category rule</dt><dd>{CRM.SEG_META[c.seg].desc}</dd></div>
          </dl>
        </div>

        <p className="muted sm">This is a generated record. The person, the purchases and the consent history are all fictional.</p>

        <div className="profile-actions">
          <button className="btn primary">Add note</button>
          <button className="btn ghost">Start campaign</button>
          <button className="btn ghost" onClick={() => { onClose(); go("segmentation"); }}>View category</button>
        </div>
      </aside>
    </div>
  );
}

Object.assign(window, { ClientsScreen, ClientProfile });
