# CLAUDE.md

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
| **User deploys backend** | `fly deploy` is run manually by the user, not automated |
| **Frontend → GitHub** | Push root HTML/CSS/JS/assets to deploy to GitHub Pages |
| **Update docs on change** | After any code change, update CLAUDE.md + the relevant `docs/*.md` |

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
| [docs/website.md](docs/website.md) | Pages, CSS system, i18n, photo gallery, checkout, client-side ZIP |
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
assets/data/translations.json  /admin  (SPA)
                               photo-server/db/*.json  (JSON on volume)
                               photo-server/services/flickrService.js
                               live.staticflickr.com  (CDN)
```

---

## Key Constraints

- **Photo downloads (ZIP)**: Use client-side approach (`/api/orders/:id/download-urls`) — server only returns Flickr metadata URLs. Browser fetches files directly. See [docs/flickr_integration.md](docs/flickr_integration.md).
- **i18n**: `shouldSkip()` in `i18n.js` must NOT skip `data-i18n` elements — DICT handles all text nodes. `applyDataI18n` is a dead path (no `_i18n` section in translations.json).
- **Watermark**: Applied once at upload, stored as separate Flickr photo. Never re-applied on download.
- **Fly.io volume**: `/data` → `ms_comm_data`. Photos metadata in `db/`, originals (if saved locally) in `storage/originals/`. Most photos are Flickr-only.

---

## Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Admin panel blank | Backend not running | `npm run dev` in photo-server/ |
| Flickr uploads fail | Circuit breaker open | Wait 10 min or reset in Settings |
| ZIP download 429 | Server IP rate-limited by Flickr CDN | Use client-side ZIP endpoint |
| Session errors on Windows | OneDrive/Defender lock | Ignore (suppressed), or set `SESSION_DIR` to temp |
| `SESSION_SECRET` error on Fly | Env var missing | `fly secrets set SESSION_SECRET="..."` |
| Translations not updating in EN | `shouldSkip` bug | Check `i18n.js` — `data-i18n` skip must not be present |
| Upload crashes after ~30 photos | Fly.io CPU burst credit exhaustion | `FLICKR_WM_MAX=1920` in imageProcessor.js — see [docs/fixes_and_issues.md](docs/fixes_and_issues.md) |
