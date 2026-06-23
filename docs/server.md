# Backend Server — photo-server/

> Deploy: `fly deploy` from `photo-server/`. Never commit `photo-server/` to GitHub.

## Entry Point

`photo-server/server.js` — Express app, all middleware, route mounting, rate limiters.

## Routes

| File | Mount | Responsibility |
|------|-------|----------------|
| `auth.js` | `/api/auth` | Login/logout, password change, bcrypt migration |
| `adminPhotos.js` | `/api/admin/photos` | CRUD photos, Flickr/local upload, sharp resize, download |
| `adminAlbums.js` | `/api/admin/albums` | CRUD albums, email codes for private albums, Flickr photoset sync |
| `adminOrders.js` | `/api/admin/orders` | Order list, token generation, download |
| `adminPromoCodes.js` | `/api/admin/promo-codes` | Promo code CRUD, discount application |
| `adminSettings.js` | `/api/admin/settings` | Config (prices, watermark, SMTP, Flickr keys, GitHub token) |
| `adminFaces.js` | `/api/admin/faces` | Face detection + tagging via gallery-app worker |
| `adminTranslations.js` | `/api/admin/translations` | i18n text management, GitHub sync |
| `publicApi.js` | `/api/public` | Public: list albums/photos, download, album ZIP, verify codes |
| `orders.js` | `/api/orders` | Stripe checkout confirm, download-all ZIP, **download-urls** (client-side ZIP), per-order retrieval |
| `stripeWebhook.js` | `/api/stripe` | Stripe payment confirmation webhook |
| `workerApi.js` | `/api/admin/worker` | gallery-app worker: claim/complete scan jobs |

## Key Route Details

### orders.js — Download Endpoints
- `GET /api/orders/:id/download-all?token=xxx` — Server-side ZIP (Flickr → server → client). Subject to Flickr CDN 429 if server IP rate-limited.
- `GET /api/orders/:id/download-urls?token=xxx` — **Preferred.** Returns `{ photoId, filename, token }` per photo. No Flickr API calls. Client uses these tokens to call `/api/public/photos/:id/download?token=xxx` individually and builds ZIP in browser.
- `GET /api/orders/:id` — Retrieve order + tokens (completed orders only).

### publicApi.js — Photo Download Matrix
```
free              → flickrOriginalId (public Flickr URL, redirected)
free-watermark    → flickrWatermarkId (public watermarked copy)
paid (no token)   → flickrWatermarkId (locked behind paywall)
paid (valid token)→ flickrOriginalId (streams via server)
private album     → flickrOriginalId or flickrWatermarkId (album code required)
```

Individual download uses `streamFlickrSized` which does **server-side streaming** (pipes Flickr → client without buffering). For "Original" it uses `originalsecret` URL; for sized it uses CDN size suffixes (`_h`, `_k`, etc.).

### publicApi.js - Album ZIP
- `POST /api/public/albums/:id/download` streams a ZIP directly from Fly to the browser. The website sends a form POST so private album codes stay in the body, not the URL.
- Body fields: `mode=watermark|original`, optional `code=xxx`, optional `ids=id1,id2`.
- The ZIP uses `archiver` with `store:true` and appends one local/Flickr stream at a time. Fly does not buffer the full ZIP or all photos in memory.
- `POST /api/public/albums/:id/download-check` probes the first Flickr source before the website starts the form download. If Flickr returns 429, the site shows an error with `mscomm.contact@gmail.com`.
- `ids` is optional. When present, only those selected photo IDs are streamed; used by the album selection download.
- `mode=watermark` is allowed for public albums and private albums with code.
- `mode=original` is allowed only for private albums with a valid code. Public paid originals still require order download tokens.
- `GET /api/public/albums/:id/download-urls?mode=watermark|original&code=xxx&ids=id1,id2` remains available as metadata fallback for browser-side ZIP creation.

### adminPhotos.js - Trash
- Default admin delete is soft-delete: sets `deletedAt`, stores `previousDownloadType`/`previousAlbumId`, changes `downloadType` to `private`, and flips the Flickr watermark copy private best-effort.
- Trash/private visibility sync hides both original and watermark Flickr copies when available.
- `GET /api/admin/photos?downloadType=trash` lists only trashed photos; normal photo lists exclude `deletedAt`.
- `POST /api/admin/photos/bulk/restore` restores selected ids or `{ all: true }`.
- A startup/daily purge permanently removes trashed photos older than 7 days from JSON/local files/Flickr best-effort.

