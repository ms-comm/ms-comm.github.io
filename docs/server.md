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
| `adminOverview.js` | `/api/admin/overview` | Dashboard aggregate: KPI + delta vs previous window, series, top lists, health, attention queue |
| `adminClients.js` | `/api/admin/clients` | Client list/detail derived from orders (email key). See [PLAN_REFONTE.md](PLAN_REFONTE.md) |
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
- `POST /api/public/albums/:id/zip-jobs` creates a resumable asynchronous ZIP job; `GET /api/public/zip-jobs/:jobId` reports progress or the terminal error and `GET /api/public/zip-jobs/:jobId/download` serves the complete ZIP after all photos are staged. Ready ZIPs expire after 1 hour.
- Repeated requests reuse a job only when album, mode, album policy, photo IDs, and exact Flickr source IDs all match. This prevents an old public ZIP from surviving a conversion to `private-watermark`. Status polling never restarts `failed`; only a new POST/click resets the failed photo and resumes from completed checkpoint files.
- Each photo gets three aggregate attempts: Flickr original `_o` from owner metadata, exact `Large 2048` `_k` returned by `getSizes`, then validated `_b` URL from `getInfo`. Every CDN request uses the tested browser User-Agent, image `Accept`, cache-busting, and a 60-second request timeout.
- Failed sources wait 5 then 10 seconds. The third failure persists `failed`, failed photo/source/status, and a user-facing error; no automatic pause/retry loop remains for new jobs.
- Async Express 4 handlers forward rejected storage/JSON operations to error middleware; an estimated ZIP above the temporary-storage budget returns HTTP 413. Archiver warnings such as a vanished checkpoint file fail the job instead of producing an incomplete `ready` ZIP.
- On Fly production, `express-session` files persist under `/data/sessions` on the attached volume. `session get suppressed: ENOENT` means an old cookie references a removed session; it is recoverable by logging in again and does not indicate a Flickr failure.
- ZIP cleanup runs every 10 minutes and removes queued/running/paused/failed/archiving jobs with no update for 10 minutes, including their temporary files. Active archive creation emits a one-minute heartbeat, so cleanup cannot remove a large ZIP while it is being finalized. This gives a manual retry up to 10 minutes to reuse completed checkpoint files. Ready ZIPs expire after one hour.
- Body fields: `mode=watermark|original`, optional `code=xxx`, optional `ids=id1,id2`.
- The ZIP uses `archiver` with `store:true` and appends one local/Flickr stream at a time. Fly does not buffer the full ZIP or all photos in memory. A normal response close during archive finalization must not abort the archive; only the request `aborted` event may do so.
- `POST /api/public/albums/:id/download-check` probes several candidate Flickr sources before the website starts the form download. If every checked source is blocked by Flickr 429, the site shows an error with `mscomm.contact@gmail.com`; one 429 must not block the album if another selected photo is reachable.
- `ids` is optional. When present, only those selected photo IDs are streamed; used by the album selection download.
- `mode=watermark` is allowed for public albums and code-unlocked `private`/`private-watermark` albums.
- `mode=original` is allowed only for `private` albums with a valid code. `private-watermark` rejects originals even with a valid code; public paid originals still require order download tokens.
- For `private-watermark`, ZIP, precheck, URL-list, and individual downloads use only `flickrWatermarkId` or `storage/watermarked/:id.jpg`. Missing safe copies return `409`; an original is never used as fallback.
- `GET /api/public/albums/:id/download-urls?mode=watermark|original&code=xxx&ids=id1,id2` remains available as metadata fallback for browser-side ZIP creation.

### adminPhotos.js - Trash
- Default admin delete is soft-delete: sets `deletedAt`, stores `previousDownloadType`/`previousAlbumId`, changes `downloadType` to `private`, and flips the Flickr watermark copy private best-effort.
- Trash/private visibility sync hides both original and watermark Flickr copies when available.
- `GET /api/admin/photos?downloadType=trash` lists only trashed photos; normal photo lists exclude `deletedAt`.
- `POST /api/admin/photos/bulk/restore` restores selected ids or `{ all: true }`.
- A startup/daily purge permanently removes trashed photos older than 7 days from JSON/local files/Flickr best-effort.

