// ── Shared UI: charts + primitives ──────────────────────────────
const { useState, useMemo, useEffect, useRef } = React;

const fmtAED = (n) => "AED " + n.toLocaleString("en-AE");
const fmtK = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "M" : n.toLocaleString() + "K"); // input in '000
const fmtNum = (n) => n.toLocaleString("en-AE");

// ── Segment badge ───────────────────────────────────────────────
function SegBadge({ seg, small }) {
  return (
    <span className={"seg-badge" + (small ? " sm" : "")} style={{ "--seg": CRM.SEG_META[seg].color }}>
      <i></i>{seg}
    </span>
  );
}

// ── KPI card ────────────────────────────────────────────────────
function Kpi({ label, value, delta, deltaLabel, spark, accent }) {
  const up = delta >= 0;
  return (
    <div className={"kpi" + (accent ? " kpi-accent" : "")}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-foot">
        {delta != null && (
          <span className={"delta " + (up ? "up" : "down")}>
            <svg width="9" height="9" viewBox="0 0 10 10">{up ? <path d="M5 1l4 5H6v3H4V6H1z" fill="currentColor"></path> : <path d="M5 9L1 4h3V1h2v3h3z" fill="currentColor"></path>}</svg>
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        {deltaLabel && <span className="kpi-sub">{deltaLabel}</span>}
      </div>
      {spark && <Sparkline data={spark} />}
    </div>
  );
}

function Sparkline({ data }) {
  const w = 120, h = 34;
  const min = Math.min(...data), max = Math.max(...data);
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 3 - ((v - min) / (max - min || 1)) * (h - 8)]);
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <path d={d + ` L${w},${h} L0,${h} Z`} fill="var(--accent-soft)" stroke="none"></path>
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="1.6"></path>
    </svg>
  );
}

