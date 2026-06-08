const assert = require('assert');

const {
  buildPackHref,
  normalizeServicesCatalog,
  renderServicesCatalogHTML
} = require('../assets/js/services-catalog.js');

const catalog = {
  categories: [
    {
      id: 'hidden',
      title: 'Hidden',
      visible: false,
      cards: [{ id: 'hidden-card', name: 'Hidden card', price: '1 EUR', items: [] }]
    },
    {
      id: 'packs',
      title: 'Packs',
      accent: 'lancement',
      layout: 'cards',
      background: true,
      cards: [
        {
          id: 'boost',
          name: 'Pack Boost',
          price: '190 EUR',
          oldPrice: '220 EUR',
          priceNote: 'pack complet',
          featured: true,
          cta: 'Choisir ce pack',
          items: ['3 stories', { label: '2 posts' }]
        }
      ]
    }
  ],
  footnote: 'Tarifs hors frais.'
};

const normalized = normalizeServicesCatalog(catalog);

assert.strictEqual(normalized.categories.length, 1);
assert.strictEqual(normalized.categories[0].cards.length, 1);
assert.strictEqual(normalized.categories[0].cards[0].items[1].label, '2 posts');

const href = buildPackHref(normalized.categories[0].cards[0]);
assert.strictEqual(href, 'contact.html?pack=Pack+Boost+%E2%80%94+190+EUR');

const html = renderServicesCatalogHTML(catalog);
assert.ok(html.includes('Pack Boost'));
assert.ok(html.includes('price-old'));
assert.ok(html.includes('Tarifs hors frais.'));
assert.ok(!html.includes('Hidden card'));

console.log('services-catalog tests passed');