### adminPhotos.js - Private Album Enforcement
- `POST /api/admin/photos/upload` and `PUT /api/admin/photos/:id` force `downloadType: private` whenever the target `albumId` belongs to an album with `type: private`, `private-watermark`, or `private-nocode`.
- `PUT /api/admin/albums/:id` entering a private type synchronizes both Flickr IDs for every linked photo, including trash, to private sequentially before changing the album, then saves active photos as `downloadType: private`; Flickr/configuration failure returns `502` without changing the album type.
- `POST /api/admin/photos/bulk/restore` reapplies this enforcement to the restored album instead of trusting the historical download type.
- The enforcement is server-side so upload, single edit, bulk album move, and album-photo membership edits all share the same rule.
- `PUT /api/admin/photos/:id` syncs Flickr permissions for both copies: `private` => original + watermark private, `free` => original public + watermark private, `free-watermark/paid` => original private + watermark public.
- `POST /api/admin/photos/bulk/repair-previews` repairs selected-photo thumbnails without reupload: refresh `flickrWatermarkUrl` from Flickr and regenerate `/storage/previews/:id.jpg` from the Flickr watermark/original source when missing.
- `POST /api/admin/photos/bulk/create-watermark` repairs old imports that have `flickrOriginalId` but no `flickrWatermarkId`: download original, generate watermark, upload the watermark copy, store the Flickr metadata, then run the same visibility sync.
- `GET/POST /api/admin/photos/upload-history` stores and lists upload batch history in `db/upload-history.json`.

+### adminOverview.js / adminClients.js - Dashboard aggregation

- `GET /api/admin/overview?range=7d|30d|90d|12m` returns one payload for the whole dashboard: `kpis` (each with
  `value`, `previous`, `deltaPct`), `series` (`revenue`, `traffic`, `hourly`, `photoGrowth`), `top`
  (`photos`, `albums`, `sold`, `clients`), `health` and `attention`.
- `deltaPct` compares the window to the immediately preceding window of equal length. It is `null` when the previous
  window is empty, so the UI shows "nouveau" instead of an infinite percentage.
- `granularity` is `day` up to 90 days and switches to `month` (12 points) for `12m`, keeping the payload small.
- `attention[]` is the actionable queue: `photos_without_watermark`, `private_album_without_code`, `orders_pending`
  (over 48 h), `trash_not_empty`, `flickr_breaker_open`, `flickr_not_configured`, `scan_jobs_failed`. Sorted
  `error` then `warn` then `info`.
- `photos_without_watermark` only counts non-private photos with a Flickr original but neither `flickrWatermarkId`
  nor `flickrWatermarkUrl`. Testing `flickrWatermarkId` alone flags the entire Flickr-imported catalogue.
- `db.isAnyWorkerOnline()` returns a diagnostic object, not a boolean; `health.worker.online` reads `state.online`.
- `GET /api/admin/clients` has no account system behind it yet. Clients are derived from `orders.json` and keyed by
  the lowercase-trimmed email, so ids look like `guest:email@example.com` and `type` is `guest`. When
  `db/accounts.json` appears (phase 2), accounts merge on the same key and become `type: account`.
- Only paid orders (`paid`, `completed`, or no status) count towards revenue and order counts; a `pending` order
  still creates the client record with zero revenue.
- `GET /api/admin/clients/:id` adds `orders[]` with photo thumbnails, `topAlbums[]` (album affinity computed from
  bought photos), `favorites[]`, `creations[]` and a merged `timeline[]` capped at 30 entries.
- Both routes are read-only and mounted behind `requireAuth`. Tests: `node tests/insights.test.js`.

## Services

| File | Purpose |
|------|---------|
| `db.js` | Atomic JSON read/write with per-file mutexes. Retries rename with backoff; fallback to direct overwrite. |
| `flickrService.js` | OAuth 1.0a, upload, download, photoset sync, circuit breaker. See [flickr_integration.md](flickr_integration.md). |
| `imageProcessor.js` | Sharp pipeline: decode → resize (1200px preview) → watermark SVG → encode JPG q85. |
| `emailService.js` | Nodemailer: private album access codes, order download links. |
| `stripeService.js` | Stripe SDK: create payment intent, validate webhook signature. |
| `analytics.js` | Lightweight download/visit counters in JSON files (capped at 5000 entries). |
| `insights.js` | Read-only aggregation for Overview + Clients. `getOverview(range)`, `getClients(query)`, `getClientDetail(id)`. Never mutates state. |

## Database — photo-server/db/ (JSON files on Fly volume)

| File | Key Fields |
|------|-----------|
| `settings.json` | `adminPassword` (bcrypt), `defaultPrice`, `watermark{}`, `smtp{}`, `flickr{}`, `githubToken` |
| `photos.json` | `id`, `title`, `albumId`, `flickrOriginalId`, `flickrWatermarkId`, `flickrWatermarkUrl`, `downloadType`, `price`, `ext`, `width`, `height` |
| `albums.json` | `id`, `name`, `type` (public/private/private-watermark/private-nocode/paid), `code`, `flickrSetId`, `maxDownloads` |
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
- Volume: `/data` → `ms_comm_data` (target size 5 GB; jobs reserve 1 GB headroom and persist db/ + storage/)
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
