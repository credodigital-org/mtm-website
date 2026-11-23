# MTM Projects Management — Website + Admin panel

One integrated project (not two websites):

- **`frontend/`** — the React + Vite website (design, animations, pages unchanged) plus the `/admin` panel.
- **`backend/`** — Django + Django REST Framework (`cms` app) with JWT login, PostgreSQL support and Cloudflare R2 image storage. Same structure as the Moscow Center and Genet Dental projects.

Everything edited in **/admin** appears on the public website. The default wording and pictures stay in `frontend/src/data.js`; the admin only stores what was *changed*, so **Reset to original** always works and the site still shows its original content if the API is ever down.

## What the admin does

| Admin page | What can be done there |
|---|---|
| **Dashboard** | New / total enquiries, 14-day chart, enquiries by project type, latest messages |
| **Enquiries** | Inbox from the Contact form: status (New / In progress / Done / Spam), search, notes, reply by email / call / WhatsApp, delete, CSV export — plus an optional e-mail alert for every new enquiry |
| **Site content** | Edit every page (About, Services, Our Focus, Why, Contact), contact details, menu labels and home-page content. Image picker with upload. Save / discard / reset-to-original per section |
| **Media** | Upload JPG, PNG, WebP, GIF (up to 8 MB), copy the address, delete (blocked while an image is in use) |
| **Settings** | Change password, add / remove admins |

## Run it locally

Backend (terminal 1):

```bash
cd backend
python -m venv .venv && .venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env                                  # macOS/Linux: cp
python manage.py migrate
python manage.py create_admin --email you@example.com   # asks for a password — YOUR admin login, there is no default
python manage.py runserver
```

Frontend (terminal 2):

```bash
cd frontend
copy .env.example .env                # VITE_API_BASE_URL=http://localhost:8000
npm install
npm run dev
```

- Website: http://localhost:5173
- Admin: http://localhost:5173/admin (sign in with the e-mail and password from `create_admin`)
- Django's own admin (fallback): http://localhost:8000/admin

Tests: `cd backend && python manage.py test`

## Where things are

| | |
|---|---|
| Website text / default pictures | `frontend/src/data.js`, `frontend/public/images/` |
| How admin edits are applied to the site | `frontend/src/content.js` |
| Admin screens | `frontend/src/admin/` |
| API address setting | `frontend/.env` → `VITE_API_BASE_URL` (`frontend/src/config.js`) |
| API endpoints, models | `backend/cms/` |
| Settings (database, R2, CORS, e-mail) | `backend/mtm_backend/settings.py`, `backend/.env.example` |

Going live (Vercel + Render + Neon + Cloudflare R2): **[LAUNCH_STEPS.md](LAUNCH_STEPS.md)** (order of work) and **[DEPLOYMENT.md](DEPLOYMENT.md)** (every setting, smoke test, troubleshooting). Editing guide and API reference: **[CMS_SETUP.md](CMS_SETUP.md)**.
