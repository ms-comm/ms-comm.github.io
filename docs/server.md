# Backend Server — photo-server/

> Deploy: `fly deploy` from the private repository `Fuzois21/ms-comm-server`.
> Never commit `photo-server/` into the public frontend repository.

## Entry Point

`photo-server/server.js` — Express app, all middleware, route mounting, rate limiters.

## Routes

| File | Mount | Responsibility |
|------|-------|----------------|
| `auth.js` | `/api/auth` | Login/logout, password change, bcrypt migration |
| `account.js` | `/api/account` | Visitor accounts: register/login/logout/me, profile, favorites, orders, browsing events |
| `adminPhotos.js` | `/api/admin/photos` | CRUD photos, Flickr/local upload, sharp resize, download |
| `adminAlbums.js` | `/api/admin/albums` | CRUD albums, email codes for private albums, Flickr photoset sync |
| `adminOrders.js` | `/api/admin/orders` | Order list, token generation, download |
| `adminOverview.js` | `/api/admin/overview` | Dashboard aggregate: KPI + delta vs previous window, series, top lists, health, attention queue |
| `adminClients.js` | `/api/admin/clients` | Client list/detail derived from orders (email key). See [PLAN_REFONTE.md](PLAN_REFONTE.md) |
| `adminStats.js` | `/api/admin/stats` | Visitor tracking statistics: summary, per-photo, per-album, visitors, events log. Contract: [tracking.md](tracking.md) |
| `adminPromoCodes.js` | `/api/admin/promo-codes` | Promo code CRUD, discount application |
| `adminSettings.js` | `/api/admin/settings` | Config (prices, watermark, SMTP, Flickr keys, GitHub token) |
| `adminFaces.js` | `/api/admin/faces` | Face detection + tagging via gallery-app worker |
| `adminTranslations.js` | `/api/admin/translations` | i18n text management, GitHub sync |
| `publicApi.js` | `/api/public` | Public: list albums/photos, download, album ZIP, verify codes, `POST /track` (visitor tracking ingest, always 204) |
| `orders.js` | `/api/orders` | Stripe checkout confirm, download-all ZIP, **download-urls** (client-side ZIP), per-order retrieval |
| `stripeWebhook.js` | `/api/stripe` | Stripe payment confirmation webhook |
| `workerApi.js` | `/api/admin/worker` | gallery-app worker: claim/complete scan jobs |

## Key Route Details

### orders.js — Download Endpoints
- `GET /api/orders/:id/download-all?token=xxx` — Server-side ZIP. Source order: local file → R2 `master` → Flickr. A migrated order no longer touches Flickr and cannot 429 the Fly IP; only rows still on Flickr remain exposed to it.
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
- `POST /api/public/albums/:id/download-check` probes several candidate Flickr sources before the website starts the form download. If every checked source is blocked by Flickr 429, the site shows an error with `mscomm.contact@gmail.com`; one 429 must not block the album if another selected photo is reachable. When every selected photo carries `r2Key`, the route answers `checked: 'r2'` without probing anything: no Flickr request will be made, so a CDN probe could only invent a failure.
- `ids` is optional. When present, only those selected photo IDs are streamed; used by the album selection download.
- `mode=watermark` is allowed for public albums and code-unlocked `private`/`private-watermark` albums.
- `mode=original` is allowed only for `private` albums with a valid code. `private-watermark` rejects originals even with a valid code; public paid originals still require order download tokens.
- For `private-watermark`, ZIP, precheck, URL-list, and individual downloads use only `flickrWatermarkId` or `storage/watermarked/:id.jpg`. Missing safe copies return `409`; an original is never used as fallback.
- `GET /api/public/albums/:id/download-urls?mode=watermark|original&code=xxx&ids=id1,id2` returns the manifest used for browser-side ZIP creation. `directUrl` is a presigned R2 URL (1 h) as soon as the photo carries `r2Key`: `master` for an unwatermarked request or a watermark-only photo, `wm` otherwise. A `wm` level not yet built leaves `directUrl` null so the browser falls back to the server URL, which builds and persists it. Photos without `r2Key` keep the Flickr CDN URL. The response carries `source: 'r2' | 'mixte' | 'flickr'`; on `'r2'` the client drops its inter-photo delay to 0 (2,5 min saved on a 300-photo album) and keeps 500 ms as soon as one photo still comes from Flickr.
  `r2Count` must be incremented where the presigned URL is produced. It used to live in an `else if (directUrl)` branch that the R2 presign itself made unreachable, so `source` stayed `'flickr'` on fully migrated albums and the browser kept waiting 500 ms per photo for a CDN it no longer called (fixed 2026-09-03, verified in production: `source=r2`, 187/187 `directUrl` presigned).
  The per-photo resolution runs in a bounded parallel pool (`MANIFEST_CONCURRENCY = 16`) writing `files[idx]` by index. In series it cost one `r2.exists()` round-trip per photo before the response even started: 11,6 s of dead time on 187 photos, more than the ~20 s the bytes themselves take. Measured after the fix: 121 ph 640 ms, 187 ph 943 ms, 296 ph 1620 ms.

