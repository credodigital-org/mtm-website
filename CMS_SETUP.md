# MTM Projects admin — setup & usage

## 1. How it works

```
Browser ──► React site (Vercel) ──► Django REST API (Render) ──► Neon PostgreSQL (edits, enquiries, admins)
                │                                        └────► Cloudflare R2 (uploaded images)
                └── /admin  (staff login, JWT)
```

- `frontend/src/data.js` holds the **default** content. The admin stores only the fields that were *changed*, as rows such as `CONTACT_PAGE.hero.titleTop = "New text"`.
- Before React renders, `frontend/src/content.js` fetches `GET /api/content/` (waits at most 1.5 s) and patches the data objects, so every page keeps reading from `data.js` exactly as before. If the API is down or asleep the site shows the defaults.
- `/admin` signs in with an e-mail and password (`POST /api/auth/token/`). The 30-minute access token is renewed automatically with the 7-day refresh token; signing out discards both.
- Phone / WhatsApp / e-mail / address under *Contact details* also update the footer, the floating WhatsApp button and the "Contact us" buttons.
- When an uploaded image is deleted in the admin, its file is removed from R2 too.
- Icons are not editable. Lists that have icons (home services, why-us, process steps) can be edited but not lengthened.
- Images shipped with the site (`frontend/public/images`) are listed in the picker from `frontend/src/siteImages.json`, which is regenerated on every `npm run dev` / `npm run build`.

## 2. API reference

| Endpoint | Who | Notes |
|---|---|---|
| `GET /health/` | anyone | `{"status": "ok"}` for UptimeRobot / Render |
| `GET /api/content/` | public | `{"content": {"PATH": value, …}}` — every edited field |
| `POST /api/enquiries/` | public | contact-form submission; rate limited (`DJANGO_ENQUIRY_RATE`, default 10/hour per visitor), spam-trap field `website`; e-mails the team if `ENQUIRY_NOTIFY_EMAILS` is set |
| `POST /api/auth/token/` | public | `{"username": "<email>", "password": …}` → `{access, refresh}`; rate limited (`DJANGO_LOGIN_RATE`, default 30/hour) |
| `POST /api/auth/token/refresh/` | public | `{"refresh": …}` → `{access}` |
| `GET /api/auth/me/` | staff | the signed-in admin |
| `GET /api/admin/stats/` | staff | dashboard numbers |
| `GET /api/admin/content/` · `PUT /api/admin/content/<SECTION>/` | staff | `PUT {"changes": {"SECTION.path": value}}` replaces that section's edits; `{}` resets it |
| `GET /api/admin/enquiries/?status=&q=&page=&per=` | staff | inbox (spam hidden unless asked for) |
| `PATCH` / `DELETE /api/admin/enquiries/<id>/` | staff | change status / notes, delete |
| `GET /api/admin/enquiries/export/` | staff | CSV download |
| `GET` / `POST /api/admin/media/` · `DELETE /api/admin/media/<id>/` | staff | multipart upload (field `file`); delete refuses images still in use |
| `GET` / `POST /api/admin/users/` · `DELETE /api/admin/users/<id>/` | staff | manage admins (a superuser account can only be removed by another superuser) |
| `POST /api/admin/password/` | staff | `{"current", "next"}` |

Every error is returned as `{"error": "a readable sentence"}`.

## 3. Rules worth knowing

- Links saved from the admin must start with `https://`, `tel:`, `mailto:`, `/` or `#`; image fields accept `/images/…` or an `https://` address. Anything else is refused.
- Uploads are identified by their contents (SVG is refused), max 8 MB.
- New admins are staff accounts; only the main administrator (created with `create_admin`) can remove another main administrator.
- Passwords: at least 10 characters and not a common password.
- Backups: Neon keeps the database history; R2 holds the images. Nothing important lives on the Render disk.

## 4. Useful commands

```bash
python manage.py create_admin --email you@example.com   # create the first admin, or reset that e-mail's password
python manage.py check_storage                          # proves the R2 settings work (uploads + deletes a test file)
python manage.py test                                   # run the automated tests
```
