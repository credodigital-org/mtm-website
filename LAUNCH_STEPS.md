# Launch steps — from finished code to a live website

Do the parts **in this order**. Do not buy the domain until Parts A–D work on the free test addresses.

---

## Part A — Final check on your computer

1. `cd backend` → activate the virtual environment → `pip install -r requirements.txt` → `python manage.py migrate`
2. `python manage.py test` (all tests should pass)
3. `python manage.py create_admin --email you@example.com`
4. `python manage.py runserver`, then in `frontend`: `copy .env.example .env` → `npm install` → `npm run dev`
5. Open every page, then `/admin`. Edit a text, upload and use an image, send a test message from the Contact page.
6. `cd frontend && npm run build` — must finish without errors.

---

## Part B — Deploy the backend on Render

1. Create the Neon database and the R2 bucket first (see `DEPLOYMENT.md`, section 1).
2. Push the project to GitHub (**never** commit `.env`).
3. Render → **New → Blueprint** → choose the repository (it reads `render.yaml`).
   *Manual alternative:* New → Web Service → repository → Root Directory `backend` → Runtime Python 3 → Build `pip install -r requirements.txt && python manage.py collectstatic --noinput` → Start `python manage.py migrate --noinput && gunicorn mtm_backend.wsgi:application --timeout 120 --workers 2` → Health check path `/health/` → add `PYTHON_VERSION=3.11.11`.
4. Environment tab — enter: `DJANGO_DEBUG=False`, `DJANGO_SECRET_KEY` (long random), `DATABASE_URL`, the five `R2_*` values, and for now:
   - `DJANGO_ALLOWED_HOSTS` = your Render host, e.g. `mtm-projects-api.onrender.com`
   - `DJANGO_CORS_ALLOWED_ORIGINS` = the Vercel address you will get in Part C (come back and set it after C)
   - `DJANGO_CSRF_TRUSTED_ORIGINS` = `https://mtm-projects-api.onrender.com`
5. Deploy and wait for **Live**. Open `https://<render-host>/health/` → `{"status": "ok"}`.
6. **Create the admin login from your computer** (free Render has no shell):
   1. In `backend/.env` temporarily put the production `DATABASE_URL`.
   2. `python manage.py migrate`
   3. `python manage.py create_admin --email owner@your-domain.com`
   4. Put `#` in front of that line in `.env` again.

---

## Part C — Deploy the website on Vercel

1. Vercel → **Add New → Project** → import the same GitHub repository.
2. **Root Directory:** `frontend`. Framework: Vite. Build: `npm run build`. Output: `dist`.
3. Environment Variable: `VITE_API_BASE_URL` = `https://<render-host>` (no `/api` at the end).
4. **Deploy**. Open the address and test every page.

---

## Part D — Connect Vercel and Render

1. Copy the Vercel address (e.g. `https://mtm-projects.vercel.app`).
2. Render → Environment → set `DJANGO_CORS_ALLOWED_ORIGINS` to exactly that address (no trailing slash; separate several with commas) → save (Render redeploys).
3. On the Vercel site test:
   - [ ] Pages show images and texts
   - [ ] `/admin` login works
   - [ ] Change a text in the admin → refresh the site → it changed
   - [ ] Upload a photo → its address begins with your `R2_PUBLIC_BASE_URL`
   - [ ] Send a test message from the Contact page → it appears in **Admin → Enquiries**
4. If you see "Can't reach the server": open the browser console (F12) and the Render logs. It is almost always `VITE_API_BASE_URL`, CORS, or a sleeping free Render instance. Add an UptimeRobot monitor on `https://<render-host>/health/` (every 5 min).

---

## Part E — Domain

1. Buy / use the domain. In Vercel add it and create the DNS records it shows.
2. Point `api.<domain>` at Render (Render → Settings → Custom Domains) and `media.<domain>` at R2.
3. Update on Render: `DJANGO_ALLOWED_HOSTS`, `DJANGO_CORS_ALLOWED_ORIGINS` (add `https://<domain>` and `https://www.<domain>`), `DJANGO_CSRF_TRUSTED_ORIGINS`, `R2_PUBLIC_BASE_URL`. On Vercel: `VITE_API_BASE_URL=https://api.<domain>`. Redeploy both.
4. Re-run the smoke test in `DEPLOYMENT.md`, section 3, then hand over the admin login and revoke any shared tokens.
