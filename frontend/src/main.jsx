import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./animations.css";

const root = createRoot(document.getElementById("root"));
const isAdmin = window.location.pathname === "/admin" || window.location.pathname.startsWith("/admin/");

async function boot() {
  if (isAdmin) {
    /* the admin panel is its own chunk: visitors of the public site never download it */
    const { default: AdminApp } = await import("./admin/AdminApp.jsx");
    root.render(
      <React.StrictMode>
        <AdminApp />
      </React.StrictMode>
    );
    return;
  }

  /* public site: patch data.js with whatever the admin has changed, then render */
  const [{ loadContent }, { default: App }] = await Promise.all([import("./content.js"), import("./App.jsx")]);
  await loadContent();
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

boot();
