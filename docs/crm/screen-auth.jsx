// ── Auth: login, 2FA, forgot password + user profile ────────────
const { useState, useRef } = React;

function AuthShell({ children, sub }) {
  return (
    <div className="auth-stage" data-screen-label="Sign in">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark">AW</span>
          <div>
            <span className="brand-name">Al Waha</span>
            <span className="brand-sub">Client Intelligence</span>
          </div>
        </div>
        {children}
      </div>
      <p className="auth-foot">
        Prototype sign-in — any email and any code will let you in, and nothing is sent anywhere.
        Al Waha Gourmet is not a real company. {sub || "SSO available via Azure AD"}
      </p>
    </div>
  );
}

function LoginScreen({ onLogin, onForgot }) {
  const [email, setEmail] = useState("sara.k@alwaha.example");
  const [pw, setPw] = useState("••••••••••");
  const [err, setErr] = useState("");
  const submit = (e) => {
    e.preventDefault();
    if (!email.includes("@")) { setErr("Enter a valid work email."); return; }
    if (pw.length < 8) { setErr("Password must be at least 8 characters."); return; }
    onLogin(email);
  };
  return (
    <AuthShell>
      <h1>Sign in</h1>
      <form className="auth-form" onSubmit={submit}>
        <label className="form-label">Work email</label>
        <input className="input" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }} autoFocus />
        <label className="form-label">Password</label>
        <input className="input" type="password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} />
        {err && <p className="form-err">{err}</p>}
        <button className="btn primary wide" type="submit">Continue</button>
        <button className="link sm auth-link" type="button" onClick={onForgot}>Forgot password?</button>
      </form>
    </AuthShell>
  );
}

function TwoFAScreen({ email, onVerify, onBack }) {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [err, setErr] = useState("");
  const refs = useRef([]);
  const set = (i, v) => {
    if (!/^[0-9]?$/.test(v)) return;
    const next = [...code];
    next[i] = v;
    setCode(next);
    setErr("");
    if (v && i < 5) refs.current[i + 1].focus();
    if (next.every((d) => d !== "")) {
      setTimeout(() => onVerify(), 350);
    }
  };
  return (
    <AuthShell sub="Codes expire after 30 seconds">
      <h1>Two-factor check</h1>
      <p className="muted auth-hint">Enter the 6-digit code from your authenticator app for <b>{email}</b>. Any code works in this prototype.</p>
      <div className="otp-row">
        {code.map((d, i) => (
          <input key={i} ref={(el) => (refs.current[i] = el)} className="otp" value={d} inputMode="numeric" maxLength="1"
            autoFocus={i === 0}
            onChange={(e) => set(i, e.target.value)}
            onKeyDown={(e) => { if (e.key === "Backspace" && !d && i > 0) refs.current[i - 1].focus(); }} />
        ))}
      </div>
      {err && <p className="form-err">{err}</p>}
      <button className="link sm auth-link" onClick={onBack}>← Use a different account</button>
    </AuthShell>
  );
}

function ForgotScreen({ onBack }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <AuthShell>
      <h1>Reset password</h1>
      {!sent ? (
        <form className="auth-form" onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
          <p className="muted auth-hint">Enter your work email and we'll send a reset link. Links expire after 1 hour.</p>
          <label className="form-label">Work email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@alwaha.example" autoFocus />
          <button className="btn primary wide" type="submit" disabled={!email.includes("@")}>Send reset link</button>
        </form>
      ) : (
        <div className="auth-form">
          <p className="picked">If <b>{email}</b> has an account, a reset link is on its way. Check your inbox — and the spam folder.</p>
          <p className="muted sm">Nothing was actually sent. This screen is a mock-up.</p>
        </div>
      )}
      <button className="link sm auth-link" onClick={onBack}>← Back to sign in</button>
    </AuthShell>
  );
}

// ── Profile page (signed-in user) ───────────────────────────────
function ProfileScreen({ email, onSignOut }) {
  const me = CRM.TEAM.find((t) => t.email === email) || { name: "Sara Khalifa", role: "CRM Lead", email };
  const [notif, setNotif] = useState({ weekly: true, inactive: true, uploads: false });
  const myAudit = CRM.AUDIT.filter((a) => a.user === me.name).slice(0, 5);
  return (
    <div className="screen" data-screen-label="My profile">
      <header className="screen-head">
        <div>
          <h1>My profile</h1>
          <p className="muted">Account, security and notification preferences · <b>this staff member is invented</b></p>
        </div>
        <button className="btn ghost" onClick={onSignOut}>Sign out</button>
      </header>

      <div className="grid-2-1">
        <div className="stack">
          <section className="card">
            <div className="card-head"><h2>Account</h2></div>
            <div className="profile-head">
              <span className="avatar big">{me.name.split(" ").map((w) => w[0]).join("")}</span>
              <div>
                <h2 className="me-name">{me.name}</h2>
                <p className="muted sm">{me.role} · {me.email}</p>
              </div>
            </div>
            <dl className="detail-list">
              <div><dt>Role</dt><dd>{me.role} (Editor)</dd></div>
              <div><dt>Boutique scope</dt><dd>All boutiques</dd></div>
              <div><dt>Member since</dt><dd>Mar 2023</dd></div>
              <div><dt>Last sign-in</dt><dd>Today, 07:02 GST · Dubai</dd></div>
            </dl>
          </section>

          <section className="card">
            <div className="card-head"><h2>My recent activity</h2></div>
            <div className="audit-list">
              {myAudit.map((a, i) => (
                <div key={i} className="audit-row">
                  <div className="audit-main">
                    <p><b>{a.action}</b> — <span className="audit-target">{a.target}</span></p>
                    <p className="audit-detail muted">{a.detail}</p>
                  </div>
                  <span className="muted sm audit-ts">{a.ts}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="stack">
          <section className="card">
            <div className="card-head"><h2>Security</h2></div>
            <div className="sec-row">
              <div><b>Password</b><span className="muted sm">last changed 41 days ago</span></div>
              <button className="btn ghost sm-btn">Change…</button>
            </div>
            <div className="sec-row">
              <div><b>Two-factor authentication</b><span className="muted sm">authenticator app · enabled</span></div>
              <span className="status-pill act"><i></i>On</span>
            </div>
            <div className="sec-row">
              <div><b>Active sessions</b><span className="muted sm">2 devices · Dubai, Sharjah</span></div>
              <button className="btn ghost sm-btn">Review</button>
            </div>
          </section>

          <section className="card">
            <div className="card-head"><h2>Email notifications</h2></div>
            {[["weekly", "Weekly KPI digest", "Mondays 08:00"], ["inactive", "Clients turning inactive", "daily summary"], ["uploads", "Upload failures", "immediately"]].map(([k, label, sub]) => (
              <div key={k} className="sec-row">
                <div><b>{label}</b><span className="muted sm">{sub}</span></div>
                <button className={"toggle" + (notif[k] ? " on" : "")} onClick={() => setNotif({ ...notif, [k]: !notif[k] })} aria-label={label}><i></i></button>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { LoginScreen, TwoFAScreen, ForgotScreen, ProfileScreen });
