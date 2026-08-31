# Fixes & Issues Tracker

> Living document — updated after every significant fix or known issue.
> Backend changes require `fly deploy` by user to take effect.

---

## Applied Fixes

### [FIXED] Async album ZIP — CloudFront 502 loop with Axios User-Agent
**Symptom**: A 302-photo job repeatedly failed on the same photo with `502`, reset its attempt counter, and restarted forever when the browser polled status.

**Root cause**: Live probes from the same Fly machine and exact Flickr URL returned `502 Error from cloudfront` with Axios' default User-Agent, but `200/206 image/jpeg` with a browser User-Agent. The previous “original + getSizes Original” fallback could also resolve to the same `_o` URL, and the worker reset attempts after exhaustion.

**Fix**: Use the tested browser User-Agent and three strictly constructed Flickr sources (`_o`, `_k`, `_b`) with cache-busting. Wait 5/10 seconds, then mark the job `failed` after the third aggregate failure. Polling cannot restart failed jobs; an explicit new click within 10 minutes reuses completed checkpoint files. Reuse keys include album policy and exact Flickr source IDs. Streams use `pipeline()`, active archives heartbeat, archive warnings fail closed, async route errors reach Express middleware, and the gallery stops on failed, missing, or malformed job responses while restoring the button.

**Verification**: `tests/flickr-zip-downloader.test.js`, `tests/album-zip-worker.test.js`, `tests/album-zip-jobs.test.js`, `tests/zip-archive.test.js`, `tests/async-route.test.js`, JavaScript syntax checks, and a live Fly-to-Flickr probe with the production headers.

### [IMPLEMENTED] Asynchronous resumable album ZIP jobs
Large album exports now prepare in the background, checkpoint each Flickr photo, stop after three failed sources, and expose a ready ZIP only after every requested photo is staged. Jobs use `storage/tmp/zip-jobs`, ready artifacts expire after one hour, and reserve 1 GB headroom on the 5 GB volume. The gallery shows progress and the exact terminal error when Flickr remains unavailable.

The worker now logs `photo N / total` and waits 3 seconds between successful Flickr photos. The legacy stream route has the same spacing and progress logs while older cached frontend pages transition to the job flow.

### [FIXED] Album ZIP — archive aborted after Flickr 429
**Root cause**: Production logs showed a 302-photo private album with 213 entries, then Flickr CDN HTTP 429 responses. The response close handler called `archive.abort()` during normal finalization, producing `ArchiverError: archive was aborted` and an unhandled rejection. ZIP retries also waited up to 75 seconds on an already-blocked Fly IP.
**Fix**: Abort only on the explicit request `aborted` event and never during archive finalization; limit a CDN 429 to one controlled retry, then continue the export with an explicit failed-photo count in logs.
**Files changed**: `photo-server/routes/publicApi.js`, `photo-server/services/zipDownloadPolicy.js`
**Verification**: `tests/zip-download-policy.test.js`; production replay should confirm no `archive was aborted`/`unhandledRejection` after a 429.

### [FIXED] ZIP download — 429 Flickr rate limit on server
**Symptom**: "Tout télécharger (ZIP)" failed silently or with 429 errors.  
**Root cause**: Server-side ZIP assembled photos by fetching each from Flickr CDN → server IP got CloudFront-banned after a few requests.  
**Fix**: Client-side ZIP via fflate (browser). The `GET /api/orders/:id/download-urls` endpoint returns per-photo `{ photoId, filename, token }` with no Flickr API calls. Browser then fetches each photo via `GET /api/public/photos/:id/download?token=xxx` (same-origin, proven to work for individual downloads) and assembles the ZIP in memory.  
**Files changed**: `photo-server/routes/orders.js`, `photos.html`, `checkout.html`  
**Deployed**: requires `fly deploy`

---

