import { useState } from "react";
import { Lock, Mail, ArrowRight } from "lucide-react";
import { adminLogin } from "./api.js";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onLogin(await adminLogin(email, password));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="adm-login">
      <form className="adm-login-card" onSubmit={submit}>
        <img src="/images/mtm-logo.jpeg" alt="" className="adm-login-logo" onError={(e) => (e.currentTarget.style.display = "none")} />
        <h1>MTM Admin</h1>
        <p>Sign in to manage your website and enquiries.</p>

        <label className="adm-field">
          <span>Email</span>
          <div className="adm-input-icon">
            <Mail size={16} />
            <input type="email" required autoFocus autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </label>
        <label className="adm-field">
          <span>Password</span>
          <div className="adm-input-icon">
            <Lock size={16} />
            <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </label>

        {error && <p className="adm-form-error" role="alert">{error}</p>}

        <button className="adm-btn primary block" disabled={busy}>
          {busy ? "Signing in…" : <>Sign in <ArrowRight size={16} /></>}
        </button>
        <a className="adm-login-back" href="/">← Back to website</a>
      </form>
    </div>
  );
}
