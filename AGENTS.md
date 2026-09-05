# AGENTS.md

Cloudflare R2 is the new photo storage. Three levels per photo, **lossless since 2026-09-04** (`r2Lossless: true`): `master/` = the raw bytes of the official Flickr export, never resized nor re-encoded, EXIF kept (private bucket `ms-comm-master`, ~11,8 Mo/photo); `wm/` = watermarked, capped at 4096 px, JPEG q100 chroma 4:4:4, built by the migration for every photo (private); `display/` = watermarked 2048 px q95 (public bucket `ms-comm-display`). The first migration (master 4096 px q90, display 1600 px q82, CDN `_4k` source) visibly degraded the photos and was fully redone with `migrate-to-r2.js --lossless`: export mandatory for every row (no CDN fallback), NEW UUID key per photo, old key deleted after write. Downloads serve the stored bytes as-is (`resizeBufferAndDownload` only re-encodes, at q100, when a resize or a watermark is actually requested). A photo is served from R2 as soon as it carries `r2Key`; Flickr stays a read fallback. Clearing `r2Key` reverts a photo to Flickr instantly — nothing is deleted on Flickr.
Two photo populations coexist and must never be confused. `flickrWatermarkId` set = a clean original exists (564 photos: Mariage Sophie&Antoine, Student Championships Lithuania, Nouvel An Chinois, Ping vacances) and "sans filigrane" is legitimate. `flickrWatermarkId` absent = the only source ALREADY carries a baked watermark (3323 photos): re-watermarking stamps a second logo, and no unwatermarked version exists anywhere. `isWatermarkOnlyPhoto()` in `services/albumAccess.js` is the single decision point; `selectFlickrPhotoId(photo, 'original')` returns null for those rows and every "sans filigrane" exit fails closed with `409 WATERMARK_ONLY` — a valid purchase token does not change this, the bytes do not exist.
Watermark-only import: the admin upload form carries a "Filigrane uniquement" checkbox (`watermarkOnly`) for files that are already watermarked. It uploads ONE Flickr copy, skips client and server watermarking, leaves `flickrWatermarkId` null and sets `r2WatermarkOnly`.

Recent ZIP hardening: album ZIP must only abort on an explicit client request abort, never on a normal response close during archive finalization; Flickr CDN requests use the tested browser User-Agent and stop permanently after three distinct source failures.
Async album ZIP work uses resumable jobs, one Flickr download at a time, one-hour retention, 5 GB target volume, and one shared CPU.
Admin Overview rework: the dashboard reads one aggregate (`GET /api/admin/overview`) with period comparison and an actionable `attention[]` queue, and a Clients section (`GET /api/admin/clients`) derives clients from orders by normalised email until real accounts exist. Roadmap and API contracts: [docs/PLAN_REFONTE.md](docs/PLAN_REFONTE.md).
Visitor accounts: browsing stays anonymous, but every download exit point is gated server-side in `publicApi.js` (`downloadGate`, `401 ACCOUNT_REQUIRED`). Purchase tokens are never gated, and an album code does not replace an account. Cross-site downloads carry a signed `dlTicket`; a client session sets `req.session.accountId` only, never `authenticated`.

Gallery bar: `assets/css/gallery-bar.css` owns the sticky gallery controls through `--bar-w`/`--bar-h` only. Topbar right side is `Demander un devis` → `FR · EN` → `Mon espace` at every width: `account.js` mounts `#acct-control` after `.nav-cta`, the FR/EN switcher re-anchors itself just before `#acct-control`. `.gal-hero` must keep the `.page-header` recipe (`calc(var(--nav-h) + 60px)` top padding + golden `::before` glow) so Photographie sits like every other sub-page. Tabs are Galerie / Albums / **Mon espace** plus the separate `Album privé` button; Visages is removed from the public site (no `faces.js`, no tab, no lightbox overlay — admin face tools stay). `html`/`body` must keep `overflow-x: clip` — `hidden` silently kills every `position: sticky`. Details: [docs/website.md](docs/website.md).

