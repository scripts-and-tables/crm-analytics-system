// ── Overview dashboard ──────────────────────────────────────────
const { useState, useMemo } = React;

function OverviewScreen({ go }) {
  const C = CRM;
  const last = C.revenueSeries.length - 1;
  // Every delta is a real month-over-month change in the generated data, not a
  // number typed into the markup. `pct` guards the divide so an empty month
  // shows no delta rather than Infinity.
  const pct = (a, b) => (b ? ((a - b) / b) * 100 : null);
  const revDelta = pct(C.revenueSeries[last], C.revenueSeries[last - 1]);
  const actDelta = pct(C.activeSeries[last], C.activeSeries[last - 1]);
  const newDelta = pct(C.newSeries[last], C.newSeries[last - 1]);
  // Basket size for the last month vs the one before, summed from transactions.
  const basketOf = (mi) => {
    const t = C.tx; let sum = 0, n = 0;
    for (let i = t.n - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(2026, 5, 10) - (730 - t.day[i]) * 864e5);
      const key = d.getUTCFullYear() * 12 + d.getUTCMonth();
      if (key === mi) { sum += t.amount[i]; n++; }
      else if (key < mi) break;
    }
    return n ? sum / n : 0;
  };
  // May 2026 against April — the last two complete months, matching the series.
  const basketDelta = React.useMemo(() => {
    const mayKey = 2026 * 12 + 4;
    return pct(basketOf(mayKey), basketOf(mayKey - 1));
  }, []);
  const segCounts = useMemo(() => {
    const m = {};
    C.SEGMENTS.forEach((s) => (m[s] = 0));
    C.clients.forEach((c) => m[c.seg]++);
    return m;
  }, []);
  const [activeSeg, setActiveSeg] = useState(null);
  const topClients = C.clients.slice(0, 6);
  const movers = C.clients.filter((c) => c.prevSeg !== c.seg).slice(0, 6);

  return (
    <div className="screen" data-screen-label="Overview">
      <header className="screen-head">
        <div>
          <h1>Client Intelligence</h1>
          <p className="muted">Trailing 12 months · all boutiques · updated 10 Jun 2026, 07:00 GST · <b>sample data</b></p>
        </div>
        <div className="head-actions">
          <button className="btn ghost">Export report</button>
          <button className="btn primary" onClick={() => go("clients")}>Browse clients</button>
        </div>
      </header>

      <div className="kpi-row">
        <Kpi label="Buying clients · May" value={fmtNum(C.activeSeries[last])} delta={actDelta} deltaLabel="vs Apr" spark={C.activeSeries.slice(-10)} accent />
        <Kpi label="Revenue · May" value={"AED " + fmtK(C.revenueSeries[last])} delta={revDelta} deltaLabel="vs Apr" spark={C.revenueSeries.slice(-10)} />
        <Kpi label="Avg basket" value={fmtAED(C.KPI.avgBasket)} delta={basketDelta} deltaLabel="vs Apr" />
        <Kpi label="Active base" value={((C.KPI.activeNow / C.KPI.clients) * 100).toFixed(1) + "%"} deltaLabel={fmtNum(C.KPI.activeNow) + " bought in 180d"} />
        <Kpi label="New clients · May" value={fmtNum(C.newSeries[last])} delta={newDelta} deltaLabel="vs Apr" />
      </div>

      <div className="grid-2-1">
        <section className="card">
          <div className="card-head">
            <h2>Revenue &amp; active clients</h2>
            <span className="muted sm">AED ’000 / month</span>
          </div>
          <LineChart labels={C.MONTHS} series={[
            { name: "Revenue", data: C.revenueSeries, color: "var(--accent)" },
            { name: "Active clients ÷ 2", data: C.activeSeries.map((v) => Math.round(v / 2)), color: "var(--seg-l)", dash: true },
          ]} />
        </section>

        <section className="card">
          <div className="card-head"><h2>Client base by category</h2></div>
          <div className="donut-flex">
            <Donut
              items={C.SEGMENTS.map((s) => ({ label: s, value: segCounts[s], color: C.SEG_META[s].color }))}
              centerValue={fmtNum(C.clients.length)} centerLabel="profiled" active={activeSeg}
              onSlice={(s) => setActiveSeg(activeSeg === s ? null : s)} />
            <div className="donut-legend">
              {C.SEGMENTS.map((s) => (
                <button key={s} className={"dl-row" + (activeSeg === s ? " on" : "")} onClick={() => setActiveSeg(activeSeg === s ? null : s)}>
                  <i style={{ background: C.SEG_META[s].color }}></i>
                  <span>{s}</span>
                  <b>{segCounts[s]}</b>
                </button>
              ))}
            </div>
          </div>
          {activeSeg && <p className="seg-note">{C.SEG_META[activeSeg].desc} — <a className="link" onClick={() => go("clients", { seg: activeSeg })}>view {activeSeg} clients →</a></p>}
        </section>
      </div>

      <div className="grid-1-1-1">
        <section className="card">
          <div className="card-head">
            <h2>Top clients · 12-mo spend</h2>
            <a className="link sm" onClick={() => go("clients")}>All clients →</a>
          </div>
          <div className="mini-table">
            {topClients.map((c) => (
              <div key={c.id} className="mini-row" onClick={() => go("clients", { open: c.id })}>
                <Avatar name={c.name} type={c.type} />
                <div className="mini-main">
                  <span className="mini-name">{c.name}</span>
                  <span className="mini-sub muted">{CRM.LOCATIONS.find((l) => l.id === c.loc).name}</span>
                </div>
                <SegBadge seg={c.seg} small />
                <b className="mini-num">{fmtK(Math.round(c.spend12m / 1000))}</b>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Revenue by boutique</h2>
            <a className="link sm" onClick={() => go("locations")}>Compare →</a>
          </div>
          <HBars items={CRM.locStats.map((l) => ({ label: l.name.replace("The ", ""), value: l.revenue, onClick: () => go("locations") }))} />
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Recent category moves</h2>
            <a className="link sm" onClick={() => go("trends")}>Trends →</a>
          </div>
          <div className="moves">
            {movers.map((c) => (
              <div key={c.id} className="move-row" onClick={() => go("clients", { open: c.id })}>
                <Avatar name={c.name} type={c.type} />
                <span className="move-name">{c.name}</span>
                <span className="move-path">
                  <SegBadge seg={c.prevSeg} small />
                  <svg width="14" height="8" viewBox="0 0 14 8"><path d="M0 4h11M8 1l3 3-3 3" stroke="currentColor" fill="none"></path></svg>
                  <SegBadge seg={c.seg} small />
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

Object.assign(window, { OverviewScreen });
