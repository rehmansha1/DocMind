import { useCallback, useEffect, useRef, useState } from "react";
import "./LoginPage.css";
import { login, signup, forgotPassword, updatePassword } from "./services/authApi";

function MailIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <polyline points="2 4 12 14 22 4" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

function FloatingParticles() {
  return (
    <div className="login-particles">
      <div className="login-particle" />
      <div className="login-particle" />
      <div className="login-particle" />
      <div className="login-particle" />
      <div className="login-particle" />
      <div className="login-particle" />
      <div className="login-particle" />
      <div className="login-particle" />
    </div>
  );
}

function decodeJwt(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (err) {
    console.error("Error decoding JWT:", err);
    return null;
  }
}

export default function LoginPage({ onLogin, onNavigate }) {
  const [mode, setMode] = useState("login"); // "login", "signup", "forgot", "reset"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [recoveryToken, setRecoveryToken] = useState("");
  
  const cardRef = useRef(null);

  const triggerShake = useCallback(() => {
    setShaking(true);
    window.setTimeout(() => setShaking(false), 550);
  }, []);

  // Parse recovery token if present in URL
  useEffect(() => {
    const hash = window.location.hash || window.location.search;
    if (hash) {
      const params = new URLSearchParams(hash.replace(/^[#?]/, ""));
      const accessToken = params.get("access_token");
      const type = params.get("type");

      if (accessToken && (type === "recovery" || hash.includes("recovery"))) {
        setRecoveryToken(accessToken);
        setMode("reset");
        // Clear tokens from address bar
        window.history.replaceState(null, "", window.location.pathname);
      } else if (accessToken && (type === "signup" || type === "invite")) {
        const decoded = decodeJwt(accessToken);
        if (decoded) {
          onLogin({
            id: decoded.sub || decoded.email,
            email: decoded.email,
            token: accessToken,
          });
          // Clear tokens from address bar
          window.history.replaceState(null, "", window.location.pathname);
        }
      }
    }
  }, [onLogin]);

  // Re-trigger entrance animation after shake ends
  useEffect(() => {
    if (!shaking && cardRef.current) {
      cardRef.current.style.animation = "none";
      void cardRef.current.offsetHeight; // Force reflow
      cardRef.current.style.animation = "";
    }
  }, [shaking]);

  const handleSubmit = async () => {
    setError("");
    setSuccessMessage("");

    if (mode === "login") {
      if (!email.trim() || !password) {
        setError("Please enter your email and password.");
        triggerShake();
        return;
      }

      if (!/\S+@\S+\.\S+/.test(email)) {
        setError("Enter a valid email address.");
        triggerShake();
        return;
      }

      setLoading(true);
      try {
        const res = await login({ email, password, rememberMe });
        onLogin({
          ...res.user,
          token: res.session?.access_token,
        });
      } catch (loginError) {
        setError(loginError.message || "Could not connect to the server. Try again.");
        triggerShake();
      } finally {
        setLoading(false);
      }
    } else if (mode === "signup") {
      if (!email.trim() || !password || !confirmPassword) {
        setError("All fields are required.");
        triggerShake();
        return;
      }

      if (!/\S+@\S+\.\S+/.test(email)) {
        setError("Enter a valid email address.");
        triggerShake();
        return;
      }

      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        triggerShake();
        return;
      }

      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        triggerShake();
        return;
      }

      setLoading(true);
      try {
        const res = await signup({ email, password });
        if (res.session) {
          onLogin({
            ...res.user,
            token: res.session.access_token,
          });
        } else {
          setSuccessMessage(res.message || "Registration successful! Please check your email to confirm your account.");
          setMode("login");
          setEmail("");
          setPassword("");
          setConfirmPassword("");
        }
      } catch (signupError) {
        setError(signupError.message || "Failed to create workspace.");
        triggerShake();
      } finally {
        setLoading(false);
      }
    } else if (mode === "forgot") {
      if (!email.trim()) {
        setError("Please enter your email address.");
        triggerShake();
        return;
      }

      if (!/\S+@\S+\.\S+/.test(email)) {
        setError("Enter a valid email address.");
        triggerShake();
        return;
      }

      setLoading(true);
      try {
        const res = await forgotPassword({ email });
        setSuccessMessage(res.message || "Password reset instructions sent. Please check your email.");
        setMode("login");
        setEmail("");
      } catch (forgotError) {
        setError(forgotError.message || "Failed to send reset email.");
        triggerShake();
      } finally {
        setLoading(false);
      }
    } else if (mode === "reset") {
      if (!password || !confirmPassword) {
        setError("Please fill in all password fields.");
        triggerShake();
        return;
      }

      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        triggerShake();
        return;
      }

      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        triggerShake();
        return;
      }

      setLoading(true);
      try {
        const res = await updatePassword({ password, token: recoveryToken });
        setSuccessMessage(res.message || "Password updated successfully. You can now log in.");
        setMode("login");
        setPassword("");
        setConfirmPassword("");
        setRecoveryToken("");
      } catch (resetError) {
        setError(resetError.message || "Failed to reset password. Link may be expired or invalid.");
        triggerShake();
      } finally {
        setLoading(false);
      }
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      handleSubmit();
    }
  };

  const getHeading = () => {
    switch (mode) {
      case "signup": return "Create your workspace";
      case "forgot": return "Reset your password";
      case "reset": return "Set new password";
      default: return "Sign in to your workspace";
    }
  };

  const getSubtitle = () => {
    switch (mode) {
      case "signup": return "Start building your AI-powered knowledge base.";
      case "forgot": return "Enter your email to receive password reset instructions.";
      case "reset": return "Choose a strong password for your workspace.";
      default: return "Ask your documents anything, get instant answers.";
    }
  };

  const getButtonText = () => {
    if (loading) {
      switch (mode) {
        case "signup": return "Creating workspace...";
        case "forgot": return "Sending instructions...";
        case "reset": return "Updating password...";
        default: return "Signing in...";
      }
    }
    switch (mode) {
      case "signup": return "Create workspace";
      case "forgot": return "Send reset instructions";
      case "reset": return "Update password";
      default: return "Sign in";
    }
  };

  return (
    <main className="login-root">
      <div className="login-bg-glow" />
      <div className="login-bg-grid" />
      <FloatingParticles />

      <div className="login-wrap">
        <section
          ref={cardRef}
          className={`login-card${shaking ? " shake" : ""}`}
          aria-label={getHeading()}
        >
          <div className="login-card-top">
            <div className="login-logo-row">
              <div className="logo-dot" />
              <span className="login-logo-text">DocMind</span>
            </div>
            <h1 className="login-heading">{getHeading()}</h1>
            <p className="login-subtitle">{getSubtitle()}</p>
          </div>

          <div className="login-card-body">
            {error && (
              <div className="login-error-banner">
                <AlertIcon />
                {error}
              </div>
            )}

            {successMessage && (
              <div className="login-error-banner" style={{ background: "rgba(74, 222, 128, 0.08)", border: "1px solid rgba(74, 222, 128, 0.2)", color: "#4ade80" }}>
                <CheckIcon />
                {successMessage}
              </div>
            )}

            {/* Email Field (Login, Signup, Forgot Password) */}
            {mode !== "reset" && (
              <label className="login-field">
                <span className="login-field-label">Email</span>
                <span className="login-input-wrap">
                  <span className="login-field-icon">
                    <MailIcon />
                  </span>
                  <input
                    className="login-input"
                    type="email"
                    placeholder="you@company.com"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={loading}
                  />
                </span>
              </label>
            )}

            {/* Password Field (Login, Signup, Reset Password) */}
            {mode !== "forgot" && (
              <div className="login-field">
                <div className="login-field-row">
                  <label className="login-field-label" htmlFor="login-password">
                    {mode === "reset" ? "New Password" : "Password"}
                  </label>
                  {mode === "login" && (
                    <button className="login-link-button" type="button" onClick={() => { setMode("forgot"); setError(""); setSuccessMessage(""); }} disabled={loading}>
                      Forgot password?
                    </button>
                  )}
                </div>
                <span className="login-input-wrap">
                  <span className="login-field-icon">
                    <LockIcon />
                  </span>
                  <input
                    id="login-password"
                    className="login-input has-toggle"
                    type={showPassword ? "text" : "password"}
                    placeholder={mode === "reset" ? "Enter new password" : "Enter your password"}
                    autoComplete={mode === "reset" ? "new-password" : "current-password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={loading}
                  />
                  <button
                    className="login-password-toggle"
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((visible) => !visible)}
                    disabled={loading}
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </span>
              </div>
            )}

            {/* Confirm Password Field (Signup, Reset Password) */}
            {(mode === "signup" || mode === "reset") && (
              <div className="login-field">
                <label className="login-field-label" htmlFor="confirm-password">
                  Confirm Password
                </label>
                <span className="login-input-wrap">
                  <span className="login-field-icon">
                    <LockIcon />
                  </span>
                  <input
                    id="confirm-password"
                    className="login-input has-toggle"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={loading}
                  />
                  <button
                    className="login-password-toggle"
                    type="button"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowConfirmPassword((visible) => !visible)}
                    disabled={loading}
                  >
                    {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </span>
              </div>
            )}

            {/* Keep me signed in (Login mode only) */}
            {mode === "login" && (
              <button className="login-remember-row" type="button" onClick={() => setRememberMe((checked) => !checked)} disabled={loading}>
                <span className={`login-checkbox${rememberMe ? " checked" : ""}`}>{rememberMe && <CheckIcon />}</span>
                <span>Keep me signed in</span>
              </button>
            )}

            {/* Submit Button */}
            <button className="login-primary-button" type="button" disabled={loading} onClick={handleSubmit}>
              {loading ? (
                <>
                  <div className="login-spinner" />
                  {getButtonText()}
                </>
              ) : (
                <>
                  {getButtonText()}
                  <ArrowIcon />
                </>
              )}
            </button>

            {/* OAuth Dividers (Login mode only) */}
            {mode === "login" && (
              <>
                <div className="login-divider">
                  <span />
                  <small>or</small>
                  <span />
                </div>

                <div className="login-oauth-row">
                  <button className="login-oauth-button" type="button" disabled={loading}>
                    <GoogleIcon />
                    Google
                  </button>
                  <button className="login-oauth-button" type="button" disabled={loading}>
                    <GithubIcon />
                    GitHub
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="login-card-footer">
            {mode === "login" && (
              <>
                <span>No account?</span>
                <button className="login-link-button strong" type="button" onClick={() => { setMode("signup"); setError(""); setSuccessMessage(""); }} disabled={loading}>
                  Create a workspace
                </button>
              </>
            )}
            {mode === "signup" && (
              <>
                <span>Already have an account?</span>
                <button className="login-link-button strong" type="button" onClick={() => { setMode("login"); setError(""); setSuccessMessage(""); }} disabled={loading}>
                  Sign in
                </button>
              </>
            )}
            {(mode === "forgot" || mode === "reset") && (
              <button className="login-link-button strong" type="button" onClick={() => { setMode("login"); setError(""); setSuccessMessage(""); }} disabled={loading}>
                Back to sign in
              </button>
            )}
          </div>
        </section>

        <div className="login-bottom-meta">
          <a href="/pricing" onClick={(e) => { e.preventDefault(); onNavigate && onNavigate("/pricing"); }}>Pricing</a>
          <span>-</span>
          <a href="/privacy">Privacy</a>
          <span>-</span>
          <a href="/terms">Terms</a>
          <span>-</span>
          <a href="/status">Status</a>
        </div>
      </div>
    </main>
  );
}
