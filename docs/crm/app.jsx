// ── App shell: auth, sidebar, router, mobile/desktop, tweaks ────
const { useState, useEffect } = React;

const NAV = [
  { id: "overview", label: "Overview", icon: "M3 13h7V3H3zM12 21h7v-8h-7zM3 21h7v-6H3zM12 9h7V3h-7z" },
  { id: "clients", label: "Clients", icon: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 4-6 8-6s8 2 8 6" },
  { id: "segmentation", label: "Categories", icon: "M12 3a9 9 0 109 9h-9z M14 2a8 8 0 018 8h-8z" },
  { id: "trends", label: "Status Trends", icon: "M3 17l5-6 4 4 6-8 3 4" },
  { id: "locations", label: "Locations", icon: "M12 21s-7-6.2-7-11a7 7 0 1114 0c0 4.8-7 11-7 11zM12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" },
];
const NAV2 = [
  { id: "data", label: "Data Sources", icon: "M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3zM4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" },
  { id: "reports", label: "Reports", icon: "M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9zM14 3v6h6M9 13h6M9 17h6" },
  { id: "audit", label: "Audit Log", icon: "M12 8v5l3 2M21 12a9 9 0 11-9-9 9 9 0 019 9z" },
];

const SCREENS = () => ({
  overview: OverviewScreen,
  clients: ClientsScreen,
  segmentation: SegmentationScreen,
  trends: TrendsScreen,
  locations: LocationsScreen,
  data: DataScreen,
  reports: ReportsScreen,
  audit: AuditScreen,
  profile: ProfileScreen,
});

const PALETTES = {
  "Oasis (green · gold)": { accent: "#1E5C49", accent2: "#B98A3E", bg: "#F6F3EC", ink: "#211F1A" },
  "Date (burgundy · brass)": { accent: "#6E2B35", accent2: "#A8823F", bg: "#F7F2EE", ink: "#241B18" },
  "Majlis (midnight · teal)": { accent: "#1B3A5B", accent2: "#2E8B8B", bg: "#F2F4F5", ink: "#1A2026" },
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": "Oasis (green · gold)",
  "density": "regular",
  "radius": 14,
  "activeDays": 180,
  "startSignedOut": true
}/*EDITMODE-END*/;

const NavIcon = ({ d, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={d}></path></svg>
);

function ViewToggle({ view, setView, floating }) {
  return (
    <div className={"view-toggle" + (floating ? " floating" : "")} title="Preview the portal on desktop or mobile">
      {[["desktop", "PC"], ["mobile", "Mobile"]].map(([v, l]) => (
        <button key={v} className={view === v ? "on" : ""} onClick={() => setView(v)}>{l}</button>
      ))}
    </div>
  );
}

// ── Mobile chrome: top bar + bottom tabs + "more" sheet ─────────
function MobileChrome({ route, go, me, signOut, t }) {
  const [more, setMore] = useState(false);
  const Screen = SCREENS()[route.screen];
  const TABS = NAV.slice(0, 4);
  const moreItems = [...NAV.slice(4), ...NAV2, { id: "profile", label: "My Profile", icon: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 4-6 8-6s8 2 8 6" }];
  const inMore = !TABS.some((n) => n.id === route.screen);
  return (
    <React.Fragment>
      <header className="m-topbar">
        <span className="brand-mark">AW</span>
        <div>
          <span className="brand-name">Al Waha</span>
          <span className="brand-sub">Client Intelligence · demo</span>
        </div>
      </header>
      <main className="m-main">
        <Screen params={route.params} go={go} activeDays={t.activeDays} email={me.email} onSignOut={signOut} />
      </main>
      <nav className="m-tabs">
        {TABS.map((n) => (
          <button key={n.id} className={route.screen === n.id ? "on" : ""} onClick={() => { setMore(false); go(n.id); }}>
            <NavIcon d={n.icon} size={20} />
            <span>{n.label === "Status Trends" ? "Trends" : n.label}</span>
          </button>
        ))}
        <button className={more || inMore ? "on" : ""} onClick={() => setMore(!more)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16"></path></svg>
          <span>More</span>
        </button>
      </nav>
      {more && (
        <div className="m-sheet-veil" onClick={() => setMore(false)}>
          <div className="m-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="m-sheet-grab"></div>
            {moreItems.map((n) => (
              <button key={n.id} className={"m-sheet-row" + (route.screen === n.id ? " on" : "")} onClick={() => { setMore(false); go(n.id); }}>
                <NavIcon d={n.icon} />
                {n.label}
              </button>
            ))}
            <button className="m-sheet-row signout-row" onClick={signOut}>
              <NavIcon d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </React.Fragment>
  );
}

// Is this an actual small screen, as opposed to a desktop previewing one?
//
// The distinction matters because "mobile" in this app meant two different
// things. The PC/Mobile switch is a DESIGN PREVIEW: it draws the phone layout
// inside a simulated iPhone so the two can be compared on one desktop screen.
// A real phone needs the same layout with none of the pretence — no bezel, no
// status bar, no toggle offering to go back to a desktop layout that does not
// fit. Without this the app fell back to the desktop shell, whose narrowest
// breakpoint is 1100px, so a 412px phone got the 232px sidebar and ~85px KPI
// columns.
function useHandheld(query = "(max-width: 860px)") {
  const [is, setIs] = useState(
    () => typeof window.matchMedia === "function" && window.matchMedia(query).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(query);
    const on = (e) => setIs(e.matches);
    // addListener is the pre-2019 Safari spelling; still worth the two lines.
    if (mq.addEventListener) mq.addEventListener("change", on);
    else mq.addListener(on);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", on);
      else mq.removeListener(on);
    };
  }, [query]);
  return is;
}

// Shown in the gap between "the app is on screen" and "the data exists".
// In practice a signed-out visitor never sees it: generation starts on the
// first frame and finishes long before anyone has typed an email.
function Preparing() {
  return (
    <div className="prep">
      <span className="brand-mark">AW</span>
      <p>Preparing the client base…</p>
      <span className="prep-sub">2,000 clients · 100,017 purchases, generated in your browser</span>
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const handheld = useHandheld();

  // THE PAGE PAINTS FIRST, THE DATA ARRIVES SECOND.
  //
  // Building the dataset costs ~265 ms on a laptop and ~2.2 s on a mid-range
  // phone. Run at import — which is where it used to be — that time is spent
  // on a blank white page before React has mounted anything. Run after the
  // first frame, it is spent behind the sign-in screen, while the visitor
  // reads it. The work is identical; only who waits for it changes.
  const [dataReady, setDataReady] = useState(() => !!CRM.ready);
  useEffect(() => {
    if (CRM.ready) return;
    let cancelled = false;
    const run = () => { if (!cancelled) { CRM.generate(); setDataReady(true); } };
    // Two frames, not one: the first commits the DOM, the second lets the
    // browser actually paint it before the main thread is taken for a second.
    const id = requestAnimationFrame(() => requestAnimationFrame(run));
    return () => { cancelled = true; cancelAnimationFrame(id); };
  }, []);
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem("alwaha_session")) || null; } catch { return null; }
  });
  const [authView, setAuthView] = useState("login"); // login | 2fa | forgot
  const [pendingEmail, setPendingEmail] = useState("");
  const [view, setViewRaw] = useState(() => localStorage.getItem("alwaha_view") || "desktop");
  const setView = (v) => { setViewRaw(v); localStorage.setItem("alwaha_view", v); };
  const [route, setRoute] = useState({ screen: "overview", params: {} });
  const go = (screen, params = {}) => {
    setRoute({ screen, params });
    window.scrollTo(0, 0);
    const m = document.querySelector(".m-main");
    if (m) m.scrollTo(0, 0);
  };
  const pal = PALETTES[t.palette] || PALETTES["Oasis (green · gold)"];

  useEffect(() => {
    const r = document.documentElement.style;
    r.setProperty("--accent", pal.accent);
    r.setProperty("--accent-2", pal.accent2);
    r.setProperty("--bg", pal.bg);
    r.setProperty("--ink", pal.ink);
    r.setProperty("--radius", t.radius + "px");
    document.body.dataset.density = t.density;
    document.body.dataset.view = view;
    document.body.dataset.device = handheld ? "handheld" : "desktop";
  }, [t, view, handheld]);

  const signIn = (email) => {
    const s = { email, at: Date.now() };
    localStorage.setItem("alwaha_session", JSON.stringify(s));
    setSession(s);
    setAuthView("login");
    go("overview");
  };
  const signOut = () => {
    localStorage.removeItem("alwaha_session");
    setSession(null);
    setAuthView("login");
  };

  const tweaks = (
    <TweaksPanel>
      <TweakSection label="Theme" />
      <TweakSelect label="Palette" value={t.palette} options={Object.keys(PALETTES)} onChange={(v) => setTweak("palette", v)} />
      <TweakSlider label="Corner radius" value={t.radius} min={4} max={22} unit="px" onChange={(v) => setTweak("radius", v)} />
      <TweakSection label="Layout" />
      <TweakRadio label="Density" value={t.density} options={["compact", "regular", "comfy"]} onChange={(v) => setTweak("density", v)} />
      <TweakSection label="Business rules" />
      <TweakSlider label="Inactive after" value={t.activeDays} min={30} max={365} step={15} unit="d" onChange={(v) => setTweak("activeDays", v)} />
      <TweakSection label="Demo" />
      <TweakToggle label="Require sign-in" value={t.startSignedOut} onChange={(v) => setTweak("startSignedOut", v)} />
      <TweakButton label="Reset session" onClick={signOut} />
    </TweaksPanel>
  );

  const needsAuth = !session && t.startSignedOut;
  const authContent = needsAuth && (
    <React.Fragment>
      {authView === "login" && <LoginScreen onLogin={(email) => { setPendingEmail(email); setAuthView("2fa"); }} onForgot={() => setAuthView("forgot")} />}
      {authView === "2fa" && <TwoFAScreen email={pendingEmail} onVerify={() => signIn(pendingEmail)} onBack={() => setAuthView("login")} />}
      {authView === "forgot" && <ForgotScreen onBack={() => setAuthView("login")} />}
    </React.Fragment>
  );

  const email = session ? session.email : "sara.k@alwaha.example";
  const me = CRM.TEAM.find((u) => u.email === email) || CRM.TEAM[0];

  // ── Real handheld ─────────────────────────────────────────────
  // The phone layout, full-bleed. `phone-app` carries every mobile content
  // adaptation in the stylesheet, so it is kept; `is-live` is what tells the
  // CSS there is no simulated device around it to leave room for.
  if (handheld) {
    return (
      <React.Fragment>
        {needsAuth ? authContent : (
          <div className="phone-app is-live">
            {dataReady
              ? <MobileChrome route={route} go={go} me={me} signOut={signOut} t={t} />
              : <Preparing />}
          </div>
        )}
        {tweaks}
      </React.Fragment>
    );
  }

  // ── Mobile PREVIEW (desktop only) ─────────────────────────────
  if (view === "mobile") {
    return (
      <React.Fragment>
        <div className="mobile-stage" data-screen-label="Mobile view">
          <IOSDevice width={402} height={820}>
            <div className="phone-app">
              {needsAuth ? authContent : <MobileChrome route={route} go={go} me={me} signOut={signOut} t={t} />}
            </div>
          </IOSDevice>
        </div>
        <ViewToggle view={view} setView={setView} floating />
        {tweaks}
      </React.Fragment>
    );
  }

  // ── Desktop view ──────────────────────────────────────────────
  if (needsAuth) {
    return (
      <React.Fragment>
        {authContent}
        <ViewToggle view={view} setView={setView} floating />
        {tweaks}
      </React.Fragment>
    );
  }

  const Screen = SCREENS()[route.screen];

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="brand">
          <span className="brand-mark">AW</span>
          <div>
            <span className="brand-name">Al Waha</span>
            <span className="brand-sub">Client Intelligence</span>
          </div>
        </div>
        <div className="nav-list">
          {NAV.map((n) => (
            <button key={n.id} className={"nav-item" + (route.screen === n.id ? " on" : "")} onClick={() => go(n.id)}>
              <NavIcon d={n.icon} />
              {n.label}
            </button>
          ))}
          <div className="nav-sep">Manage</div>
          {NAV2.map((n) => (
            <button key={n.id} className={"nav-item" + (route.screen === n.id ? " on" : "")} onClick={() => go(n.id)}>
              <NavIcon d={n.icon} />
              {n.label}
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <ViewToggle view={view} setView={setView} />
          <div className="sidebar-foot">
            <button className={"user" + (route.screen === "profile" ? " on" : "")} onClick={() => go("profile")} title="My profile">
              <span className="avatar">{me.name.split(" ").map((w) => w[0]).join("")}</span>
              <div>
                <span className="user-name">{me.name}</span>
                <span className="user-role muted">{me.role}</span>
              </div>
            </button>
            <button className="signout" onClick={signOut} title="Sign out">
              <NavIcon d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" size={16} />
            </button>
          </div>
        </div>
      </nav>

      <main className="main">
        {dataReady
          ? <Screen params={route.params} go={go} activeDays={t.activeDays} email={email} onSignOut={signOut} />
          : <Preparing />}
      </main>

      {tweaks}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
