import { useEffect, useState } from "react";
import { Inbox, CalendarDays, Layers, PencilLine, ArrowRight } from "lucide-react";
import { Link } from "../router.jsx";
import { api, timeAgo, STATUS_LABEL } from "./api.js";
import { PageHead, Spinner, Empty } from "./ui.jsx";

export default function Dashboard() {
  const [s, setS] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api("/admin/stats").then(setS).catch((e) => setErr(e.message));
  }, []);

  if (err) return <div className="adm-page"><p className="adm-form-error">{err}</p></div>;
  if (!s) return <div className="adm-page"><Spinner /></div>;

  const e = s.enquiries;
  const max = Math.max(1, ...e.perDay.map((d) => d.count));
  const typeMax = Math.max(1, ...e.byType.map((t) => t.n));

  const cards = [
    { label: "New enquiries", value: e.byStatus.new, icon: Inbox, to: "/admin/enquiries", accent: e.byStatus.new > 0 },
    { label: "Last 7 days", value: e.last7, icon: CalendarDays },
    { label: "All enquiries", value: e.total, icon: Layers },
    { label: "Edited content fields", value: s.content.changedFields, icon: PencilLine, to: "/admin/content" },
  ];

  return (
    <div className="adm-page">
      <PageHead title="Dashboard" sub="What's happening on your website." />

      <div className="adm-cards">
        {cards.map(({ label, value, icon: Icon, to, accent }) => {
          const inner = (
            <>
              <span className="adm-card-icon"><Icon size={20} /></span>
              <b>{value}</b>
              <small>{label}</small>
            </>
          );
          return to ? (
            <Link key={label} to={to} className={`adm-card link ${accent ? "accent" : ""}`}>{inner}</Link>
          ) : (
            <div key={label} className="adm-card">{inner}</div>
          );
        })}
      </div>

      <div className="adm-grid2">
        <section className="adm-panel">
          <h2>Enquiries · last 14 days</h2>
          <div className="adm-bars" role="img" aria-label="Enquiries per day for the last 14 days">
            {e.perDay.map((d) => (
              <div key={d.day} className="adm-bar" title={`${d.day}: ${d.count}`}>
                <span className="adm-bar-n">{d.count || ""}</span>
                <i style={{ height: `${(d.count / max) * 100}%` }} className={d.count ? "has" : ""} />
                <small>{new Date(d.day + "T00:00:00").getDate()}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="adm-panel">
          <h2>By project type</h2>
          {e.byType.length === 0 ? (
            <p className="adm-muted">No enquiries yet.</p>
          ) : (
            <ul className="adm-hbars">
              {e.byType.map((t) => (
                <li key={t.type}>
                  <span>{t.type}</span>
                  <div><i style={{ width: `${(t.n / typeMax) * 100}%` }} /></div>
                  <b>{t.n}</b>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="adm-panel">
        <div className="adm-panel-head">
          <h2>Latest enquiries</h2>
          <Link to="/admin/enquiries" className="adm-link">View all <ArrowRight size={14} /></Link>
        </div>
        {e.recent.length === 0 ? (
          <Empty icon={Inbox} title="No enquiries yet" text="Messages sent from the Contact page will show up here." />
        ) : (
          <ul className="adm-recent">
            {e.recent.map((r) => (
              <li key={r.id}>
                <Link to="/admin/enquiries">
                  <span className={`adm-dot ${r.status}`} title={STATUS_LABEL[r.status]} />
                  <div>
                    <b>{r.name}</b> <small>{r.type || "—"}</small>
                    <p>{r.snippet}</p>
                  </div>
                  <time>{timeAgo(r.created_at)}</time>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
