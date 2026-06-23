# Admin Panel — photo-server/admin/

> Access: `https://ms-comm-server.fly.dev/admin` (prod) or `http://localhost:3000/admin` (dev)
> Single-page app — no build step. Edit files and reload.

## Files

| File | Purpose |
|------|---------|
| `admin/index.html` | Full SPA HTML + inline styles |
| `admin/js/admin.js` | All logic (~4000+ lines): CRUD, upload queue, face scan, settings, text/service editors |
| `admin/css/admin.css` | Admin-specific styles |

## Tabs / Pages

| Tab | `navigate()` key | What it does |
|-----|-----------------|--------------|
| Dashboard | `dashboard` | Stats overview: photo/album counts, revenue, downloads, visits, histogram, top photos, recent orders |
| Photos | `photos` | Photo grid/list with search/filter, inline edit, upload queue, Flickr badge |
| Albums | `albums` | Album CRUD, public/private toggle, email code sender, Flickr photoset sync |
| Faces | `faces` | Face detection results grid, person tagging, bulk scan launch |
| Orders | `orders` | Order list, download token generation, order status |
| Texts | `texts` | i18n translation editor + editable services catalog, GitHub push |
| Settings | `settings` | Prices, watermark, SMTP, Flickr API keys, password change |

## Key Functions in admin.js

### Auth
- `checkAuth()` → `showLogin()` / `showAdmin()`
- Session expires → redirect to login screen automatically

### Photos
- `loadPhotos()` — fetches + renders photo grid or list view
- `photoCardHTML(p)` / `photoTableRow(p)` — render modes
- `uploadQueue` — drag-drop multi-file upload with progress
- `adminDownloadPhoto(id, resolution)` — creates `<a>` tag and clicks it → browser downloads via `/api/admin/photos/:id/download?resolution=original`
  - Goes **through the server** which streams from Flickr (`streamFlickrSized`)
- `toggleAdminDl(id)` — shows download resolution menu per photo
- `hasPrivateOriginal(p)` — true when `flickrWatermarkId` set (original is in private Flickr album)
- Sidebar tab `Corbeille` loads `GET /api/admin/photos?downloadType=trash` while reusing the Photos grid/list.
- Delete actions move photos into the 7-day trash, set them private, and hide them from the public site.
- Trash mode swaps the bulk toolbar to `Restaurer` for selected photos and `Restaurer tout` for the full trash.
- Private album share copies only `https://ms-comm.github.io/photos.html?private=1`; the access code is not embedded in the URL and is given separately.
- Photos uploaded into a private album, moved there from the photo editor, or bulk-moved there are forced to `downloadType: private`; the backend enforces this even if the client sends another type.
- `downloadType: private` means hidden on the public site and hidden on Flickr: both `flickrOriginalId` and `flickrWatermarkId` are set private. `private-nocode` albums are treated the same as private albums for upload/move enforcement.
- The list select-all checkbox toggles visible rows: first click selects all current rows, second click clears them. Toolbar actions are grouped into `Visages` and `Sync` menus, with the bulk selection bar using consistent outline buttons and sticky positioning while scrolling.
- Bulk album/type changes run sequentially instead of `Promise.all` so Flickr permission updates do not get burst-rate-limited; a Flickr permission failure is shown as an error instead of a false success.
- Long selected-photo actions show `bulk-progress-modal`, block the admin UI, and update `done / total` after every photo.
- Selected photos with `flickrOriginalId` but no `flickrWatermarkId` expose the `Filigrane` action. It calls `/api/admin/photos/bulk/create-watermark`, creates the missing watermarked Flickr copy, stores `flickrWatermarkId`/`flickrWatermarkUrl`, then re-applies the correct Flickr visibility.
- The global topbar no longer shows "Importer des photos"; importing remains available from the Upload sidebar tab.
- Settings and topbar only show worker/job sync details when gallery-app is connected; when offline, queued/failed job text is hidden.

### Upload Flow
1. File selected / dropped → added to `state.uploadQueue`
2. `prepareUploadPage()` calls `loadWatermarkAssets()` — fetches custom font + logo PNG once via `/api/admin/settings/watermark-font` and `/api/admin/settings/watermark-image`
3. For each file: if `OffscreenCanvas + createImageBitmap + FontFace` supported (Safari 16.4+, iOS 18+, modern Android/Chrome), browser generates the watermark image via `generateClientWatermark()` — zero server CPU cost
   - Decodes + resizes to FLICKR_WM_MAX (3840) in one `createImageBitmap` call with `resizeWidth/resizeHeight` (memory-efficient on mobile)
   - Applies gradient + logo + text on OffscreenCanvas, exports as JPEG q82
   - If unsupported or assets not loaded → falls back to server-side sharp
