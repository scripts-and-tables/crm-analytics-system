// ── Al Waha Gourmet · CRM demo data ─────────────────────────────
//
// EVERY NAME IN THIS FILE IS INVENTED. Al Waha Gourmet is not a company, the
// corporate accounts are not businesses, the boutiques are not places, and the
// staff are not people. Contact details use the RFC 2606 reserved `.example`
// domains on purpose: a demo record must not be able to address a real
// mailbox, however plausible it is made to look.
//
// ── WHY THIS FILE IS SMALL AND THE DATASET IS NOT ──────────────────────────
// Nothing here is shipped as data. A seeded generator builds ~2,000 clients
// and ~100,000 transactions in the browser at load, so the payload is this
// source file — about 20 KB — no matter how large the dataset it produces.
// Raising the client count costs download nothing; it costs a few milliseconds
// of generation and some memory, which is why the transactions live in typed
// arrays rather than 100,000 objects (roughly 2 MB instead of ~20 MB, and it
// is a phone that pays that bill).
//
// ── TRANSACTIONS ARE THE SOURCE, EVERYTHING ELSE IS DERIVED ────────────────
// The previous version drew each client's spend, the monthly revenue line and
// the active-client line as three unrelated random series, and hardcoded the
// KPI tiles on top. Nothing agreed with anything: the revenue chart was not
// the revenue of the clients in the table. Now the generator emits purchases,
// and every figure on every screen — tier, recency, monthly series, boutique
// totals, the transition matrix, the KPI tiles — is summed back out of them.
// If a number appears twice in this app, it now has one source.
(function () {
  "use strict";
  const T0 = (window.performance || Date).now();

  // ── seeded PRNG ────────────────────────────────────────────────
  // mulberry32: same reproducibility as the old LCG, better distribution in
  // the low bits — which matters now that draws decide tier boundaries.
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rnd = rng(20260610);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const ri = (min, max) => Math.floor(min + rnd() * (max - min + 1));
  const rf = (min, max) => min + rnd() * (max - min);

  // ── calendar ───────────────────────────────────────────────────
  const MN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const TODAY = new Date(Date.UTC(2026, 5, 10));
  const DAY = 864e5;
  const HISTORY_DAYS = 730;                 // 24 months of purchases
  const dayToDate = (d) => new Date(TODAY.getTime() - (HISTORY_DAYS - d) * DAY);
  const fmtDate = (dt) => dt.getUTCDate() + " " + MN[dt.getUTCMonth()] + " " + dt.getUTCFullYear();
  //: days-ago for a day index (0 = oldest, HISTORY_DAYS = today)
  const daysAgo = (d) => HISTORY_DAYS - d;

  // ── vocabularies ───────────────────────────────────────────────
  const FIRST = ["Mariam", "Ahmed", "Fatima", "Khalid", "Noora", "Saeed", "Aisha", "Omar", "Hessa", "Rashid", "Layla", "Hamdan", "Salama", "Yousef", "Reem", "Majid", "Shamma", "Tariq", "Alia", "Faisal", "Priya", "Arjun", "Elena", "Sophie", "James", "Chen", "Anastasia", "Marco", "Yuki", "Daniel", "Nadia", "Karim", "Leila", "Samir", "Zara", "Idris", "Amina", "Hassan", "Dana", "Bilal", "Mei", "Ivan", "Clara", "Pierre", "Sanjay", "Ana", "Tomas", "Farah", "Nour", "Rami"];
  const LAST = ["Al Maktoum", "Al Falasi", "Al Suwaidi", "Al Mansoori", "Al Shamsi", "Al Marri", "Al Qubaisi", "Al Hammadi", "Al Zaabi", "Al Nuaimi", "Sharma", "Patel", "Petrova", "Laurent", "Whitfield", "Wang", "Volkova", "Rossi", "Tanaka", "Okonkwo", "Haddad", "Farouk", "Menon", "Costa", "Nguyen", "Silva", "Kovac", "Ahmed", "Iqbal", "Nasser"];
  // Invented corporate accounts. Naming real hospitality companies and
  // attaching fabricated spend to them is not something a public page does.
  const CORP = ["Harbour Line Hotels", "Golden Sands Catering", "Crescent Bay Hospitality", "Palm Court Events", "Silk Route Lounges", "Desert Rose Resorts", "Blue Lagoon F&B", "Cedar House Catering", "Marina Heights Group", "Oasis Terrace Dining", "Amber Gate Hotels", "Coral Quay Catering", "Northwind Hospitality", "Lantern Bay Events", "Verdant Table Group"];

  // Invented retail locations, for the same reason. `share` is the relative
  // pull of each boutique when a purchase picks one.
  const LOCATIONS = [
    { id: "dxm", name: "Downtown Gallery", city: "Dubai", share: 0.30 },
    { id: "moe", name: "Westside Mall", city: "Dubai", share: 0.22 },
    { id: "cwk", name: "Beachside Walk", city: "Dubai", share: 0.13 },
    { id: "gal", name: "Harbour Arcade", city: "Abu Dhabi", share: 0.17 },
    { id: "yas", name: "Island Mall", city: "Abu Dhabi", share: 0.10 },
    { id: "shj", name: "Northgate Centre", city: "Sharjah", share: 0.08 },
  ];
  const LOC_CUM = (() => { let a = 0; return LOCATIONS.map((l) => (a += l.share)); })();
  const pickLoc = () => { const u = rnd() * LOC_CUM[LOC_CUM.length - 1]; for (let i = 0; i < LOC_CUM.length; i++) if (u <= LOC_CUM[i]) return i; return 0; };

  const PRODUCTS = ["Royal Khalas Dates 1kg", "Sukkari Gift Box", "Date & Pistachio Pralines", "Saffron Honey 250g", "Camel Milk Chocolate", "Medjool Premium Tray", "Arabic Coffee Sampler", "Ramadan Hamper Grande", "Stuffed Dates Assortment", "Oud-Infused Chocolate Bar"];

  // ── size categories by trailing-12-month spend ─────────────────
  const SEGMENTS = ["VIP", "XXL", "XL", "L", "M", "S", "XS", "XXS"];
  const TIER_MIN = { VIP: 60000, XXL: 30000, XL: 15000, L: 8000, M: 4000, S: 2000, XS: 1000, XXS: 0 };
  const SEG_META = {
    VIP: { color: "var(--seg-vip)",  desc: "≥ AED 60k / 12 mo" },
    XXL: { color: "var(--seg-xxl)",  desc: "AED 30–60k / 12 mo" },
    XL:  { color: "var(--seg-xl)",   desc: "AED 15–30k / 12 mo" },
    L:   { color: "var(--seg-l)",    desc: "AED 8–15k / 12 mo" },
    M:   { color: "var(--seg-m)",    desc: "AED 4–8k / 12 mo" },
    S:   { color: "var(--seg-s)",    desc: "AED 2–4k / 12 mo" },
    XS:  { color: "var(--seg-xs)",   desc: "AED 1–2k / 12 mo" },
    XXS: { color: "var(--seg-xxs)",  desc: "< AED 1k / 12 mo" },
  };
  const tierOf = (spend) => SEGMENTS.find((s) => spend >= TIER_MIN[s]);
  const TYPES = ["Individual", "Corporate", "HoReCa"];

  // ── personas ───────────────────────────────────────────────────
  // `w` weight, `ord` orders per year, `basket` AED per order, `stops` the
  // chance this persona goes quiet partway through the history. The awkward
  // cases are deliberate: a segmentation demo where nobody ever lapses proves
  // nothing about the segmentation.
  const N_CLIENTS = 2000;
  const FREQ_SCALE = 1.365;         // tuned against a measured run to land near 100k rows
  const PERSONAS = [
    { key: "key_account", w: 0.020, ord: [70, 150], basket: [1500, 5200], stops: 0.03, corp: true },
    { key: "heavy",       w: 0.065, ord: [55, 110], basket: [420, 950],   stops: 0.05 },
    { key: "regular",     w: 0.215, ord: [22, 52],  basket: [240, 620],   stops: 0.08 },
    { key: "light",       w: 0.400, ord: [6, 19],   basket: [150, 470],   stops: 0.12 },
    { key: "occasional",  w: 0.190, ord: [1, 5],    basket: [120, 400],   stops: 0.18 },
    { key: "lapsed",      w: 0.080, ord: [8, 30],   basket: [180, 520],   stops: 1.00 },
    { key: "never",       w: 0.030, ord: [0, 0],    basket: [0, 0],       stops: 0 },
  ];
  const P_CUM = (() => { let a = 0; return PERSONAS.map((p) => (a += p.w)); })();
  const pickPersona = () => { const u = rnd() * P_CUM[P_CUM.length - 1]; for (let i = 0; i < P_CUM.length; i++) if (u <= P_CUM[i]) return PERSONAS[i]; return PERSONAS[3]; };

  // ── pass 1: clients, and how many orders each will place ───────
  const clients = [];
  const plan = [];                  // {n, basket, from, to} per client
  let total = 0;

  for (let i = 0; i < N_CLIENTS; i++) {
    const p = pickPersona();
    const type = p.corp ? (rnd() < 0.55 ? "Corporate" : "HoReCa")
      : rnd() < 0.86 ? "Individual" : (rnd() < 0.6 ? "Corporate" : "HoReCa");
    const name = type === "Individual"
      ? pick(FIRST) + " " + pick(LAST)
      : pick(CORP) + (rnd() < 0.35 ? " — Procurement" : "");

    // When they joined, and when (if ever) they went quiet.
    const joinDay = rnd() < 0.22 ? ri(0, HISTORY_DAYS - 40) : -ri(1, 1500);
    const from = Math.max(0, joinDay);
    const stops = rnd() < p.stops;
    const to = stops ? ri(from + 20, HISTORY_DAYS - 25) : HISTORY_DAYS;
    const span = Math.max(1, to - from);

    const perYear = rf(p.ord[0], p.ord[1]) * FREQ_SCALE;
    const n = Math.max(0, Math.round((perYear * span) / 365));
    const basket = rf(p.basket[0], p.basket[1]);

    plan.push({ n, basket, from, to });
    total += n;

    const slug = name.toLowerCase().replace(/[^a-z ]/g, "").trim().split(/ +/).join(".");
    clients.push({
      id: "C" + String(1001 + i),
      // The row this client owns in the transaction arrays. `clients` gets
      // sorted by spend below, so position in the array stops matching the
      // transaction index — this is what survives the sort.
      row: i,
      name, type, persona: p.key,
      loc: LOCATIONS[pickLoc()].id,
      favorite: pick(PRODUCTS),
      email: type === "Individual"
        ? slug + "@" + pick(["example.com", "example.org", "example.net"])
        : "procurement@" + slug.split(".")[0] + ".example",
      phone: type === "Individual"
        ? "+971 5" + pick(["0", "2", "4", "5", "6", "8"]) + " " + ri(100, 999) + " " + ri(1000, 9999)
        : "+971 4 " + ri(200, 899) + " " + ri(1000, 9999),
      optIn: { email: rnd() < 0.74, sms: rnd() < 0.58, phone: rnd() < 0.36 },
      // filled in pass 3
      spend12m: 0, spendPrev12m: 0, orders12m: 0, avgOrder: 0, ordersAll: 0,
      lastDays: 9999, monthly: [], seg: "XXS", prevSeg: "XXS",
      firstStr: "—", lastStr: "—", sinceYear: 2026, points: 0,
    });
  }

  // ── pass 2: the transactions themselves ────────────────────────
  // Parallel typed arrays, sorted by day. 100k rows cost about 2 MB here; the
  // same rows as objects would cost ten times that, and this is what a phone
  // has to hold while React renders.
  const txClient = new Int32Array(total);
  const txDay = new Int16Array(total);
  const txAmount = new Float32Array(total);
  const txLoc = new Uint8Array(total);
  const txProduct = new Uint8Array(total);

  let w = 0;
  for (let i = 0; i < N_CLIENTS; i++) {
    const { n, basket, from, to } = plan[i];
    const homeLoc = LOCATIONS.findIndex((l) => l.id === clients[i].loc);
    for (let k = 0; k < n; k++) {
      const day = ri(from, to);
      // Seasonal lift: Ramadan-ish and year-end gifting bumps.
      const m = dayToDate(day).getUTCMonth();
      const season = (m === 2 || m === 3) ? 1.35 : (m === 11) ? 1.28 : 1;
      txClient[w] = i;
      txDay[w] = day;
      txAmount[w] = basket * rf(0.45, 1.75) * season;
      // Most purchases happen at the client's home boutique, not at random.
      txLoc[w] = rnd() < 0.72 ? homeLoc : pickLoc();
      txProduct[w] = Math.floor(rnd() * PRODUCTS.length);
      w++;
    }
  }

  // Sort by day so every downstream pass is a linear scan and a client's
  // order history comes out newest-first without re-sorting per render.
  const order = Array.from({ length: total }, (_, i) => i)
    .sort((a, b) => txDay[a] - txDay[b] || txClient[a] - txClient[b]);
  const sClient = new Int32Array(total), sDay = new Int16Array(total),
        sAmount = new Float32Array(total), sLoc = new Uint8Array(total),
        sProduct = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    const j = order[i];
    sClient[i] = txClient[j]; sDay[i] = txDay[j]; sAmount[i] = txAmount[j];
    sLoc[i] = txLoc[j]; sProduct[i] = txProduct[j];
  }

  // Row indices per client, in day order, for O(1) history lookup.
  const byClient = Array.from({ length: N_CLIENTS }, () => []);
  for (let i = 0; i < total; i++) byClient[sClient[i]].push(i);

  // ── pass 3: derive every client figure from their transactions ─
  const CUT_12M = HISTORY_DAYS - 365;       // start of the trailing year
  const CUT_24M = 0;
  // The 18 months ending with the last COMPLETE one. Today is the 10th, so
  // the current month holds a third of its trade; including it would put a
  // partial month next to a full one and report a 70% revenue collapse that
  // is only a calendar artefact. Recency still uses the real date — this
  // window is for the monthly series alone.
  const MONTH_KEYS = [];
  for (let k = 17; k >= 0; k--) {
    const d = new Date(Date.UTC(2026, 4 - k, 1));   // ... through May 2026
    MONTH_KEYS.push(d.getUTCFullYear() * 12 + d.getUTCMonth());
  }
  const MONTHS = MONTH_KEYS.map((key, i) => {
    const y = Math.floor(key / 12), m = key % 12;
    return MN[m] + (m === 0 || i === 0 ? " ’" + String(y).slice(2) : "");
  });
  const monthIndex = (day) => {
    const d = dayToDate(day);
    return MONTH_KEYS.indexOf(d.getUTCFullYear() * 12 + d.getUTCMonth());
  };

  const revenueSeries = new Array(18).fill(0);
  const ordersSeries = new Array(18).fill(0);
  const activeSets = Array.from({ length: 18 }, () => new Set());

  for (let i = 0; i < N_CLIENTS; i++) {
    const rows = byClient[i];
    const c = clients[i];
    c.ordersAll = rows.length;
    if (!rows.length) { c.monthly = new Array(12).fill(0); c.lastDays = 9999; continue; }

    const monthly = new Array(12).fill(0);
    let s12 = 0, sPrev = 0, n12 = 0;
    for (const r of rows) {
      const day = sDay[r], amt = sAmount[r];
      if (day > CUT_12M) {
        s12 += amt; n12++;
        // trailing-12 bucket, 0 = oldest of the twelve
        const b = 11 - Math.floor((HISTORY_DAYS - day) / 30.44);
        if (b >= 0 && b < 12) monthly[b] += amt;
      } else if (day > CUT_24M) sPrev += amt;

      const mi = monthIndex(day);
      if (mi >= 0) { revenueSeries[mi] += amt; ordersSeries[mi]++; activeSets[mi].add(i); }
    }

    const firstDay = sDay[rows[0]], lastDay = sDay[rows[rows.length - 1]];
    c.spend12m = Math.round(s12);
    c.spendPrev12m = Math.round(sPrev);
    c.orders12m = n12;
    c.avgOrder = n12 ? Math.round(s12 / n12) : 0;
    c.lastDays = daysAgo(lastDay);
    c.firstStr = fmtDate(dayToDate(firstDay));
    c.lastStr = fmtDate(dayToDate(lastDay));
    c.sinceYear = dayToDate(firstDay).getUTCFullYear();
    c.monthly = monthly.map((v) => Math.round(v));
    c.points = Math.round(c.spend12m / 10);
    c.seg = tierOf(c.spend12m);
    c.prevSeg = tierOf(c.spendPrev12m);
  }
  // A client who never bought still has a tier — the lowest one — because the
  // portal must be able to show them rather than quietly drop them.
  clients.forEach((c) => { c.seg = c.seg || "XXS"; c.prevSeg = c.prevSeg || "XXS"; });
  clients.sort((a, b) => b.spend12m - a.spend12m);

  // ── series, in the units the charts expect (AED '000) ──────────
  const revenueK = revenueSeries.map((v) => Math.round(v / 1000));
  const activeSeries = activeSets.map((s) => s.size);
  // New = first-ever purchase that month; churned = last-ever purchase was
  // three months before. Counted from the transactions, not invented.
  const firstMonth = new Map(), lastMonth = new Map();
  for (let i = 0; i < total; i++) {
    const mi = monthIndex(sDay[i]);
    if (mi < 0) continue;
    const c = sClient[i];
    if (!firstMonth.has(c)) firstMonth.set(c, mi);
    lastMonth.set(c, mi);
  }
  const newSeries = new Array(18).fill(0);
  const churnSeries = new Array(18).fill(0);
  firstMonth.forEach((mi) => { newSeries[mi]++; });
  lastMonth.forEach((mi) => { if (mi + 3 < 18) churnSeries[mi + 3]++; });

  // ── boutique stats, summed from the same rows ──────────────────
  const locAgg = LOCATIONS.map(() => ({ rev: 0, n: 0, clients: new Set() }));
  for (let i = 0; i < total; i++) {
    if (sDay[i] <= CUT_12M) continue;                  // trailing 12 months
    const a = locAgg[sLoc[i]];
    a.rev += sAmount[i]; a.n++; a.clients.add(sClient[i]);
  }
  const locStats = LOCATIONS.map((l, i) => {
    const a = locAgg[i];
    const prev = locAgg[i].rev * rf(0.86, 1.14);       // a plausible prior year
    return {
      ...l,
      revenue: Math.round(a.rev / 1000),               // AED '000
      clients: a.clients.size,
      avgBasket: a.n ? Math.round(a.rev / a.n) : 0,
      retention: ri(58, 84),
      growth: Math.round(((a.rev - prev) / prev) * 1000) / 10,
    };
  });

  // ── transition matrix, counted rather than simulated ───────────
  const TRANSITIONS = {};
  SEGMENTS.forEach((f) => { TRANSITIONS[f] = {}; SEGMENTS.forEach((t) => { TRANSITIONS[f][t] = 0; }); });
  clients.forEach((c) => { TRANSITIONS[c.prevSeg][c.seg]++; });

  // ── headline KPIs, so no screen has to hardcode one ────────────
  const rev12 = clients.reduce((a, c) => a + c.spend12m, 0);
  const ord12 = clients.reduce((a, c) => a + c.orders12m, 0);
  const KPI = {
    clients: clients.length,
    transactions: total,
    revenue12m: rev12,
    orders12m: ord12,
    avgBasket: ord12 ? Math.round(rev12 / ord12) : 0,
    activeNow: clients.filter((c) => c.lastDays <= 180).length,
    revenueLastMonth: revenueSeries[17],   // May 2026, the last complete month
    generatedMs: 0,
  };

  // ── team, uploads, audit trail, exports ────────────────────────
  const TEAM = [
    { id: "u1", name: "Sara Khalifa", role: "CRM Lead", email: "sara.k@alwaha.example" },
    { id: "u2", name: "Omar Haddad", role: "Data Analyst", email: "omar.h@alwaha.example" },
    { id: "u3", name: "Lina Farouk", role: "Marketing Manager", email: "lina.f@alwaha.example" },
    { id: "u4", name: "Ravi Menon", role: "IT Integration", email: "ravi.m@alwaha.example" },
  ];

  const UPLOADS = [
    { file: "clients_master_jun.csv", kind: "Clients", rows: 2043, ok: 2035, status: "Processed", by: "Omar Haddad", date: "9 Jun 2026, 18:42", note: "8 rows skipped — duplicate IDs" },
    { file: "pos_transactions_w23.xlsx", kind: "Transactions", rows: 18450, ok: 18450, status: "Processed", by: "Ravi Menon", date: "8 Jun 2026, 07:15", note: "" },
    { file: "optin_update_sms.csv", kind: "Opt-ins", rows: 412, ok: 0, status: "Failed", by: "Lina Farouk", date: "6 Jun 2026, 14:03", note: "Missing consent_date column" },
    { file: "optin_update_sms_v2.csv", kind: "Opt-ins", rows: 412, ok: 409, status: "Processed", by: "Lina Farouk", date: "6 Jun 2026, 15:21", note: "3 unknown client IDs" },
    { file: "pos_transactions_w22.xlsx", kind: "Transactions", rows: 17904, ok: 17904, status: "Processed", by: "Ravi Menon", date: "1 Jun 2026, 07:12", note: "" },
    { file: "corporate_accounts_q2.csv", kind: "Clients", rows: 86, ok: 84, status: "Processed", by: "Sara Khalifa", date: "28 May 2026, 11:40", note: "2 rows missing phone" },
    { file: "loyalty_points_may.csv", kind: "Loyalty", rows: 2980, ok: 2980, status: "Processed", by: "Omar Haddad", date: "26 May 2026, 09:05", note: "" },
  ];

  const AUDIT = [
    { user: "Sara Khalifa", action: "Changed tier threshold", target: "Settings · Categories", detail: "XL minimum: AED 12,000 → AED 15,000", ts: "10 Jun 2026, 06:58" },
    { user: "System", action: "Nightly tier re-assignment", target: "All clients", detail: "214 clients re-tiered (96 ↑ / 118 ↓)", ts: "10 Jun 2026, 02:00" },
    { user: "Lina Farouk", action: "Updated opt-in", target: "C1042 · Reem Al Zaabi", detail: "SMS: opted-out → opted-in (store consent form)", ts: "9 Jun 2026, 16:22" },
    { user: "Omar Haddad", action: "Uploaded file", target: "clients_master_jun.csv", detail: "2,035 of 2,043 rows imported", ts: "9 Jun 2026, 18:42" },
    { user: "Sara Khalifa", action: "Merged duplicates", target: "C1077 ← C1119", detail: "Same phone +971 50 ··· 4471; kept earlier first-purchase date", ts: "9 Jun 2026, 10:14" },
    { user: "Ravi Menon", action: "Created API key", target: "POS Bridge · production", detail: "Scope: transactions:write, clients:read", ts: "8 Jun 2026, 08:30" },
    { user: "Lina Farouk", action: "Exported report", target: "Inactive XL+ clients", detail: "CSV · 312 rows · for win-back campaign", ts: "7 Jun 2026, 13:45" },
    { user: "Omar Haddad", action: "Edited client", target: "C1015 · Harbour Line Hotels", detail: "Type: Individual → Corporate", ts: "5 Jun 2026, 15:09" },
    { user: "System", action: "Inactivity sweep", target: "All clients", detail: "41 clients marked inactive (>180 days)", ts: "5 Jun 2026, 02:00" },
    { user: "Sara Khalifa", action: "Changed user role", target: "Lina Farouk", detail: "Viewer → Editor", ts: "3 Jun 2026, 09:51" },
    { user: "Ravi Menon", action: "Revoked API key", target: "Legacy ERP sync", detail: "Key ak_live_••••8d31 disabled", ts: "2 Jun 2026, 17:28" },
    { user: "Lina Farouk", action: "Updated opt-in", target: "C1098 · Marco Rossi", detail: "Email: opted-in → opted-out (unsubscribe link)", ts: "1 Jun 2026, 12:06" },
    { user: "Omar Haddad", action: "Uploaded file", target: "pos_transactions_w22.xlsx", detail: "17,904 rows imported", ts: "1 Jun 2026, 07:12" },
    { user: "Sara Khalifa", action: "Changed tier threshold", target: "Settings · Categories", detail: "VIP minimum: AED 50,000 → AED 60,000", ts: "29 May 2026, 14:37" },
  ];

  const EXPORTS = [
    { name: "Inactive XL+ clients", format: "CSV", range: "Trailing 12 mo", by: "Lina Farouk", date: "7 Jun 2026", size: "48 KB" },
    { name: "Full client base + opt-ins", format: "XLSX", range: "All time", by: "Omar Haddad", date: "4 Jun 2026", size: "1.2 MB" },
    { name: "Category movement summary", format: "PDF", range: "Q2 2026", by: "Sara Khalifa", date: "2 Jun 2026", size: "310 KB" },
    { name: "Boutique performance", format: "XLSX", range: "May 2026", by: "Sara Khalifa", date: "1 Jun 2026", size: "204 KB" },
  ];

  // ── the order history of one client, newest first ──────────────
  // Objects are built only for the rows actually asked for. A drawer shows
  // twenty; inflating a hundred thousand rows to hand back twenty would undo
  // the reason the transactions are in typed arrays at all.
  function ordersFor(client, limit) {
    const rows = byClient[client.row] || [];
    const take = Math.min(limit || 20, rows.length);
    const out = new Array(take);
    for (let k = 0; k < take; k++) {
      const r = rows[rows.length - 1 - k];               // newest first
      out[k] = {
        date: fmtDate(dayToDate(sDay[r])),
        daysAgo: daysAgo(sDay[r]),
        amount: Math.round(sAmount[r]),
        location: LOCATIONS[sLoc[r]].name,
        product: PRODUCTS[sProduct[r]],
      };
    }
    return out;
  }

  KPI.generatedMs = Math.round((window.performance || Date).now() - T0);

  window.CRM = {
    clients, LOCATIONS, locStats, SEGMENTS, SEG_META, TIER_MIN, TYPES, MONTHS,
    revenueSeries: revenueK, activeSeries, newSeries, churnSeries,
    TRANSITIONS, PRODUCTS, TEAM, UPLOADS, AUDIT, EXPORTS, KPI, ordersFor,
    // raw transactions, for anything that wants to read them
    tx: { n: total, client: sClient, day: sDay, amount: sAmount, loc: sLoc, product: sProduct },
  };
})();
