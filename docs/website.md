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
| `compte.html` | Client space: favorites, orders, profile, password. `noindex`. Tabs are deep-linkable (`#favoris`, `#commandes`, `#profil`) |

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
| `assets/js/faces.js` | Face detection UI — **no longer loaded by `photos.html`** (Visages removed from the public site on 2026-09-02; admin tooling untouched) |
| `assets/js/account.js` | Client accounts: header control, sign-in sheet, favorites, download tickets. Exposes `window.MSAccount`. Loaded on every public page |
| `assets/js/track.js` | Visitor tracking: `vid` (localStorage `ms_vid`) + `sid` (sessionStorage `ms_sid`, 30-min gap), batched `POST /api/public/track` with sendBeacon on pagehide, 20 s heartbeat while visible. Exposes `window.MSTrack.event/identify/flush`. Loaded after `account.js` on every public page. Contract: [tracking.md](tracking.md) |

`assets/css/account.css` holds the account surfaces (header control, sheet, toast,
favorite affordance) and reuses the existing `style.css` tokens.


## Client accounts — « Mon espace »

Browsing stays anonymous. **Downloading requires an account**; the rule is
enforced server-side (see [server.md](server.md), download gate), not just in
the UI.

`window.MSAccount` (from `assets/js/account.js`) is the single entry point:

| Method | Use |
|---|---|
| `isSignedIn()` / `account` / `counts` | current session state |
| `requireAccount({ eyebrow, title, message })` | opens the sheet, resolves `true` after sign-in, `false` if dismissed |
| `signDownloadUrl(url)` / `downloadTicket()` | appends/returns the `dlTicket` needed for cross-site downloads |
| `isFavorite(id)` / `toggleFavorite(id)` | favorites, self-gated (opens the sheet then applies) |
| `logEvent(type, extra)` | best-effort `photo_view` / `album_view` |
| `onChange(fn)` | repaint hook |

**Gated paths in `photos.html`:** `openDlModal()`, `downloadPhoto()`,
`downloadPrivateAlbumPhoto()` and `downloadAlbumZip()`. Each one replays itself
after a successful sign-in, so the visitor lands back on the action he asked
for instead of an empty page.

**Never gate a purchase token.** `downloadPhoto()` skips the gate when a token
from `mscomm_tokens` is present: the buyer paid and may have no account.

The heart stays visible when signed out — hiding it would hide the reason to
have an account.

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

### Gallery bar (`assets/css/gallery-bar.css`)
- One sticky control block `.gal-controls` under the topbar, driven by two variables `--bar-w` / `--bar-h`. Breakpoints (1024 / 900 / 720 / 600 / 430 / 360) only redefine those variables; no rule may set a per-case width, otherwise the three rows drift to different widths again.
- `.gal-tabs-thumb` is a single sliding pill: its `transform` and `width` are written in JS by `syncTabs()`, itself driven by a `MutationObserver` on the tab classes — the active tab is changed from ~10 call sites (`switchView`, `openAlbum`, album return, private code unlock).
- Search field and album filter live in one frame (`.gal-search-row`, `flex-wrap: nowrap`, `#gal-search { width: 0 }`). `.gal-controls.filter-off` collapses the album filter with an animation on non-timeline views.
- The bar becomes glass (`backdrop-filter`) only once `.is-stuck` is set; the topbar hides on scroll down (`.topbar.is-hidden`) and returns on scroll up, with asymmetric thresholds (14px hide / 4px show). `--chrome-h` is tracked frame by frame from the topbar transform matrix so the sticky offset follows the animation.
- `.fx-halo` is a fixed golden veil at `z-index: 0`; the bar sits at 60, so the halo stays visible behind the gallery while scrolling. It only lights up (`.is-lit`) once the visitor has scrolled past 55 % of the viewport; at the top of the page the glow comes from `.gal-hero::before`.
- `.gal-hero` copies the `.page-header` recipe of the other sub-pages exactly: `padding: calc(var(--nav-h) + 60px) 0 40px`, h1 `clamp(32px, 4vw, 52px)`, 16px sub-line, and the same blurred golden `::before` glow behind the title. The topbar is fixed, so a padding that ignores `--nav-h` glues the title to the bar — that was the bug.
- Tabs: `Galerie`, `Albums`, `Mon espace` (badge `#tab-mine-count`), plus the separate `Album privé` button. The former `Mes favoris` and `Mes achats` tabs are gone: both live inside `Mon espace`.

#### Mon espace (`#view-mine`)
- Signed out: the account door `#fav-logged-out` (create an account first, sign-in as the quiet link, both through `MSAccount.requireAccount`). Nothing personal is reachable without an account.
- Signed in: `#fav-logged-in` holds a `.mine-nav` with three facets driven by `setMineFacet()` → `#mine-pane-favorites`, `#mine-pane-albums`, `#mine-pane-purchased`.
  - **Mes favoris** — `renderFavoritesView()`, hearted photos from the loaded catalog through the same masonry/lightbox pipeline, refreshed on every `MSAccount.onChange`.
  - **Mes albums partagés** — `loadMineAlbums()` → `GET /api/account/albums`, rendered by `renderMineAlbums()`; `openGrantedAlbum()` opens a granted private album **without asking for the code**.
  - **Mes achats** — `loadMineOrders()` → `GET /api/account/orders`. Purchases follow the ACCOUNT, not the browser: `purchasedTokens()`/`purchasedPhotoIds()` read the server orders and `localStorage` (`mscomm_tokens`, `mscomm_orders`) is only a migration fallback for pre-account buyers. `hasPurchasedPhoto`, the download modal and `downloadPhoto` all go through `purchasedTokens()`.