### Album download performance (measured 2026-09-03, production)

| Album | Photos | Manifest | Bytes | Total |
|---|---|---|---|---|
| Student Championships (paid) | 121 | 681 ms | 24,7 s / 169 Mo (6,9 Mo/s) | **25,4 s** |
| Stage National | 296 | 1620 ms | 24,9 s / 378 Mo (15,2 Mo/s) | **26,6 s** |

Zero failure, zero 429. The browser loop stays sequential on purpose: at 7–15 Mo/s the link is already saturated, and a parallel loop would multiply the peak memory of a ZIP that is assembled in RAM — the exact cause of the mobile out-of-memory errors. The gains came from removing dead time (serial manifest, useless 500 ms delay), not from adding concurrency.

### tools/prebuild-wm.js

Builds the R2 `wm` level ahead of demand for every photo whose master is clean (`flickrWatermarkId` set). Reads the master from R2, bakes the watermark, writes `wm/` — **no Flickr call**. Run it after any upload of such photos.

```powershell
node tools/prebuild-wm.js --dry-run
node tools/prebuild-wm.js --concurrency 6
```

Without it the level stays lazy, `download-urls` cannot presign, and the manifest silently falls back to the Flickr CDN: 120 of the 121 photos of the paid album still came from Flickr after a complete migration. First run: 564 photos, +0,71 Go, ~3 min, and the album went from `source=mixte` (2463 ms) to `source=r2` (811 ms). Like the migration, it refuses to start without the watermark assets.

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

### adminOverview.js / adminClients.js - Dashboard aggregation

- `GET /api/admin/overview?range=7d|30d|90d|12m|all` (or `from=YYYY-MM-DD&to=YYYY-MM-DD&granularity=day|week|month`)
  returns one payload for the whole dashboard: `kpis` (each with `value`, `previous`, `deltaPct`), `series`
  (`revenue`, `traffic`, `hourly`, `weekday`, `photoGrowth`), `breakdown` (device/browser/os/lang/referrer/page),
  `top` (`photos`, `albums`, `sold`, `clients`, `pages`, `searches`), `health` and `attention`.
  When the tracking journal has data for the window (`trackingActive: true`) `visits`/`uniqueVisitors`/`conversion`
  and the top photos/albums come from it; otherwise the legacy `analytics-visits` log is used. Extra kpis:
  `visitors`, `sessions`, `avgSessionMs`, `pageViews`, `photoViews`, `albumViews`, `online`, `bounceRate`.
- `deltaPct` compares the window to the immediately preceding window of equal length. It is `null` when the previous
  window is empty, so the UI shows "nouveau" instead of an infinite percentage.
- `granularity` is `day` up to ~90 days, `week` up to ~200 days, `month` beyond (`12m` = 13 monthly points) unless
  forced by the query. Period resolution lives in `services/stats.js` `resolvePeriod()`.
