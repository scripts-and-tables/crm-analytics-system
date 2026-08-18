// ── Segmentation, Status trends, Locations ──────────────────────
const { useState, useMemo } = React;

// ── Segmentation ────────────────────────────────────────────────
function ClassificationCard({ go }) {
  const C = CRM;
  const asc = [...C.SEGMENTS].reverse(); // XXS → VIP
  const fmtT = (v) => (v >= 1000 ? v / 1000 + "k" : v);
  return (
    <section className="card">
      <div className="card-head">
        <h2>How clients are classified</h2>
        <button className="btn ghost sm-btn" title="Threshold changes are written to the audit log">Edit thresholds…</button>
      </div>
      <div className="ladder">
        {asc.map((s, i) => (
          <div key={s} className="ladder-col" onClick={() => go("clients", { seg: s })} title={C.SEG_META[s].desc + " — view clients"}>
            <div className={"ladder-bar" + (i < 4 ? " lite" : "")} style={{ height: `${24 + i * 10.5}%`, background: C.SEG_META[s].color }}>{s}</div>
            <span className="ladder-min">{i === 0 ? "AED 0" : "AED " + fmtT(C.TIER_MIN[s])}{i === asc.length - 1 ? "+" : ""}</span>
          </div>
        ))}
      </div>
      <div className="rule-list">
        <div className="rule"><b>What counts</b><span>Net spend across all boutiques &amp; online, in AED, over the <em>trailing 12 months</em>. Refunds deducted; loyalty redemptions excluded.</span></div>
        <div className="rule"><b>When it updates</b><span>Recalculated nightly at 02:00 GST. A client moves the moment their rolling spend crosses a boundary — up or down. Every move lands in the audit log.</span></div>
        <div className="rule"><b>Category ≠ status</b><span>Active / inactive is a separate flag based on days since last purchase (configurable in Tweaks) — a VIP can be inactive and still VIP until their rolling spend decays.</span></div>
      </div>
    </section>
  );
}

