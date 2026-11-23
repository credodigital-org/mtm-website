import { useCallback, useEffect, useMemo, useState } from "react";
import { Save, Undo2, RotateCcw, ExternalLink } from "lucide-react";
import { Link, navigate } from "../router.jsx";
import { buildContent, diffSection } from "../content.js";
import { api } from "./api.js";
import { PageHead, Spinner, useUI } from "./ui.jsx";
import { Fields } from "./fields.jsx";

const GROUPS = [
  {
    title: "Pages",
    items: [
      { key: "ABOUT_PAGE", label: "About Us", url: "/about" },
      { key: "SERVICES_PAGE", label: "Services", url: "/services" },
      { key: "FOCUS_PAGE", label: "Our Focus", url: "/focus" },
      { key: "WHY_PAGE", label: "Why Choose Us", url: "/why" },
      { key: "CONTACT_PAGE", label: "Contact", url: "/contact" },
    ],
  },
  {
    title: "Site-wide",
    items: [
      { key: "CONTACT", label: "Contact details", url: "/contact", note: "Phone, WhatsApp, email and address. Changing these also updates the footer, floating WhatsApp button and “Contact us” buttons." },
      { key: "NAV", label: "Menu", url: "/", note: "Labels in the top navigation bar." },
    ],
  },
  {
    title: "Home page",
    items: [
      { key: "IMG", label: "Home images", url: "/", note: "Hero, About, Focus cards and call-to-action banner images on the home page." },
      { key: "SERVICES", label: "Services list", url: "/#services", note: "The service names shown on the home page." },
      { key: "FOCUS", label: "Focus cards", url: "/" },
      { key: "WHY", label: "Why us highlights", url: "/" },
      { key: "PROCESS", label: "Process steps", url: "/" },
    ],
  },
];
const ALL = GROUPS.flatMap((g) => g.items);

export default function ContentEditor({ section }) {
  const { toast, confirm } = useUI();
  const [overrides, setOverrides] = useState(null);
  const [meta, setMeta] = useState({});
  const [working, setWorking] = useState(null);
  const [saving, setSaving] = useState(false);

  const current = ALL.find((s) => s.key === section);

  const load = useCallback(
    () => api("/admin/content").then((r) => { setOverrides(r.content); setMeta(r.meta); }).catch((e) => toast(e.message, "err")),
    [toast]
  );
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!section) navigate("/admin/content/ABOUT_PAGE");
  }, [section]);

  /* what the section looks like when saved, and what it looks like with no overrides of its own */
  const saved = useMemo(() => (overrides && current ? buildContent(overrides)[current.key] : null), [overrides, current]);
  const baseline = useMemo(() => (overrides && current ? buildContent(overrides, current.key)[current.key] : null), [overrides, current]);

  useEffect(() => { setWorking(saved); }, [saved]);

  const dirty = working && saved && JSON.stringify(working) !== JSON.stringify(saved);

  // warn before closing the tab with unsaved edits
  useEffect(() => {
    if (!dirty) return;
    const h = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const go = async (e, key) => {
    if (dirty) {
      e.preventDefault();
      if (await confirm({ title: "Discard unsaved changes?", message: "You have edits on this page that haven't been saved.", confirmText: "Discard" })) navigate(`/admin/content/${key}`);
    }
  };

  const persist = async (changes, okMsg) => {
    setSaving(true);
    try {
      await api(`/admin/content/${current.key}`, { method: "PUT", body: { changes } });
      await load();
      toast(okMsg);
    } catch (e) {
      toast(e.message, "err");
    }
    setSaving(false);
  };

  const save = () => persist(diffSection(current.key, working, baseline), "Saved. The website now shows your changes.");

  const reset = async () => {
    if (!(await confirm({ title: `Reset “${current.label}”?`, message: "All your edits to this section are removed and the original text and images come back.", danger: true, confirmText: "Reset to original" }))) return;
    persist({}, "Section reset to the original content");
  };

  const edited = (key) => overrides && Object.keys(overrides).some((p) => p === key || p.startsWith(`${key}.`));

  return (
    <div className="adm-page">
      <PageHead title="Site content" sub="Edit the text and images of your website. Changes go live as soon as you save." />

      <div className="adm-editor">
        <nav className="adm-sections" aria-label="Sections">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <h4>{g.title}</h4>
              {g.items.map((s) => (
                <Link key={s.key} to={`/admin/content/${s.key}`} className={s.key === section ? "active" : ""} onClick={(e) => go(e, s.key)}>
                  {s.label}
                  {edited(s.key) && <i className="adm-edited" title="Has edits" />}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="adm-editor-main">
          {!current ? (
            <p className="adm-muted">Choose a section on the left.</p>
          ) : !working ? (
            <Spinner />
          ) : (
            <>
              <div className="adm-editor-head">
                <div>
                  <h2>{current.label}</h2>
                  {current.note && <p>{current.note}</p>}
                  {meta[current.key] && <small>Last saved {meta[current.key].updated_at} UTC by {meta[current.key].updated_by}</small>}
                </div>
                <a className="adm-btn sm" href={current.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> View page</a>
              </div>

              <div className="adm-fields">
                {Array.isArray(working) ? (
                  <Fields value={Object.fromEntries(working.map((v, i) => [String(i), v]))} path={current.key} onChange={(o) => setWorking(Object.values(o))} />
                ) : (
                  <Fields value={working} path={current.key} onChange={setWorking} />
                )}
              </div>

              <div className={`adm-savebar ${dirty ? "dirty" : ""}`}>
                <span>{dirty ? "You have unsaved changes" : "No unsaved changes"}</span>
                <div>
                  <button className="adm-btn ghost" onClick={reset} disabled={saving || !edited(current.key)}><RotateCcw size={15} /> Reset to original</button>
                  <button className="adm-btn" onClick={() => setWorking(saved)} disabled={!dirty || saving}><Undo2 size={15} /> Discard</button>
                  <button className="adm-btn primary" onClick={save} disabled={!dirty || saving}><Save size={15} /> {saving ? "Saving…" : "Save changes"}</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