- `GET /api/admin/clients?segment=visitors` lists anonymous visitors (`type:'visitor'`, `id:'visitor:<vid>'`,
  `displayName:'Visiteur <ip>'`); `segment=all` excludes them, `segment=everyone` merges both, `segment=online`
  keeps whoever was seen in the last 2 minutes. Every client carries `online` and a `tracking{}` block; the detail
  adds `tracking`, `sessions[]`, `journey[]`, `topPhotos[]` (see [tracking.md](tracking.md) §4).
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
- `GET /api/admin/clients/:id` returns the enriched sheet (phase 3):
  - `counters` — `orders`, `spent`, `photosBought`, `favorites`, `downloads`, `creations`, `albumsViewed`,
    `photoViews`, `logins`.
  - `engagement` — `daysSinceSignup`, `daysSinceActivity`, `firstOrderAt`, `lastOrderAt`, `avgOrderValue`, and
    `activityByDay` which is **always 30 points including empty days**: a variable-length series would misrepresent
    the time axis, and a gap is itself information.
  - `orders[]` with photo thumbnails, `favorites[]`, `downloads[]`, `creations[]`.
  - `topAlbums[]` keeps `purchased` and `viewed` in **separate fields**: a browse must never be presented as a
    purchase. Sorted by purchases first, then views.
  - `timeline[]` merges the journal, the orders and a synthesised `signup` entry, newest first, capped at 60. Each
    entry carries `at` (ISO), `label` (the event type in French) and `detail` (the photo or album name).
- Journal-derived counters only exist for accounts. A `guest` client (bought without signing up) legitimately has
  zeros everywhere and a timeline containing only orders; the admin sheet says so explicitly instead of showing a
  wall of dashes.
- Favourites pointing at a trashed photo are hidden from the sheet but kept in storage, exactly like
  `/api/account/favorites`, so admin and client never disagree.
- Attention labels are accorded in French (`1 photo` / `2 photos`) and the UI displays `item.label` directly.
- Both routes are read-only and mounted behind `requireAuth`.
  Tests: `node tests/insights.test.js` and `node tests/insights-detail.test.js`.


### account.js + publicApi.js - Download gate (visitor accounts)

Browsing is anonymous by design: albums, photos, faces and translations are all
readable without an account. Taking bytes out of the gallery requires one.

The gate is enforced **server-side** in `publicApi.js` (`downloadGate`) on all four
exit points, because hiding the UI button would be bypassed by calling the URL:

```
GET  /api/public/photos/:id/download
POST /api/public/albums/:id/download
POST /api/public/albums/:id/download-check
GET  /api/public/albums/:id/download-urls
```

Refusal is `401 { error, code: 'ACCOUNT_REQUIRED' }` so the front end can tell it
apart from a wrong album code and open the sign-in sheet instead of an error.

Deliberate exceptions, each an authorisation of its own:

- **Purchase tokens** (`?token=` and every route in `orders.js`). The buyer paid,
  may have no account, and the emailed link must keep working.
- **Album codes do NOT replace the account.** A code decides *which* photos a
  visitor may see; the account is *who* is taking them. Both apply.

### albumGrants.js - Named access to a private album

A private album can be opened by two different proofs: the shared code, or a
**named grant** attached to an account. `services/albumGrants.js` stores them in
`db/album-grants.json` through `db.mutate()`, keyed by **normalised e-mail**, so
a grant can be created *before* the person signs up; `accounts.register()` calls
`albumGrants.attachAccount(account)` right after `attachOrders` to bind it.

API: `listAll`, `listForAlbum(albumId, accounts)`, `albumIdsForAccount`,
`hasGrant`, `grant` (idempotent), `revoke`, `revokeByEmail`, `attachAccount`.

Routes:

```
GET    /api/admin/albums/:id/access            → { grants, accountExists }
POST   /api/admin/albums/:id/access            { email }
DELETE /api/admin/albums/:id/access/:grantId
GET    /api/account/albums                     (requireAccount) granted albums
GET    /api/account/albums/:id/photos          (requireAccount) 403 without a grant
```

`publicApi.js` gained `currentAccount(req)` (memoised on `req._msAccount`),
`hasGrantedAlbumAccess(req, album)` and `hasAlbumAccess(req, album, code)`. The
three album exits (`/albums/:id/download`, `/download-check`, `/download-urls`)
now call `hasAlbumAccess(...)` instead of `hasValidAlbumCode(...)`, and
`/photos/:id/download` accepts `albumAccess.hasCodeAccess || grantedAccess`.
A grant replaces the CODE only. The account gate, purchase tokens and the
watermark policy are unchanged: **a code says WHICH photos, an account says WHO,
a grant says TO WHOM**.
`sessionPayload` exposes `counts.albums` so the account menu can badge it.

