import { useEffect, useState } from "react";
import { LayoutDashboard, Inbox, FileText, Image as ImageIcon, Settings as Cog, LogOut, ExternalLink, Menu } from "lucide-react";
import { useLocation, Link, navigate } from "../router.jsx";
import { api, adminLogout, hasSession } from "./api.js";
import { UIProvider, Spinner } from "./ui.jsx";
import Login from "./Login.jsx";
import Dashboard from "./Dashboard.jsx";
import Enquiries from "./Enquiries.jsx";
import ContentEditor from "./ContentEditor.jsx";
import Media from "./Media.jsx";
import SettingsPage from "./Settings.jsx";
import "./admin.css";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/enquiries", label: "Enquiries", icon: Inbox },
  { to: "/admin/content", label: "Site content", icon: FileText },
  { to: "/admin/media", label: "Media", icon: ImageIcon },
  { to: "/admin/settings", label: "Settings", icon: Cog },
];

export default function AdminApp() {
  return (
    <UIProvider>
      <Gate />
    </UIProvider>
  );
}

function Gate() {
  const [user, setUser] = useState(undefined); // undefined = checking, null = signed out

  useEffect(() => {
    document.title = "MTM Admin";
    if (!hasSession()) setUser(null);
    else api("/auth/me").then((r) => setUser(r.user)).catch(() => setUser(null));
    const out = () => setUser(null);
    window.addEventListener("admin-unauthorized", out);
    return () => window.removeEventListener("admin-unauthorized", out);
  }, []);

  if (user === undefined) return <div className="adm adm-center"><Spinner /></div>;
  if (!user) return <div className="adm"><Login onLogin={setUser} /></div>;
  return <Shell user={user} onLogout={() => setUser(null)} />;
}

function Shell({ user, onLogout }) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [newCount, setNewCount] = useState(0);

  // keep the "new enquiries" badge fresh
  useEffect(() => {
    let live = true;
    const load = () => api("/admin/stats").then((s) => live && setNewCount(s.enquiries.byStatus.new)).catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    window.addEventListener("enquiries-changed", load);
    return () => {
      live = false;
      clearInterval(t);
      window.removeEventListener("enquiries-changed", load);
    };
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  const logout = () => {
    adminLogout();
    onLogout();
    navigate("/admin");
  };

  let page;
  if (pathname === "/admin") page = <Dashboard />;
  else if (pathname === "/admin/enquiries") page = <Enquiries />;
  else if (pathname === "/admin/content" || pathname.startsWith("/admin/content/")) page = <ContentEditor section={pathname.split("/")[3]} />;
  else if (pathname === "/admin/media") page = <Media />;
  else if (pathname === "/admin/settings") page = <SettingsPage user={user} />;
  else page = <div className="adm-page"><h1>Page not found</h1><Link to="/admin">Back to dashboard</Link></div>;

  return (
    <div className="adm adm-shell">
      <aside className={`adm-side ${open ? "open" : ""}`}>
        <div className="adm-brand">
          <span className="adm-brand-mark">M</span>
          <div><b>MTM Admin</b><small>Projects Management</small></div>
        </div>
        <nav>
          {NAV.map(({ to, label, icon: Icon, exact }) => {
            const active = exact ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
            return (
              <Link key={to} to={to} className={active ? "active" : ""}>
                <Icon size={18} /> {label}
                {to === "/admin/enquiries" && newCount > 0 && <em className="adm-badge">{newCount}</em>}
              </Link>
            );
          })}
        </nav>
        <div className="adm-side-foot">
          <a href="/" target="_blank" rel="noopener noreferrer"><ExternalLink size={16} /> View website</a>
          <div className="adm-user">
            <span className="adm-avatar">{user.name.slice(0, 1).toUpperCase()}</span>
            <div><b>{user.name}</b><small>{user.email}</small></div>
            <button className="adm-icon-btn" onClick={logout} title="Sign out" aria-label="Sign out"><LogOut size={17} /></button>
          </div>
        </div>
      </aside>
      {open && <div className="adm-scrim" onClick={() => setOpen(false)} />}

      <div className="adm-main">
        <header className="adm-topbar">
          <button className="adm-icon-btn" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <b>MTM Admin</b>
        </header>
        {page}
      </div>
    </div>
  );
}
