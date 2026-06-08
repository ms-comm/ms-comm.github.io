(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MSCommServicesAdmin = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function createServiceDraft(type) {
    if (type === 'category') {
      return {
        id: uid('category'),
        title: 'Nouvelle section',
        accent: '',
        subtitle: '',
        layout: 'cards',
        columns: '',
        background: false,
        visible: true,
        cards: []
      };
    }
    if (type === 'card') {
      return {
        id: uid('card'),
        name: 'Nouveau service',
        price: '',
        oldPrice: '',
        priceNote: '',
        cta: 'Choisir ce pack',
        visible: true,
        featured: false,
        items: []
      };
    }
    return {
      id: uid('item'),
      label: 'Nouvel élément',
      price: '',
      visible: true
    };
  }

  function itemLabel(item, index) {
    if (typeof item === 'string') return item || `Élément ${index + 1}`;
    return item && item.label ? item.label : `Élément ${index + 1}`;
  }

  function cardBadges(card) {
    const badges = [];
    if (card.visible === false) badges.push('masqué');
    if (card.price) badges.push(card.price);
    if (card.featured === true) badges.push('mis en avant');
    const itemCount = Array.isArray(card.items) ? card.items.length : 0;
    if (itemCount) badges.push(`${itemCount} élément${itemCount > 1 ? 's' : ''}`);
    return badges;
  }

  function buildServicesAdminTree(catalog) {
    const categories = catalog && Array.isArray(catalog.categories) ? catalog.categories : [];
    return categories.map((category, categoryIndex) => ({
      type: 'category',
      id: category.id || `category-${categoryIndex}`,
      label: category.title || `Section ${categoryIndex + 1}`,
      path: `category:${categoryIndex}`,
      badges: category.visible === false ? ['masqué'] : [],
      children: (Array.isArray(category.cards) ? category.cards : []).map((card, cardIndex) => ({
        type: 'card',
        id: card.id || `card-${cardIndex}`,
        label: card.name || `Card ${cardIndex + 1}`,
        path: `card:${categoryIndex}:${cardIndex}`,
        badges: cardBadges(card),
        children: (Array.isArray(card.items) ? card.items : []).map((item, itemIndex) => ({
          type: 'item',
          id: item && item.id ? item.id : `item-${itemIndex}`,
          label: itemLabel(item, itemIndex),
          path: `item:${categoryIndex}:${cardIndex}:${itemIndex}`,
          badges: item && item.visible === false ? ['masqué'] : []
        }))
      }))
    }));
  }

  return {
    buildServicesAdminTree,
    createServiceDraft
  };
});
