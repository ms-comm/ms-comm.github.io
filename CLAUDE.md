# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**MS Comm'** is a dual-stack project for a photography/communication services portfolio with integrated photo gallery management:

1. **Frontend** (GitHub Pages): Static HTML/CSS/JS site at `https://ms-comm.github.io/`
   - Marketing pages: home, services, portfolio, experiences, contact
   - Public photo gallery (`photos.html`) with album browsing, lazy-loading, and Stripe checkout
   - i18n support (FR/EN)

2. **Backend** (Node.js/Express on Fly.io): Photo gallery server with admin panel
   - Photo upload/management with Flickr integration (CDN offloading)
   - Admin dashboard at `/admin` with face detection, albums, orders, settings
   - Stripe integration for paid photo downloads
   - Email notifications for private album access codes

---

## Development & Deployment Commands

### Frontend (Root Directory)

```bash
# Local development server (Python built-in)
python -m http.server 8080
# Visit http://localhost:8080

# Deploy to GitHub Pages (all changes auto-publish on push to main)
git add .
git commit -m "Description"
git push origin main
```

**Note**: PowerShell doesn't support `&&` chaining — run git commands separately.

### Backend (photo-server/)

```bash
# Install dependencies
cd photo-server
npm install

# Local development with hot-reload
npm run dev
# Server runs at http://localhost:3000
# Admin panel at http://localhost:3000/admin

# Production start
npm start

# Deploy to Fly.io
fly deploy
# Requires: fly auth login, environment secrets configured
```

---

## Architecture Overview