**Download tickets.** The public site runs on GitHub Pages while the API runs on
Fly, so an `<a download>` navigation or a top-level form POST is cross-site and
cannot rely on the session cookie. `accounts.issueDownloadTicket()` mints a
10-minute HMAC-signed string (`SESSION_SECRET`) passed as `dlTicket`. It proves
"a signed-in account asked for this" and nothing else: album privacy, purchase
tokens and watermark policy are still enforced downstream unchanged.

The session cookie is `SameSite=None; Secure` in production for the same
cross-site reason (`Lax` in dev, where http origins reject `None`).

**Perimeter isolation.** A client session sets `req.session.accountId` only and
never `req.session.authenticated`, so it can never reach `/api/admin/*`.
`requireAuth` and `requireAccount` each test their own field.

**Order attachment.** On signup, every order whose `customer.email` matches the
normalised account email gets `accountId` written. New orders carry `accountId`
when checkout happens in a client session. Email stays the fallback key, so
history is visible without a destructive migration.

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
| `accounts.js` | Visitor account store: register (bcrypt 12), credentials, profile, favorites, bounded `client-events` journal, signed download tickets. Attaches past orders by normalised email. |
| `r2Storage.js` | Cloudflare R2 (S3 API) client. Three levels: `master/` + `wm/` in the private bucket, `display/` in the public one. Keys are a per-photo UUID (`r2Key`), NOT the photo id. `requestChecksumCalculation: 'WHEN_REQUIRED'` is mandatory — R2 answers 400 otherwise. |
| `albumAccess.js` | Album code/visibility resolution and source selection. `isWatermarkOnlyPhoto()` is the single point deciding whether an unwatermarked version may exist at all. |

## Cloudflare R2 storage

Photos live in R2; Flickr is a read-only fallback for rows not yet migrated.

| Level | Bucket | Size | Built |
|-------|--------|------|-------|
| `master/` | `ms-comm-master` (private) | raw source bytes, no resize, no re-encode, EXIF kept (~11,8 Mo) | at migration/upload |
| `wm/` | `ms-comm-master` (private) | watermarked, ≤ 4096 px, JPEG q100 chroma 4:4:4 (~8–12 Mo) | at migration (lossless) / lazily for later uploads |
| `display/` | `ms-comm-display` (public) | watermarked, 2048 px, JPEG q95 (~0,8 Mo) | at migration/upload |

**Double-logo fix (2026-09-04, same day)**: the export equals CDN `_o`, so watermark-only masters are already stamped; the lossless run added a second logo on their `wm`/`display`. `tools/rebuild-stamped-levels.js` rebuilds both levels from the R2 master by plain reduction (`resizeCappedBuffer()`), under a new UUID, and sets `r2MasterStamped: true` (pushed by `push-r2-keys.js`). `isR2MasterWatermarked()` honours that flag first; `serveFromR2` lazy-builds `wm` by reduction for stamped masters and by watermarking for clean ones. The site (gallery + lightbox) only ever shows `display` (2048 px); the master is download-only.

**Lossless policy (2026-09-04)**: the first migration re-encoded the master (4096 px q90) from the CDN `_4k` render and produced visibly degraded photos. Everything was re-migrated with `node tools/migrate-to-r2.js --lossless` (wrapper `tools/run-lossless.ps1`, log `_mscomm-r2-local\lossless.log`): the export is mandatory for every photo, master = raw bytes, `wm` built up front, a NEW UUID key per photo (immutable 1-year cache) and the old key removed after write, row flagged `r2Lossless: true` (resume key). Quality knobs: `R2_WM_QUALITY = 100`, `R2_DISPLAY_QUALITY = 95`, `R2_DISPLAY_MAX = 2048` in `imageProcessor.js`; `R2_MASTER_QUALITY` no longer exists. `resizeBufferAndDownload` returns the stored bytes untouched unless a resize or watermark is requested (then q100). Storage ≈ 40 Go, above the free tier (~0,5 $/month). Follow-up tools: `--verify`, `tools/purge-r2-orphans.js [--delete]` (drops objects whose UUID is not referenced by `photos.json`, trash included), `push-r2-keys.js --replace` (required: keys changed).

