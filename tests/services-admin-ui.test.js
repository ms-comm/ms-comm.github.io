const assert = require('assert');

const {
  buildServicesAdminTree,
  createServiceDraft
} = require('../assets/js/services-admin-ui.js');
const adminUi = require('../photo-server/admin/js/services-admin-ui.js');

const catalog = {
  categories: [
    {
      id: 'packs',
      title: 'Packs de lancement',
      visible: true,
      cards: [
        {
          id: 'boost',
          name: 'Pack Boost',
          price: '190€',
          featured: true,
          visible: true,
          items: [{ label: '3 stories' }, { label: '2 posts' }]
        },
        {
          id: 'hidden',
          name: 'Pack caché',
          visible: false,
          items: []
        }
      ]
    }
  ]
};

const tree = buildServicesAdminTree(catalog);
assert.strictEqual(tree.length, 1);
assert.strictEqual(tree[0].label, 'Packs de lancement');
assert.strictEqual(tree[0].children[0].label, 'Pack Boost');
assert.deepStrictEqual(tree[0].children[0].badges, ['190€', 'mis en avant', '2 éléments']);
assert.strictEqual(tree[0].children[1].badges[0], 'masqué');
assert.strictEqual(tree[0].children[0].children.length, 2);
assert.strictEqual(tree[0].children[0].children[1].label, '2 posts');

const card = createServiceDraft('card');
assert.ok(card.id.startsWith('card-'));
assert.strictEqual(card.name, 'Nouveau service');
assert.strictEqual(card.cta, 'Choisir ce pack');

const item = createServiceDraft('item');
assert.ok(item.id.startsWith('item-'));
assert.strictEqual(item.label, 'Nouvel élément');

assert.strictEqual(typeof adminUi.buildServicesAdminTree, 'function');
assert.strictEqual(adminUi.buildServicesAdminTree(catalog)[0].children[0].label, 'Pack Boost');

console.log('services-admin-ui tests passed');