// ── Line / area chart ───────────────────────────────────────────
function LineChart({ series, labels, height = 220, money = true }) {
  const [hover, setHover] = useState(null);
  const w = 760, h = height, padL = 46, padB = 26, padT = 14, padR = 10;
  const all = series.flatMap((s) => s.data);
  const max = Math.max(...all) * 1.12, min = 0;
  const iw = w - padL - padR, ih = h - padT - padB;
  const x = (i, len) => padL + (i / (len - 1)) * iw;
  const y = (v) => padT + ih - ((v - min) / (max - min)) * ih;
  const ticks = 4;
  const smooth = (data) => {
    const p = data.map((v, i) => [x(i, data.length), y(v)]);
    let d = `M${p[0][0]},${p[0][1]}`;
    for (let i = 1; i < p.length; i++) {
      const c = (p[i][0] - p[i - 1][0]) / 2.2;
      d += ` C${p[i - 1][0] + c},${p[i - 1][1]} ${p[i][0] - c},${p[i][1]} ${p[i][0]},${p[i][1]}`;
    }
    return d;
  };
  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${w} ${h}`} className="chart" onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const mx = ((e.clientX - r.left) / r.width) * w;
          const len = series[0].data.length;
          const i = Math.round(((mx - padL) / iw) * (len - 1));
          setHover(i >= 0 && i < len ? i : null);
        }}>
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const v = min + ((max - min) / ticks) * i;
          return (
            <g key={i}>
              <line x1={padL} x2={w - padR} y1={y(v)} y2={y(v)} className="gridline"></line>
              <text x={padL - 8} y={y(v) + 3} className="axis" textAnchor="end">{money ? fmtK(Math.round(v)) : Math.round(v).toLocaleString()}</text>
            </g>
          );
        })}
        {labels.map((l, i) => (i % 3 === 0 ? <text key={i} x={x(i, labels.length)} y={h - 6} className="axis" textAnchor="middle">{l}</text> : null))}
        {series.map((s, si) => (
          <g key={si}>
            {si === 0 && <path d={smooth(s.data) + ` L${x(s.data.length - 1, s.data.length)},${y(0)} L${padL},${y(0)} Z`} fill="var(--accent-soft)"></path>}
            <path d={smooth(s.data)} fill="none" stroke={s.color} strokeWidth="2.2" strokeLinecap="round" strokeDasharray={s.dash ? "5 5" : "none"}></path>
          </g>
        ))}
        {hover != null && (
          <g>
            <line x1={x(hover, series[0].data.length)} x2={x(hover, series[0].data.length)} y1={padT} y2={padT + ih} className="hoverline"></line>
            {series.map((s, si) => <circle key={si} cx={x(hover, s.data.length)} cy={y(s.data[hover])} r="4" fill={s.color} stroke="var(--surface)" strokeWidth="2"></circle>)}
          </g>
        )}
      </svg>
      {hover != null && (
        <div className="chart-tip" style={{ left: `${((padL + (hover / (series[0].data.length - 1)) * iw) / w) * 100}%` }}>
          <div className="tip-title">{labels[hover]}</div>
          {series.map((s, si) => (
            <div key={si} className="tip-row"><i style={{ background: s.color }}></i>{s.name}: <b>{money ? fmtK(s.data[hover]) : s.data[hover].toLocaleString()}</b></div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Donut ───────────────────────────────────────────────────────
function Donut({ items, size = 168, centerLabel, centerValue, onSlice, active }) {
  const total = items.reduce((a, b) => a + b.value, 0);
  const r = size / 2 - 10, cx = size / 2, cy = size / 2, sw = 17;
  let acc = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="donut">
      {items.map((it, i) => {
        const a0 = (acc / total) * Math.PI * 2 - Math.PI / 2;
        acc += it.value;
        const a1 = (acc / total) * Math.PI * 2 - Math.PI / 2;
        const large = a1 - a0 > Math.PI ? 1 : 0;
        const p0 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)];
        const p1 = [cx + r * Math.cos(a1 - 0.012), cy + r * Math.sin(a1 - 0.012)];
        const dim = active && active !== it.label;
        return (
          <path key={i} d={`M${p0[0]},${p0[1]} A${r},${r} 0 ${large} 1 ${p1[0]},${p1[1]}`} fill="none"
            stroke={it.color} strokeWidth={dim ? sw - 6 : sw} opacity={dim ? 0.3 : 1}
            style={{ cursor: onSlice ? "pointer" : "default", transition: "all .25s" }}
            onClick={() => onSlice && onSlice(it.label)}>
          </path>
        );
      })}
      <text x={cx} y={cy - 4} textAnchor="middle" className="donut-num">{centerValue}</text>
      <text x={cx} y={cy + 16} textAnchor="middle" className="donut-cap">{centerLabel}</text>
    </svg>
  );
}

// ── Horizontal bars ─────────────────────────────────────────────
function HBars({ items, money = true, maxOverride }) {
  const max = maxOverride || Math.max(...items.map((i) => i.value));
  return (
    <div className="hbars">
      {items.map((it, i) => (
        <div key={i} className="hbar-row" onClick={it.onClick} style={{ cursor: it.onClick ? "pointer" : "default" }}>
          <span className="hbar-label">{it.label}</span>
          <span className="hbar-track"><i style={{ width: `${(it.value / max) * 100}%`, background: it.color || "var(--accent)", animationDelay: `${i * 60}ms` }}></i></span>
          <span className="hbar-val">{money ? fmtK(it.value) : it.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

// ── Grouped vertical bars (two series) ──────────────────────────
function DualBars({ labels, a, b, nameA, nameB, height = 220 }) {
  const [hover, setHover] = useState(null);
  const w = 760, h = height, padL = 40, padB = 26, padT = 12;
  const max = Math.max(...a, ...b) * 1.15;
  const iw = w - padL - 10, ih = h - padT - padB;
  const bw = (iw / labels.length) * 0.30;
  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${w} ${h}`} className="chart" onMouseLeave={() => setHover(null)}>
        {[0, 1, 2, 3].map((i) => {
          const v = (max / 3) * i;
          const yy = padT + ih - (v / max) * ih;
          return <g key={i}><line x1={padL} x2={w - 10} y1={yy} y2={yy} className="gridline"></line><text x={padL - 8} y={yy + 3} className="axis" textAnchor="end">{Math.round(v)}</text></g>;
        })}
        {labels.map((l, i) => {
          const gx = padL + (i / labels.length) * iw + (iw / labels.length) / 2;
          return (
            <g key={i} onMouseEnter={() => setHover(i)} style={{ cursor: "default" }}>
              <rect x={gx - bw - 1.5} y={padT + ih - (a[i] / max) * ih} width={bw} height={(a[i] / max) * ih} rx="3" fill="var(--accent)" opacity={hover == null || hover === i ? 1 : 0.35} style={{ transition: "opacity .2s" }}></rect>
              <rect x={gx + 1.5} y={padT + ih - (b[i] / max) * ih} width={bw} height={(b[i] / max) * ih} rx="3" fill="var(--inactive)" opacity={hover == null || hover === i ? 1 : 0.35} style={{ transition: "opacity .2s" }}></rect>
              {i % 3 === 0 && <text x={gx} y={h - 6} className="axis" textAnchor="middle">{l}</text>}
              {hover === i && <text x={gx} y={padT + 2} className="axis bold" textAnchor="middle">{nameA} {a[i]} · {nameB} {b[i]}</text>}
            </g>
          );
        })}
      </svg>
      <div className="legend">
        <span><i style={{ background: "var(--accent)" }}></i>{nameA}</span>
        <span><i style={{ background: "var(--inactive)" }}></i>{nameB}</span>
      </div>
    </div>
  );
}

