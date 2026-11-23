import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, Copy, Trash2, ImageIcon, Check } from "lucide-react";
import { api, formatBytes } from "./api.js";
import { PageHead, Spinner, Empty, useUI } from "./ui.jsx";
import SITE_IMAGES from "../siteImages.json";

const MAX = 8 * 1024 * 1024;

/* shared by the Media page and the image picker */
export async function uploadFiles(files, toast) {
  const done = [];
  for (const f of files) {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(f.type)) {
      toast(`${f.name}: only JPG, PNG, WebP or GIF`, "err");
      continue;
    }
    if (f.size > MAX) {
      toast(`${f.name} is larger than 8 MB`, "err");
      continue;
    }
    try {
      const form = new FormData();
      form.append("file", f);
      const r = await api("/admin/media", { method: "POST", form });
      done.push(r.media);
    } catch (e) {
      toast(`${f.name}: ${e.message}`, "err");
    }
  }
  if (done.length) toast(done.length === 1 ? "Image uploaded" : `${done.length} images uploaded`);
  return done;
}

export default function Media() {
  const { toast, confirm } = useUI();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [copied, setCopied] = useState("");
  const input = useRef(null);

  const load = useCallback(() => api("/admin/media").then(setData).catch((e) => toast(e.message, "err")), [toast]);
  useEffect(() => { load(); }, [load]);

  const upload = async (files) => {
    setBusy(true);
    await uploadFiles([...files], toast);
    setBusy(false);
    load();
  };

  const copy = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      toast("Couldn't copy. Select the path and copy it by hand.", "err");
    }
  };

  const remove = async (m) => {
    if (!(await confirm({ title: "Delete image?", message: `${m.original} will be removed permanently.`, danger: true, confirmText: "Delete" }))) return;
    try {
      await api(`/admin/media/${m.id}`, { method: "DELETE" });
      toast("Image deleted");
      load();
    } catch (e) {
      toast(e.message, "err");
    }
  };

  return (
    <div className="adm-page">
      <PageHead title="Media" sub="Upload images, then pick them when editing site content.">
        <button className="adm-btn primary" onClick={() => input.current?.click()} disabled={busy}><Upload size={16} /> {busy ? "Uploading…" : "Upload images"}</button>
      </PageHead>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />

      <div
        className={`adm-drop ${drag ? "over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}
      >
        <Upload size={20} /> Drag images here (JPG, PNG, WebP, GIF · up to 8 MB each)
      </div>

      {!data ? (
        <Spinner />
      ) : (
        <>
          <h2 className="adm-h2">Your uploads</h2>
          {data.uploads.length === 0 ? (
            <Empty icon={ImageIcon} title="No uploads yet" text="Images you upload appear here." />
          ) : (
            <ul className="adm-media">
              {data.uploads.map((m) => (
                <li key={m.id}>
                  <div className="adm-thumb"><img src={m.url} alt="" loading="lazy" /></div>
                  <b title={m.original}>{m.original}</b>
                  <small>{formatBytes(m.size)}{m.usedBy.length ? ` · in use` : ""}</small>
                  <div className="adm-media-actions">
                    <button className="adm-btn sm" onClick={() => copy(m.url)}>{copied === m.url ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy path</>}</button>
                    <button className="adm-icon-btn danger" onClick={() => remove(m)} aria-label={`Delete ${m.original}`}><Trash2 size={16} /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <h2 className="adm-h2">Website images <small>(shipped with the site in frontend/public/images)</small></h2>
          <ul className="adm-media compact">
            {SITE_IMAGES.map((m) => (
              <li key={m.url}>
                <div className="adm-thumb"><img src={m.url} alt="" loading="lazy" /></div>
                <b title={m.filename}>{m.filename}</b>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