Mon espace: one signed-in tab (`#view-mine`) with three facets — Mes favoris / Mes albums partagés / Mes achats — replacing the old `Mes favoris` + `Mes achats` tabs. Signed out it shows the account door (create first, sign-in as the quiet link). Purchases now come from `GET /api/account/orders`, i.e. they follow the ACCOUNT, not the browser; `localStorage` (`mscomm_tokens`/`mscomm_orders`) is only a migration fallback. Shared albums come from named grants: the admin album modal (private types only) grants access by e-mail into `db/album-grants.json` (`services/albumGrants.js`), keyed by normalised e-mail so a grant can precede signup and is attached on `register()`. Invariant: **a code says WHICH photos, an account says WHO, a grant says TO WHOM** — all three apply, and a grant unlocks a private album WITHOUT the code (`hasAlbumAccess()` in `publicApi.js`, `GET /api/account/albums`). Deep links: `photos.html?view=mine|favorites|purchased|albums_partages`.

> **Update this file + the relevant `docs/` file at every code change.**

Visitor tracking + admin stats: `assets/js/track.js` journals every visitor (anonymous = `vid` + IP, signed-in = linked to the account) into `db/track-events.json` / `track-sessions.json` / `visitors.json` through `POST /api/public/track` (`services/tracking.js`, always 204, client-only event types). Server-side truths (`download`, `album_download`, `favorite_*`, `login`, `signup`, `logout`, `order`) are written by `tracking.logServerEvent()` at the point where the action happens and can never be forged from the browser. `services/stats.js` aggregates for `/api/admin/stats/*` (summary, photos, albums, visitors, events — every route accepts `range=7d|30d|90d|12m|all` or `from/to` + `granularity`), and feeds the Overview (`trackingActive`, `breakdown`, extra kpis) and Clients (`segment=visitors`, `tracking{}`, `journey[]`). Views are deduped per visitor/target within 30 s; the raw IP is kept on purpose and only ever surfaces behind `requireAuth`. `X-MS-Vid` must stay in the CORS `allowedHeaders`. Contract: [docs/tracking.md](docs/tracking.md).

---

## Project — MS Comm'

Dual-stack photography portfolio with integrated photo gallery:
- **Frontend**: Static HTML/CSS/JS on GitHub Pages (`https://ms-comm.github.io/`)
- **Backend**: Node.js/Express on Fly.io (`https://ms-comm-server.fly.dev`)

---

## Critical Rules

| Rule | Detail |
|------|--------|
| **Backend isolation** | Never commit `photo-server/` into the public frontend repo. Backend source lives in private `Fuzois21/ms-comm-server`; deploy via `fly deploy`. |
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
| [docs/PLAN_REFONTE.md](docs/PLAN_REFONTE.md) | Overview/Clients rework, client accounts, favorites, Atelier MS Comm' — architecture, API contracts, phases |

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