// ── Status pill + opt-in icons ──────────────────────────────────
function StatusPill({ active }) {
  return <span className={"status-pill " + (active ? "act" : "inact")}><i></i>{active ? "Active" : "Inactive"}</span>;
}

function OptIns({ optIn, labels }) {
  const CH = [["phone", "Call"], ["sms", "SMS"], ["email", "Email"]];
  return (
    <span className="optins">
      {CH.map(([k, l]) => (
        <span key={k} className={"opt " + (optIn[k] ? "in" : "out")} title={l + ": " + (optIn[k] ? "opted in" : "opted out")}>
          {optIn[k] ? "✓" : "✕"}{labels !== false && <em>{l}</em>}
        </span>
      ))}
    </span>
  );
}

// ── Transition matrix heatmap ───────────────────────────────────
function TransitionMatrix({ onCell }) {
  const segs = CRM.SEGMENTS;
  const max = 120; // cap for color scaling of off-diagonal
  return (
    <div className="matrix" style={{ gridTemplateColumns: `70px repeat(${segs.length}, 1fr)` }}>
      <div className="mx-corner">From ↓ / To →</div>
      {segs.map((s) => <div key={"h" + s} className="mx-head">{s}</div>)}
      {segs.map((from) => (
        <React.Fragment key={from}>
          <div className="mx-row-head"><SegBadge seg={from} small /></div>
          {segs.map((to) => {
            const v = CRM.TRANSITIONS[from][to];
            const diag = from === to;
            const t = Math.min(v / max, 1);
            return (
              <div key={to} className={"mx-cell" + (diag ? " diag" : "") + (v === 0 ? " zero" : "")}
                style={!diag && v > 0 ? { background: `color-mix(in oklch, var(--accent) ${8 + t * 55}%, var(--surface))`, color: t > 0.55 ? "#fff" : "var(--ink)" } : {}}
                title={`${from} → ${to}: ${v} clients`}
                onClick={() => !diag && v > 0 && onCell && onCell(from, to, v)}>
                {v || "·"}
              </div>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Table helpers ───────────────────────────────────────────────
function Avatar({ name, type }) {
  const init = name.split(" ").filter((w) => w[0] && w[0] === w[0].toUpperCase()).slice(0, 2).map((w) => w[0]).join("");
  return <span className={"avatar " + (type !== "Individual" ? "corp" : "")}>{type !== "Individual" ? "◆" : init}</span>;
}

function Recency({ days }) {
  const txt = days <= 1 ? "Today" : days < 30 ? days + "d ago" : days < 90 ? Math.round(days / 30) + "mo ago" : Math.round(days / 30) + "mo ago";
  const cls = days <= 30 ? "ok" : days <= 90 ? "" : days <= 180 ? "warn" : "bad";
  return <span className={"recency " + cls}>{txt}</span>;
}

Object.assign(window, { fmtAED, fmtK, fmtNum, SegBadge, Kpi, Sparkline, LineChart, Donut, HBars, DualBars, TransitionMatrix, Avatar, Recency, StatusPill, OptIns });
