import { useEffect, useState } from "react";
import { Trash2, UserPlus, KeyRound } from "lucide-react";
import { api, fullDate } from "./api.js";
import { PageHead, useUI } from "./ui.jsx";

export default function SettingsPage({ user }) {
  const { toast, confirm } = useUI();
  const [users, setUsers] = useState([]);
  const [pw, setPw] = useState({ current: "", next: "", again: "" });
  const [nu, setNu] = useState({ name: "", email: "", password: "" });

  const load = () => api("/admin/users").then((r) => setUsers(r.users)).catch((e) => toast(e.message, "err"));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const changePw = async (e) => {
    e.preventDefault();
    if (pw.next !== pw.again) return toast("The new passwords don't match", "err");
    try {
      await api("/admin/password", { method: "POST", body: { current: pw.current, next: pw.next } });
      setPw({ current: "", next: "", again: "" });
      toast("Password changed");
    } catch (err) {
      toast(err.message, "err");
    }
  };

  const addUser = async (e) => {
    e.preventDefault();
    try {
      await api("/admin/users", { method: "POST", body: nu });
      setNu({ name: "", email: "", password: "" });
      toast("Admin added");
      load();
    } catch (err) {
      toast(err.message, "err");
    }
  };

  const remove = async (u) => {
    if (!(await confirm({ title: "Remove admin?", message: `${u.email} will no longer be able to sign in.`, danger: true, confirmText: "Remove" }))) return;
    try {
      await api(`/admin/users/${u.id}`, { method: "DELETE" });
      toast("Admin removed");
      load();
    } catch (err) {
      toast(err.message, "err");
    }
  };

  return (
    <div className="adm-page">
      <PageHead title="Settings" sub={`Signed in as ${user.email}`} />

      <div className="adm-grid2">
        <section className="adm-panel">
          <h2><KeyRound size={17} /> Change password</h2>
          <form onSubmit={changePw} className="adm-form">
            <label className="adm-field"><span>Current password</span><input type="password" required autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></label>
            <label className="adm-field"><span>New password <small>(min. 10 characters)</small></span><input type="password" required minLength={10} autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></label>
            <label className="adm-field"><span>Repeat new password</span><input type="password" required minLength={10} autoComplete="new-password" value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} /></label>
            <button className="adm-btn primary">Update password</button>
          </form>
        </section>

        <section className="adm-panel">
          <h2><UserPlus size={17} /> Add an admin</h2>
          <form onSubmit={addUser} className="adm-form">
            <label className="adm-field"><span>Name</span><input required value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} /></label>
            <label className="adm-field"><span>Email</span><input type="email" required value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} /></label>
            <label className="adm-field"><span>Temporary password <small>(min. 10 characters)</small></span><input type="password" required minLength={10} autoComplete="new-password" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} /></label>
            <button className="adm-btn primary">Add admin</button>
          </form>
        </section>
      </div>

      <section className="adm-panel">
        <h2>Admins</h2>
        <ul className="adm-users">
          {users.map((u) => (
            <li key={u.id}>
              <span className="adm-avatar">{u.name.slice(0, 1).toUpperCase()}</span>
              <div><b>{u.name}{u.id === user.id && <em className="adm-you">you</em>}</b><small>{u.email} · added {fullDate(u.created_at)}</small></div>
              {u.id !== user.id && <button className="adm-icon-btn danger" onClick={() => remove(u)} aria-label={`Remove ${u.email}`}><Trash2 size={16} /></button>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
