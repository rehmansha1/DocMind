import { useState } from "react";

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@400;500&family=Syne:wght@400;500;600;700&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0a0a0f;
    --surface: #111118;
    --surface2: #18181f;
    --surface3: #1e1e28;
    --border: rgba(255,255,255,0.07);
    --border2: rgba(255,255,255,0.12);
    --accent: #7c6af7;
    --accent2: #a89ff8;
    --accent-glow: rgba(124,106,247,0.15);
    --text: #f0effe;
    --text2: #9896b0;
    --text3: #5a5870;
    --danger: #f87171;
    --font-display: 'DM Serif Display', Georgia, serif;
    --font-ui: 'Syne', system-ui, sans-serif;
    --font-mono: 'DM Mono', monospace;
    --r: 12px;
    --r-sm: 8px;
    --r-lg: 18px;
  }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--font-ui);
  }

  /* ── Layout ── */
  .login-root {
    min-height: 100vh;
    background: var(--bg);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-ui);
    color: var(--text);
    position: relative;
    overflow: hidden;
    padding: 24px;
  }

  .login-bg-glow {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 60% 50% at 50% -10%, rgba(124,106,247,0.12) 0%, transparent 70%),
      radial-gradient(ellipse 40% 30% at 80% 90%, rgba(124,106,247,0.06) 0%, transparent 60%);
    pointer-events: none;
  }

  .login-bg-grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
    background-size: 48px 48px;
    mask-image: radial-gradient(ellipse 80% 60% at 50% 50%, black 0%, transparent 70%);
    pointer-events: none;
  }

  .login-wrap {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
  }

  /* ── Card ── */
  .login-card {
    width: 100%;
    background: var(--surface);
    border: 1px solid var(--border2);
    border-radius: 20px;
    overflow: hidden;
  }

  .card-top {
    padding: 32px 32px 28px;
    border-bottom: 1px solid var(--border);
  }

  .logo-row {
    display: flex;
    align-items: center;
    gap: 9px;
    margin-bottom: 24px;
  }

  .logo-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 12px rgba(124,106,247,0.7);
    animation: pulse-dot 2s ease-in-out infinite;
  }

  @keyframes pulse-dot {
    0%, 100% { opacity: 1; box-shadow: 0 0 12px rgba(124,106,247,0.7); }
    50% { opacity: 0.5; box-shadow: 0 0 5px rgba(124,106,247,0.3); }
  }

  .logo-text {
    font-family: var(--font-display);
    font-size: 20px;
    color: var(--text);
    letter-spacing: -0.3px;
  }

  .card-heading {
    font-size: 22px;
    font-weight: 600;
    color: var(--text);
    line-height: 1.2;
    margin-bottom: 6px;
  }

  .card-sub {
    font-size: 13px;
    color: var(--text2);
    line-height: 1.5;
  }

  /* ── Body ── */
  .card-body {
    padding: 28px 32px 32px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* ── Error banner ── */
  .error-banner {
    display: flex;
    align-items: center;
    gap: 7px;
    background: rgba(248,113,113,0.08);
    border: 1px solid rgba(248,113,113,0.2);
    border-radius: var(--r-sm);
    padding: 9px 12px;
    font-size: 12.5px;
    color: var(--danger);
    animation: fadeUp 0.2s ease;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── Field ── */
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text2);
    letter-spacing: 0.04em;
  }

  .field-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .field-input-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .field-icon {
    position: absolute;
    left: 13px;
    color: var(--text3);
    display: flex;
    pointer-events: none;
    transition: color 0.15s;
  }

  .field-input-wrap:focus-within .field-icon {
    color: var(--accent2);
  }

  .field-input {
    width: 100%;
    background: var(--surface2);
    border: 1px solid var(--border2);
    border-radius: var(--r-sm);
    color: var(--text);
    font-family: var(--font-ui);
    font-size: 13.5px;
    padding: 10px 13px 10px 38px;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
    -webkit-appearance: none;
  }

  .field-input::placeholder { color: var(--text3); }

  .field-input:hover { border-color: rgba(255,255,255,0.18); }

  .field-input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-glow);
  }

  .field-input.has-toggle { padding-right: 38px; }

  /* ── Password toggle ── */
  .pw-toggle {
    position: absolute;
    right: 11px;
    background: none;
    border: none;
    color: var(--text3);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: color 0.15s;
  }

  .pw-toggle:hover { color: var(--text2); }

  /* ── Forgot link ── */
  .forgot-link {
    font-size: 11.5px;
    color: var(--accent2);
    font-weight: 500;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    font-family: var(--font-ui);
    transition: color 0.15s;
  }

  .forgot-link:hover { color: var(--text); }

  /* ── Remember me ── */
  .remember-row {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    user-select: none;
    margin-top: -4px;
  }

  .custom-checkbox {
    width: 16px;
    height: 16px;
    min-width: 16px;
    border-radius: 4px;
    border: 1px solid var(--border2);
    background: var(--surface2);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
  }

  .custom-checkbox.checked {
    background: var(--accent);
    border-color: var(--accent);
  }

  .remember-label {
    font-size: 12px;
    color: var(--text2);
  }

  /* ── Primary button ── */
  .btn-primary {
    width: 100%;
    padding: 11px;
    background: var(--accent);
    border: none;
    border-radius: var(--r-sm);
    color: white;
    font-family: var(--font-ui);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: background 0.15s, transform 0.1s;
    letter-spacing: 0.01em;
  }

  .btn-primary:hover:not(:disabled) { background: #9183f8; }
  .btn-primary:active:not(:disabled) { transform: scale(0.99); }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  /* ── Divider ── */
  .divider {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .divider-line {
    flex: 1;
    height: 1px;
    background: var(--border);
  }

  .divider-text {
    font-size: 11px;
    color: var(--text3);
    font-family: var(--font-mono);
    letter-spacing: 0.05em;
  }

  /* ── OAuth buttons ── */
  .oauth-row {
    display: flex;
    gap: 8px;
  }

  .btn-oauth {
    flex: 1;
    padding: 10px;
    background: var(--surface2);
    border: 1px solid var(--border2);
    border-radius: var(--r-sm);
    color: var(--text2);
    font-family: var(--font-ui);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }

  .btn-oauth:hover {
    background: var(--surface3);
    border-color: rgba(255,255,255,0.18);
    color: var(--text);
  }

  /* ── Footer ── */
  .card-footer {
    padding: 16px 32px;
    border-top: 1px solid var(--border);
    background: var(--surface2);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  .footer-text {
    font-size: 12.5px;
    color: var(--text3);
  }

  .signup-link {
    font-size: 12.5px;
    color: var(--accent2);
    font-weight: 600;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    font-family: var(--font-ui);
    transition: color 0.15s;
  }

  .signup-link:hover { color: var(--text); }

  /* ── Bottom meta ── */
  .bottom-meta {
    font-size: 11px;
    color: var(--text3);
    font-family: var(--font-mono);
    letter-spacing: 0.05em;
    display: flex;
    gap: 4px;
    align-items: center;
  }

  .bottom-meta a {
    color: var(--text3);
    text-decoration: none;
    transition: color 0.15s;
  }

  .bottom-meta a:hover { color: var(--text2); }

  .bottom-meta-sep { opacity: 0.35; margin: 0 4px; }

  /* ── Mobile ── */
  @media (max-width: 480px) {
    .card-top,
    .card-body { padding-left: 20px; padding-right: 20px; }
    .card-footer { padding-left: 20px; padding-right: 20px; }
  }
`;

function IconMail() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <polyline points="2 4 12 14 22 4" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function IconEye() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function IconArrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function IconAlert() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconGoogle() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function IconGithub() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

export default function Login({ onLogin, onSignup, onForgotPassword }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("http://localhost:3001/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Invalid email or password.");
        return;
      }

      onLogin?.(data);
    } catch {
      setError("Couldn't connect to the server. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <>
      <style>{STYLES}</style>
      <div className="login-root">
        <div className="login-bg-glow" />
        <div className="login-bg-grid" />

        <div className="login-wrap">
          <div className="login-card">

            {/* ── Header ── */}
            <div className="card-top">
              <div className="logo-row">
                <div className="logo-dot" />
                <span className="logo-text">DocMind</span>
              </div>
              <div className="card-heading">Sign in to your workspace</div>
              <div className="card-sub">Ask your documents anything, get instant answers.</div>
            </div>

            {/* ── Body ── */}
            <div className="card-body">

              {error && (
                <div className="error-banner">
                  <IconAlert />
                  {error}
                </div>
              )}

              {/* Email */}
              <div className="field">
                <label className="field-label" htmlFor="login-email">Email</label>
                <div className="field-input-wrap">
                  <input
                    id="login-email"
                    className="field-input"
                    type="email"
                    placeholder="you@company.com"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                  <span className="field-icon"><IconMail /></span>
                </div>
              </div>

              {/* Password */}
              <div className="field">
                <div className="field-row">
                  <label className="field-label" htmlFor="login-password">Password</label>
                  <button
                    className="forgot-link"
                    type="button"
                    onClick={() => onForgotPassword?.()}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="field-input-wrap">
                  <input
                    id="login-password"
                    className="field-input has-toggle"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                  <span className="field-icon"><IconLock /></span>
                  <button
                    className="pw-toggle"
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <IconEyeOff /> : <IconEye />}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <div
                className="remember-row"
                onClick={() => setRememberMe((v) => !v)}
              >
                <div className={`custom-checkbox${rememberMe ? " checked" : ""}`}>
                  {rememberMe && <IconCheck />}
                </div>
                <span className="remember-label">Keep me signed in</span>
              </div>

              {/* Submit */}
              <button
                className="btn-primary"
                type="button"
                disabled={loading}
                onClick={handleSubmit}
              >
                {loading ? "Signing in…" : "Sign in"}
                {!loading && <IconArrow />}
              </button>

              {/* Divider */}
              <div className="divider">
                <div className="divider-line" />
                <span className="divider-text">or</span>
                <div className="divider-line" />
              </div>

              {/* OAuth */}
              <div className="oauth-row">
                <button className="btn-oauth" type="button">
                  <IconGoogle /> Google
                </button>
                <button className="btn-oauth" type="button">
                  <IconGithub /> GitHub
                </button>
              </div>

            </div>

            {/* ── Footer ── */}
            <div className="card-footer">
              <span className="footer-text">No account?</span>
              <button
                className="signup-link"
                type="button"
                onClick={() => onSignup?.()}
              >
                Create a workspace →
              </button>
            </div>
          </div>

          {/* Bottom meta */}
          <div className="bottom-meta">
            <a href="/privacy">Privacy</a>
            <span className="bottom-meta-sep">·</span>
            <a href="/terms">Terms</a>
            <span className="bottom-meta-sep">·</span>
            <a href="/status">Status</a>
          </div>
        </div>
      </div>
    </>
  );
}