Secrets on Fly: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_PRIVATE`, `R2_BUCKET_PUBLIC`, `R2_PUBLIC_DOMAIN`.

### CORS

Both buckets allow `https://ms-comm.github.io`, `http://localhost:8080` and `http://127.0.0.1:8080`, methods `GET` and `HEAD`. The browser-side album ZIP reads presigned `master` URLs directly, so without this policy every album download fails in the browser while succeeding from a script. The R2 API token cannot write it (`PutBucketCors` → `AccessDenied`); set it from the dashboard, R2 → bucket → Settings → CORS Policy.

### Migration

`tools/migrate-to-r2.js` — resumable, state in `storage/r2-migration-state.json`.

Run it **locally**, against a copy of the production `db/photos.json`, then push only the `r2*` keys back:

```powershell
node tools/migrate-to-r2.js --mbps 500          # source = Flickr export on disk, no CDN request
node tools/push-r2-keys.js --from <photos.json local> --dry-run
node tools/push-r2-keys.js --from <photos.json local>
```

Running it on Fly was abandoned. Flickr throttles the `_o` path after a few dozen photos, and the single shared CPU makes the re-encode the bottleneck (a 4-CPU attempt OOM-ed at ~31 photos).

**Source order** (`fetchSourceBuffer`): local file → Flickr export → URL cache → Flickr API.

The official account export is read **only for photos that carry `flickrWatermarkId`**, i.e. the 564 rows with a certain clean original. Measured 2026-09-03, the export is MIXED for the 1431 watermark-only rows: it returns a clean original for some and an already-stamped file for others, and no database field separates them — re-applying the watermark on a stamped file bakes a second logo. A pixel detector was built and rejected (23 % false positives on a 564-photo control), so the code does not guess: those rows fall back to the CDN copy, which is exactly what the site already published. Two traps the export carries:

- It delivers **clean originals even for watermark-only photos**, whose CDN copy is already stamped. Passing those bytes through unchanged publishes unwatermarked photos. From the export the watermark is therefore ALWAYS re-applied: `watermarkOnly = src.fromExport ? false : …`, while `r2WatermarkOnly` keeps deriving from the photo, never from the source.
- Its originals carry **orientation in EXIF** where CDN renders are pre-straightened. `buildR2Levels()` calls `.rotate()` on all three branches and computes dimensions on the straightened image, otherwise portraits are stored lying down.

`tools/index-flickr-export.js` builds the `{ flickrId: path }` index. The export uses two filename shapes — `titre_<id>_o.jpg` and `<id>_<secret>_o.jpg`; a single naive regex missed 1967 of 4451 files and mistook the secret for an id.

**Why `_4k` before `_o`**: Flickr throttles only the `_o` path, which is built from `originalsecret`. Measured on one photo at one instant with identical headers: `_o` → 429, while `_6k`/`_5k`/`_4k`/`_3k`/`_k`/`_b` → 200. It is neither the IP nor the CDN nor the byte volume. Since `R2_MASTER_MAX` is 4096, `_4k` yields an identical master. CDN requests need a browser User-Agent (otherwise CloudFront answers 502) plus `Referer: https://www.flickr.com/`.

**The migration refuses to start without the watermark assets.** `renderWatermarkedBuffer` does not throw when the logo or the custom font is missing: it silently falls back to a bare monospace font and drops the logo. A local run against a `DATA_DIR` lacking `storage/watermark-asset.png` stamped 564 photos that way and could only be undone by re-migrating. `runMigrate()` now checks both paths up front and exits 1 — fetch them with `fly ssh sftp get /data/storage/watermark-asset.png` and `/data/storage/fonts/<hash>.ttf`.

