/* Address of the Django API (backend/). Set VITE_API_BASE_URL in Vercel (or frontend/.env locally).
   Use the host only, with no /api at the end, e.g. https://api.your-domain.com */
export const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");