function SegmentationScreen({ go }) {
  const C = CRM;
  const segCounts = useMemo(() => {
    const m = {};
    C.SEGMENTS.forEach((s) => (m[s] = { n: 0, spend: 0 }));
    C.clients.forEach((c) => { m[c.seg].n++; m[c.seg].spend += c.spend12m; });
    return m;
  }, []);
  const totalSpend = C.clients.reduce((a, c) => a + c.spend12m, 0);

  // RFM grid: recency buckets × order-frequency buckets
  const RB = ["≤ 30d", "31–90d", "91–180d", "> 180d"];
  const FB = ["10+ orders", "6–9 orders", "3–5 orders", "1–2 orders"];
  const rfm = useMemo(() => {
    const g = FB.map(() => RB.map(() => 0));
    C.clients.forEach((c) => {
      const r = c.lastDays <= 30 ? 0 : c.lastDays <= 90 ? 1 : c.lastDays <= 180 ? 2 : 3;
      const f = c.orders12m >= 10 ? 0 : c.orders12m >= 6 ? 1 : c.orders12m >= 3 ? 2 : 3;
      g[f][r]++;
    });
    return g;
  }, []);
  const rfmMax = Math.max(...rfm.flat());

  return (
    <div className="screen" data-screen-label="Segmentation">
      <header className="screen-head">
        <div>
          <h1>Categories</h1>
          <p className="muted">Size categories by trailing-12-month spend · click a tier to see its clients</p>
        </div>
      </header>

      <ClassificationCard go={go} />

      <div className="seg-cards">
        {C.SEGMENTS.map((s) => (
          <button key={s} className="seg-card" style={{ "--seg": C.SEG_META[s].color }} onClick={() => go("clients", { seg: s })}>
            <div className="sc-top"><i></i><span>{s}</span></div>
            <b>{segCounts[s].n}</b>
            <span className="sc-share muted">{((segCounts[s].spend / totalSpend) * 100).toFixed(0)}% of revenue</span>
            <span className="sc-rule">{C.SEG_META[s].desc}</span>
          </button>
        ))}
      </div>

      <div className="grid-2-1">
        <section className="card">
          <div className="card-head">
            <h2>Recency × frequency</h2>
            <span className="muted sm">rows = orders in 12 mo · columns = time since last purchase</span>
          </div>
          <div className="rfm">
            <div className="rfm-corner">Orders ↓ · Last purchase →</div>
            {RB.map((r) => <div key={r} className="rfm-head">{r}</div>)}
            {FB.map((f, fi) => (
              <React.Fragment key={f}>
                <div className="rfm-row-head">{f}</div>
                {RB.map((r, ri) => {
                  const v = rfm[fi][ri];
                  const t = v / (rfmMax || 1);
                  const hot = fi <= 1 && ri >= 2; // frequent but going cold
                  return (
                    <div key={r} className={"rfm-cell" + (hot && v > 0 ? " alert" : "")}
                      style={{ background: `color-mix(in oklch, var(--accent) ${4 + t * 60}%, var(--surface))`, color: t > 0.5 ? "#fff" : "var(--ink)" }}
                      title={`${f}, last purchase ${r}: ${v} clients (darker = more clients)`}>
                      {v || "·"}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
          <p className="seg-note">⚑ Outlined cells are frequent buyers going cold — prime win-back targets.</p>
        </section>

        <section className="card">
          <div className="card-head"><h2>Revenue share by segment</h2></div>
          <HBars money={false} items={C.SEGMENTS.map((s) => ({
            label: s, color: C.SEG_META[s].color,
            value: Math.round((segCounts[s].spend / totalSpend) * 100),
            onClick: () => go("clients", { seg: s }),
          }))} />
          <p className="seg-note">Values are % of trailing-12-month revenue. VIP, XXL &amp; XL clients are {(((["VIP","XXL","XL"].reduce((a,s)=>a+segCounts[s].spend,0)) / totalSpend) * 100).toFixed(0)}% of revenue from just {["VIP","XXL","XL"].reduce((a,s)=>a+segCounts[s].n,0)} clients.</p>
        </section>
      </div>
    </div>
  );
}

// ── Status change trends ────────────────────────────────────────
function TrendsScreen({ go }) {
  const C = CRM;
  const [sel, setSel] = useState(null);
  const net = C.MONTHS.map((_, i) => C.newSeries[i] - C.churnSeries[i]);
  // every off-diagonal move, signed by direction (lower index = bigger tier)
  const moves = useMemo(() => {
    const ups = [], downs = [];
    C.SEGMENTS.forEach((f, fi) => C.SEGMENTS.forEach((t, ti) => {
      if (f === t || !C.TRANSITIONS[f][t]) return;
      (ti < fi ? ups : downs).push({ label: f + " → " + t, value: C.TRANSITIONS[f][t] });
    }));
    const top = (a, color) => a.sort((x, y) => y.value - x.value).slice(0, 5).map((m) => ({ ...m, color }));
    return {
      ups: top(ups, "var(--seg-xxl)"),
      downs: top(downs, "var(--warn)"),
      nUp: ups.reduce((a, m) => a + m.value, 0),
      nDown: downs.reduce((a, m) => a + m.value, 0),
    };
  }, []);
  const upMoves = moves.ups, downMoves = moves.downs;

  return (
    <div className="screen" data-screen-label="Status trends">
      <header className="screen-head">
        <div>
          <h1>Status change trends</h1>
          <p className="muted">How clients move between size categories · Q2 2026 vs Q1 2026</p>
        </div>
      </header>

      <div className="kpi-row four">
        <Kpi label="Moved up this quarter" value={fmtNum(moves.nUp)} delta={9.1} deltaLabel="vs Q1" accent />
        <Kpi label="Moved down" value={fmtNum(moves.nDown)} delta={-4.3} deltaLabel="vs Q1" />
        <Kpi label="Net movement" value={(moves.nUp - moves.nDown >= 0 ? "+" : "") + (moves.nUp - moves.nDown)} deltaLabel="upgrades minus downgrades" />
        <Kpi label="Net base growth · Jun" value={"+" + net[net.length - 1]} deltaLabel="new minus churned" />
      </div>

      <section className="card">
        <div className="card-head">
          <h2>New vs churned clients</h2>
          <span className="muted sm">per month · 18 months</span>
        </div>
        <DualBars labels={C.MONTHS} a={C.newSeries} b={C.churnSeries} nameA="New" nameB="Churned" />
      </section>

      <div className="grid-2-1">
        <section className="card">
          <div className="card-head">
            <h2>Category transition matrix</h2>
            <span className="muted sm">clients moving From → To, last quarter · click a cell</span>
          </div>
          <TransitionMatrix onCell={(f, t, v) => setSel({ f, t, v })} />
          {sel && (
            <p className="seg-note">
              <b>{sel.v} clients</b> moved <SegBadge seg={sel.f} small /> → <SegBadge seg={sel.t} small /> last quarter.{" "}
              <a className="link" onClick={() => go("clients", { seg: sel.t })}>View {sel.t} clients →</a>
            </p>
          )}
        </section>

        <section className="card">
          <div className="card-head"><h2>Biggest movements</h2></div>
          <h3 className="sub-h up-h">▲ Upgrades</h3>
          <HBars money={false} items={upMoves} />
          <h3 className="sub-h down-h">▼ Downgrades</h3>
          <HBars money={false} items={downMoves} />
        </section>
      </div>
    </div>
  );
}

// ── Locations ───────────────────────────────────────────────────
function LocationsScreen({ go }) {
  const C = CRM;
  const [metric, setMetric] = useState("revenue");
  const METRICS = {
    revenue: { label: "Revenue (AED ’000)", get: (l) => l.revenue, money: true },
    clients: { label: "Active clients", get: (l) => l.clients, money: false },
    avgBasket: { label: "Avg basket (AED)", get: (l) => l.avgBasket, money: false },
    retention: { label: "Retention %", get: (l) => l.retention, money: false },
  };
  const cities = ["Dubai", "Abu Dhabi", "Sharjah"];

  return (
    <div className="screen" data-screen-label="Locations">
      <header className="screen-head">
        <div>
          <h1>Boutique comparison</h1>
          <p className="muted">6 boutiques · 3 emirates · trailing 12 months · <b>all locations are invented</b></p>
        </div>
        <div className="chip-group">
          {Object.entries(METRICS).map(([k, m]) => (
            <button key={k} className={"chip" + (metric === k ? " on" : "")} onClick={() => setMetric(k)}>{m.label.split(" (")[0]}</button>
          ))}
        </div>
      </header>

      <div className="city-cols">
        {cities.map((city) => {
          const locs = C.locStats.filter((l) => l.city === city);
          const cityRev = locs.reduce((a, l) => a + l.revenue, 0);
          return (
            <section key={city} className="card city-card">
              <div className="card-head">
                <h2>{city}</h2>
                <span className="muted sm">{locs.length} boutique{locs.length > 1 ? "s" : ""} · {fmtK(cityRev)} revenue</span>
              </div>
              {locs.map((l) => (
                <div key={l.id} className="loc-row" onClick={() => go("clients", {})}>
                  <div className="loc-main">
                    <span className="loc-name">{l.name}</span>
                    <span className={"delta " + (l.growth >= 0 ? "up" : "down")}>{l.growth >= 0 ? "▲" : "▼"} {Math.abs(l.growth)}% YoY</span>
                  </div>
                  <div className="loc-bar">
                    <i style={{ width: `${(METRICS[metric].get(l) / Math.max(...C.locStats.map(METRICS[metric].get))) * 100}%` }}></i>
                  </div>
                  <div className="loc-stats muted sm">
                    {METRICS[metric].money ? fmtK(METRICS[metric].get(l)) : METRICS[metric].get(l).toLocaleString() + (metric === "retention" ? "%" : "")}
                    {" · "}{l.clients.toLocaleString()} clients · {l.retention}% retained
                  </div>
                </div>
              ))}
            </section>
          );
        })}
      </div>

      <section className="card table-card">
        <div className="card-head"><h2>All boutiques</h2></div>
        <table className="table">
          <thead>
            <tr><th>Boutique</th><th>City</th><th className="num">Revenue ’000</th><th className="num">Clients</th><th className="num">Avg basket</th><th className="num">Retention</th><th className="num">YoY</th></tr>
          </thead>
          <tbody>
            {C.locStats.map((l) => (
              <tr key={l.id}>
                <td><b>{l.name}</b></td>
                <td className="muted">{l.city}</td>
                <td className="num">{fmtK(l.revenue)}</td>
                <td className="num">{l.clients.toLocaleString()}</td>
                <td className="num">{fmtAED(l.avgBasket)}</td>
                <td className="num">{l.retention}%</td>
                <td className="num"><span className={"delta " + (l.growth >= 0 ? "up" : "down")}>{l.growth >= 0 ? "+" : ""}{l.growth}%</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

Object.assign(window, { SegmentationScreen, TrendsScreen, LocationsScreen });