### Frontend Stack
- **HTML/CSS/JS**: Vanilla (no framework)
- **Fonts**: Playfair Display (titles), Poppins (headings), Inter (body)
- **Design**: Dark theme (--bg: #0a0a0a), gold accents (--gold: #c69b00)
- **Animations**: IntersectionObserver reveal, CSS animations, canvas sparkles
- **Key files**: `style.css` (2157 lines), `main.js` (399 lines)

### Backend Architecture

#### HTTP Server (server.js)
- Express.js with session-based authentication
- Multi-tier rate limiting: auth (10/15min) → orders (20/10min) → admin (3000/15min) → public (2000/15min) → worker (30000/15min)
- Helmet.js for security headers (CSP, CORS, COEP disabled for Flickr CDN)
- CORS allowlist: localhost:8080/3000, ms-comm.github.io, Fly.io domain
- Session store: file-based (with Windows EPERM resilience layer)
- Process safety: uncaught exception handlers, memory watchdog (warn >400MB), health check at `/healthz`

#### Routes (photo-server/routes/)

| File | Responsibility |
|------|---|
| `auth.js` | Login/logout, password change, bcrypt migration |
| `adminPhotos.js` | CRUD photos, Flickr/local upload, image resizing (multer + sharp) |
| `adminAlbums.js` | CRUD albums, email codes for private albums, Flickr photoset sync |
| `adminOrders.js` | Payment orders, download tokens, ZIP generation |
| `adminPromoCodes.js` | Promo code CRUD, discount application |
| `adminSettings.js` | Config (prices, watermark, SMTP, Flickr keys) |
| `adminFaces.js` | Face detection + tagging via gallery-app worker |
| `adminTranslations.js` | i18n text management |
| `publicApi.js` | Public endpoints: list albums/photos, verify codes, download |
| `orders.js` | (Deprecated) legacy order handling |
| `stripeWebhook.js` | Stripe payment confirmation webhook |
| `workerApi.js` | gallery-app worker endpoints (claim/complete scan jobs) |

#### Services (photo-server/services/)

| File | Purpose |
|------|---------|
| `db.js` | Atomic JSON read/write with per-file mutexes; prevents race conditions on high concurrency |
| `flickrService.js` | OAuth 1.0a, upload (original private + watermark public), download, photoset sync, circuit breaker for CloudFront bans |
| `imageProcessor.js` | Sharp: generate previews (1200px), apply watermarks (SVG text or image), resize |
| `emailService.js` | Nodemailer: send private album access codes |
| `stripeService.js` | Stripe SDK integration for payment handling |

#### Database (photo-server/db/ — JSON files)

| File | Schema |
|------|--------|
| `settings.json` | Admin credentials (bcrypt), prices, watermark config, SMTP, Flickr keys, GitHub token |
| `photos.json` | Photo metadata: id, title, albumId, flickr IDs (original/watermark), downloadType, price, dimensions |
| `albums.json` | Album metadata: name, type (public/private), code, flickrSetId, cover photo, max downloads allowed |
| `orders.json` | Orders: cart items, total, promo code, download tokens, timestamp |
| `promo-codes.json` | Code, discount type (fixed/percent), max uses, remaining uses, active flag |
| `persons.json` | Named faces detected in photos |
| `appearances.json` | Face detection results: person ID, photo ID, bounding box |
| `scan-jobs.json` | Batch face-scan jobs (pending/running/done/failed) |
| `worker-state.json` | Gallery-app worker heartbeat data |

#### Admin Interface (photo-server/admin/)

Single-page app (SPA) with tabs:
- **Dashboard**: stats, recent orders/uploads
- **Photos**: grid CRUD, upload with drag-drop queue, Flickr badge, resolution download selector
- **Albums**: CRUD, public/private toggle, email code sender
- **Faces**: AI face detection results, person tagging, bulk scan management
- **Orders**: payment history, download token generation
- **Upload**: direct file upload interface
- **Texts**: i18n translation editor
- **Settings**: prices, watermark (position/opacity/image), SMTP, Flickr API keys, GitHub sync

### Photo Pipeline

#### Upload Flow (Admin → Flickr)
1. Admin uploads file via `/api/admin/photos/upload`
2. Backend saves original locally, generates preview (1200px)
3. Based on `downloadType`:
   - **`free`**: Upload original to Flickr (public, no watermark)
   - **`free-watermark`**: Upload original (private) + watermarked copy (public)
   - **`paid`**: Upload original (private) + watermarked copy (public), generate download token on purchase
4. Store Flickr photo IDs in `photos.json`
5. If album is public, sync/add to Flickr photoset

#### Download Flow (Client)
- **Free (unwatermarked)**: Direct from Flickr original URL
- **Free (watermarked)**: From Flickr watermarked copy URL
- **Paid (original)**: Flickr original buffer + token validation
- **Private album**: ZIP of max N photos from Flickr

#### Watermarking
Applied **once at upload** using Sharp:
- Position: bottom-right, center, corners
- Opacity: 10–90% configurable
- Text or image overlay
- Stored as separate Flickr copy (never re-applied on download)

### Flickr Integration

- **OAuth 1.0a** (not OAuth 2)
- **Circuit breaker**: CloudFront WAF bans IP for rate limiting; when detected, all Flickr calls blocked for 10 min to avoid prolonging the ban
- **Credential fallback**: env vars (prod) → `settings.json` (admin panel)
- **Photoset sync**: Auto-create/update Flickr photosets for public albums
- **CDN offloading**: All images served from `live.staticflickr.com` (zero server bandwidth)

---

## Key Implementation Details

### Security

- **Admin password**: bcrypt (12 rounds); plaintext legacy passwords auto-hashed on first login
- **Session**: file-based, httpOnly cookies, regenerated on login (prevents fixation)
- **CSP**: Strict in production (allows only Stripe, Flickr, Google Fonts)
- **Rate limiting**: Per-endpoint tiers to mitigate brute-force, scraping, card-testing
- **Input validation**: `typeof` checks on username/password; server-side discount recalculation (ignores client values)
- **Critical env vars**: `SESSION_SECRET` required in production (blocks startup if missing)

### Frontend Photo Gallery (photos.html)

- **Lazy-loading**: Batch rendering (~200 photos/month) via IntersectionObserver sentinel
- **Justified layout**: Flex with `flex-grow` for perfect grid (no black holes)
- **Views**: Albums (timeline by year) / Timeline (all) / Grid
- **Search**: By title or album name
- **Private albums**: Enter code → modal unlock
- **Lightbox**: Full-screen preview with filigrane
- **Progressive enhancement**: Works without JS (fallback grid), enhanced UX with JS

### Image Processing

- Sharp pipeline: decode → resize → apply watermark (SVG text + optional image) → encode
- Preview size: 1200px width (responsive)
- Output: JPG (quality 85)
- Watermark SVG: customizable font, rotation (-25°), position, opacity, text/image blend

### i18n (Internationalization)

- **Switcher**: Language flag in top-right header
- **Detection**: Auto-detects `navigator.language` (fr* → FR, else EN)
- **Storage**: `localStorage['mscomm_lang']`
- **Dictionary**: In `assets/js/i18n.js`, translates:
  - Text nodes
  - Attributes (`placeholder`, `alt`, `aria-label`, `title`)
  - Meta tags, page title
  - Dynamic content via MutationObserver

### Rate Limiting Strategy

Mounted in order of specificity:
1. `/api/auth/login`: 10/15min (brute-force defense)
2. `/api/orders`: 20/10min (card-testing defense)
3. `/api/admin/*`: 3000/15min (admin heartbeat + bulk re-scans)
4. `/api/admin/worker/*`: 30000/15min (worker parallel jobs)
5. `/api/*`: 2000/15min (catchall; protects healthcheck)

**Important**: `/healthz` is mounted **before** all limiters to avoid killing the Fly.io machine.

### Windows Compatibility Quirks

- **Session file store**: OneDrive/Defender/antivirus hold transient locks on freshly-written files. Wrapped with 25 retry loops + fallback to non-atomic overwrite. `SESSION_DIR` env var points to OS temp dir (not project) to avoid this.
- **Atomic writes**: `db.js` retries atomic rename with exponential backoff; falls back to direct overwrite if stuck.
- **PowerShell**: `&&` operator not available; must run git commands separately.

### Fly.io Production Config (fly.toml)

- **Region**: Paris (cdg)
- **VM**: 1 shared CPU, 512 MB RAM, 512 MB swap
- **Concurrency**: Hard limit 200, soft limit 100 (bumped from 50 due to worker parallelism)
- **Persistence**: `/data` volume (persists db/ and storage/)
- **Min machines**: 1 (always running; critical for worker batch flushes)
- **Healthcheck**: `/healthz` every 30s (before any rate limiter)

---

## Common Development Tasks

### Add a New API Endpoint

1. Create route file in `photo-server/routes/` (or add to existing)
2. Import in `server.js` and mount: `app.use('/api/path', require('./routes/file'))`
3. Add rate limiting if needed (mount after other middleware, before your route)
4. Update `CLAUDE.md` + `PROJECT_CONTEXT.md` if public-facing

### Modify Admin Panel UI

1. Edit `photo-server/admin/index.html` (single file with inline styles)
2. Update `photo-server/admin/js/admin.js` for logic
3. CSS in `photo-server/admin/css/admin.css`
4. Reload at `http://localhost:3000/admin` (no build step)

### Change Frontend Pages

1. Edit HTML file (e.g., `services.html`)
2. Push to GitHub → auto-deploys
3. Check `style.css` for responsive breakpoints (960px, 600px)
4. Verify meta tags + JSON-LD Schema.org before publishing

### Add Flickr API Call

1. Open `photo-server/services/flickrService.js`
2. Use OAuth 1.0a helper: `const auth = OAuth(oauthConfig).authorize(requestData)`
3. Check circuit breaker status before call: `assertCircuitClosed()`
4. Handle CloudFront 429: caught by `isCloudfrontBlock()`, trips 10-min cooldown

### Adjust Watermark Settings

1. Admin panel → Settings → Watermark
2. Position, opacity, text, font size, color, rotation are live-editable
3. Upload custom watermark image (stored in Fly volume)
4. Next upload uses new watermark; old photos not re-processed

### Enable Email for Private Albums

1. Admin → Settings → SMTP
2. Configure host, port, user, pass, from address
3. When code is sent, `emailService.js` uses these credentials
4. Fallback: if SMTP not configured, code displayed in admin panel only

---

## Testing & Debugging

### Local Testing Checklist

```bash
# 1. Backend + admin panel
cd photo-server
npm run dev
# Logs will show session store warnings on Windows (expected)

# 2. Frontend
python -m http.server 8080
# Visit http://localhost:8080, http://localhost:8080/photos.html

# 3. Check API connectivity (admin panel should show green dot)
curl http://localhost:3000/api/health

# 4. Test Flickr integration (admin → settings)
# Run "Test Connection" — should show success or circuit-breaker cooldown

# 5. Stripe (dev mode keys only; replace with live keys for production)
# admin → orders → create test order
```

### Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Admin panel won't load | Backend not running or CORS error | Start backend: `npm run dev` in photo-server/ |
| Flickr uploads fail | Circuit breaker open (CloudFront banned IP) | Wait 10 min; check `isCloudfrontBlock()` logs |
| Session save errors on Windows | OneDrive/Defender file lock | Ignore (wrapped error handler suppresses) |
| `SESSION_SECRET` error on Fly.io | Env var not set | `fly secrets set SESSION_SECRET="<random>"` |
| Photos not appearing in gallery | Photo not added to album or album not public | Check album type + photo albumId in settings |
| Rate limit triggered | Too many requests from same IP | Check limiter tiers in server.js |

---

## Key Files to Know

| Path | Purpose |
|------|---------|
| `/index.html` + `/services.html` + `/portfolio.html` | Main marketing pages |
| `/photos.html` | Public photo gallery (frontend) |
| `/assets/css/style.css` | Global styles (dark theme, animations) |
| `/assets/js/main.js` | Frontend logic (drawer, reveal, lightbox, carousel) |
| `/assets/js/i18n.js` | Language switcher + translation engine |
| `photo-server/server.js` | Express app setup, middleware, rate limiters |
| `photo-server/admin/index.html` | Admin panel (all-in-one SPA) |
| `photo-server/admin/js/admin.js` | Admin logic (CRUD, upload, face scanning) |
| `/PROJECT_CONTEXT.md` | Detailed project context (pages, design, SEO) |
| `photo-server/FLICKR_INTEGRATION_CONTEXT.md` | Deep dive on Flickr integration |
| `photo-server/SECURITY_AUDIT.md` | Security fixes + pre-production checklist |

---

## Environment Variables (Fly.io Production)

Required:
```
NODE_ENV=production
SESSION_SECRET=<64+ random chars>
SITE_URL=https://ms-comm.github.io
PUBLIC_API_URL=https://ms-comm-server.fly.dev
FLICKR_API_KEY, FLICKR_API_SECRET, FLICKR_ACCESS_TOKEN, FLICKR_ACCESS_TOKEN_SECRET
STRIPE_PUBLISHABLE_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
```

Optional:
```
DATA_DIR=/data (for Fly volume mount)
SESSION_DIR=<custom temp dir> (default: OS temp + suffix)
```

Set with: `fly secrets set VAR_NAME="value"`

---

## Deploy Checklist

**Before `fly deploy`:**
- [ ] Test admin panel locally (`npm run dev`)
- [ ] Test photo upload + Flickr sync
- [ ] Test Stripe payment (dev mode)
- [ ] Secrets configured on Fly.io
- [ ] Volume mounted (`/data` → `ms_comm_data`)

**After deploy:**
- [ ] Check logs: `fly logs`
- [ ] Verify healthcheck: `curl https://ms-comm-server.fly.dev/healthz`
- [ ] Admin panel loads: `https://ms-comm-server.fly.dev/admin`
- [ ] Test upload → Flickr sync
- [ ] Public site: `https://ms-comm.github.io/photos.html`

---

## Important Notes

- **Frontend**: Static, no backend dependency. Pushes to GitHub Pages auto-deploy.
- **Backend**: Stateless (except sessions). Data persists in Fly volume.
- **Flickr**: All images served from CDN; server only stores metadata.
- **Watermark**: Applied once at upload; cached on Flickr. Never re-processed.
- **Workers**: `gallery-app` polls `/api/admin/worker/` for face-scan jobs (100-way parallel).
- **Rate limits**: Per-endpoint; worker tier separate from admin/public to prevent interference.
