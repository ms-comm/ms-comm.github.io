# Flickr Integration

> File: `photo-server/services/flickrService.js`
> Protocol: OAuth 1.0a (NOT OAuth 2)

## Configuration

Credentials resolved in order:
1. Environment variables (production Fly.io)
2. `photo-server/db/settings.json` (admin panel → Settings → Flickr)

```
FLICKR_API_KEY
FLICKR_API_SECRET
FLICKR_ACCESS_TOKEN
FLICKR_ACCESS_TOKEN_SECRET
```

## Circuit Breaker — CloudFront IP Ban

Flickr's CDN (live.staticflickr.com) is fronted by CloudFront WAF. If the server IP makes too many requests, CloudFront returns `HTTP 429` with an HTML body (not JSON). This is detected by `isCloudfrontBlock(err)`:

```js
status === 429 && (content-type includes 'text/html' || x-cache includes 'cloudfront')
```

When detected → `tripCircuit()` blocks ALL Flickr API calls for 10 minutes (`assertCircuitClosed()` throws).

- `getCircuitStatus()` — returns `{ open, secondsUntilOpen }`
- `resetCircuit()` — admin can force-reset from Settings tab
- `assertCircuitClosed()` is called by `restGet` and `restPost` (API calls), NOT by direct CDN downloads

**Important**: Direct CDN downloads via axios (e.g., in ZIP routes) bypass the circuit breaker — they won't trip it and won't be blocked by it. Only Flickr REST API calls are protected.

## Key Functions

### Upload

```js
uploadToFlickr(buffer, filename, title, isPublic, tags)
uploadToFlickrPath(filePath, title, isPublic, tags)
```

Upload strategy per `downloadType`:
- `free` → 1× PUBLIC original (no watermark)
- `free-watermark` → 1× PRIVATE original + 1× PUBLIC watermarked copy
- `paid` → 1× PRIVATE original + 1× PUBLIC watermarked copy

Private photos go into the `__MSCOMM_ORIGINALS__` photoset (auto-created on first use).

### Download / Streaming

```js
streamFlickrSized(flickrPhotoId, targetMaxPx, res, filename)
```
Pipes Flickr CDN → HTTP response without buffering. Uses `_o` (originalsecret) for original, `_h/_k/etc.` for sized variants. Memory: ~64 KB constant regardless of file size.

```js
getOriginalUrl(flickrPhotoId)
```
Returns the full CDN URL (`https://live.staticflickr.com/{server}/{id}_{originalsecret}_o.{format}`) by calling `flickr.photos.getInfo`. Used by the **client-side ZIP** endpoint (`/api/orders/:id/download-urls`) — server only fetches metadata, browser fetches the actual file.

```js
downloadOriginalBuffer(flickrPhotoId)
downloadSizedBuffer(flickrPhotoId, maxPx)
```
Downloads into memory buffer. Avoid for large files — use streaming instead.

### URL Construction

CDN URL format:
```
https://live.staticflickr.com/{server}/{id}_{originalsecret}_o.{format}   ← original
https://live.staticflickr.com/{server}/{id}_{secret}_{suffix}.jpg          ← sized
```

Suffixes: `_sq` (75px), `_t` (100px), `_s` (240px), `_m` (500px), `_n` (320px), `_z` (640px), `_c` (800px), `_b` (1024px), `_h` (1600px), `_k` (2048px), `_3k` (3072px), `_4k` (4096px), `_f` (4096px), `_5k` (5120px), `_6k` (6144px).

### Photosets (Albums)

```js
createPhotoset(title, primaryPhotoId)
addPhotoToPhotoset(photoId, setId)
deletePhotoset(setId)
getUserPhotosets()
getPhotosInSet(setId)
```

When a photo is added to a **public** album: auto-create/update the corresponding Flickr photoset (`flickrSetId` stored in `albums.json`).

Private `__MSCOMM_ORIGINALS__` photoset holds all private originals.
- `findOriginalsPhotosetId()` — searches user's photosets by title
- `getOrCreateOriginalsPhotosetId()` — cached lookup, creates if not found

### Other

```js
setPhotoPerms(flickrPhotoId, isPublic)   // make photo public or private
deleteFromFlickr(flickrPhotoId)           // permanent delete
testLogin()                               // tests OAuth credentials
readDimensionsFromCdn(flickrWatermarkUrl) // reads EXIF/dimensions from CDN stream
```

## 429 Rate Limiting — Server vs Browser

| Scenario | Who fetches | Rate limited? |
|----------|-------------|---------------|
| Admin individual download | Server → streams to browser | Server IP (but works in practice for single requests) |
| Server-side ZIP (`download-all`) | Server downloads all files | Server IP gets 429 after N requests |
| Client-side ZIP (`download-urls`) | Browser fetches directly | Browser IP — NOT rate limited |

**Rule**: For bulk downloads (ZIP), always use the client-side approach (`download-urls` endpoint). The server should only fetch metadata (`getOriginalUrl`), not the actual photo bytes.

## Watermarking

- Applied **once at upload** using Sharp (imageProcessor.js)
- SVG text overlay: customizable font, rotation (-25°), position, opacity
- Optional image overlay (uploaded via admin settings)
- Stored as a separate Flickr photo (`flickrWatermarkId`)
- **Never re-applied on download** — the watermarked copy on Flickr is the definitive version
- Changing watermark settings only affects future uploads

## CORS

`live.staticflickr.com` responds with `Access-Control-Allow-Origin: *` for image GET requests, allowing browser `fetch(flickrUrl, { mode: 'cors' })` to work. This is what enables the client-side ZIP approach.
