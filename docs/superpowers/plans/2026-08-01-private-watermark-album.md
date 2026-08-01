# Private Watermark Album Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a code-protected `private-watermark` album type whose visitor UI and server endpoints permit only watermarked downloads.

**Architecture:** Centralize backend album access predicates in `photo-server/services/albumAccess.js`, mirror the minimal display predicate in a browser-safe helper, then wire existing admin and public routes to those policies. Preserve all existing album types and fail closed when a strict-watermark album has no safe watermarked source.

**Tech Stack:** Node.js, Express, CommonJS, static HTML/CSS/JavaScript, Node `assert` tests, GitHub Pages, Fly.io.

## Global Constraints

- `private-watermark` always requires the album code.
- `private-watermark` never exposes an original, including through direct URLs and ZIP endpoints.
- Existing `private` albums keep original and watermarked download choices.
- Private album codes never appear in shared URLs.
- Watermarks are baked once at upload and are never reapplied during download.
- `photo-server/` stays gitignored and is deployed only with `fly deploy`.
- Every code change updates `AGENTS.md` and the relevant `docs/*.md` files.

---

### Task 1: Access policy and regression tests

**Files:**
- Create: `photo-server/services/albumAccess.js`
- Create: `assets/js/album-access.js`
- Create: `tests/private-watermark-album.test.js`

**Interfaces:**
- Produces backend functions `isCodeProtectedAlbum(album)`, `isHiddenAlbum(album)`, `isPrivateStorageAlbum(album)`, `hasValidAlbumCode(album, code)`, `allowsOriginalDownload(album)`, and `selectFlickrPhotoId(photo, mode, strictWatermark)`.
- Produces browser functions `isCodeProtectedAlbumType(type)`, `allowsOriginalAlbumDownload(type)`, `albumDownloadModes(type)`, and `canRequestAlbumDownload(type, mode)` through CommonJS and `window.MSAlbumAccess`.

- [ ] **Step 1: Write the failing policy test**

Test these exact outcomes with Node `assert`: both `private` and `private-watermark` require a code and stay hidden; only `private` permits originals; `private-nocode` uses private storage without accepting a code; strict watermark source selection returns only `flickrWatermarkId` and never falls back to `flickrOriginalId`; `private` exposes `['watermark', 'original']`; `private-watermark` exposes only `['watermark']`; direct original requests are rejected by the browser policy.

- [ ] **Step 2: Run the test and verify failure**

Run: `node tests/private-watermark-album.test.js`

Expected: `MODULE_NOT_FOUND` for one of the new policy modules.

- [ ] **Step 3: Add minimal policy modules**

Backend policy shape:

```js
const CODE_PROTECTED_TYPES = new Set(['private', 'private-watermark']);
const HIDDEN_TYPES = new Set(['private', 'private-watermark', 'private-nocode']);

function allowsOriginalDownload(album) {
  return album?.type === 'private';
}

function selectFlickrPhotoId(photo, mode, strictWatermark = false) {
  if (mode === 'original') return photo.flickrOriginalId || photo.flickrWatermarkId || null;
  if (strictWatermark) return photo.flickrWatermarkId || null;
  return photo.flickrWatermarkId || photo.flickrOriginalId || null;
}
```

Browser policy must export the same original-download decision without importing server code.

- [ ] **Step 4: Run the policy test**

Run: `node tests/private-watermark-album.test.js`

Expected: `private-watermark album tests passed`.

---

### Task 2: Backend administration and download enforcement

**Files:**
- Modify: `photo-server/routes/adminAlbums.js`
- Modify: `photo-server/routes/adminPhotos.js`
- Modify: `photo-server/services/db.js`
- Modify: `photo-server/routes/publicApi.js`

**Interfaces:**
- Consumes all functions from `photo-server/services/albumAccess.js`.
- Produces `album.type` in both private-code verification responses.
- Enforces `401` for invalid code, `403` for original requests, and `409` when no safe watermark exists.

- [ ] **Step 1: Wire admin album behavior**

Use `isCodeProtectedAlbum({ type })` when creating/updating albums so both code-protected types preserve `code`, `clientEmail`, and `clientEmails`. Allow email sending for both types.

- [ ] **Step 2: Wire private storage and public visibility**

Use `isPrivateStorageAlbum(album)` in `adminPhotos.js` and `db.js`, ensuring `private-watermark` forces photo `downloadType: private`, keeps both Flickr copies private, and never appears in public faces/gallery data.

