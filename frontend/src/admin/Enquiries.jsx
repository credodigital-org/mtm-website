import { useCallback, useEffect, useState } from "react";
import { Search, Download, Mail, Phone, MessageCircle, Trash2, Inbox, ChevronLeft, ChevronRight, X } from "lucide-react";
import { api, downloadEnquiriesCsv, fullDate, timeAgo, STATUS_LABEL } from "./api.js";
import { PageHead, Spinner, Empty, useUI } from "./ui.jsx";

const TABS = [
  ["inbox", "Inbox"],
  ["new", "New"],
  ["in_progress", "In progress"],
  ["done", "Done"],
  ["spam", "Spam"],
  ["all", "All"],
];
const PER = 15;

export default function Enquiries() {
  const { toast, confirm } = useUI();
  const [tab, setTab] = useState("inbox");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [openId, setOpenId] = useState(null);

  // debounce the search box
  useEffect(() => {
    const t = setTimeout(() => {
      setTerm(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(() => {
    const p = new URLSearchParams({ page, per: PER });
    if (tab !== "inbox") p.set("status", tab);
    if (term) p.set("q", term);
    api(`/admin/enquiries?${p}`).then(setData).catch((e) => toast(e.message, "err"));
  }, [tab, term, page, toast]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  const changed = () => {
    load();
    window.dispatchEvent(new Event("enquiries-changed"));
  };

  const open = data?.items.find((x) => x.id === openId) || null;
  const pages = data ? Math.max(1, Math.ceil(data.total / PER)) : 1;

  return (
    <div className="adm-page">
      <PageHead title="Enquiries" sub="Messages sent from the contact form.">
        <button className="adm-btn" onClick={() => downloadEnquiriesCsv().catch((e) => toast(e.message, "err"))}><Download size={16} /> Export CSV</button>
      </PageHead>

      <div className="adm-toolbar">
        <div className="adm-tabs" role="tablist">
          {TABS.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => { setTab(k); setPage(1); setOpenId(null); }}>
              {label}
            </button>
          ))}
        </div>
        <label className="adm-search">
          <Search size={16} />
          <input placeholder="Search name, email, phone, message…" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && <button type="button" onClick={() => setQ("")} aria-label="Clear search"><X size={14} /></button>}
        </label>
      </div>

      <div className={`adm-split ${open ? "has-detail" : ""}`}>
        <section className="adm-panel flush">
          {!data ? (
            <Spinner />
          ) : data.items.length === 0 ? (
            <Empty icon={Inbox} title={term ? "No matches" : "Nothing here"} text={term ? "Try a different search." : "No enquiries in this view."} />
          ) : (
            <>
              <ul className="adm-list">
                {data.items.map((r) => (
                  <li key={r.id}>
                    <button className={`${r.id === openId ? "on" : ""} ${r.status === "new" ? "unread" : ""}`} onClick={() => setOpenId(r.id)}>
                      <span className={`adm-dot ${r.status}`} title={STATUS_LABEL[r.status]} />
                      <div>
                        <div className="adm-list-top"><b>{r.name}</b><time>{timeAgo(r.created_at)}</time></div>
                        <small>{r.type || "No project type"}</small>
                        <p>{r.message}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="adm-pager">
                <span>{data.total} total</span>
                <div>
                  <button className="adm-icon-btn" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page"><ChevronLeft size={17} /></button>
                  <span>{page} / {pages}</span>
                  <button className="adm-icon-btn" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Next page"><ChevronRight size={17} /></button>
                </div>
              </div>
            </>
          )}
        </section>

        {open ? (
          <Detail key={open.id} r={open} onClose={() => setOpenId(null)} onChanged={changed} toast={toast} confirm={confirm} />
        ) : (
          <aside className="adm-panel adm-detail-empty"><Empty icon={Mail} title="Select an enquiry" text="Click a message to read it and update its status." /></aside>
        )}
      </div>
    </div>
  );
}

function Detail({ r, onClose, onChanged, toast, confirm }) {
  const [notes, setNotes] = useState(r.notes);
  const [busy, setBusy] = useState(false);
  const digits = r.phone.replace(/\D/g, "");

  const patch = async (body, okMsg) => {
    setBusy(true);
    try {
      await api(`/admin/enquiries/${r.id}`, { method: "PATCH", body });
      toast(okMsg);
      onChanged();
    } catch (e) {
      toast(e.message, "err");
    }
    setBusy(false);
  };

  const remove = async () => {
    if (!(await confirm({ title: "Delete enquiry?", message: `This permanently deletes the message from ${r.name}.`, danger: true, confirmText: "Delete" }))) return;
    try {
      await api(`/admin/enquiries/${r.id}`, { method: "DELETE" });
      toast("Enquiry deleted");
      onClose();
      onChanged();
    } catch (e) {
      toast(e.message, "err");
    }
  };

  return (
    <aside className="adm-panel adm-detail">
      <div className="adm-detail-head">
        <div>
          <h2>{r.name}</h2>
          <small>{fullDate(r.created_at)}{r.type ? ` · ${r.type}` : ""}</small>
        </div>
        <button className="adm-icon-btn only-narrow" onClick={onClose} aria-label="Close"><X size={18} /></button>
      </div>

      <div className="adm-status-row" role="group" aria-label="Status">
        {Object.entries(STATUS_LABEL).map(([k, label]) => (
          <button key={k} disabled={busy} className={`adm-chip ${k} ${r.status === k ? "on" : ""}`} onClick={() => r.status !== k && patch({ status: k }, `Marked as ${label.toLowerCase()}`)}>
            {label}
          </button>
        ))}
      </div>

      <div className="adm-contact-row">
        <a className="adm-btn sm" href={`mailto:${r.email}?subject=${encodeURIComponent("Re: your enquiry to MTM Projects")}`}><Mail size={15} /> {r.email}</a>
        <a className="adm-btn sm" href={`tel:${r.phone}`}><Phone size={15} /> {r.phone}</a>
        {digits && <a className="adm-btn sm wa" href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={15} /> WhatsApp</a>}
      </div>

      <h3 className="adm-h3">Message</h3>
      <p className="adm-message">{r.message}</p>

      <h3 className="adm-h3">Internal notes</h3>
      <textarea className="adm-textarea" rows={3} placeholder="Only visible to admins…" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} />
      <div className="adm-detail-actions">
        <button className="adm-btn primary" disabled={busy || notes === r.notes} onClick={() => patch({ notes }, "Notes saved")}>Save notes</button>
        <button className="adm-btn danger" onClick={remove}><Trash2 size={15} /> Delete</button>
      </div>
    </aside>
  );
}
