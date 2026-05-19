# Fixes & Issues Tracker

> Living document — updated after every significant fix or known issue.
> Backend changes require `fly deploy` by user to take effect.

---

## Applied Fixes

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
- Preview generation: replaced `fs.copyFileSync(wmPath → preview)` (copies full 3840px watermark) with `generatePreviewFromPath(origPath → preview)` — generates proper 1200px thumbnail directly from the original via DCT /8 decode; fast and correct size for admin thumbnails
- Preview is now generated BEFORE the watermark, so it's saved even if watermark generation fails

**Files changed**: `photo-server/services/imageProcessor.js`, `photo-server/routes/adminPhotos.js`  
**Deployed**: requires `fly deploy`

**Remaining ceiling**: For 8000×12000px sources at 4K watermark, peak RGBA is ~96 MB per photo (DCT /2 decode is the minimum). The adaptive throttle system (cpu_throttle detection + configurable pauses in admin Settings) handles this automatically. For very large batches (200-300 photos), configure longer pauses in Settings.

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

## Pending / To-Do

- [ ] Test ZIP flow end-to-end after `fly deploy` (client-side approach was not confirmed working before session closed)
- [ ] Monitor upload stability with large batches (200–300 photos) after CPU fix is deployed

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