### adminPhotos.js - Private Album Enforcement
- `POST /api/admin/photos/upload` and `PUT /api/admin/photos/:id` force `downloadType: private` whenever the target `albumId` belongs to an album with `type: private` or `type: private-nocode`.
- The enforcement is server-side so upload, single edit, bulk album move, and album-photo membership edits all share the same rule.
- `PUT /api/admin/photos/:id` syncs Flickr permissions for both copies: `private` => original + watermark private, `free` => original public + watermark private, `free-watermark/paid` => original private + watermark public.
- `POST /api/admin/photos/bulk/create-watermark` repairs old imports that have `flickrOriginalId` but no `flickrWatermarkId`: download original, generate watermark, upload the watermark copy, store the Flickr metadata, then run the same visibility sync.
- `GET/POST /api/admin/photos/upload-history` stores and lists upload batch history in `db/upload-history.json`.

## Services

| File | Purpose |
|------|---------|
| `db.js` | Atomic JSON read/write with per-file mutexes. Retries rename with backoff; fallback to direct overwrite. |
| `flickrService.js` | OAuth 1.0a, upload, download, photoset sync, circuit breaker. See [flickr_integration.md](flickr_integration.md). |
| `imageProcessor.js` | Sharp pipeline: decode → resize (1200px preview) → watermark SVG → encode JPG q85. |
| `emailService.js` | Nodemailer: private album access codes, order download links. |
| `stripeService.js` | Stripe SDK: create payment intent, validate webhook signature. |
| `analytics.js` | Lightweight download/visit counters in JSON files (capped at 5000 entries). |

## Database — photo-server/db/ (JSON files on Fly volume)

| File | Key Fields |
|------|-----------|
| `settings.json` | `adminPassword` (bcrypt), `defaultPrice`, `watermark{}`, `smtp{}`, `flickr{}`, `githubToken` |
| `photos.json` | `id`, `title`, `albumId`, `flickrOriginalId`, `flickrWatermarkId`, `flickrWatermarkUrl`, `downloadType`, `price`, `ext`, `width`, `height` |
| `albums.json` | `id`, `name`, `type` (public/private/paid), `code`, `flickrSetId`, `maxDownloads` |
| `orders.json` | `id`, `status`, `photos[]` (photoId + downloadToken), `orderDownloadToken`, `total`, `customer{}` |
| `promo-codes.json` | `code`, `discountType` (fixed/percent), `discountValue`, `maxUses`, `uses`, `active` |
| `persons.json` | `id`, `name` — named faces |
| `appearances.json` | `personId`, `photoId`, `bbox{}` — face detection results |
| `scan-jobs.json` | Batch face-scan jobs: `pending/running/done/failed` |
| `worker-state.json` | gallery-app worker heartbeat |

## Security

- Admin password: bcrypt 12 rounds. Plaintext auto-migrated on first login.
- Session: file-based, httpOnly, regenerated on login (session fixation prevention).
- CSP: strict in production (Stripe, Flickr, Google Fonts only).
- `SESSION_SECRET` required in prod — server refuses to start without it.
- Server-side discount recalculation — client total is ignored.

## Rate Limiting (order matters — most specific first)

```
/api/auth/login      → 10 req / 15 min  (brute-force)
/api/orders          → 20 req / 10 min  (card-testing)
/api/admin/worker/*  → 30000 req / 15 min (parallel face-scan workers)
/api/admin/*         → 3000 req / 15 min  (admin heartbeat + bulk ops)
/api/*               → 2000 req / 15 min  (catchall)
/healthz             → NO limiter (mounted before all limiters)
```

## Fly.io Production

- Region: Paris (cdg)
- VM: 1 shared CPU, 512 MB RAM + 512 MB swap
- Volume: `/data` → `ms_comm_data` (persists db/ + storage/)
- Min machines: 1 (always-on for worker batch flushes)
- Healthcheck: `GET /healthz` every 30s

### Environment Variables

```
NODE_ENV=production
SESSION_SECRET=<64+ chars>
SITE_URL=https://ms-comm.github.io
PUBLIC_API_URL=https://ms-comm-server.fly.dev
FLICKR_API_KEY, FLICKR_API_SECRET, FLICKR_ACCESS_TOKEN, FLICKR_ACCESS_TOKEN_SECRET
STRIPE_PUBLISHABLE_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
DATA_DIR=/data
SESSION_DIR=<os-temp>   (optional, avoids Windows file lock issues)
```

## Windows Dev Quirks

- Session store: OneDrive/Defender hold file locks. Wrapped with 25 retries + fallback to direct overwrite.
- `SESSION_DIR` should point to OS temp (not project dir) to avoid lock contention.
- PowerShell: no `&&` operator — run git commands sequentially.

## Deploy Checklist

```
Before fly deploy:
  □ npm run dev locally — admin panel loads, no JS errors
  □ Test photo upload + Flickr sync
  □ Test Stripe (dev keys)
  □ All secrets set: fly secrets list

After fly deploy:
  □ fly logs — no startup errors
  □ curl https://ms-comm-server.fly.dev/healthz → 200
  □ Admin panel loads
  □ Upload one photo → appears in gallery
```
