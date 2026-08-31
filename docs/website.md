# Frontend Website — GitHub Pages

> Deploy: `git push origin main` from root. Auto-publishes to `https://ms-comm.github.io/`.
> Never include `photo-server/` in git commits.

## Pages

| File | Purpose |
|------|---------|
| `index.html` | Homepage: hero, stats, about, skills, services CTA |
| `services.html` | Services detail page |
| `portfolio.html` | Portfolio grid |
| `experiences.html` | Client experiences / testimonials |
| `contact.html` | Contact form |
| `photos.html` | Public photo gallery + checkout + "Mes achats" |
| `checkout.html` | Stripe payment + order confirmation |

## Design System

- Theme: dark (`--bg: #0a0a0a`), gold accents (`--gold: #c69b00`, `--gold-2: #d4aa00`)
- Fonts: Playfair Display (titles), Poppins (headings), Inter (body) — Google Fonts
- Animations: IntersectionObserver reveals, canvas sparkles, CSS transitions
- Breakpoints: 960px (tablet), 600px (mobile) in `assets/css/style.css`
- `style.css` is the single global stylesheet (~2200 lines)

## JS Files

| File | Purpose |
|------|---------|
| `assets/js/main.js` | Drawer nav, scroll reveals, lightbox, carousel, sparkles |
| `assets/js/i18n.js` | Language switcher + full translation engine |
| `assets/js/services-catalog.js` | Renders editable services/prices on `services.html` from `translations.json._servicesCatalog` |
| `assets/js/faces.js` | Face detection UI in photo gallery |

## i18n System

- Detection: `navigator.language` → `fr` if starts with `fr`, else `en`
- Storage: `localStorage['mscomm_lang']`
- Dictionary source: `assets/data/translations.json` (loaded by server at `/api/public/translations`)
- Engine: `walkAndTranslate` scans all DOM text nodes + attributes (`placeholder`, `alt`, `aria-label`, `title`)
- **Important**: Elements with `data-i18n` attributes are translated by the DICT system like all others (do NOT add a skip for `data-i18n` in `shouldSkip` — was a known bug, now fixed)
- `_fr_overrides`: admin can override French strings; stored in `translations.json._fr_overrides`
- MutationObserver re-translates dynamically added content

## services.html — Editable Services Catalog

- `services.html` keeps a static fallback inside `#services-catalog-root`, then `assets/js/services-catalog.js` replaces it when `translations.json._servicesCatalog` is available.
- Data source priority matches i18n: backend `GET /api/public/translations` first, then static `assets/data/translations.json`.
- Dynamic service blocks are forced visible after injection because the global reveal observer only observes DOM present on initial page load.
- Admin edits happen in Texts → Services and save through the same `/api/admin/translations` flow as normal text edits.
- `_servicesCatalog.categories[]` contains section fields: `title`, `accent`, `subtitle`, `layout` (`cards` or `tarifs`), `columns`, `background`, `visible`, `footnote`, and `cards[]`.
- Each card supports `name`, `oldPrice`, `price`, `priceNote`, `note`, `cta`, `ctaHref`, `featured`, `visible`, and `items[]` (`label`, optional `price`).
- If `ctaHref` is empty, the renderer builds `contact.html?pack=<name> — <price>` automatically.

## photos.html — Gallery

### Views
- **Timeline**: all photos sorted by date, infinite lazy-load (sentinel IntersectionObserver)
- **Albums**: grouped by album with the same justified masonry image style as the main gallery; public/private album photo grids use the same visual language and sort photos newest-first (`takenAt || createdAt`)
- **Faces**: AI face detection results
- **Mes achats**: purchased photos with "Tout télécharger (ZIP)" button

### Photo Card Download Types
- `free` → direct Flickr original URL (no watermark)
- `free-watermark` → Flickr watermarked copy URL
- `paid` → shows buy button; after purchase, unlocks via download token
- `private` → requires album code

### "Mes achats" / Client-side ZIP
- After Stripe checkout, `checkout.html` stores order info in `localStorage['mscomm_orders']`:
  ```js
  { id, url, photoIds, total, at }
  ```
  `url` = `/api/orders/:id/download-all?token=xxx` (contains the order token)
- "Tout télécharger" button calls `downloadOrderZip(orderId, token, btnEl, lblEl)`
- Uses **fflate** (CDN: `cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js`) loaded before `</body>`
- Flow: GET `/api/orders/:id/download-urls?token=xxx` → for each photo, fetch via `GET /api/public/photos/:id/download?token=xxx&resolution=original` (same-origin, no CORS issue) → `fflate.zipSync()` → `URL.createObjectURL()` → download
- Same endpoint as individual downloads — already proven to work
- `revokeObjectURL` delayed 30s so browser has time to read the blob before it's freed
- Guard: checks `typeof fflate !== 'undefined'` before proceeding

