# Deployment guide & manual-changes checklist

Architecture (same as the Moscow Center and Genet Dental projects):

```
your-domain.com ──► Vercel (React site + /admin)
                       │  HTTPS
                       ▼
                    Render (Django REST API)
                    ├──► Neon PostgreSQL   (content edits, enquiries, admin logins)
                    └──► Cloudflare R2     (every image uploaded in the admin)
```

## 1. Values you need before you start

| Environment variable | Where it comes from | Set it in |
|---|---|---|
| `DATABASE_URL` | Neon → project → Connection string | Render |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Cloudflare R2 → Manage API tokens → *Object Read & Write*, limited to the bucket | Render |
| `R2_BUCKET_NAME` | the bucket you created | Render |
| `R2_ENDPOINT_URL` | `https://<account_id>.r2.cloudflarestorage.com` | Render |
| `R2_PUBLIC_BASE_URL` | the bucket's public address, e.g. `https://media.your-domain.com` | Render |
| `DJANGO_SECRET_KEY` | generated for you by `render.yaml` | Render |
| `DJANGO_ALLOWED_HOSTS` | the API host, e.g. `api.your-domain.com` (the `onrender.com` host is added automatically) | Render |
| `DJANGO_CORS_ALLOWED_ORIGINS` | the website origins, no trailing slash: `https://your-domain.com,https://www.your-domain.com` | Render |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | `https://api.your-domain.com` | Render |
| `EMAIL_HOST`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `ENQUIRY_NOTIFY_EMAILS` | *recommended* — an e-mail for every new enquiry, so none sits unseen | Render |
| `VITE_API_BASE_URL` | the API address **without** `/api`, e.g. `https://api.your-domain.com` | Vercel |

Never put these in Git or in the frontend. `backend/.env` is ignored by Git.

## 2. Deploy, step by step

1. **Git.** Push the project (the `backend/` and `frontend/` folders as they are) to a GitHub repository.
2. **Neon.** Create a project, copy the connection string.
3. **Cloudflare R2.** Create the bucket, allow public access (custom domain preferred), create the API token.
4. **Render.** New → *Blueprint* → choose the repository. `render.yaml` creates the service with the correct build/start commands (`collectstatic`, then `migrate` + `gunicorn --timeout 120`, health check `/health/`). Fill in the variables marked `sync: false`.
   - If you prefer to create the service by hand: root directory `backend`, Python `3.11.11` (`PYTHON_VERSION`), the same build and start commands as in `render.yaml`.
   - Render ignores the `Procfile`; it is there for hosts that use it.
5. **First admin login.** Free Render services have no shell, so run this **on your own computer** against the production database:
   1. In `backend/.env` put the production `DATABASE_URL` (temporarily).
   2. `python manage.py migrate`
   3. `python manage.py create_admin --email owner@your-domain.com` (it asks for a password; **this is the admin login — there is no default**).
   4. Remove the `DATABASE_URL` line from `.env` again.
   5. Optional: also put the five `R2_*` values in `.env` and run `python manage.py check_storage` to prove R2 works.
6. **Vercel.** Import the repository: root directory `frontend`, framework *Vite*, build `npm run build`, output `dist`. Add `VITE_API_BASE_URL`.
7. **Domain.** In Vercel add the domain and create exactly the DNS records it shows. Point `api.` at Render (Render → Settings → Custom Domains) and `media.` at R2 (R2 → bucket → Custom Domain). Then update `DJANGO_ALLOWED_HOSTS`, `DJANGO_CORS_ALLOWED_ORIGINS`, `DJANGO_CSRF_TRUSTED_ORIGINS` on Render, set `VITE_API_BASE_URL` on Vercel to the final API address, and redeploy both.
8. **Keep-alive.** Add an UptimeRobot monitor for `https://<api-host>/health/` (every 5 minutes) so the free Render instance stays awake.
9. **Smoke test** (below), then give the client their admin login.