- **Admin client sheet (phase 3)**: `GET /api/admin/clients/:id` carries `counters`, `engagement` and an enriched `timeline`. `engagement.activityByDay` is always 30 points, empty days included — a variable-length series misrepresents the time axis. `topAlbums[]` keeps `purchased` and `viewed` apart: a browse must never be shown as a purchase. A `guest` client legitimately has zeros; the sheet explains why instead of showing dashes.
- **Album views must be journalled**: `photos.html` logs `album_view` in `openAlbum()` and after a private-code unlock. Without it the "Albums vus" counter stays at zero and the client sheet lies by omission.
- **Charts vs the global SVG rule**: `admin.css` styles icons with `svg { stroke: currentColor }`. Every chart built by `charts.js` carries the class `.ms-chart`, which resets that inheritance; removing it draws a white outline around every bar and hover zone.
- **Download requires an account**: `/photos/:id/download`, `/albums/:id/download`, `/albums/:id/download-check` and `/albums/:id/download-urls` reject anonymous callers with `401 { code: 'ACCOUNT_REQUIRED' }` (`downloadGate` in `publicApi.js`). Browsing stays anonymous. Exception: purchase tokens (`?token=`, every `orders.js` route) are never gated. An album code authorises WHICH photos, the account authorises WHO — both apply.
- **Client vs admin session**: never set `req.session.authenticated` on a client login. `requireAuth` tests `authenticated`, `requireAccount` tests `accountId`; the two perimeters must not bleed.
- **Session cookie**: `SameSite=None; Secure` in production because GitHub Pages and Fly are cross-site; `Lax` in dev. Reverting this silently signs every visitor out.
- **Download tickets**: browser-initiated downloads (`<a download>`, form POST) carry a 10-minute HMAC `dlTicket` instead of the cookie. It proves identity only — album privacy, tokens and watermark policy stay enforced downstream.
- **Photo downloads (ZIP)**: Album ZIP is built **client-side on every device** from `/api/public/albums/:id/download-urls` + `fflate`. Once a photo carries `r2Key`, `directUrl` is a presigned R2 URL (`master` for a clean or watermark-only original, `wm` otherwise) and Flickr is only used for rows not yet migrated. The manifest returns `source: 'r2' | 'mixte' | 'flickr'`; on a fully migrated album the client drops its 500 ms inter-photo delay, which only ever existed to spare the Flickr CDN. Purchases also use client-side ZIP (`/api/orders/:id/download-urls`).
- **Album ZIP UI**: One `zipProgress` controller drives the inline banner and the `#zip-modal` three-step dialog (Préparation / Téléchargement des photos / Fabrication du ZIP), each step with its own bar and live `n/total`. Closing the modal must never cancel the download; the banner stays visible and reopens the panel.
- **Album ZIP estimates**: A step with no countable unit must never use an indeterminate bar. It fills asymptotically against an ETA (seeded from the photo count) and displays a remaining-time estimate from the first frame, refreshed as the real pace is measured. Never let such a bar reach 100 % before the step actually ends.
- **Album ZIP success**: A finished ZIP must end on an explicit animated confirmation in the panel, never on a silently closed modal. The archive blob is kept 10 minutes so `Retélécharger` can re-save it without re-fetching Flickr; when it is revoked the button must be withdrawn, and a new run must clear both the cached blob and the success state.
- **Album ZIP browser cadence**: 500 ms between two photo downloads in `downloadAlbumZip()`, skipped after the last photo.
- **Album ZIP reuse**: Identical album/mode/policy/exact-Flickr-source selections reuse one queued, running, paused, failed, archiving, or unexpired ready job; a failed job restarts from its checkpoint only after an explicit new POST/click, never from status polling. A policy/source change must invalidate old ZIPs.
- **Album ZIP progress**: The gallery must show a dedicated progress bar for both PC-local downloads and server preparation; fallback from local to server must be explicit and visible.
- **Private album refresh**: Keep private album route context and temporary access in session storage; never place private code in the URL.
- **ZIP visual state**: While local or server ZIP work runs, button shows animated progress; invalid/stale saved job state must be cleared without displaying `undefined` values.
- **ZIP immediate feedback**: Set visible progress state before any manifest or server request; private album URL may retain album context but never private code.
- **ZIP loading icon**: Hide download SVG while animated loading indicator is active; restore it when the job ends.
- **ZIP diagnostics**: Log job start/checkpoint, source label, HTTP/network failure, alternate-source delay, archive start, ready expiry, and terminal stop after three failures.
- **ZIP retry cap**: Exactly three aggregate attempts per photo for non-429 failures, with 5-second then 10-second delays. The third failure marks the job `failed`; status polling must never restart it.
- **ZIP 429 handling**: HTTP 429 is a rate limit, not a source failure. It must NOT consume a normal attempt and must NOT switch source. The job pauses via `pauseForRateLimit` (`status: paused`, `resumeAt`), waits `Retry-After` when present, otherwise 60s/120s/300s, doubles the inter-photo cadence up to 8s, and resumes the same photo. Only after 6 pauses does the job fail.
- **Browser ZIP 429 handling**: the client loop `fetchAlbumPhotoBytes()` in `photos.html` follows the same rule as the server worker. A 429 never consumes one of the 3 attempts: it pauses (`Retry-After`, else 20/45/90/120/180/300 s), retries the same photo, doubles the inter-photo cadence (500 ms up to 8 s), and only fails after 6 pauses. Treating a 429 as a failure makes throttled connections die at a fixed photo index while other connections succeed.
- **ZIP cadence**: `interPhotoDelayMs` defaults to 1000 ms and self-adapts upward on each 429 (max 8000 ms).
- **ZIP transient gateway errors**: `500/502/503/504`, metadata failures, and stream failures advance to the next source instead of repeating the same URL.
- **ZIP Flickr fallback**: Use the tested browser User-Agent and cache-busting for three distinct sources: original `_o` from owner `getInfo`, exact `Large 2048` `_k` returned by `getSizes`, then validated `_b` URL from `getInfo`. Never manually invent `_k` or accept `getSizes` widest fallback. Strict watermark albums resolve all three from the watermark Flickr photo ID only.
- **ZIP stream safety**: Stage each Flickr stream through `stream.pipeline()`, remove failed `.part` files without masking the original error, treat archive warnings/errors as terminal before marking ready, and heartbeat `archiving` jobs so cleanup cannot delete an active large archive.
- **ZIP route failures**: Wrap async Express 4 handlers so filesystem/JSON errors reach middleware; map temporary-storage budget overflow to HTTP 413 instead of leaving requests pending.
- **Production sessions**: Default `SESSION_DIR` must be `/data/sessions` on Fly, not OS temp; stale cookies may produce one recoverable `ENOENT` and require login once.
- **ZIP cleanup**: Queued, running, paused, or failed ZIP jobs with no update for 10 minutes are deleted with their temporary files; ready ZIPs keep their existing one-hour TTL.
- **Album ZIP precheck**: `/api/public/albums/:id/download-check` must not block an album on one Flickr 429; it tests several candidate sources and only blocks if all checked sources fail. A fully migrated album short-circuits to `checked: 'r2'`: probing the Flickr CDN for bytes that will never be requested invents a failure. That short-circuit must sit BEFORE the `candidates` filter, never inside its callback — nested, it answered the first photo then called `res.json()` again for every remaining one, raising an unhandled `ERR_HTTP_HEADERS_SENT` per photo (186 on a 187-photo album) while still returning a correct-looking response.
- **Album ZIP security**: Public albums expose only the watermarked ZIP. Original/sans-filigrane ZIP is allowed only for private albums after code validation, or through purchase tokens.
- **Private watermark albums**: `private-watermark` requires a code but exposes only baked watermarked copies. Individual, ZIP, precheck, and URL-list endpoints must reject originals and must fail closed when no safe watermark exists; never fall back to an original.
- **Photo trash**: Admin deletion soft-deletes photos into a 7-day trash (`deletedAt`), sets them private, hides them from all public APIs, and allows restore selected/all from the sidebar tab `Corbeille`.
- **Private album photos**: Uploading into a `private`, `private-watermark`, or `private-nocode` album or moving photos into one forces `downloadType: private` server-side and in the admin UI.
- **Private album conversion**: Switching an existing public/paid album to any private type must first set both Flickr copies private sequentially for every linked photo, including trash, then force active photo metadata to `downloadType: private`; abort the album type change if remote privacy cannot be verified.
- **Flickr private visibility**: `downloadType: private` must set both Flickr original and watermark copies private. `private-watermark` and `private-nocode` albums follow the same rule as private albums.
- **Watermark repair**: Admin selected photos without `flickrWatermarkId` can create a watermarked duplicate later via `/api/admin/photos/bulk/create-watermark`; this links `flickrWatermarkId`/`flickrWatermarkUrl` and then re-syncs Flickr visibility.
- **Preview repair**: Admin selected photos can run `/api/admin/photos/bulk/repair-previews` to refresh `flickrWatermarkUrl` and regenerate local previews from Flickr without reupload; only ask to create a watermark if no `flickrWatermarkId` is linked.
- **Bulk admin UX**: Long selected-photo actions must show the blocking bulk progress modal and run sequentially so the admin sees progress and cannot trigger conflicting actions.
- **Album display order**: Public/private album views render photos newest-first (`takenAt || createdAt`) and public album opening reloads album photos from `/api/public/photos?albumId=...` before falling back to cached data.
- **Private album sharing**: Never put private album codes in URLs. Share `photos.html?private=1` only so the code modal opens immediately; give the code manually or in separate email text.
- **i18n**: `shouldSkip()` in `i18n.js` must NOT skip `data-i18n` elements — DICT handles all text nodes. `applyDataI18n` is a dead path (no `_i18n` section in translations.json).
- **Services catalog**: `services.html` renders editable services from `translations.json._servicesCatalog` via `assets/js/services-catalog.js`; admin edits it from Texts → Services with the same save/GitHub flow as text edits.
- **Services admin UX**: helper for hierarchy/drafts lives in `photo-server/admin/js/services-admin-ui.js`; keep it in `photo-server/` for Fly deploy because Docker copies only backend files.
- **Watermark**: Applied once at upload, stored as separate Flickr photo. Never re-applied on download.
- **R2 storage levels (lossless)**: `master` = raw export bytes (~11,8 Mo/photo, ~30 Go for 3887), `wm` ≤ 4096 px q100 4:4:4 (~8–12 Mo), `display` 2048 px q95 (~0,8 Mo). Total ≈ 40 Go, i.e. beyond the 10 Go free tier (~0,015 $/Go/month → ~0,5 $/month), accepted by Loïs on 2026-09-04 ("aucune limite, aucune compression"). Never reintroduce `R2_MASTER_QUALITY` or a master resize; `R2_WM_QUALITY`/`R2_DISPLAY_QUALITY` live in `imageProcessor.js`. Admin upload limit is 1 Go per file.
- **R2 migration**: run it LOCALLY from the official Flickr export, then push only the `r2*` keys to production with `tools/push-r2-keys.js`. Running it on Fly was abandoned: Flickr throttles the `_o` path, and Fly's single shared CPU turns the re-encode into the bottleneck. The job is resumable, keeps state in `storage/r2-migration-state.json`, and `--verify` re-checks that every migrated photo has all its levels.
- **Flickr 429 real cause**: only the `_o` path is throttled, not the IP and not the CDN. Measured on one photo at one instant with identical headers: `_o` → 429 while `_6k`, `_5k`, `_4k`, `_3k`, `_k` and `_b` all returned 200. `_o` is built from `originalsecret`; the pre-rendered sizes use the ordinary secret and stay served. The migration therefore tries `_4k` BEFORE `_o` — and since `R2_MASTER_MAX` is 4096, the output is identical, not a compromise.
- **The Flickr export is only trusted for photos with a clean original**: `migrate-to-r2.js` reads the export ONLY when `flickrWatermarkId` is set. Measured 2026-09-03 over the 1431 watermark-only rows, the export is MIXED: it returns a clean original for some and an already-stamped file for others, and no database field separates them. Re-applying the watermark on an already-stamped export file bakes a second logo (seen visually). A pixel detector was built and rejected — 23 % false positives against a 564-photo control of known status — so the code does not guess: those rows fall back to the CDN copy, which is exactly what the site already published. Export originals also carry orientation in EXIF while CDN renders are pre-straightened, so `.rotate()` is mandatory or portraits come out lying down.
- **The migration refuses to start without the watermark assets**: `renderWatermarkedBuffer` does not fail when the logo or the custom font is missing — it silently falls back to a bare monospace font and drops the logo, baking a degraded watermark that can only be undone by re-migrating. A local run against a `DATA_DIR` without `storage/watermark-asset.png` stamped 564 photos that way (2026-09-03). `runMigrate()` now checks both paths up front and exits 1. Fetch them from production first: `fly ssh sftp get /data/storage/watermark-asset.png` and `/data/storage/fonts/<hash>.ttf`.
- **R2 CORS**: both buckets allow `https://ms-comm.github.io` plus localhost, methods `GET`/`HEAD`. Without it the browser-side album ZIP cannot read a presigned master URL. The R2 API token cannot write this policy (`AccessDenied`); set it from the dashboard.
- **Never re-watermark on download**: R2 serving picks `wm` for watermarked requests and `master` otherwise, except when `master` already carries a baked watermark, in which case it is served as-is for both modes.
- **`download-urls` must count its R2 hits**: `source` drives the browser cadence — `'r2'` drops the 500 ms inter-photo delay that only ever existed to spare the Flickr CDN. `r2Count` was incremented in an `else if (directUrl)` branch made unreachable by the R2 presign that had just set `directUrl`, so a fully migrated album still reported `'flickr'` and paid 500 ms x N photos for nothing (187 photos = 1,5 min). Increment it where the presigned URL is produced, never in a fallback branch.
- **The ZIP manifest resolves photos in parallel**: `download-urls` used to run `r2.exists()` then `signedUrl()` in SERIES, i.e. one network round-trip per photo before answering anything — measured at 11,6 s of dead time on a 187-photo album while the bytes themselves take ~20 s. Photos are resolved with a bounded pool (`MANIFEST_CONCURRENCY = 16`) and written by index, so order is preserved: 11,6 s → 1,4 s. Never turn that loop back into a sequential `for`.
- **The `wm` level must exist for every photo**: without it `download-urls` cannot presign and silently falls back to the Flickr CDN (seen: 120 of 121 photos of the paid album still went to Flickr after the first migration). The lossless migration builds `wm` for every row; `tools/prebuild-wm.js` remains for photos uploaded later with `flickrWatermarkId` (reads the R2 master, no Flickr call, refuses to start without the watermark assets).
- **Never re-watermark a stamped master**: the export equals CDN `_o` byte for byte (sha checked), so every watermark-only photo (no `flickrWatermarkId`) has a master that ALREADY carries the logo. The lossless run of 2026-09-04 stamped `wm`/`display` on top of it and produced a double logo on all 3323 rows (seen visually). Fixed by `tools/rebuild-stamped-levels.js`: master re-read from R2, `wm` (≤ 4096 px q100) and `display` (2048 px q95) rebuilt as plain reductions via `resizeCappedBuffer()`, new UUID key, `r2MasterStamped: true`. That flag makes `isR2MasterWatermarked()` true regardless of `r2Source`; the lazy `wm` build in `serveFromR2` and `buildR2Levels()` (`alreadyWatermarked`) reduce instead of stamping. `migrate-to-r2.js` now treats every row without a clean original as stamped, export or not. 124 wmOnly exports carry EXIF orientation 6/8: `.rotate()` stays on the `wm`/`display` branches; the raw master keeps its EXIF.
- **Level policy per photo**: `master` = original bytes (clean for the 564 rows with `flickrWatermarkId`, stamped for the 3323 others). `wm` = what a watermarked download serves: one logo, ≤ 4096 px, q100 — baked lazily on first request when missing (`serveFromR2`), or served as `master` when the master is stamped and `wm` absent (`download-urls`). `display` = gallery/lightbox at 2048 px (fast to load); the site never shows the master.
- **Push after lossless**: `migrate-local.ps1 -PushOnly` calls `push-r2-keys.js --replace` because every photo got a NEW key; without `--replace` the prod/local key conflict is silently ignored. Then `purge-r2-orphans.js` (simulate, then `--delete`) removes the old-key objects.
- **`isR2MasterWatermarked()` is not `isWatermarkOnlyPhoto()`**: the first says what the BYTES contain, the second what the photo may OFFER. For one same watermark-only photo the Flickr CDN copy is baked while the official export returns the clean original, so the answer depends on `r2Source`, never on the rights alone. Collapsing the two served unstamped files to visitors who asked for the watermarked version (found visually on an export-migrated master, 2026-09-02); `r2WatermarkOnly` must keep blocking the sans-filigrane exits either way.
- **Fly.io VM size**: Production app should run on `shared-cpu-1x` with 512 MB RAM + 512 MB swap.
- **Fly.io volume**: `/data` → `ms_comm_data`. Photos metadata in `db/`, originals (if saved locally) in `storage/originals/`.

