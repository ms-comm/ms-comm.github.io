/* assets/js/faces.js — Public-site face overlay & visages page module.
 *
 * Exposed on `window.MSFaces`. Intended to be used by `photos.html`:
 *
 *   MSFaces.init({ apiBase: API, resolveUrl });
 *   MSFaces.attachOverlay(imgEl, photoId);
 *   MSFaces.renderPersonsView(container);
 *
 * The module is defensive: every fetch failure degrades silently — the
 * page must keep working when the photo-server is asleep, the gallery-app
 * worker is offline, or no faces have been published yet.
 */
(function (global) {
  const PERSONS_CACHE_KEY = 'mscomm_faces_persons_v1';
  /* Short TTLs so admin renames / new visages appear within a minute on
   * a hard refresh — caching here is just to avoid re-fetching during a
   * single browsing session, not for long-term offline access. */
  const PERSONS_CACHE_TTL_MS     = 60 * 1000;          /* 60 s */
  const PHOTO_FACES_CACHE_TTL_MS = 60 * 1000;          /* 60 s — per-photo */
  const PHOTO_FACES_CACHE_KEY    = 'mscomm_faces_photo_v1';

  /* ─── State ──────────────────────────────────────────────────────────── */
  const cfg = {
    apiBase: '',
    resolveUrl: (u) => u || ''
  };
  /* In-memory cache layer over localStorage to avoid repeated parse cost. */
  const photoFacesMem = new Map();
  const inFlight = new Map();

  function init(options = {}) {
    cfg.apiBase    = options.apiBase    || '';
    cfg.resolveUrl = options.resolveUrl || ((u) => u || '');
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ─── Local-storage helpers ──────────────────────────────────────────── */
  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || '{}'); }
    catch { return {}; }
  }
  function writeJson(key, obj) {
    try { localStorage.setItem(key, JSON.stringify(obj)); }
    catch { /* quota exceeded — best effort */ }
  }

  /* ─── Public API: photo faces ────────────────────────────────────────── */
  async function loadPhotoFaces(photoId) {
    if (!photoId || !cfg.apiBase) return [];
    if (photoFacesMem.has(photoId)) return photoFacesMem.get(photoId);
    if (inFlight.has(photoId))      return inFlight.get(photoId);

    /* Look in localStorage cache first. */
    const cache = readJson(PHOTO_FACES_CACHE_KEY);
    const entry = cache[photoId];
    if (entry && Date.now() - entry.ts < PHOTO_FACES_CACHE_TTL_MS) {
      photoFacesMem.set(photoId, entry.faces);
      return entry.faces;
    }

    /* Network fetch */
    const promise = (async () => {
      try {
        const res = await fetch(`${cfg.apiBase}/api/public/photos/${encodeURIComponent(photoId)}/faces`);
        if (!res.ok) return [];
        const faces = await res.json();
        photoFacesMem.set(photoId, faces);
        cache[photoId] = { ts: Date.now(), faces };
        writeJson(PHOTO_FACES_CACHE_KEY, cache);
        return faces;
      } catch { return []; }
      finally { inFlight.delete(photoId); }
    })();
    inFlight.set(photoId, promise);
    return promise;
  }

  /* Attach an SVG face overlay over an <img> element. The overlay is added
   * once: subsequent calls update it in place. The image must be inside a
   * positioned ancestor (or we wrap one). */
  async function attachOverlay(imgEl, photoId, opts = {}) {
    if (!imgEl || !photoId) return;
    /* Ensure host wrapper. We use the image's parent if it's already
     * positioned (the photos.html lightbox uses `.lb-img-wrap`); otherwise
     * we lazily wrap the image in a `<div class="ms-face-host">`. */
    let host = imgEl.parentElement;
    if (host && getComputedStyle(host).position === 'static') {
      host.style.position = 'relative';
    }
    if (!host) return;

    /* Reuse a single overlay per host. */
    let overlay = host.querySelector(':scope > .ms-face-overlay');
    if (!overlay) {
      overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      overlay.setAttribute('class', 'ms-face-overlay');
      overlay.setAttribute('viewBox', '0 0 100 100');
      overlay.setAttribute('preserveAspectRatio', 'none');
      host.appendChild(overlay);
    }
    overlay.setAttribute('data-photo-id', photoId);
    overlay.innerHTML = '';

    const faces = await loadPhotoFaces(photoId);
    /* If the photo changed during the fetch (user clicked next), bail. */
    if (overlay.getAttribute('data-photo-id') !== photoId) return;
    if (!faces || !faces.length) {
      overlay.classList.add('empty');
      return;
    }
    overlay.classList.remove('empty');

    /* When the lightbox image uses `object-fit: contain`, the overlay (sized
     * via CSS to 100% × 100%) covers the *box* rather than the actual image.
     * Recalibrate by reading the real rendered image rect. */
    function recalibrate() {
      const rect = imgEl.getBoundingClientRect();
      const hostRect = host.getBoundingClientRect();
      if (rect.width <= 1 || rect.height <= 1) return;
      const left = ((rect.left - hostRect.left) / hostRect.width)  * 100;
      const top  = ((rect.top  - hostRect.top)  / hostRect.height) * 100;
      const w    = (rect.width  / hostRect.width)  * 100;
      const h    = (rect.height / hostRect.height) * 100;
      overlay.style.left   = left + '%';
      overlay.style.top    = top  + '%';
      overlay.style.width  = w    + '%';
      overlay.style.height = h    + '%';
    }
    recalibrate();
    /* Re-run on image load (size changes), modal resize, and window resize. */
    if (!imgEl._msFaceCalibBound) {
      imgEl.addEventListener('load', recalibrate);
      window.addEventListener('resize', recalibrate);
      imgEl._msFaceCalibBound = true;
    }

    /* Compensate for the SVG `preserveAspectRatio="none"` stretch so the
     * shape stays a true visual circle rather than a squashed ellipse on
     * non-square photos. The overlay was already calibrated above to the
     * actual <img> rect, so we read its current dimensions. */
    const ow    = parseFloat(overlay.getBoundingClientRect().width)  || 1;
    const oh    = parseFloat(overlay.getBoundingClientRect().height) || 1;
    const ratio = ow / oh;
    overlay.innerHTML = faces.map(f => {
      if (!f.box) return '';
      const cx = (f.box.x + f.box.width / 2) * 100;
      const cy = (f.box.y + f.box.height / 2) * 100;
      /* Smaller (×40 instead of ×50) so the ring sits a bit inside the
       * detected box — the user feedback was "moins zoomé". */
      const baseR = Math.max(f.box.width, f.box.height) * 40;
      const rx = baseR / ratio;
      const ry = baseR;
      const ly = Math.max(2, f.box.y * 100 - 1);
      const safeName = escapeHtml(f.name || '?');
      return `
        <g class="ms-face-group" data-person-id="${escapeHtml(f.personId || '')}">
          <ellipse class="ms-face-circle" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" vector-effect="non-scaling-stroke" />
          <foreignObject x="${f.box.x * 100}" y="${ly}" width="${f.box.width * 100}" height="6">
            <div xmlns="http://www.w3.org/1999/xhtml" class="ms-face-label">${safeName}</div>
          </foreignObject>
          <title>${safeName}</title>
        </g>`;
    }).join('');

    if (typeof opts.onPersonClick === 'function') {
      overlay.querySelectorAll('.ms-face-group').forEach(g => {
        g.addEventListener('click', (e) => {
          e.stopPropagation();
          const pid = g.getAttribute('data-person-id');
          if (pid) opts.onPersonClick(pid);
        });
      });
    }
  }

  /* ─── Public API: persons list ───────────────────────────────────────── */
  async function loadPersons({ page = 1, limit = 50, q = '' } = {}) {
    if (!cfg.apiBase) return { items: [], total: 0, page: 1, limit };
    /* Cache page 1 only (most common). */
    const useCache = page === 1 && !q;
    if (useCache) {
      const c = readJson(PERSONS_CACHE_KEY);
      if (c && c.ts && Date.now() - c.ts < PERSONS_CACHE_TTL_MS && c.data) return c.data;
    }
    try {
      const url = new URL(`${cfg.apiBase}/api/public/persons`);
      url.searchParams.set('page', page);
      url.searchParams.set('limit', limit);
      if (q) url.searchParams.set('q', q);
      const res = await fetch(url.toString());
      if (!res.ok) return { items: [], total: 0, page, limit };
      const data = await res.json();
      if (useCache) writeJson(PERSONS_CACHE_KEY, { ts: Date.now(), data });
      return data;
    } catch { return { items: [], total: 0, page, limit }; }
  }

  async function loadPersonDetail(personId) {
    if (!cfg.apiBase || !personId) return null;
    try {
      const res = await fetch(`${cfg.apiBase}/api/public/persons/${encodeURIComponent(personId)}`);
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
  }

  /* CSS-clip a person sample face. Returns a style string for a square
   * vignette centered on the face box.
   *
   * The detection box from InsightFace is tight against the chin/forehead,
   * which produces a very claustrophobic crop. We expand the box outwards
   * by `pad` (fraction of box size) on each side so the thumbnail shows a
   * little breathing room — typically the hair, ears and shoulders. The
   * expanded box is clamped to [0,1] so we never sample outside the
   * original photo (which would render as background colour). */
  function faceThumbStyle(previewUrl, box, sizePx = 96, pad = 0.45) {
    if (!previewUrl || !box) return '';
    const url = cfg.resolveUrl(previewUrl);
    const bw0 = Math.max(0.001, box.width);
    const bh0 = Math.max(0.001, box.height);
    const padX = bw0 * pad;
    const padY = bh0 * pad;
    const x = Math.max(0, box.x - padX);
    const y = Math.max(0, box.y - padY);
    const bw = Math.min(1 - x, bw0 + 2 * padX);
    const bh = Math.min(1 - y, bh0 + 2 * padY);
    const bgW = sizePx / bw;
    const bgH = sizePx / bh;
    const offX = -x * bgW;
    const offY = -y * bgH;
    return `background-image:url('${url}');`
      + `background-size:${bgW}px ${bgH}px;`
      + `background-position:${offX}px ${offY}px;`
      + `width:${sizePx}px;height:${sizePx}px;`;
  }

  /* ─── Visages tab renderer ───────────────────────────────────────────── */
  async function renderPersonsView(container, opts = {}) {
    if (!container) return;
    container.classList.add('ms-faces-container');
    container.innerHTML = `
      <div class="ms-faces-search">
        <input type="text" class="ms-faces-search-input" placeholder="Rechercher un nom…" autocomplete="off" />
      </div>
      <div class="ms-faces-grid" data-loading="1"><div class="ms-faces-loading">Chargement…</div></div>
      <div class="ms-faces-pager"></div>
      <div class="ms-faces-detail hidden"></div>
    `;
    const grid       = container.querySelector('.ms-faces-grid');
    const pager      = container.querySelector('.ms-faces-pager');
    const detail     = container.querySelector('.ms-faces-detail');
    const searchEl   = container.querySelector('.ms-faces-search-input');

    let curPage = 1, curQuery = '';
    const PAGE_SIZE = 48;

    async function refresh() {
      grid.dataset.loading = '1';
      grid.innerHTML = '<div class="ms-faces-loading">Chargement…</div>';
      const data = await loadPersons({ page: curPage, limit: PAGE_SIZE, q: curQuery });
      grid.dataset.loading = '0';

      if (!data.items.length) {
        grid.innerHTML = `<div class="ms-faces-empty">${
          curQuery
            ? 'Aucun visage ne correspond à cette recherche.'
            : 'Aucun visage publié pour l\'instant.'
        }</div>`;
        pager.innerHTML = '';
        return;
      }

      grid.innerHTML = data.items.map(p => {
        const sample = p.sample || null;
        const style  = sample ? faceThumbStyle(sample.previewUrl, sample.box, 130) : '';
        const initials = (p.name || '?').trim().split(/\s+/).slice(0,2).map(s => s[0] || '').join('').toUpperCase() || '?';
        const thumb = sample
          ? `<div class="ms-person-thumb" style="${style}"></div>`
          : `<div class="ms-person-thumb ms-person-thumb-empty">${escapeHtml(initials)}</div>`;
        return `
          <button type="button" class="ms-person-card" data-person-id="${escapeHtml(p.id)}">
            ${thumb}
            <div class="ms-person-name">${escapeHtml(p.name)}</div>
            <div class="ms-person-count">${p.photoCount} photo${p.photoCount === 1 ? '' : 's'}</div>
          </button>`;
      }).join('');

      grid.querySelectorAll('.ms-person-card').forEach(el => {
        el.addEventListener('click', () => openDetail(el.dataset.personId));
      });

      /* Pager */
      const totalPages = Math.max(1, Math.ceil(data.total / data.limit));
      if (totalPages > 1) {
        pager.innerHTML = `
          <button class="ms-faces-pager-btn" data-act="prev" ${curPage <= 1 ? 'disabled' : ''}>← Précédent</button>
          <span class="ms-faces-pager-info">Page ${curPage} / ${totalPages}</span>
          <button class="ms-faces-pager-btn" data-act="next" ${curPage >= totalPages ? 'disabled' : ''}>Suivant →</button>
        `;
        pager.querySelector('[data-act="prev"]')?.addEventListener('click', () => {
          if (curPage > 1) { curPage--; refresh(); }
        });
        pager.querySelector('[data-act="next"]')?.addEventListener('click', () => {
          if (curPage < totalPages) { curPage++; refresh(); }
        });
      } else {
        pager.innerHTML = '';
      }
    }

    async function openDetail(personId) {
      detail.classList.remove('hidden');
      detail.innerHTML = '<div class="ms-faces-loading">Chargement…</div>';
      grid.classList.add('hidden');
      pager.classList.add('hidden');
      const data = await loadPersonDetail(personId);
      if (!data) {
        detail.innerHTML = `<div class="ms-faces-empty">Personne introuvable.</div>
          <button class="ms-person-back">← Retour</button>`;
        detail.querySelector('.ms-person-back')?.addEventListener('click', backToList);
        return;
      }
      const { person, photos } = data;
      const sample = person.sample;
      const headerStyle = sample ? faceThumbStyle(sample.previewUrl, sample.box, 110) : '';
      const photosHtml = photos.map(ph => {
        const thumbStyle = ph.box
          ? `background-image:url('${cfg.resolveUrl(ph.previewUrl)}');background-size:cover;background-position:${(ph.box.x + ph.box.width/2)*100}% ${(ph.box.y + ph.box.height/2)*100}%;`
          : `background-image:url('${cfg.resolveUrl(ph.previewUrl)}');background-size:cover;background-position:center;`;
        return `<button type="button" class="ms-person-photo-card" data-photo-id="${escapeHtml(ph.photoId)}" style="${thumbStyle}" title="${escapeHtml(ph.title || '')}"></button>`;
      }).join('');
      detail.innerHTML = `
        <button class="ms-person-back">← Retour aux visages</button>
        <div class="ms-person-header">
          <div class="ms-person-thumb" style="${headerStyle}${headerStyle ? '' : 'width:110px;height:110px;background:rgba(198,155,0,0.12);display:flex;align-items:center;justify-content:center;color:var(--gold);font-size:36px;border-radius:12px;'}">${
            sample ? '' : escapeHtml((person.name||'?').trim().split(/\s+/).slice(0,2).map(s=>s[0]||'').join('').toUpperCase() || '?')
          }</div>
          <div>
            <h3 class="ms-person-title">${escapeHtml(person.name)}</h3>
            <div class="ms-person-subtitle">${person.photoCount} photo${person.photoCount === 1 ? '' : 's'}</div>
          </div>
        </div>
        <div class="ms-person-photos">${photosHtml}</div>
      `;
      detail.querySelector('.ms-person-back')?.addEventListener('click', backToList);
      detail.querySelectorAll('.ms-person-photo-card').forEach(card => {
        card.addEventListener('click', () => {
          const pid = card.dataset.photoId;
          if (typeof opts.onPhotoClick === 'function') opts.onPhotoClick(pid);
        });
      });
    }

    function backToList() {
      detail.classList.add('hidden');
      grid.classList.remove('hidden');
      pager.classList.remove('hidden');
    }

    /* Debounced search */
    let searchTimer = null;
    searchEl.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        curQuery = searchEl.value.trim();
        curPage = 1;
        refresh();
      }, 300);
    });

    refresh();
  }

  /* ─── Export ────────────────────────────────────────────────────────── */
  global.MSFaces = {
    init,
    loadPhotoFaces,
    attachOverlay,
    loadPersons,
    loadPersonDetail,
    faceThumbStyle,
    renderPersonsView
  };
})(typeof window !== 'undefined' ? window : this);