4. `POST /api/admin/photos/upload` sends both `photo` (original) + `watermark` (browser-generated, optional) as multipart fields
5. Server: if `watermark` field present → skips `generateWatermarkedFlickrFile`, uploads browser file to Flickr directly; if absent → server-side sharp (existing path)
6. Pipeline upload (`MAX_IN_FLIGHT=4`): `uploadFile()` returns `{sent, done}` — `sent` resolves on `xhr.upload.onload` (file received by server), `done` resolves when server responds. `tryStartNext()` is called on `sent` so the next file starts uploading while server is doing Flickr upload (~15s). At most 4 concurrent XHRs. ETA = `avgMs × remaining / active`.
7. Progress modal: shows per-file rows (always visible), connection speed (KB/s or MB/s), ETA, cancel button shows "Annulation…" when clicked
8. Duplicate detection: checks last-3-days uploads by filename
9. Upload tab stores a batch history in `upload-history.json`: start/end time, album, visibility, total/imported/failed counts, and per-photo result details.

### Face Detection
- `loadFaces()` — load faces + persons from API
- Bulk scan: POST scan job → worker polls `/api/admin/worker/` → 100-parallel face detections
- `openPersonModal(personId)` — tag detected face to named person

### Translation Editor (Texts tab)
- Loads `GET /api/admin/translations`
- Mode switch: **Textes** edits normal i18n entries; **Services** edits `translations.json._servicesCatalog`
- Textes mode: FR column editable through `_fr_overrides`; EN column editable in section data / `_i18n`
- Services mode: category/card/item CRUD for names, prices, old prices, notes, CTA, order, visibility, featured state, layout, and section backgrounds
- Services mode UX: left hierarchy (`Section > Card > Élément`) jumps to the selected editor block; center pane edits fields; right pane shows a live site-style preview
- Add actions scroll/focus the newly created section, card, or item so the admin sees where it was created
- `admin/js/services-admin-ui.js` contains the hierarchy/draft helpers and must stay inside `photo-server/` because Fly deploy copies only the backend folder
- Save button: current implementation uses `POST /api/admin/translations` with `pushGitHub: true`; it writes `translations.json`, then pushes GitHub when a token is configured
- Public `services.html` reads `_servicesCatalog` through `/api/public/translations` and falls back to static HTML if unavailable

### Settings
- Flickr fields auto-save with debounce (300ms) on blur
- Watermark preview updates live
- `flickrDashReset()` / `flickrDashTest()` — circuit breaker management

## Dashboard Stats Structure (from /api/admin/photos/stats)

```json
{
  "totalPhotos": 42,
  "totalAlbums": 8,
  "storageBytes": 1234567,
  "recentPhotos": [...],
  "downloads": { "last24h": 3, "last7d": 12 },
  "visits": { "last24h": 45, "last7d": 200 },
  "revenue": { "total": 150.00, "last7d": 30.00 },
  "histogram": [{ "day": "2026-05-18", "downloads": 2, "visits": 10 }],
  "topPhotos": [{ "photoId": "...", "title": "...", "count": 5 }],
  "flickr": { "configured": true, "open": false, "secondsUntilOpen": 0 }
}
```

## State Object

```js
state = {
  photos: [],          // all photos from API
  albums: [],          // all albums
  settings: {},        // current settings
  view: 'list'|'grid', // photo view mode
  selectedIds: Set,    // multi-select for bulk ops
  uploadQueue: [],     // pending uploads
  currentPage: 'dashboard',
  sort: 'date-desc',
  uploadCompleted: Map,  // dedup: "name|size" → true
  queueDuplicates: Set,  // server-side dup filenames
  throttleHistory: []    // CPU throttle timestamps (adaptive backoff)
}
```

## Adding a New Admin Tab

1. Add nav button in `admin/index.html` with `onclick="navigate('key')"`
2. Add `<section id="page-key" class="page hidden">` content
3. Add `else if (page === 'key') loadKey();` in `navigate()`
4. Add `async function loadKey() { ... }` in `admin.js`
5. Add tab title: `const titles = { ..., key: 'Tab Title' }`
