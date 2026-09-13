/* L'atelier — lightweight client-side editor and creation shelf. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const STORE = 'mscomm_atelier_creations';
  const params = new URLSearchParams(window.location.search);
  const fallback = 'assets/data/image_photo_1.jpg';
  const state = {
    image: params.get('src') || fallback,
    title: params.get('title') || 'Ma création MS Comm',
    photoId: params.get('photo') || '',
    product: 'print',
    format: 'portrait',
    zoom: 1,
    rotation: 0
  };

  function read() {
    try { return JSON.parse(localStorage.getItem(STORE) || '[]'); } catch (_) { return []; }
  }
  function write(items) { try { localStorage.setItem(STORE, JSON.stringify(items)); } catch (_) {} }
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }
  function safeImage(src) { return /^(https?:|\/|assets\/)/.test(src || '') ? src : fallback; }
  function productLabel() { return ({ print:'Tirage photo', poster:'Poster', phone:'Coque', calendar:'Calendrier', tote:'Tote bag', tshirt:'T-shirt', mug:'Mug', card:'Carte' })[state.product] || 'Tirage photo'; }

  if (params.get('creation')) {
    const saved = read().find((item) => item.id === params.get('creation'));
    if (saved) Object.assign(state, saved);
  }

  function paint() {
    const img = $('atelier-preview');
    const board = $('atelier-artboard');
    if (!img || !board) return;
    img.src = safeImage(state.image);
    img.alt = state.title;
    img.style.transform = `scale(${state.zoom}) rotate(${state.rotation}deg)`;
    board.classList.toggle('square', state.format === 'square');
    board.classList.toggle('landscape', state.format === 'landscape');
    $('atelier-preview-title').textContent = state.title;
    $('atelier-zoom-value').textContent = `${Math.round(state.zoom * 100)} %`;
    $('atelier-format').value = state.format;
    document.querySelectorAll('[data-product]').forEach((btn) => {
      const active = btn.dataset.product === state.product;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function loadCreation(item) {
    Object.assign(state, item || {});
    paint();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderSaved() {
    const host = $('atelier-saved-grid');
    const empty = $('atelier-saved-empty');
    if (!host || !empty) return;
    const items = read();
    empty.hidden = items.length > 0;
    host.innerHTML = items.slice(0, 8).map((item) => `
      <article class="atelier-saved-card">
        <img src="${esc(safeImage(item.image))}" alt="${esc(item.title)}" loading="lazy">
        <div class="atelier-saved-body">
          <strong>${esc(item.title)}</strong>
          <span>${esc(item.productLabel || 'Impression')} · ${esc(item.formatLabel || 'Portrait')}</span>
          <div class="atelier-saved-actions">
            <button type="button" data-load="${esc(item.id)}">Modifier</button>
            <button type="button" data-delete="${esc(item.id)}" aria-label="Supprimer ${esc(item.title)}">Supprimer</button>
          </div>
        </div>
      </article>`).join('');
    host.querySelectorAll('[data-load]').forEach((button) => button.addEventListener('click', () => {
      const item = read().find((entry) => entry.id === button.dataset.load);
      if (item) loadCreation(item);
    }));
    host.querySelectorAll('[data-delete]').forEach((button) => button.addEventListener('click', () => {
      write(read().filter((entry) => entry.id !== button.dataset.delete));
      renderSaved();
    }));
  }

  document.querySelectorAll('[data-product]').forEach((button) => button.addEventListener('click', () => {
    state.product = button.dataset.product;
    paint();
  }));
  document.querySelectorAll('[data-atelier-product]').forEach((link) => link.addEventListener('click', () => {
    state.product = link.dataset.atelierProduct;
    paint();
  }));
  $('atelier-format')?.addEventListener('change', (event) => { state.format = event.target.value; paint(); });
  $('atelier-zoom')?.addEventListener('input', (event) => { state.zoom = Number(event.target.value); paint(); });
  $('atelier-rotate')?.addEventListener('click', () => { state.rotation = (state.rotation + 90) % 360; paint(); });
  $('atelier-reset')?.addEventListener('click', () => { state.zoom = 1; state.rotation = 0; state.format = 'portrait'; paint(); });
  $('atelier-save')?.addEventListener('click', () => {
    const items = read();
    const item = { ...state, id: state.id || `creation-${Date.now()}`, productLabel: productLabel(), formatLabel: ({ portrait:'Portrait', square:'Carré', landscape:'Paysage' })[state.format] };
    const index = items.findIndex((entry) => entry.id === item.id);
    if (index >= 0) items[index] = item; else items.unshift(item);
    state.id = item.id;
    write(items);
    $('atelier-save-status').textContent = 'Création enregistrée dans votre espace.';
    renderSaved();
    setTimeout(() => { if ($('atelier-save-status')) $('atelier-save-status').textContent = ''; }, 3500);
  });

  const continueButton = $('atelier-continue');
  continueButton?.addEventListener('click', () => {
    const subject = encodeURIComponent(`L'atelier — ${state.title}`);
    window.location.href = `contact.html?subject=${subject}`;
  });

  paint();
  renderSaved();
})();
