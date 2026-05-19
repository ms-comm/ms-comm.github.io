# Project Guidelines — Architecture Decisions & Constraints

> Read this before making any code changes. These are firm decisions made by the project owner.
> When in doubt: **ask before implementing**.

---

## Hard Rules — Never Change Without Explicit Authorization

| What | Value | Why |
|------|-------|-----|
| `FLICKR_WM_MAX` | `3840` (4K) | User wants 4K watermarks. Do not reduce. |
| Watermark resolution cap | Keep at 3840px | Applies to the public Flickr watermark copy |
| No artificial upload limits | None | Upload auto-manages via CPU/memory guards already in place |
| No server-side upload delays | None | User does not want extra steps in the pipeline |
| No commit of `photo-server/` | Ever | Backend is private; deploy via `fly deploy` only |
| Admin panel upload pause values | Don't set defaults | Values are configurable in admin Settings; leave to the user |

---

## Photo / Image Specs

| Spec | Value |
|------|-------|
| Max source file size | ~20 MB |
| Max source dimensions | 8000 × 12000 px |
| Typical source format | JPEG (camera output) |
| Watermark copy output | 3840px max (longest side), JPEG q82, no EXIF |
| Admin preview | 1200px, JPEG q82 |
| Original on Flickr | Full resolution, private album `__MSCOMM_ORIGINALS__` |
| Watermark copy on Flickr | Public, used for gallery display |

---

## Upload Pipeline (Flickr path, free-watermark or paid)

```
1. multer diskStorage → temp file (never in heap)
2. readExif(origPath) — header only, fast
3. generatePreviewFromPath(origPath → previews/id.jpg) — 1200px thumbnail for admin
4. generateWatermarkedFlickrFile(origPath → wmPath) — 3840px watermark, q82, no EXIF
5. flickr.uploadToFlickrPath(origPath) — original, private
6. 500ms pause
7. flickr.uploadToFlickrPath(wmPath) — watermark, public
8. flickr.getOrCreateOriginalsPhotosetId + addPhotoToPhotoset (non-blocking)
9. flickr.getPhotoInfo → flickrWatermarkUrl
10. delete temp files, call global.gc()
```

**Do not reorder steps or add new ones without asking.**

---

## CPU / Memory Management

- Fly.io: 1 shared vCPU, 512 MB RAM + 512 MB swap
- `sharp.cache(false)` + `sharp.concurrency(1)` — always set in imageProcessor.js
- `--expose-gc` is set in `npm start` → `global.gc()` works in production (not in `npm run dev`)
- CPU throttle detection: reads `/sys/fs/cgroup/cpu.stat` every 2s (Linux/cgroup v2 only)
- Memory guard: rejects upload with 503 if RSS > 400 MB (leaves ~110 MB headroom)
- Client-side adaptive pause: detects `cpuThrottled` in server response + configurable pauses (tp1/tp2/tp3 in admin Settings)
- **DCT shrink-on-load**: for 8000px source → 3840px target, libjpeg uses /2 decode (4000px intermediate). Peak RGBA ~96 MB per photo — this is the fundamental ceiling for 4K watermarks on large sources.

---

## Flickr Integration

- Protocol: OAuth 1.0a (not OAuth 2)
- Circuit breaker: trips on HTTP 429 + HTML body (CloudFront WAF ban) → blocks all Flickr REST API for 10 min
- `assertCircuitClosed()` is in the REST API path only — does NOT block CDN streaming
- Streaming: `streamFlickrSized()` pipes Flickr CDN → client, ~64 KB constant memory
- ZIP downloads: **always client-side** (`/api/orders/:id/download-urls`). Server returns metadata, browser fetches bytes. Never use server-side ZIP for Flickr photos (triggers 429 fast).
- `live.staticflickr.com` has `Access-Control-Allow-Origin: *` → browser fetch works

---

## What to Ask Before Implementing

Always ask when the change involves:
- Output resolution or quality of any image (preview, watermark, original)
- Upload pipeline order or steps
- Pause/retry/throttle logic
- Flickr album structure (photosets, visibility)
- New dependencies or services
- Changes to the DB schema (JSON files in `db/`)

---

## Common Mistakes to Avoid

| Mistake | Correct approach |
|---------|-----------------|
| Reduce `FLICKR_WM_MAX` to fix CPU | Do not — ask for alternatives |
| `Promise.all` for bulk Flickr ops | Use a worker pool with concurrency=3 max |
| Server-side ZIP (Flickr fetch in loop) | Client-side ZIP only (`download-urls` endpoint) |
| Commit `photo-server/` to git | Never — fly deploy only |
| Calling `assertCircuitClosed()` from `download-urls` | No Flickr REST in that endpoint — DB lookups only |
| Adding `data-i18n` skip to `shouldSkip()` in i18n.js | Do not — DICT engine handles all elements |

---

## Admin Panel Architecture

- Single JS file: `photo-server/admin/js/admin.js` (~3800+ lines)
- No build step — edit + reload
- `state` object holds all runtime state (photos, albums, settings, uploadQueue, throttleHistory)
- Upload is sequential (one file at a time), never parallel
- Duplicate detection: checks last 3 days by filename before each batch

---

## Deployment

| Environment | How |
|-------------|-----|
| Frontend (HTML/CSS/JS/docs) | `git push origin main` → GitHub Pages auto-deploys |
| Backend (photo-server/) | `fly deploy` — run manually by user |
| Backend env vars | `fly secrets set KEY="value"` |

**Claude does not run `fly deploy`. User does it manually after reviewing changes.**

---

## Key File Locations

```
Frontend (git-tracked):
  photos.html              Public gallery + cart + ZIP download
  checkout.html            Stripe checkout
  assets/js/i18n.js        Translation engine
  assets/js/main.js        Nav, lightbox, sparkles
  assets/data/translations.json  i18n strings (synced to server)
  docs/                    All documentation

Backend (never git):
  photo-server/server.js           Express entry point
  photo-server/routes/adminPhotos.js   Upload, CRUD, download
  photo-server/routes/orders.js        ZIP download-urls endpoint
  photo-server/routes/publicApi.js     Public gallery API
  photo-server/services/imageProcessor.js  Sharp pipeline
  photo-server/services/flickrService.js   OAuth + upload + stream
  photo-server/db/*.json           Live data (on Fly volume)
  photo-server/admin/js/admin.js   Admin SPA (~3800 lines)
```
