# Admin Panel — photo-server/admin/

> Access: `https://ms-comm-server.fly.dev/admin` (prod) or `http://localhost:3000/admin` (dev)
> Single-page app — no build step. Edit files and reload.

## Files

| File | Purpose |
|------|---------|
| `admin/index.html` | Full SPA HTML + inline styles |
| `admin/js/admin.js` | All logic (~3800 lines): CRUD, upload queue, face scan, settings |
| `admin/css/admin.css` | Admin-specific styles |

## Tabs / Pages

| Tab | `navigate()` key | What it does |
|-----|-----------------|--------------|
| Dashboard | `dashboard` | Stats overview: photo/album counts, revenue, downloads, visits, histogram, top photos, recent orders |
| Photos | `photos` | Photo grid/list with search/filter, inline edit, upload queue, Flickr badge |
| Albums | `albums` | Album CRUD, public/private toggle, email code sender, Flickr photoset sync |
| Faces | `faces` | Face detection results grid, person tagging, bulk scan launch |
| Orders | `orders` | Order list, download token generation, order status |
| Texts | `texts` | i18n translation editor: FR column (editable) + EN column, GitHub push |
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

### Upload Flow
1. File selected / dropped → added to `state.uploadQueue`
2. Each file uploaded via `POST /api/admin/photos/upload` (multipart)
3. Backend: saves original locally → generates preview (1200px) → uploads to Flickr
4. Queue item shows progress bar → success/error badge
5. Duplicate detection: checks last-3-days uploads by filename

### Face Detection
- `loadFaces()` — load faces + persons from API
- Bulk scan: POST scan job → worker polls `/api/admin/worker/` → 100-parallel face detections
- `openPersonModal(personId)` — tag detected face to named person

### Translation Editor (Texts tab)
- Loads `GET /api/admin/translations`
- FR column editable, EN column read-only
- Save: `PUT /api/admin/translations` → writes `translations.json`
- GitHub push button: `POST /api/admin/translations/push` → commits to GitHub via API

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