### [FIXED] i18n — EN mode translations missing on data-i18n elements
**Symptom**: Switching to English left some UI strings in French.  
**Root cause**: `shouldSkip()` in `i18n.js` returned `true` for elements with a `data-i18n` attribute, deferring to `applyDataI18n` which requires a `_i18n` section in `translations.json` (doesn't exist).  
**Fix**: Removed the `data-i18n` check from `shouldSkip()`. DICT engine now translates all text nodes including those inside `data-i18n` elements.  
**Files changed**: `assets/js/i18n.js`  
**Deployed**: yes (frontend, GitHub Pages)

---

### [FIXED] Admin dashboard — Flickr API limits widget crash
**Symptom**: Dashboard threw JS error when Flickr circuit breaker data was unavailable.  
**Fix**: Removed the entire "Flickr API" dashboard category widget.  
**Files changed**: `photo-server/admin/index.html`, `photo-server/admin/js/admin.js`  
**Deployed**: requires `fly deploy`

---

### [FIXED] Upload CPU saturation — crash after ~30–50 photos
**Symptom**: Fly.io VM CPU climbs above its quota and crashes after 30–50 photo uploads. Increasing the client-side inter-upload pause (even to 5000ms) had no effect.  
**Root cause**: For large sources (up to 8000×12000px, 20 MB), the watermark generation at 4K (3840px) requires libjpeg /2 decode — peak RGBA ~96 MB per photo. Repeated in a large batch, this exhausts CPU burst credits on the 1 shared vCPU Fly.io VM. The pause between uploads doesn't help because the spike happens DURING processing, not between files.  
**Fix** (no change to output resolution — watermark stays 4K):
- Watermark JPEG quality: `90 → 82` — faster encode (~15-20%), smaller Flickr upload (~25%)
- Removed `.withMetadata()` from watermark copy — strips GPS/EXIF (privacy + minor speed)
- Preview generation: **supprimée entièrement du path Flickr**. Les previews locales (`storage/previews/`) n'étaient qu'un fallback pour `flickrWatermarkUrl` qui est toujours rempli quand Flickr est configuré. Suppression = une sharp op et une écriture disque de moins par upload, plus aucun stockage gaspillé.

**Files changed**: `photo-server/services/imageProcessor.js`, `photo-server/routes/adminPhotos.js`  
**Deployed**: requires `fly deploy`

**Additional mitigations applied**:
- `sharp.simd(false)` — disables AVX/NEON vectorisation; ~40-50% less CPU per second, ~2× longer wall time. Keeps usage under sustained quota (~5-6%) so burst credits stop depleting.
- Proactive cooldown before watermark: reads `usage_usec` in existing cgroup monitor (zero overhead), waits up to 6s if CPU > 5% before starting sharp.

---

## Known Limitations

### Stripe `r.stripe.com/b` CORS error in browser console
**Status**: Harmless, not fixable on our side.  
**Detail**: Duplicate `Access-Control-Allow-Origin` header on Stripe's internal telemetry endpoint. Affects all Stripe integrations. Has no impact on payments.

### admin `dev` mode — no `--expose-gc`
**Status**: Minor.  
**Detail**: `npm run dev` uses `nodemon server.js` (no `--expose-gc`), so `global.gc()` calls in the upload handler are no-ops during local dev. In production (`npm start`) `--expose-gc` is present. Not a problem for local testing of small batches.

### Windows dev — session file locks
**Status**: Suppressed, not a crash risk.  
**Detail**: OneDrive/Defender hold file locks on the session store. The session store has 25-retry + fallback-overwrite logic. Set `SESSION_DIR` to OS temp to avoid this entirely.

---

---

### [IMPLEMENTED] Browser-side watermark generation
**Goal**: Eliminate server CPU usage for watermark processing (main bottleneck for large batches).  
**Implementation**:
- Admin JS: `generateClientWatermark(file, settings)` — OffscreenCanvas approach.
  - `createImageBitmap(file, {resizeWidth, resizeHeight, resizeQuality:'high', imageOrientation:'from-image'})` decodes + resizes in one pass (memory-efficient, no full 8000×12000 decode)
  - Replicates server watermark: gradient, logo (PNG from `/api/admin/settings/watermark-image`), text (custom font from `/api/admin/settings/watermark-font`), opacity, rotation, position
  - Exports as JPEG q82 blob (matches server quality)
  - Graceful fallback to server-side when `OffscreenCanvas.convertToBlob` not available (older browsers)
- `POST /api/admin/photos/upload` now accepts `multer.fields([photo, watermark])` — server skips `generateWatermarkedFlickrFile` when `watermark` field is present
- Progress modal: detail rows always visible (no toggle), connection speed displayed (KB/s or MB/s)
- Custom font loaded via FontFace API + `document.fonts.add()` — works in OffscreenCanvas on main thread
**Files changed**: `photo-server/routes/adminPhotos.js`, `photo-server/admin/index.html`, `photo-server/admin/js/admin.js`  
**Deployed**: requires `fly deploy`  
**Compatibility**: Safari 16.4+ / iOS 18+ (iPhone 17) ✓, Chrome 69+ ✓, Firefox 46+ ✓. Older browsers → server fallback.

---

### [IMPLEMENTED] Pipeline upload + cancel button feedback
**Goal**: Eliminate idle client time during server's Flickr upload (~15s per photo).
**Implementation**:
- `uploadFile()` now returns `{sent, done}` — `sent` resolves on `xhr.upload.onload` (client finished sending), `done` on server response
- `tryStartNext()` called from `sent.then()` → next file starts uploading while server handles current one with Flickr
- `MAX_IN_FLIGHT=4` event-driven pipeline replaces 2-worker pool; at most 4 concurrent XHRs
- Cancel button immediately shows "Annulation…" and is disabled on click; reset to "Annuler"/enabled at next upload start
**Files changed**: `photo-server/admin/js/admin.js`  
**Deployed**: requires `fly deploy`

---

---

### [FIXED] i18n backend fetch — no timeout caused cold-start stall
**Symptom**: Admin translation edits not visible on site, or visible only after 10–15s delay.  
**Root cause**: `_fetchTranslations()` had no timeout. If Fly.io backend was sleeping, the page waited 10–15s for the cold start before applying admin edits. Also `applyFrOverrides` was incorrectly called in EN mode.  
**Fix**:
- Added 4 s `AbortController` timeout to backend fetch — falls back to static file immediately if backend is cold
- `applyFrOverrides` now only applied when `currentLang === 'fr'`
- Silent `catch(e){}` in `_loadTranslationsJson` replaced with `console.error` so errors are visible in DevTools  
**Files changed**: `assets/js/i18n.js`  
**Deployed**: yes (frontend, GitHub Pages)

**Important**: To guarantee changes are always visible even when backend is cold, use **"Sauvegarder & Pousser sur GitHub"** in the Texts tab — not just "Enregistrer local". The GitHub push updates the static fallback file that is served when the backend is asleep.

---

### [IMPLEMENTED] Admin panel — watermark download
**Goal**: Allow downloading the watermarked copy of a photo from the admin photo list.  
**Implementation**: Download icon menu now shows "Avec filigrane" (in addition to "Original") for photos that have a `flickrWatermarkId`. Backend streams the Flickr watermark copy via `streamFlickrSized` with `resolution=watermark`.  
**Files changed**: `photo-server/admin/js/admin.js`, `photo-server/routes/adminPhotos.js`  
**Deployed**: requires `fly deploy`

---

## Pending / To-Do

- [ ] Test ZIP flow end-to-end after `fly deploy` (client-side approach was not confirmed working before session closed)
- [ ] Monitor upload stability with large batches (200–300 photos) after browser watermark is deployed
- [x] Reduce Fly.io from 2 CPUs to 1 CPU after browser watermark is confirmed working (scaled to `shared-cpu-1x:512MB` on 2026-07-03)

---

## Diagnostics

### Check server health
```
fly logs                              # live logs
curl https://ms-comm-server.fly.dev/healthz
GET /api/admin/photos/memory          # RSS / heap snapshot
POST /api/admin/photos/memory/gc      # manual GC trigger
```

### Upload crash pattern
If `fly logs` shows `nr_throttled` increasing rapidly or OOM kills → reduce `FLICKR_WM_MAX` further or add more client-side pause via `uploadPauseBetween` setting in admin Settings.