---

## Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Admin panel blank | Backend not running | `npm run dev` in photo-server/ |
| Flickr uploads fail | Circuit breaker open | Wait 10 min or reset in Settings |
| ZIP download 429 | Server IP rate-limited by Flickr CDN | Album ZIP probes `/download-check` and shows contact email before starting when Flickr already blocks Fly |
| ZIP download 502 only with Axios | CloudFront rejects the default Axios User-Agent | Async ZIP uses the tested browser User-Agent and `_o` → `_k` → `_b` source fallback |
| Mobile ZIP memory error | Browser cannot allocate enough RAM for a full album ZIP | Album ZIP uses server streaming; purchases may still need selected/smaller downloads |
| Session errors on Windows | OneDrive/Defender lock | Ignore (suppressed), or set `SESSION_DIR` to temp |
| `SESSION_SECRET` error on Fly | Env var missing | `fly secrets set SESSION_SECRET="..."` |
| Translations not updating in EN | `shouldSkip` bug | Check `i18n.js` — `data-i18n` skip must not be present |
| Services prices not updating | Backend serving old `db/translations.json` | Save again from admin Texts → Services, or remove stale dev `photo-server/db/translations.json` |
| Upload crashes after ~30 photos | Fly.io CPU burst credit exhaustion | watermark q82 + no preview copy — see [docs/fixes_and_issues.md](docs/fixes_and_issues.md) |