- Facet state (`mineFacet`, `mineAlbums`, `mineAlbumsLoaded`, `mineOrders`, `mineOrdersLoaded`) is declared at the top of the module next to `allAlbums`/`allPhotos`: the deep-link IIFE runs before the render block, and declaring it later throws a TDZ error.
- Deep links: `photos.html?view=mine | favorites | purchased | albums_partages` — each opens the right facet. The account menu points at them.

### Topbar order
- Right side of the row, at every width: `Demander un devis` → `FR · EN` → `Mon espace` (far right). `account.js` `mount()` inserts `#acct-control` right after `.nav-cta`; the FR/EN switcher is then inserted **inside** `.topbar-inner`, right before `#acct-control` (`positionSwitcher()` in `i18n.js`, re-called by `mount()` because i18n runs first and the anchor does not exist yet). Never restore the old absolutely-positioned rule: below 961px it fell back into normal flow and dropped to a second line.
- `html`/`body` use `overflow-x: clip`, never `hidden`: `hidden` turns the element into a scroll container and silently disables every `position: sticky` on the site.
- `.nav-cta` and `.acct-trigger` are `white-space: nowrap; flex-shrink: 0` globally — their fixed 40px height turns any line break into clipped text.
- Below 560px the brand baseline (`.brand-text span`) is hidden; it wrapped onto three lines and doubled the topbar height.

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
- The download loop lives in `fetchAlbumPhotoBytes()` (injectable `fetchImpl`/`sleep`/`now`, covered by `tests/album-zip-browser-ratelimit.test.js`). Do not rename it `fetchAlbumPhotos`: that name already belongs to the album-listing helper.
- Each photo gets 3 attempts (1 s then 2 s backoff) so one CDN hiccup does not lose the whole album; a definitive failure names the file and asks for a relaunch.
- **HTTP 429 is a rate limit, not a failure** — same policy as the server worker. It must NOT consume one of the 3 attempts. It pauses (`Retry-After` when present, otherwise 20 s / 45 s / 90 s / 120 s / 180 s / 300 s), retries the *same* photo, and permanently doubles the inter-photo cadence (500 ms up to max 8 s). Only after 6 pauses does the download stop, with a message telling the visitor to retry in ~10 minutes. Symptom of getting this wrong: on a throttled connection the album always dies at the same photo (measured: 142/302, three runs in a row) because three 429 burn the three attempts in ~3 s, while other connections finish normally.
- During a rate-limit pause the step switches to the `waiting` estimate so the countdown to resumption is visible instead of looking frozen. Pause time is excluded from the measured per-photo pace, so one 429 does not inflate the remaining-time estimate for the rest of the album.
- A 500 ms pause separates two photos (skipped after the last one) to stay well under any Flickr CDN burst threshold. Cost: ~2 min 30 s of added wait on a 302-photo album. This is a *starting* cadence: it self-adapts upward on 429.
- Progress is shown in two synchronized surfaces driven by the `zipProgress` controller: the inline banner (clickable, always visible while running) and the `#zip-modal` dialog with the three steps **Préparation → Téléchargement des photos → Fabrication du ZIP**, each with its own bar and live `n/total` count plus the current image name.
- **Préparation** has no countable photo unit (it is one manifest request that resolves every Flickr URL server-side and can take ~20s on a big album), so it is reported as 3 explicit sub-steps — access check, server building the list, list ready.
- Sub-step 2 sits at `2/3` for the whole manifest request, so `zipProgress.set(step, done, total, current, waiting = true, etaMs)` marks it with a time estimate instead of an indeterminate bar. The estimate is seeded from the photo count (`max(3000, count * 60)` ms) and the bar fills asymptotically (`1 - exp(-2.5 * elapsed / etaMs)`), reaching ~92 % at the estimate and never 100 % early, so a slower server still looks like it is progressing. The count shows the remaining time via `formatRemaining()` (`quelques secondes` / `environ N s` rounded to 5 s / `environ N min`), refreshed every 200 ms with a `.22s linear` CSS transition on the progress value (disabled under `prefers-reduced-motion`).
- The **Téléchargement des photos** step shows the same estimate, recomputed live from the measured average per photo so far (seeded at 900 ms so a figure appears from photo 1): `Image n/total — file.jpg · reste <estimation>`. It reuses the exported `zipProgress.formatRemaining()`.
- Closing the modal (cross, backdrop or `Escape`) never cancels the download: the job keeps running and the banner stays visible; clicking the banner reopens the panel with the live state.
- On success the panel does not close: `zipProgress.succeed({ subtitle, expiryLabel, onAgain })` swaps the step list for a confirmation state (`.zip-modal.is-done`) with an animated drawn checkmark, "ZIP téléchargé avec succès", and a summary line `N photos · taille · nom-du-fichier`. All animations are disabled under `prefers-reduced-motion`.
- The blob is kept alive for **10 minutes** after the save, and a **Retélécharger** button re-triggers `saveZip()` from that cached archive — useful when the browser save dialog was cancelled or the wrong folder was picked, since it avoids re-fetching 300 photos from Flickr. When the keep-alive timer fires, `URL.revokeObjectURL()` frees the memory and `zipProgress.expireDone()` withdraws the button (a revoked object URL would fail silently). A new run clears any previous cached archive and the success state (`clearDone()`).
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
