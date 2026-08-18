// ── Al Waha Gourmet · CRM mock data ─────────────────────────────
// Seeded PRNG so data is stable across reloads.
//
// EVERY NAME IN THIS FILE IS INVENTED. Al Waha Gourmet is not a company, the
// corporate accounts are not businesses, the boutiques are not places, and the
// staff are not people. Contact details use the RFC 2606 reserved `.example`
// domains on purpose: a demo record must not be able to address a real
// mailbox, however plausible it is made to look.
(function () {
  let seed = 20260610;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const ri = (min, max) => Math.floor(min + rnd() * (max - min + 1));

  const FIRST = ["Mariam", "Ahmed", "Fatima", "Khalid", "Noora", "Saeed", "Aisha", "Omar", "Hessa", "Rashid", "Layla", "Hamdan", "Salama", "Yousef", "Reem", "Majid", "Shamma", "Tariq", "Alia", "Faisal", "Priya", "Arjun", "Elena", "Sophie", "James", "Chen", "Anastasia", "Marco", "Yuki", "Daniel"];
  const LAST = ["Al Maktoum", "Al Falasi", "Al Suwaidi", "Al Mansoori", "Al Shamsi", "Al Marri", "Al Qubaisi", "Al Hammadi", "Al Zaabi", "Al Nuaimi", "Sharma", "Patel", "Petrova", "Laurent", "Whitfield", "Wang", "Volkova", "Rossi", "Tanaka", "Okonkwo"];
  // Invented corporate accounts. The originals in the design named real
  // hospitality companies; attaching fabricated spend figures to identifiable
  // businesses is not something a public portfolio page should do.
  const CORP = ["Harbour Line Hotels", "Golden Sands Catering", "Crescent Bay Hospitality", "Palm Court Events", "Silk Route Lounges", "Desert Rose Resorts", "Blue Lagoon F&B", "Cedar House Catering", "Marina Heights Group", "Oasis Terrace Dining"];

  // Invented retail locations, for the same reason.
  const LOCATIONS = [
    { id: "dxm", name: "Downtown Gallery", city: "Dubai", share: 0.30 },
    { id: "moe", name: "Westside Mall", city: "Dubai", share: 0.22 },
    { id: "cwk", name: "Beachside Walk", city: "Dubai", share: 0.13 },
    { id: "gal", name: "Harbour Arcade", city: "Abu Dhabi", share: 0.17 },
    { id: "yas", name: "Island Mall", city: "Abu Dhabi", share: 0.10 },
    { id: "shj", name: "Northgate Centre", city: "Sharjah", share: 0.08 },
  ];

  // ── Size categories by trailing-12-month spend ────────────────
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

  const PRODUCTS = ["Royal Khalas Dates 1kg", "Sukkari Gift Box", "Date & Pistachio Pralines", "Saffron Honey 250g", "Camel Milk Chocolate", "Medjool Premium Tray", "Arabic Coffee Sampler", "Ramadan Hamper Grande", "Stuffed Dates Assortment", "Oud-Infused Chocolate Bar"];
  const MN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const TODAY = new Date(2026, 5, 10);
  const fmtDate = (d) => d.getDate() + " " + MN[d.getMonth()] + " " + d.getFullYear();

  // ── Clients ───────────────────────────────────────────────────
  const clients = [];
  for (let i = 0; i < 132; i++) {
    const type = rnd() < 0.78 ? "Individual" : rnd() < 0.6 ? "Corporate" : "HoReCa";
    const name = type === "Individual" ? pick(FIRST) + " " + pick(LAST) : pick(CORP) + (rnd() < 0.4 ? " — Procurement" : "");
    const mult = type === "Individual" ? 1 : type === "Corporate" ? 2.2 : 3;
    const spend12m = Math.round(350 * Math.pow(220, rnd()) * mult);
    const seg = tierOf(spend12m);
    const si = SEGMENTS.indexOf(seg);
    const basket = type === "Individual" ? ri(140, 850) : ri(1400, 5500);
    const orders12m = Math.max(1, Math.round(spend12m / basket));
    const avgOrder = Math.round(spend12m / orders12m);
    // bigger tiers buy more recently
    const lastDays = Math.max(1, Math.round(Math.pow(rnd(), 1.4) * (40 + si * 55)));
    const lastPurchase = new Date(TODAY.getTime() - lastDays * 864e5);
    const sinceYear = 2018 + ri(0, 7);
    const firstPurchase = new Date(Math.min(new Date(sinceYear, ri(0, 11), ri(1, 28)).getTime(), lastPurchase.getTime() - 30 * 864e5));
    const monthly = Array.from({ length: 12 }, () => (rnd() < Math.min(orders12m / 10, 0.85) + 0.12 ? Math.round(avgOrder * (0.4 + rnd() * 1.4)) : 0));
    // previous-quarter category: mostly stable, some adjacent moves
    const r = rnd();
    const prevSeg = r < 0.62 ? seg : SEGMENTS[Math.max(0, Math.min(SEGMENTS.length - 1, si + (r < 0.81 ? 1 : -1)))];
    // contact + opt-ins — reserved .example domains only
    const slug = name.toLowerCase().replace(/[^a-z ]/g, "").trim().split(/ +/).join(".");
    const email = type === "Individual" ? slug + "@" + pick(["example.com", "example.org", "example.net"]) : "procurement@" + slug.split(".")[0] + ".example";
    const phone = type === "Individual" ? "+971 5" + pick(["0", "2", "4", "5", "6", "8"]) + " " + ri(100, 999) + " " + ri(1000, 9999) : "+971 4 " + ri(200, 899) + " " + ri(1000, 9999);
    const optIn = { email: rnd() < 0.74, sms: rnd() < 0.58, phone: rnd() < 0.36 };
    clients.push({
      id: "C" + String(1001 + i),
      name, type, seg, prevSeg,
      loc: pick(LOCATIONS).id,
      spend12m, avgOrder, orders12m,
      lastDays,
      firstStr: fmtDate(firstPurchase),
      lastStr: fmtDate(lastPurchase),
      sinceYear,
      monthly,
      favorite: pick(PRODUCTS),
      points: Math.round(spend12m / 10),
      email, phone, optIn,
    });
  }
  clients.sort((a, b) => b.spend12m - a.spend12m);

  // ── Time series (18 months) ──────────────────────────────────
  const MONTHS = [];
  for (let k = 17; k >= 0; k--) {
    const d = new Date(2026, 5 - k, 1);
    MONTHS.push(MN[d.getMonth()] + (d.getMonth() === 0 || k === 17 ? " ’" + String(d.getFullYear()).slice(2) : ""));
  }
  const seasonal = (i) => 1 + 0.45 * Math.sin((i + 3) / 2.4) + (i % 12 === 2 || i % 12 === 14 ? 0.55 : 0); // Ramadan-ish bumps
  const revenueSeries = MONTHS.map((_, i) => Math.round(1480 + i * 26 + 420 * seasonal(i) + rnd() * 160)); // in AED '000
  const activeSeries = MONTHS.map((_, i) => Math.round(2350 + i * 38 + 130 * Math.sin(i / 2.1) + rnd() * 60));
  const newSeries = MONTHS.map((_, i) => Math.round(118 + 40 * seasonal(i) * 0.7 + rnd() * 30));
  const churnSeries = MONTHS.map((_, i) => Math.round(72 + 22 * Math.sin(i / 1.7 + 2) + rnd() * 24));

  // ── Category transition matrix (last quarter, counts) ────────
  // rows: from, cols: to · mostly diagonal + adjacent-tier moves
  const baseSize = { VIP: 130, XXL: 240, XL: 430, L: 660, M: 920, S: 1080, XS: 740, XXS: 520 };
  const TRANSITIONS = {};
  SEGMENTS.forEach((f, fi) => {
    TRANSITIONS[f] = {};
    SEGMENTS.forEach((t, ti) => {
      const d = Math.abs(fi - ti);
      let v;
      if (f === t) v = Math.round(baseSize[f] * (0.78 + rnd() * 0.1));
      else if (d === 1) v = Math.round(baseSize[f] * (0.03 + rnd() * 0.06));
      else if (d === 2) v = Math.round(baseSize[f] * rnd() * 0.018);
      else v = rnd() < 0.88 ? 0 : ri(1, 4);
      TRANSITIONS[f][t] = v;
    });
  });

  // ── Location stats ────────────────────────────────────────────
  const locStats = LOCATIONS.map((l, idx) => ({
    ...l,
    revenue: Math.round(28400 * l.share * (0.92 + rnd() * 0.16)), // AED '000 / 12mo
    clients: Math.round(3120 * l.share * (0.9 + rnd() * 0.2)),
    avgBasket: ri(265, 520),
    retention: ri(58, 84),
    growth: [12.4, 8.1, 15.2, 6.8, 4.2, -2.1][idx],
  }));

  // ── Team, uploads, audit trail, exports ───────────────────────
  const TEAM = [
    { id: "u1", name: "Sara Khalifa", role: "CRM Lead", email: "sara.k@alwaha.example" },
    { id: "u2", name: "Omar Haddad", role: "Data Analyst", email: "omar.h@alwaha.example" },
    { id: "u3", name: "Lina Farouk", role: "Marketing Manager", email: "lina.f@alwaha.example" },
    { id: "u4", name: "Ravi Menon", role: "IT Integration", email: "ravi.m@alwaha.example" },
  ];

  const UPLOADS = [
    { file: "clients_master_jun.csv", kind: "Clients", rows: 3128, ok: 3120, status: "Processed", by: "Omar Haddad", date: "9 Jun 2026, 18:42", note: "8 rows skipped — duplicate IDs" },
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
    { user: "Omar Haddad", action: "Uploaded file", target: "clients_master_jun.csv", detail: "3,120 of 3,128 rows imported", ts: "9 Jun 2026, 18:42" },
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

  window.CRM = { clients, LOCATIONS, locStats, SEGMENTS, SEG_META, TIER_MIN, TYPES, MONTHS, revenueSeries, activeSeries, newSeries, churnSeries, TRANSITIONS, PRODUCTS, TEAM, UPLOADS, AUDIT, EXPORTS };
})();
