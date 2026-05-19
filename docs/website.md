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
| `assets/js/faces.js` | Face detection UI in photo gallery |

## i18n System

- Detection: `navigator.language` → `fr` if starts with `fr`, else `en`
- Storage: `localStorage['mscomm_lang']`
- Dictionary source: `assets/data/translations.json` (loaded by server at `/api/public/translations`)
- Engine: `walkAndTranslate` scans all DOM text nodes + attributes (`placeholder`, `alt`, `aria-label`, `title`)
- **Important**: Elements with `data-i18n` attributes are translated by the DICT system like all others (do NOT add a skip for `data-i18n` in `shouldSkip` — was a known bug, now fixed)
- `_fr_overrides`: admin can override French strings; stored in `translations.json._fr_overrides`
- MutationObserver re-translates dynamically added content

## photos.html — Gallery

### Views
- **Timeline**: all photos sorted by date, infinite lazy-load (sentinel IntersectionObserver)
- **Albums**: grouped by album, timeline by year
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
- Flow: GET `/api/orders/:id/download-urls?token=xxx` → fetch each Flickr URL directly in browser → `fflate.zipSync()` → `URL.createObjectURL()` → download
- Zero server bandwidth for photo files (browser fetches directly from Flickr CDN)

### Lazy Loading
- Batch: ~200 photos rendered at a time, IntersectionObserver sentinel at bottom
- Justified layout: flexbox `flex-grow` on photo tiles (no black holes in grid)
- `resolveUrl()` picks between Flickr watermark URL and local preview fallback

### Private Album Unlock
- Modal with code input → `POST /api/public/albums/:id/verify` → success unlocks photos
- `localStorage` stores unlocked album codes per session

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
  "_fr_overrides": { "original FR": "admin override FR" }
}
```

## Responsive Checklist Before Push

- [ ] Test at 960px and 600px breakpoints
- [ ] Verify `data-i18n` attributes translate in EN mode
- [ ] Check meta tags and `<title>` update on lang switch
- [ ] Verify no broken images (Flickr CDN URLs vs local fallback)
