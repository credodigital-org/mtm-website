import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { api } from "./api.js";
import { Modal, Spinner, useUI } from "./ui.jsx";
import { uploadFiles } from "./Media.jsx";
import SITE_IMAGES from "../siteImages.json";

/* Modal that lets you pick one of the site's images or an uploaded one, or upload a new one. */
export default function ImagePicker({ current, onPick, onClose }) {
  const { toast } = useUI();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const input = useRef(null);

  const load = () => api("/admin/media").then(setData).catch((e) => toast(e.message, "err"));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const upload = async (files) => {
    setBusy(true);
    const done = await uploadFiles([...files], toast);
    setBusy(false);
    if (done[0]) onPick(done[0].url); // one new upload: use it straight away
    else load();
  };

  const Grid = ({ items }) => (
    <ul className="adm-picker-grid">
      {items.map((m) => (
        <li key={m.url}>
          <button className={m.url === current ? "on" : ""} onClick={() => onPick(m.url)}>
            <img src={m.url} alt="" loading="lazy" />
            <span>{m.original || m.filename}</span>
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <Modal title="Choose an image" onClose={onClose} wide>
      <div className="adm-picker-top">
        <button className="adm-btn primary" onClick={() => input.current?.click()} disabled={busy}><Upload size={16} /> {busy ? "Uploading…" : "Upload new image"}</button>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
      </div>
      {!data ? (
        <Spinner />
      ) : (
        <>
          {data.uploads.length > 0 && (<><h4 className="adm-h4">Your uploads</h4><Grid items={data.uploads} /></>)}
          <h4 className="adm-h4">Website images</h4>
          <Grid items={SITE_IMAGES} />
        </>
      )}
    </Modal>
  );
}