## 3. Smoke test after deploying

- [ ] `https://<api-host>/health/` shows `{"status": "ok"}`
- [ ] The website loads, all six pages open, images show
- [ ] `/admin` login works with the account you created
- [ ] Admin → Site content → change a heading → refresh the website → it changed; **Reset to original** puts it back
- [ ] Admin → Media → upload a photo → its address starts with your `R2_PUBLIC_BASE_URL`
- [ ] Send a test message from the Contact page → it appears in Admin → Enquiries (and in the mailbox if e-mail is set up)
- [ ] Admin → Enquiries → Export CSV downloads a file
- [ ] `https://your-domain.com/admin` is not indexed: `robots.txt` disallows it

## 4. What you must add or change by hand

| # | Where | What to change |
|---|---|---|
| 1 | Render → Environment | All variables in section 1 |
| 2 | Vercel → Environment | `VITE_API_BASE_URL` |
| 3 | Domain registrar / Cloudflare | DNS records for the website, `api.` and `media.` |
| 4 | Admin → **Site content → Contact details** | Real phone, WhatsApp, e-mail, address (these also update the footer and the floating WhatsApp button) |
| 5 | Admin → every page | Real photos and any wording the client wants changed |
| 6 | `frontend/index.html`, `frontend/public/robots.txt` | The page title/description; add a `Sitemap:` line to `robots.txt` once the real domain is known |
| 7 | Render → `ENQUIRY_NOTIFY_EMAILS` + SMTP | The team's address for new-enquiry e-mails |
| 8 | After go-live | Create a **new** R2 token and revoke the one that was shared; change any password that was sent in plain text |

## 5. What has and has not been verified

Verified (in the build environment, without running the servers):
- All 41 frontend source files parse without syntax errors.
- All backend Python files compile.
- The admin panel's screens and the data layer (`data.js` + `content.js`) are unchanged apart from where they talk to the server: the API address, the login (now JWT), image upload (now multipart) and the CSV download (now an authenticated download).

**Not verified** (needs a real run on your machine / the servers): `pip install -r requirements.txt`, `python manage.py migrate` (the first migration was written by hand to match `cms/models.py` — if Django reports pending model changes, run `python manage.py makemigrations` and commit the result), `python manage.py test`, `npm run build`, the Render and Vercel builds, Cloudflare R2 uploads (use `python manage.py check_storage`), and e-mail sending.

The previous version of this project used a Node server with a SQLite file (`server/data/mtm.db`). Content edits, enquiries and admin accounts stored in that file are **not** carried over; re-enter any edits in the new admin (nothing is lost from the website itself, because the original content is in `frontend/src/data.js`).

## 6. Troubleshooting

| Symptom | Likely cause |
|---|---|
| Login says "Can't reach the server" | `VITE_API_BASE_URL` wrong, the API is asleep (free Render), or the website's origin is missing from `DJANGO_CORS_ALLOWED_ORIGINS` (no trailing slash, exact `https://` address) |
| API shows `DisallowedHost` / 400 | the API host is missing from `DJANGO_ALLOWED_HOSTS` |
| Images upload but do not display | `R2_PUBLIC_BASE_URL` wrong, or the bucket is not public |
| Uploaded images vanish after a deploy | R2 is not configured, so files went to Render's temporary disk. Set the four `R2_*` values and run `check_storage` |
| `python manage.py check_storage` fails | one of the `R2_*` values is wrong (see the error text) |
| Contact form seems to do nothing | the WhatsApp window still opens; the API may be asleep or blocked by CORS (the enquiry is then not saved) |
| "Too many requests" | rate limit (`DJANGO_ENQUIRY_RATE` default 10/hour per visitor, `DJANGO_LOGIN_RATE` default 30/hour) |
| Site takes ~50 s on the first visit | free Render instance was asleep — use the UptimeRobot monitor |
