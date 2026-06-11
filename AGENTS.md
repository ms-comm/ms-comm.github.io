# AGENTS.md

> **Update this file + the relevant `docs/` file at every code change.**

---

## Project — MS Comm'

Dual-stack photography portfolio with integrated photo gallery:
- **Frontend**: Static HTML/CSS/JS on GitHub Pages (`https://ms-comm.github.io/`)
- **Backend**: Node.js/Express on Fly.io (`https://ms-comm-server.fly.dev`)

---

## Critical Rules

| Rule | Detail |
|------|--------|
| **Never commit `photo-server/`** | Backend deploys via `fly deploy` only — no GitHub exposure |
| **Deploy directly unless told otherwise** | User now wants deploy after each change: push frontend to GitHub Pages and run Fly deploy when backend changed, unless explicitly paused |
| **Frontend → GitHub** | Push root HTML/CSS/JS/assets to deploy to GitHub Pages |
| **Update docs on change** | After any code change, update AGENTS.md + the relevant `docs/*.md` |

---

## Commands

### Frontend
```powershell
python -m http.server 8080        # local dev → http://localhost:8080
git add <files>
git commit -m "description"
git push origin main               # PowerShell: no && chaining
```

### Backend
```powershell
cd photo-server
npm install
npm run dev                        # hot-reload → http://localhost:3000/admin
fly deploy                         # production deploy (user runs this)
fly logs                           # check prod logs
fly secrets set KEY="value"        # set env var
```

---

## Docs — Detailed Reference

| File | When to read |
|------|-------------|
| [docs/server.md](docs/server.md) | Routes, services, DB schema, rate limits, deploy checklist |
| [docs/website.md](docs/website.md) | Pages, CSS system, i18n, photo gallery, checkout, ZIP downloads |
| [docs/admin_panel.md](docs/admin_panel.md) | Admin SPA tabs, upload flow, face detection, translation editor |
| [docs/flickr_integration.md](docs/flickr_integration.md) | OAuth, circuit breaker, CDN URLs, watermarking, 429 strategy |
| [docs/fixes_and_issues.md](docs/fixes_and_issues.md) | Applied fixes, known limitations, pending issues, diagnostics |
| [docs/guidelines.md](docs/guidelines.md) | Hard rules, image specs, what to ask before changing, common mistakes |

---

## Architecture at a Glance

```
GitHub Pages (static)          Fly.io (Node/Express)
─────────────────────          ─────────────────────
index.html                     server.js
photos.html ──────────────────▶ /api/public/*
checkout.html                  /api/orders/*
assets/js/i18n.js              /api/admin/*  (session auth)
assets/js/services-catalog.js  /api/public/translations
assets/data/translations.json  /admin  (SPA)
                               photo-server/db/*.json  (JSON on volume)
                               photo-server/services/flickrService.js
                               live.staticflickr.com  (CDN)
```

---

## Key Constraints

- **Photo downloads (ZIP)**: Purchases still use client-side ZIP (`/api/orders/:id/download-urls`). Public/private album ZIP uses server streaming `POST /api/public/albums/:id/download` so mobile/desktop do not build the ZIP in browser memory; optional `ids=` downloads only selected album photos.
- **Album ZIP security**: Public albums expose only the watermarked ZIP. Original/sans-filigrane ZIP is allowed only for private albums after code validation, or through purchase tokens.
- **Photo trash**: Admin deletion soft-deletes photos into a 7-day trash (`deletedAt`), sets them private, hides them from all public APIs, and allows restore selected/all from the sidebar tab `Corbeille`.
- **Private album photos**: Uploading into a private album or moving photos into one forces `downloadType: private` server-side and in the admin UI.
- **Private album sharing**: Never put private album codes in URLs. Share `photos.html?private=1` only so the code modal opens immediately; give the code manually or in separate email text.
- **i18n**: `shouldSkip()` in `i18n.js` must NOT skip `data-i18n` elements — DICT handles all text nodes. `applyDataI18n` is a dead path (no `_i18n` section in translations.json).
- **Services catalog**: `services.html` renders editable services from `translations.json._servicesCatalog` via `assets/js/services-catalog.js`; admin edits it from Texts → Services with the same save/GitHub flow as text edits.
- **Services admin UX**: helper for hierarchy/drafts lives in `photo-server/admin/js/services-admin-ui.js`; keep it in `photo-server/` for Fly deploy because Docker copies only backend files.
- **Watermark**: Applied once at upload, stored as separate Flickr photo. Never re-applied on download.
- **Fly.io volume**: `/data` → `ms_comm_data`. Photos metadata in `db/`, originals (if saved locally) in `storage/originals/`. Most photos are Flickr-only.

---

## Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Admin panel blank | Backend not running | `npm run dev` in photo-server/ |
| Flickr uploads fail | Circuit breaker open | Wait 10 min or reset in Settings |
| ZIP download 429 | Server IP rate-limited by Flickr CDN | Album ZIP streams one photo at a time; purchases still use client-side ZIP |
| Mobile ZIP memory error | Browser cannot allocate enough RAM for a full album ZIP | Album ZIP uses server streaming; purchases may still need selected/smaller downloads |
| Session errors on Windows | OneDrive/Defender lock | Ignore (suppressed), or set `SESSION_DIR` to temp |
| `SESSION_SECRET` error on Fly | Env var missing | `fly secrets set SESSION_SECRET="..."` |
| Translations not updating in EN | `shouldSkip` bug | Check `i18n.js` — `data-i18n` skip must not be present |
| Services prices not updating | Backend serving old `db/translations.json` | Save again from admin Texts → Services, or remove stale dev `photo-server/db/translations.json` |
| Upload crashes after ~30 photos | Fly.io CPU burst credit exhaustion | watermark q82 + no preview copy — see [docs/fixes_and_issues.md](docs/fixes_and_issues.md) |