**First migration (2026-09-03, superseded)**: 3887/3887 photos migrated from `export|clean` 564, `cdn:4k|wmOnly` 2965, `flickr:original|wmOnly` 350, `cdn:o|wmOnly` 6, `cdn:5k|wmOnly` 2. Replaced by the lossless run of 2026-09-04 (export for all rows; the export equals CDN `_o` byte for byte, verified by sha on both populations). Caveat kept: a wmOnly export that is already stamped gets a second logo on `wm`/`display` only — control a visual sample of the 2026-04 albums. 124 wmOnly exports carry EXIF orientation 6/8, so `.rotate()` stays on the `wm`/`display` branches while the raw master keeps its EXIF.

**Rollback**: clear `r2Key` on the affected photos and the Flickr path takes over immediately. Nothing is deleted on Flickr and every `flickr*` field is preserved.
### Watermark-only photos

3323 of 3887 photos have no clean original **on Flickr**: their public copy already carries a baked watermark. `isWatermarkOnlyPhoto()` detects them (`r2WatermarkOnly`, or missing `flickrWatermarkId` on a non-`free` row) and every unwatermarked exit fails closed with `409 WATERMARK_ONLY`, purchase token included. The admin upload form exposes this as a "Filigrane uniquement" checkbox (`watermarkOnly`).

**Two different questions, two functions.** `isWatermarkOnlyPhoto()` answers what the photo may OFFER; `isR2MasterWatermarked()` answers what the stored BYTES contain. They diverge for the same photo depending on the migration source: the Flickr CDN copy is baked, but the official account export returns the CLEAN original. Serving `master` for a watermarked request is only valid in the first case — doing it in the second handed out unstamped files to visitors who explicitly asked for the watermarked version (found visually on an export-migrated master, 2026-09-02). Export-migrated photos therefore build a real `wm` level on first watermarked download, exactly like a photo with a clean original, while `r2WatermarkOnly` keeps blocking every sans-filigrane exit.

## Database — photo-server/db/ (JSON files on Fly volume)

| File | Key Fields |
|------|-----------|
| `settings.json` | `adminPassword` (bcrypt), `defaultPrice`, `watermark{}`, `smtp{}`, `flickr{}`, `githubToken` |
| `photos.json` | `id`, `title`, `albumId`, `flickrOriginalId`, `flickrWatermarkId`, `flickrWatermarkUrl`, `downloadType`, `price`, `ext`, `width`, `height` |
| `albums.json` | `id`, `name`, `type` (public/private/private-watermark/private-nocode/paid), `code`, `flickrSetId`, `maxDownloads` |
| `orders.json` | `id`, `status`, `photos[]` (photoId + downloadToken), `orderDownloadToken`, `total`, `customer{}` |
| `accounts.json` | `id`, `email`, `emailNormalized`, `firstName`, `lastName`, `passwordHash` (bcrypt 12), `status`, `createdAt`, `lastLoginAt`, `lastSeenAt`, `marketingOptIn` |
| `favorites.json` | `accountId`, `photoId`, `createdAt` |
| `album-grants.json` | `id`, `albumId`, `email`, `emailNormalized`, `accountId` (null until signup), `createdAt`. Named access to a private album, granted from the admin album modal |
| `client-events.json` | `accountId`, `type` (login/photo_view/album_view/favorite_add/favorite_remove/download), `photoId`, `albumId`, `ts`. Capped at 20000 entries / 365 days |
| `track-events.json` | Visitor journal: `id`, `ts`, `vid`, `sid`, `accountId`, `type`, `path`, `page`, `photoId`, `albumId`, `meta`, `ip`, `ua`, `lang`, `ref`, `tz`, `screen`, `device{type,os,browser}`. Capped at 60000 entries / 180 days |
| `track-sessions.json` | One row per `sid`: `vid`, `accountId`, `startAt`, `lastAt`, `endAt`, `activeMs`, `durationMs`, counters, `pages[]`, `landing`, `exit`, `refHost`, `ip`, `device` |
| `visitors.json` | One row per `vid`: `accountId`, `firstSeenAt`, `lastSeenAt`, `lastIp`, `ips[≤5]`, `device`, `lang`, `tz`, `screen`, `sessions`, `totalDurationMs`, `lastSessionDurationMs`, counters, `lastPath` |
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
/api/account/login    → 10 req / 15 min  (same authLimiter)
/api/account/register → 10 req / 15 min  (same authLimiter)
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