### Album ZIP
- Public albums show "Tout telecharger (avec filigrane)" only.
- Private albums unlocked by code also show "Tout telecharger (sans filigrane)".
- `private-watermark` albums unlock with a code but individual and grouped menus show only "Avec filigrane".
- Album view uses download menus: "Tout telecharger" opens a choice between watermark/original, and "Telecharger la selection" first enters selection mode, then opens the same choice for selected photos. The magnifier overlay is hidden while selecting, "Annuler" exits selection mode, and the all-download button is hidden until selection mode is cancelled. Public original downloads remain blocked unless a private album is unlocked.
- `downloadAlbumZip(mode, btnEl, lblEl, selectedOnly)` builds the ZIP entirely in the browser for **every device** (desktop and mobile): it reads `/api/public/albums/:id/download-urls`, fetches each `directUrl` from the Flickr CDN, then zips locally with `fflate.zip` (async, `level: 0`). No server ZIP job is created any more.
- Rationale: measured on the 302-photo private wedding album, the browser fetched 10/10 photos in 0.4 s from the home connection while the exact same URLs returned HTTP 429 from the Fly datacenter IP. Flickr rate-limits the server IP, not the visitor, so client-side download is both faster and immune to the 429 that made large albums impossible.
- Each photo gets 3 attempts (1 s then 2 s backoff) so one CDN hiccup does not lose the whole album; a definitive failure names the file and asks for a relaunch.
- Progress is shown in two synchronized surfaces driven by the `zipProgress` controller: the inline banner (clickable, always visible while running) and the `#zip-modal` dialog with the three steps **Préparation → Téléchargement des photos → Fabrication du ZIP**, each with its own bar and live `n/total` count plus the current image name.
- **Préparation** has no countable photo unit (it is one manifest request that resolves every Flickr URL server-side and can take ~20s on a big album), so it is reported as 3 explicit sub-steps — access check, server building the list, list ready.
- Sub-step 2 sits at `2/3` for the whole manifest request, so `zipProgress.set(..., waiting = true)` marks it: the bar loses its `value` attribute to render the browser's animated indeterminate bar, the count becomes `2/3 · Ns` with live elapsed seconds, and the caption gains a pulsing ellipsis. The same treatment applies to any step running with `total = 0`.
- Closing the modal (cross, backdrop or `Escape`) never cancels the download: the job keeps running and the banner stays visible; clicking the banner reopens the panel with the live state.
- `resumeStoredAlbumZipJob()` only clears the legacy `mscomm_album_zip_job` key so an old server job can never reopen a stale progress bar.
- Private album access is restored after refresh from session storage, scoped to the album; code remains absent from URL and is cleared when the session ends.
- Local and server ZIP work add an animated button indicator; invalid saved job responses are discarded so stale state cannot show `undefined/undefined`.
- Download feedback starts before network requests, and private album refresh keeps `private=1&album=...` context without putting code in URL.
- Before submitting the form, the page calls `/api/public/albums/:id/download-check`; if Flickr/Fly is already blocked with 429, it shows a native alert with `mscomm.contact@gmail.com`.
- Private album code is sent in the POST body, not in the share URL.
- Button label changes to "Preparation..." then "Telechargement lance"; detailed byte progress is handled by the browser download UI.
- Security rule: sans-filigrane requires a valid code for an album of type `private`; `private-watermark` never permits originals, and public paid originals remain purchase-token only.

### Lazy Loading
- Batch: ~200 photos rendered at a time, IntersectionObserver sentinel at bottom
- Justified layout: flexbox `flex-grow` on photo tiles (no black holes in grid)
- `resolveUrl()` picks between Flickr watermark URL and local preview fallback
- Opening a public album reloads its photos from `/api/public/photos?albumId=...` with `cache:no-store`, then falls back to cached `allPhotos`; this avoids empty album views when the initial global photo payload is stale or incomplete.

### Private Album Unlock
- Modal with code input → `POST /api/public/verify-private-code` → success unlocks photos
- The response includes `album.type`; `private` enables watermark/original actions while `private-watermark` enables watermark actions only.
- Unlock code stays in memory for the current view and is re-sent per private photo/ZIP download.
- Private album share links never include the code. Admin shares `photos.html?private=1` so the code modal opens immediately; the code is given separately.

### Cart & Checkout
- Cart state in memory + `localStorage['mscomm_cart']`
- `renderCartPanel()` manages cart sidebar
- On checkout: create Stripe PaymentIntent → confirm → POST `/api/orders/confirm`

## API Connection

```js
const API = (localhost || file://) ? 'http://localhost:3000' : 'https://ms-comm-server.fly.dev';
```

## Translations Data File

`assets/data/translations.json` — also mirrored to `photo-server/defaults/translations.json` (bundled in fly deploy as fallback, NOT git-tracked in photo-server/).

Structure:
```json
{
  "_meta": { "updatedAt": "..." },
  "navigation": { "fr": "...", "en": "..." },
  "photos": { ... },
  "checkout": { ... },
  "_servicesCatalog": { "categories": [...] },
  "_fr_overrides": { "original FR": "admin override FR" }
}
```

## Responsive Checklist Before Push

- [ ] Test at 960px and 600px breakpoints
- [ ] Verify `data-i18n` attributes translate in EN mode
- [ ] Check meta tags and `<title>` update on lang switch
- [ ] Verify no broken images (Flickr CDN URLs vs local fallback)