- [ ] **Step 3: Wire code verification and original authorization**

In `publicApi.js`, hide `private-watermark` from anonymous album/photo lists, accept its code in both verification routes, include `type` in the returned album object, and compute these separate states:

```js
const hasCodeAccess = hasValidAlbumCode(album, code);
const canDownloadOriginal = hasCodeAccess && allowsOriginalDownload(album);
const strictWatermark = hasCodeAccess && album.type === 'private-watermark';
```

Every original request must require `canDownloadOriginal`, not merely a valid code.

- [ ] **Step 4: Fail closed for strict watermark downloads**

For ZIP, precheck, URL-list and individual download routes, strict mode may use only `storage/watermarked/<id>.jpg` or `flickrWatermarkId`. It must never use the original path or `flickrOriginalId` as fallback. If neither safe source exists, return:

```js
res.status(409).json({
  error: 'Version filigranée indisponible. Réparez le filigrane depuis le panneau admin.'
});
```

- [ ] **Step 5: Validate backend syntax and policy tests**

Run:

```powershell
node --check photo-server/routes/adminAlbums.js
node --check photo-server/routes/adminPhotos.js
node --check photo-server/routes/publicApi.js
node --check photo-server/services/db.js
node tests/private-watermark-album.test.js
```

Expected: all syntax checks silent; test prints success.

---

### Task 3: Admin option and visitor download buttons

**Files:**
- Modify: `photo-server/admin/index.html`
- Modify: `photo-server/admin/js/admin.js`
- Modify: `photos.html`
- Modify: `tests/private-watermark-album.test.js`

**Interfaces:**
- Consumes `window.MSAlbumAccess` from `assets/js/album-access.js`.
- Stores visitor state as `currentAlbumAccessType` and per-photo `_albumType`.

- [ ] **Step 1: Add admin type option and private-field behavior**

Add the radio option, label/badge mapping, private styling, code/email field visibility, share URL and email button support. Treat both `private` and `private-watermark` as code-protected; treat all three private types as private storage.

- [ ] **Step 2: Load browser policy and retain album type**

Load `assets/js/album-access.js` before gallery inline logic. Reset `currentAlbumAccessType` with other album state; after code validation assign `found.album.type`; copy it into each unlocked photo as `_albumType`.

- [ ] **Step 3: Correct individual and ZIP buttons**

When `allowsOriginalAlbumDownload(type)` is false, render only the watermarked row in `buildDlDropdown`, omit the original ZIP menu button, and reject any in-memory call attempting `mode === 'original'`. Existing `private` UI keeps both choices.

- [ ] **Step 4: Run UI/policy test**

Run: `node tests/private-watermark-album.test.js`

Expected: `private-watermark album tests passed`.

---

### Task 4: Documentation, targeted verification, and deployment

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/admin_panel.md`
- Modify: `docs/server.md`
- Modify: `docs/website.md`
- Modify: `docs/flickr_integration.md`

**Interfaces:**
- Documents the new stored type, access flow, UI, Flickr privacy and no-original fallback rule.

- [ ] **Step 1: Update durable documentation**

Add `private-watermark` to album type matrices and private constraints. State that both Flickr copies remain private, only the baked watermark is downloadable after code validation, and missing watermarks fail closed.

- [ ] **Step 2: Run final targeted checks**

Hypothesis: all changed JavaScript parses and policy/static tests cover the new authorization boundary plus UI wiring.

Run:

```powershell
node tests/private-watermark-album.test.js
node tests/services-catalog.test.js
node tests/services-admin-ui.test.js
node --check photo-server/routes/publicApi.js
node --check photo-server/routes/adminAlbums.js
node --check photo-server/routes/adminPhotos.js
node --check photo-server/admin/js/admin.js
git diff --check
```

Expected: three test success messages, silent syntax checks, no diff errors.

- [ ] **Step 3: Inspect final scope**

Run: `git status --short` and `git diff --stat`.

Expected: no staged or tracked changes outside frontend, tests, docs and plan; `.claude/` remains untouched; `photo-server/` remains ignored.

- [ ] **Step 4: Commit and push tracked frontend/docs/tests**

Stage only named tracked files, commit with `Add private watermark albums`, then push `main` to GitHub Pages. Never stage `photo-server/`.

- [ ] **Step 5: Deploy backend and verify live state**

From `photo-server/`, query current Fly machine state, run `fly deploy`, then query machine status and perform read-only production health checks. Do not expose album codes or secrets in logs.
