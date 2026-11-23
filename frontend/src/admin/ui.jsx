import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

/* ---------- toasts + confirm dialog, shared by every admin screen ---------- */
const Ctx = createContext(null);
export const useUI = () => useContext(Ctx);

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const id = useRef(0);

  const toast = useCallback((message, type = "ok") => {
    const n = ++id.current;
    setToasts((t) => [...t, { id: n, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== n)), type === "err" ? 6000 : 3200);
  }, []);

  const confirm = useCallback(
    (opts) => new Promise((resolve) => setDialog({ ...opts, resolve })),
    []
  );
  const close = (v) => {
    dialog?.resolve(v);
    setDialog(null);
  };

  return (
    <Ctx.Provider value={{ toast, confirm }}>
      {children}

      <div className="adm-toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`adm-toast ${t.type}`}>
            {t.type === "err" ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {dialog && (
        <Modal onClose={() => close(false)} title={dialog.title} small>
          <p className="adm-dialog-msg">{dialog.message}</p>
          <div className="adm-dialog-actions">
            <button className="adm-btn" onClick={() => close(false)}>Cancel</button>
            <button className={`adm-btn ${dialog.danger ? "danger-solid" : "primary"}`} onClick={() => close(true)} autoFocus>
              {dialog.confirmText || "Confirm"}
            </button>
          </div>
        </Modal>
      )}
    </Ctx.Provider>
  );
}

export function Modal({ title, onClose, children, small = false, wide = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="adm-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`adm-modal ${small ? "small" : ""} ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <h3>{title}</h3>
          <button className="adm-icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>
        <div className="adm-modal-body">{children}</div>
      </div>
    </div>
  );
}

export const Spinner = ({ label = "Loading…" }) => (
  <div className="adm-loading"><span className="adm-spin" />{label}</div>
);

export const PageHead = ({ title, sub, children }) => (
  <div className="adm-pagehead">
    <div>
      <h1>{title}</h1>
      {sub && <p>{sub}</p>}
    </div>
    {children && <div className="adm-pagehead-actions">{children}</div>}
  </div>
);

export const Empty = ({ icon: Icon, title, text }) => (
  <div className="adm-empty">
    {Icon && <Icon size={30} strokeWidth={1.5} />}
    <b>{title}</b>
    {text && <p>{text}</p>}
  </div>
);
