(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MSCommServices = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  const DEFAULT_CTA = 'Choisir ce pack';

  function escHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function slug(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'service';
  }

  function visible(item) {
    return item && item.visible !== false;
  }

  function normalizeItem(item) {
    if (typeof item === 'string') return { label: item, visible: true };
    return {
      label: item && item.label != null ? String(item.label) : '',
      price: item && item.price != null ? String(item.price) : '',
      visible: item ? item.visible !== false : true
    };
  }

  function normalizeCard(card, index) {
    const normalized = {
      id: card.id || slug(card.name || `service-${index + 1}`),
      name: card.name || '',
      note: card.note || '',
      price: card.price || '',
      oldPrice: card.oldPrice || '',
      priceNote: card.priceNote || '',
      cta: card.cta || DEFAULT_CTA,
      ctaHref: card.ctaHref || '',
      featured: card.featured === true,
      visible: card.visible !== false,
      items: Array.isArray(card.items) ? card.items.map(normalizeItem).filter(visible) : []
    };
    return normalized;
  }

  function normalizeCategory(category, index) {
    const cards = Array.isArray(category.cards) ? category.cards : [];
    return {
      id: category.id || slug(category.title || `category-${index + 1}`),
      title: category.title || '',
      accent: category.accent || '',
      subtitle: category.subtitle || '',
      footnote: category.footnote || '',
      layout: category.layout === 'tarifs' ? 'tarifs' : 'cards',
      columns: category.columns || '',
      background: category.background === true,
      visible: category.visible !== false,
      cards: cards.map(normalizeCard).filter(visible)
    };
  }

  function normalizeServicesCatalog(catalog) {
    const data = catalog && typeof catalog === 'object' ? catalog : {};
    const categories = Array.isArray(data.categories) ? data.categories : [];
    return {
      updatedAt: data.updatedAt || '',
      footnote: data.footnote || '',
      categories: categories.map(normalizeCategory).filter(cat => visible(cat) && cat.cards.length)
    };
  }

  function buildPackHref(card) {
    if (card && card.ctaHref) return card.ctaHref;
    const label = [card && card.name, card && card.price].filter(Boolean).join(' — ');
    return `contact.html?pack=${encodeURIComponent(label).replace(/%20/g, '+')}`;
  }

  function renderTitle(title, accent) {
    const safeTitle = escHtml(title);
    const safeAccent = escHtml(accent);
    if (!safeAccent || !safeTitle.includes(safeAccent)) return safeTitle;
    return safeTitle.replace(safeAccent, `<span class="gold">${safeAccent}</span>`);
  }

  function renderTarifCard(card) {
    return `<div class="tarif-card">
      <h3>${escHtml(card.name)}</h3>
      ${card.note ? `<p class="tarif-note">${escHtml(card.note)}</p>` : ''}
      <ul class="tarif-list">
        ${card.items.map(item => `<li><span>${escHtml(item.label)}</span><strong>${escHtml(item.price || '')}</strong></li>`).join('')}
      </ul>
    </div>`;
  }

  function renderServiceCard(card) {
    const price = card.price || card.oldPrice
      ? `<div class="price">${card.oldPrice ? `<span class="price-old">${escHtml(card.oldPrice)}</span> ` : ''}${escHtml(card.price)}</div>`
      : '';
    return `<div class="service-card${card.featured ? ' featured' : ''}">
      <h3>${escHtml(card.name)}</h3>
      ${price}
      ${card.priceNote ? `<div class="price-note">${escHtml(card.priceNote)}</div>` : ''}
      ${card.note ? `<p class="tarif-note">${escHtml(card.note)}</p>` : ''}
      <ul class="service-list">
        ${card.items.map(item => `<li>${escHtml(item.label)}</li>`).join('')}
      </ul>
      ${card.cta ? `<a class="btn ${card.featured ? 'btn-gold' : 'btn-outline-gold'} pack-cta" href="${escHtml(buildPackHref(card))}">${escHtml(card.cta)}</a>` : ''}
    </div>`;
  }

  function renderCategory(category) {
    const gridClass = category.layout === 'tarifs' ? 'tarif-grid' : 'services-grid';
    const style = category.columns ? ` style="grid-template-columns:${escHtml(category.columns)}"` : '';
    const cards = category.cards
      .map(card => category.layout === 'tarifs' ? renderTarifCard(card) : renderServiceCard(card))
      .join('');
    return `<section class="section"${category.background ? ' style="background:var(--bg-2)"' : ''}>
      <div class="container">
        <div class="section-header reveal">
          <div class="section-line"></div>
          <h2>${renderTitle(category.title, category.accent)}</h2>
          ${category.subtitle ? `<p>${escHtml(category.subtitle)}</p>` : ''}
        </div>
        <div class="${gridClass} reveal stagger"${style}>${cards}</div>
        ${category.footnote ? `<p class="tarif-footnote reveal">${escHtml(category.footnote).replace(/\n/g, '<br>')}</p>` : ''}
      </div>
    </section>`;
  }

  function renderServicesCatalogHTML(catalog) {
    const normalized = normalizeServicesCatalog(catalog);
    return normalized.categories.map(renderCategory).join('') +
      (normalized.footnote ? `<p class="tarif-footnote reveal">${escHtml(normalized.footnote).replace(/\n/g, '<br>')}</p>` : '');
  }

  function apiBase() {
    const loc = root.location;
    if (!loc) return '';
    if (loc.hostname === 'localhost' || loc.hostname === '127.0.0.1' || loc.protocol === 'file:') {
      return 'http://localhost:3000';
    }
    return 'https://ms-comm-server.fly.dev';
  }

  async function fetchTranslations() {
    const stamp = `?t=${Date.now()}`;
    const urls = [`${apiBase()}/api/public/translations${stamp}`, `assets/data/translations.json${stamp}`];
    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) return res.json();
      } catch (_) { /* try next source */ }
    }
    return null;
  }

  async function renderFromTranslations() {
    const doc = root.document;
    if (!doc) return;
    const target = doc.getElementById('services-catalog-root');
    if (!target) return;
    const translations = await fetchTranslations();
    if (!translations || !translations._servicesCatalog) return;
    const html = renderServicesCatalogHTML(translations._servicesCatalog);
    if (!html.trim()) return;
    target.innerHTML = html;
    if (root.MSCommI18n && typeof root.MSCommI18n.refresh === 'function') root.MSCommI18n.refresh();
  }

  if (root.document) {
    if (root.document.readyState === 'loading') {
      root.document.addEventListener('DOMContentLoaded', renderFromTranslations);
    } else {
      renderFromTranslations();
    }
  }

  return {
    buildPackHref,
    normalizeServicesCatalog,
    renderServicesCatalogHTML,
    renderFromTranslations
  };
});
