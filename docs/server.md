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
- `GET /api/orders/:id/download-urls?token=xxx` — **Preferred.** Returns JSON list of Flickr CDN URLs for client-side ZIP assembly (zero server bandwidth for files).
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
