import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2, ArrowUp, ArrowDown, ImageOff, Image as ImageIcon } from "lucide-react";
import { isOpaque } from "../content.js";
import ImagePicker from "./ImagePicker.jsx";

/* ---------- labels ---------- */
const LABELS = {
  alt: "Image description (for screen readers)",
  image: "Image",
  mobileImage: "Mobile image",
  titleTop: "Title (first line)",
  titleAccent: "Title (highlighted line)",
  href: "Link",
  tel: "Phone (landline)",
  whatsapp: "WhatsApp number",
  coords: "Coordinates (shown text)",
  lat: "Latitude (map)",
  lng: "Longitude (map)",
  cta: "Call-to-action banner",
  eyebrow: "Small heading above title",
  kicker: "Kicker (small line above title)",
  lines: "Lines of text",
  tags: "Tags",
  projectTypes: "Project type options (contact form)",
  followTitle: "“Follow us” heading",
  linkText: "Link text",
  landmarkLabel: "Landmark card · label",
  landmarkTitle: "Landmark card · title",
  landmarkText: "Landmark card · text",
};
export function labelFor(key) {
  if (LABELS[key]) return LABELS[key];
  if (/^\d+$/.test(key)) return `Item ${Number(key) + 1}`;
  const s = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const HIDDEN = new Set(["CONTACT.whatsappLink"]); // derived from the WhatsApp number
const LONG_KEYS = new Set(["text", "message", "success", "alt"]);

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v) && !isOpaque(v);
const hasIcon = (arr) => arr.some((x) => isObj(x) && "icon" in x);

function itemTitle(item, i) {
  if (isObj(item)) {
    const t = item.title || item.label || item.badge || item.titleTop;
    if (typeof t === "string" && t) return `${i + 1}. ${t}`;
  }
  return `Item ${i + 1}`;
}

/* a blank copy of an item: strings emptied, arrays cleared, numbers kept */
function blankLike(v) {
  if (typeof v === "string") return "";
  if (Array.isArray(v)) return [];
  if (isObj(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, blankLike(x)]));
  return v;
}

/* ---------- one field of any shape ---------- */
export default function Field({ name, value, path, onChange }) {
  if (HIDDEN.has(path)) return null;
  if (isOpaque(value)) return null; // icons: fixed

  if (typeof value === "string") return <TextField name={name} value={value} onChange={onChange} />;
  if (typeof value === "number") {
    return (
      <label className="adm-field">
        <span>{labelFor(name)}</span>
        <input type="number" step="any" value={value} onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} />
      </label>
    );
  }
  if (Array.isArray(value)) {
    if (value.every((x) => typeof x === "string")) return <StringList name={name} value={value} onChange={onChange} />;
    return <ObjectList name={name} value={value} path={path} onChange={onChange} />;
  }
  if (isObj(value)) {
    return (
      <fieldset className="adm-group">
        <legend>{labelFor(name)}</legend>
        <Fields value={value} path={path} onChange={onChange} />
      </fieldset>
    );
  }
  return null;
}

export function Fields({ value, path, onChange }) {
  return Object.entries(value).map(([k, v]) => (
    <Field key={k} name={k} value={v} path={`${path}.${k}`} onChange={(nv) => onChange({ ...value, [k]: nv })} />
  ));
}

/* ---------- strings ---------- */
function TextField({ name, value, onChange }) {
  const [picking, setPicking] = useState(false);

  if (name === "image" || name === "mobileImage") {
    return (
      <div className="adm-field">
        <span>{labelFor(name)}</span>
        <div className="adm-imgfield">
          <div className="adm-imgfield-thumb">
            {value ? <img src={value} alt="" onError={(e) => (e.currentTarget.style.visibility = "hidden")} /> : <ImageOff size={20} />}
          </div>
          <div className="adm-imgfield-main">
            <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="/images/… or https://…" spellCheck={false} />
            <div>
              <button type="button" className="adm-btn sm" onClick={() => setPicking(true)}><ImageIcon size={14} /> Choose image</button>
              {name === "mobileImage" && value && <button type="button" className="adm-btn sm ghost" onClick={() => onChange("")}>Remove</button>}
            </div>
          </div>
        </div>
        {picking && <ImagePicker current={value} onClose={() => setPicking(false)} onPick={(url) => { onChange(url); setPicking(false); }} />}
      </div>
    );
  }

  const long = LONG_KEYS.has(name) ? value.length > 70 || name === "text" : value.length > 90;
  return (
    <label className="adm-field">
      <span>{labelFor(name)}</span>
      {long ? (
        <textarea className="adm-textarea" rows={Math.min(8, Math.max(3, Math.ceil(value.length / 80)))} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

function StringList({ name, value, onChange }) {
  const set = (i, v) => onChange(value.map((x, j) => (j === i ? v : x)));
  return (
    <div className="adm-field">
      <span>{labelFor(name)}</span>
      <div className="adm-strlist">
        {value.map((v, i) => (
          <div key={i}>
            <input value={v} onChange={(e) => set(i, e.target.value)} />
            <button type="button" className="adm-icon-btn danger" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 size={15} /></button>
          </div>
        ))}
        <button type="button" className="adm-btn sm" onClick={() => onChange([...value, ""])}><Plus size={14} /> Add</button>
      </div>
    </div>
  );
}

/* ---------- lists of objects (cards) ---------- */
function ObjectList({ name, value, path, onChange }) {
  const fixed = hasIcon(value); // items with an icon can be edited but not added/removed
  const [open, setOpen] = useState(() => (value.length <= 1 ? 0 : -1));
  const move = (i, d) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
    setOpen(i + d);
  };

  return (
    <div className="adm-field">
      <span>{labelFor(name)} <small>{value.length} item{value.length === 1 ? "" : "s"}{fixed ? " · fixed number of items" : ""}</small></span>
      <div className="adm-cards-list">
        {value.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={i} className={`adm-acc ${isOpen ? "open" : ""}`}>
              <div className="adm-acc-head">
                <button type="button" className="adm-acc-toggle" onClick={() => setOpen(isOpen ? -1 : i)} aria-expanded={isOpen}>
                  {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  <b>{itemTitle(item, i)}</b>
                </button>
                {!fixed && (
                  <span className="adm-acc-tools">
                    <button type="button" className="adm-icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp size={15} /></button>
                    <button type="button" className="adm-icon-btn" disabled={i === value.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown size={15} /></button>
                    <button type="button" className="adm-icon-btn danger" onClick={() => { onChange(value.filter((_, j) => j !== i)); setOpen(-1); }} aria-label="Remove item"><Trash2 size={15} /></button>
                  </span>
                )}
              </div>
              {isOpen && (
                <div className="adm-acc-body">
                  {isObj(item) ? (
                    <Fields value={item} path={`${path}.${i}`} onChange={(nv) => onChange(value.map((x, j) => (j === i ? nv : x)))} />
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
        {!fixed && value.length > 0 && isObj(value[0]) && (
          <button type="button" className="adm-btn sm" onClick={() => { onChange([...value, blankLike(value[value.length - 1])]); setOpen(value.length); }}>
            <Plus size={14} /> Add item
          </button>
        )}
      </div>
    </div>
  );
}
