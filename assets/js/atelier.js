(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const CART_KEY = 'mscomm_merch_cart';
  const params = new URLSearchParams(location.search);
  const fallbackImage = 'assets/data/image_photo_1.jpg';
  const API = () => window.MSAccount?.API || 'https://ms-comm-server.fly.dev';
  const SLOT_NAMES = [
    ['Couverture', 'Cover'], ['Janvier', 'January'], ['Février', 'February'], ['Mars', 'March'],
    ['Avril', 'April'], ['Mai', 'May'], ['Juin', 'June'], ['Juillet', 'July'],
    ['Août', 'August'], ['Septembre', 'September'], ['Octobre', 'October'],
    ['Novembre', 'November'], ['Décembre', 'December'], ['Dos', 'Back cover']
  ];
  const PLUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  const MINUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>';
  const REMOVE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';

  let products = [];
  let allProducts = [];
  let index = 0;
  let format = '';
  let cart = [];
  let lastTrackedProduct = '';
  let unavailableReason = 'closed';
  let pickerMode = 'single';
  let pickerSlot = -1;
  let pickerFocus = null;
  let pickerFavorites = [];
  let pickerSelected = new Set();
  let cartFocus = null;
  let seededPrintPhoto = false;
  let printPhotos = [];
  let calendarPhotos = Array(14).fill(null);
  let photo = { id: '', title: 'Choisir dans mes favoris', image: fallbackImage };

  try {
    const requestedId = params.get('photo');
    const saved = JSON.parse(sessionStorage.getItem('mscomm_atelier_photo') || 'null');
    sessionStorage.removeItem('mscomm_atelier_photo');
    if (requestedId && saved?.id === requestedId && typeof saved.image === 'string') {
      const image = new URL(saved.image, location.href);
      const allowedOrigins = new Set([location.origin, new URL(API()).origin]);
      if (image.protocol === 'https:' || allowedOrigins.has(image.origin)) {
        photo = { id: requestedId, title: String(saved.title || 'Photo choisie').slice(0, 160), image: image.href };
      }
    }
  } catch (_) {}

  try {
    cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]').filter(item =>
      item && typeof item.productUid === 'string' && Number.isFinite(item.price) && item.price > 0 &&
      Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 1000
    );
  } catch (_) { cart = []; }

  const money = (value, currency = 'EUR') =>
    new Intl.NumberFormat(document.documentElement.lang || 'fr', { style: 'currency', currency: currency || 'EUR' }).format(Number(value) || 0);
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
  const save = () => { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (_) {} };
  const abs = url => !url ? '' : /^https?:/.test(url) ? url : API() + (url.startsWith('/') ? '' : '/') + url;
  const family = product => product.family || (
    /phone|coque/i.test(product.catalogUid || '') ? 'phone' :
      /calendar/i.test(product.catalogUid || '') ? 'calendar' :
        /fine-art|premium|cards/i.test(product.catalogUid || '') || /^flat_product_/i.test(product.productUid || '') ? 'print' : 'poster'
  );
  const isEn = () => document.documentElement.lang === 'en';
  const copy = (fr, en) => isEn() ? en : fr;
  const localized = (product, key) => isEn() && product[key + 'En'] ? product[key + 'En'] : product[key] || '';
  const minimumQuantity = product => Math.max(1, Number(product.minimumQuantity) || 1);
  const familyName = kind => ({
    poster: copy('Impression poster', 'Photo poster'),
    print: copy('Tirage photo', 'Photo print'),
    phone: copy('Coque de téléphone', 'Phone case'),
    calendar: copy('Calendrier', 'Calendar')
  }[kind]);
  const variant = product => localized(product, 'variantLabel') || String(product.title || '').split('·')[1]?.trim() || 'Standard';
  const slotName = slot => copy(SLOT_NAMES[slot][0], SLOT_NAMES[slot][1]);
  const printCount = () => printPhotos.reduce((sum, item) => sum + item.quantity, 0);
  const photoThumb = (url, alt) => '<img src="' + esc(url || fallbackImage) + '" alt="' + esc(alt || '') + '" loading="lazy">';

  function thumbnail(product, url = photo.image) {
    return '<span class="shop-object-thumb kind-' + family(product) + '" aria-hidden="true"><span>' +
      photoThumb(url, '') + '</span></span>';
  }

  function renderCatalog() {
    const root = $('shop-products');
    if (!products.length) {
      root.innerHTML = '<div class="shop-empty-catalog"><b>' +
        copy('L’Atelier se prépare.', 'The Atelier is getting ready.') + '</b><span>' +
        copy('Revenez bientôt découvrir les créations disponibles.', 'Come back soon to discover the available creations.') +
        '</span></div>';
      return;
    }
    const kinds = [...new Set(products.map(family))];
    root.innerHTML = kinds.map(kind => {
      const group = products.filter(product => family(product) === kind);
      const first = group[0];
      const startingPrice = Math.min(...group.map(product => Number(product.retailPrice) * (kind === 'print' ? minimumQuantity(product) : 1)));
      const priceLabel = kind === 'print'
        ? copy(minimumQuantity(first) + ' tirages dès ' + money(startingPrice, first.currency),
          minimumQuantity(first) + ' prints from ' + money(startingPrice, first.currency))
        : copy('Dès ' + money(startingPrice, first.currency), 'From ' + money(startingPrice, first.currency));
      const active = family(products[index]) === kind;
      return '<button class="shop-product ' + (active ? 'is-active' : '') + '" aria-pressed="' + active +
        '" type="button" data-product="' + products.indexOf(first) + '">' + thumbnail(first) +
        '<span><b>' + esc(familyName(kind)) + '</b><small>' + esc(priceLabel) + '</small></span></button>';
    }).join('');
    root.querySelectorAll('[data-product]').forEach(button => {
      button.onclick = () => {
        index = Number(button.dataset.product);
        $('shop-quantity').value = '1';
        renderProduct();
      };
    });
  }

  function renderPrintSelection() {
    const root = $('shop-print-selection');
    root.innerHTML = printPhotos.map((item, itemIndex) =>
      '<article class="shop-print-tile"><div class="shop-print-image">' + photoThumb(item.image, item.title) +
      '<button class="shop-print-remove" type="button" data-remove-print="' + itemIndex +
      '" aria-label="' + esc(copy('Retirer ', 'Remove ') + item.title) + '">' + REMOVE + '</button></div>' +
      '<span class="shop-print-title">' + esc(item.title) + '</span><div class="shop-print-quantity">' +
      '<button type="button" data-change-print="' + itemIndex + '" data-delta="-1" aria-label="' +
      esc(copy('Retirer un tirage de ', 'Remove one print of ') + item.title) + '">' + MINUS + '</button>' +
      '<span>' + item.quantity + '</span><button type="button" data-change-print="' + itemIndex +
      '" data-delta="1" aria-label="' + esc(copy('Ajouter un tirage de ', 'Add one print of ') + item.title) +
      '">' + PLUS + '</button></div></article>'
    ).join('') +
      '<button class="shop-print-add-tile" type="button" id="shop-add-print-photo" aria-label="' +
      esc(copy('Ajouter des photos au lot', 'Add photos to this set')) + '">' + PLUS +
      '<span>' + copy('Ajouter une photo', 'Add a photo') + '</span></button>';
    root.querySelector('#shop-add-print-photo').onclick = () => openPicker(true, { mode: 'print' });
    root.querySelectorAll('[data-remove-print]').forEach(button => {
      button.onclick = () => { printPhotos.splice(Number(button.dataset.removePrint), 1); renderProduct(); };
    });
    root.querySelectorAll('[data-change-print]').forEach(button => {
      button.onclick = () => {
        const item = printPhotos[Number(button.dataset.changePrint)];
        if (!item) return;
        if (Number(button.dataset.delta) > 0 && printCount() >= 1000) return;
        item.quantity = Math.max(1, item.quantity + Number(button.dataset.delta));
        renderPrintSelection();
        updateTotal();
      };
    });
    const copies = printCount();
    const minimum = minimumQuantity(products[index] || {});
    const remainder = Math.max(0, minimum - copies);
    $('shop-print-count').textContent = copy(copies + ' / ' + minimum + ' tirages', copies + ' / ' + minimum + ' prints');
    $('shop-print-status').textContent = copies >= minimum
      ? copy(copies + ' tirage(s) prêt(s) · lot minimum atteint.', copies + ' print(s) ready · minimum reached.')
      : copy('Lot minimum : ' + minimum + ' tirages. Ajoutez encore ' + remainder + '.',
        'Minimum set: ' + minimum + ' prints. Add ' + remainder + ' more.');
  }

  function renderCalendarSlots() {
    const root = $('shop-calendar-slots');
    root.innerHTML = SLOT_NAMES.map((_, slot) => {
      const item = calendarPhotos[slot];
      return '<button type="button" class="shop-calendar-slot ' + (item ? 'is-filled' : 'is-empty') +
        '" data-calendar-slot="' + slot + '" aria-label="' +
        esc(copy('Choisir la photo pour ', 'Choose photo for ') + slotName(slot)) + '">' +
        (item ? photoThumb(item.image, item.title) : '<span class="shop-calendar-plus">' + PLUS + '</span>') +
        '<span class="shop-calendar-slot-name">' + esc(slotName(slot)) + '</span></button>';
    }).join('');
    root.querySelectorAll('[data-calendar-slot]').forEach(button => {
      button.onclick = () => openPicker(true, { mode: 'calendar', slot: Number(button.dataset.calendarSlot) });
    });
    const filled = calendarPhotos.filter(Boolean).length;
    $('shop-calendar-status').textContent = copy(filled + ' / 14 photos choisies', filled + ' / 14 photos selected');
  }

  function renderSelectionPanels(kind) {
    const isSequence = kind === 'print' || kind === 'calendar';
    $('shop-single-photo-field').hidden = isSequence;
    $('shop-print-series').hidden = kind !== 'print';
    $('shop-calendar-series').hidden = kind !== 'calendar';
    $('shop-quantity-field').hidden = kind === 'print';
    $('shop-price-note').hidden = !isSequence;
    if (kind === 'print') {
      $('shop-price-note').textContent = copy(
        'Prix par tirage · lot de ' + minimumQuantity(products[index]) + ' minimum.',
        'Price per print · minimum set of ' + minimumQuantity(products[index]) + '.'
      );
      renderPrintSelection();
    } else if (kind === 'calendar') {
      $('shop-price-note').textContent = copy('Calendrier complet · 14 photos uniques obligatoires.',
        'Complete calendar · 14 different photos required.');
      renderCalendarSlots();
    }
  }

  function renderProduct() {
    if (!products.length) return;
    const product = products[index];
    const kind = family(product);
    format = variant(product);
    if (kind === 'print' && !seededPrintPhoto) {
      seededPrintPhoto = true;
      if (photo.id) printPhotos = [{ ...photo, quantity: 1 }];
    }
    renderCatalog();
    renderSelectionPanels(kind);

    const previewPhoto = kind === 'print' ? printPhotos[0] : kind === 'calendar' ? calendarPhotos[0] : photo;
    $('shop-index').textContent = variant(product);
    $('shop-preview-image').src = (previewPhoto?.image || fallbackImage);
    $('shop-preview-image').alt = copy('Simulation : ', 'Preview: ') + localized(product, 'title');

    const object = $('shop-preview-object');
    object.className = 'shop-preview-object product-' + kind;
    object.hidden = product.previewEnabled === false;
    object.querySelector('.shop-calendar-grid')?.remove();
    if (kind === 'calendar') {
      const year = new Date().getFullYear() + 1;
      const offset = (new Date(year, 0, 1).getDay() + 6) % 7;
      const heading = copy('Janvier', 'January') + ' ' + year;
      const days = copy('L M M J V S D', 'M T W T F S S').split(' ');
      object.insertAdjacentHTML('beforeend', '<span class="shop-calendar-grid" aria-hidden="true"><b>' + heading + '</b>' +
        days.map(day => '<span>' + day + '</span>').join('') + '<span></span>'.repeat(offset) +
        Array.from({ length: 31 }, (_, day) => '<span>' + (day + 1) + '</span>').join('') + '</span>');
    }
    $('shop-preview-caption').textContent = product.previewEnabled === false
      ? copy('Aperçu indisponible pour ce produit.', 'Preview unavailable for this product.')
      : copy('Simulation indicative · cadrage et rendu validés avant impression.',
        'Illustrative preview · crop and finish approved before printing.');
    $('shop-stage-name').textContent = familyName(kind);
    $('shop-stage-note').textContent = kind === 'phone'
      ? copy('Téléphone non inclus. Découpes selon le modèle.', 'Phone not included. Cutouts vary by model.')
      : kind === 'calendar'
        ? copy('Couverture, 12 mois et dos · 14 photos.', 'Cover, 12 months and back · 14 photos.')
        : kind === 'print'
          ? copy('Papier photo A6 · lot de 10 minimum.', 'A6 photo paper · 10-print minimum set.')
          : copy('Tirage seul · cadre non inclus.', 'Print only · frame not included.');

    $('shop-name').textContent = familyName(kind);
    $('shop-price').textContent = money(product.retailPrice, product.currency);
    $('shop-stage-description').textContent = localized(product, 'description');
    $('shop-specifications').textContent = localized(product, 'specifications') || localized(product, 'description');
    $('shop-choice-image').src = photo.image || fallbackImage;
    $('shop-choice-title').textContent = photo.id ? photo.title : copy('Choisir dans mes favoris', 'Choose from my favorites');
    $('shop-variant-label').textContent = kind === 'phone'
      ? copy('Modèle de téléphone', 'Phone model') : copy('Format', 'Size');
    $('shop-variant').innerHTML = products.map((item, itemIndex) => family(item) === kind
      ? '<option value="' + itemIndex + '" ' + (itemIndex === index ? 'selected' : '') + '>' +
        esc(variant(item)) + ' — ' + esc(money(item.retailPrice, item.currency)) + '</option>' : ''
    ).join('');
    $('shop-add').querySelector('span').textContent = copy('Ajouter au panier', 'Add to cart');
    updateTotal();
    if (lastTrackedProduct !== product.productUid) {
      lastTrackedProduct = product.productUid;
      window.MSTrack?.event('view_change', { productUid: product.productUid, productTitle: product.title, price: product.retailPrice });
    }
  }

  function updateTotal() {
    if (!products.length) return;
    const product = products[index];
    const kind = family(product);
    const quantity = kind === 'print' ? printCount() : Number($('shop-quantity').value || 1);
    $('shop-total').textContent = money(product.retailPrice * quantity, product.currency);
    if (kind === 'print') {
      renderPrintSelection();
      $('shop-add').disabled = quantity < minimumQuantity(product);
    } else if (kind === 'calendar') {
      $('shop-add').disabled = calendarPhotos.filter(Boolean).length !== 14;
    } else {
      $('shop-add').disabled = false;
    }
  }

  function renderCart() {
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    $('shop-cart-count').textContent = count;
    $('shop-cart-total').textContent = money(total);
    $('shop-cart-empty').hidden = cart.length > 0;
    $('shop-checkout').disabled = !cart.length || !products.length;
    $('shop-cart-items').innerHTML = cart.map((item, itemIndex) => {
      const name = isEn() ? (item.nameEn || item.name) : (item.nameFr || item.name);
      const photos = Array.isArray(item.photos) ? item.photos : [];
      const detail = item.family === 'print'
        ? copy(item.quantity + ' tirages · ' + photos.length + ' photo(s) différente(s)',
          item.quantity + ' prints · ' + photos.length + ' different photo(s)')
        : item.family === 'calendar'
          ? copy('14 photos · ' + item.quantity + ' calendrier(s)', '14 photos · ' + item.quantity + ' calendar(s)')
          : esc(item.format) + ' · ' + copy('Qté ', 'Qty ') + item.quantity;
      const strip = photos.length
        ? '<span class="shop-cart-photo-strip">' + photos.slice(0, 6).map(entry => photoThumb(entry.image, entry.title)).join('') +
          (photos.length > 6 ? '<small>+' + (photos.length - 6) + '</small>' : '') + '</span>'
        : '';
      return '<article class="shop-cart-item">' + thumbnail({ family: item.family || 'poster' }, item.image) +
        '<div><b>' + esc(name) + '</b><small>' + detail + '</small>' + strip + '</div><span><b>' +
        money(item.price * item.quantity, item.currency) + '</b><button type="button" data-remove="' + itemIndex +
        '">' + copy('Retirer', 'Remove') + '</button></span></article>';
    }).join('');
    document.querySelectorAll('[data-remove]').forEach(button => {
      button.onclick = () => { cart.splice(Number(button.dataset.remove), 1); save(); renderCart(); };
    });
  }

  function openCart(open = true) {
    if (open) cartFocus = document.activeElement;
    $('shop-cart').classList.toggle('is-open', open);
    $('shop-cart').setAttribute('aria-hidden', String(!open));
    $('shop-cart-backdrop').hidden = !open;
    if (open) $('shop-cart-close').focus();
    else if (cartFocus?.isConnected) cartFocus.focus();
    $('shop-cart').inert = !open;
  }

  function openPicker(open = true, options = {}) {
    if (open) {
      pickerFocus = document.activeElement;
      pickerMode = options.mode || 'single';
      pickerSlot = Number.isInteger(options.slot) ? options.slot : -1;
      pickerSelected = new Set();
      $('favorite-picker-title').textContent = pickerMode === 'print'
        ? copy('Choisir les photos du lot', 'Choose photos for this set')
        : pickerMode === 'calendar'
          ? copy('Choisir la photo · ' + slotName(pickerSlot), 'Choose photo · ' + slotName(pickerSlot))
          : copy('Choisir une photo favorite', 'Choose a favorite photo');
      $('favorite-picker-confirm').hidden = pickerMode !== 'print';
      $('favorite-picker-confirm').textContent = copy('Ajouter les photos sélectionnées', 'Add selected photos');
      $('favorite-picker-state').textContent = copy('Chargement de vos favoris…', 'Loading your favorites…');
      $('favorite-picker-grid').replaceChildren();
    }
    $('favorite-picker').hidden = !open;
    document.body.classList.toggle('favorite-picker-open', open);
    if (open) {
      $('favorite-picker-close').focus();
      loadFavorites().catch(() => {
        $('favorite-picker-state').textContent = copy('Impossible de charger vos favoris.', 'Unable to load your favorites.');
      });
    } else if (pickerFocus?.isConnected) {
      pickerFocus.focus();
    }
  }

  function renderFavoriteGrid() {
    const grid = $('favorite-picker-grid');
    grid.innerHTML = pickerFavorites.map(item => {
      const alreadySelected = pickerMode === 'print' && printPhotos.some(photoItem => photoItem.id === item.id);
      const selected = alreadySelected || pickerSelected.has(item.id);
      const stateLabel = alreadySelected ? copy('Déjà ajoutée', 'Already added') :
        selected ? copy('Sélectionnée', 'Selected') : '';
      const image = item.watermarkedUrl || item.previewUrl;
      return '<button type="button" data-photo="' + esc(item.id) + '" data-title="' +
        esc(item.title || 'Photo favorite') + '" data-image="' + esc(abs(image)) + '" aria-pressed="' +
        selected + '" aria-label="' + esc(copy('Choisir ', 'Choose ') + (item.title || 'Photo favorite')) +
        '" ' + (alreadySelected ? 'disabled' : '') + '>' + photoThumb(abs(image), item.title || 'Photo favorite') +
        '<span>' + esc(item.title || 'Photo favorite') + (stateLabel ? ' · ' + stateLabel : '') + '</span></button>';
    }).join('');
    const count = pickerSelected.size;
    $('favorite-picker-state').hidden = pickerFavorites.length > 0;
    $('favorite-picker-confirm').textContent = copy(
      'Ajouter ' + count + ' photo' + (count > 1 ? 's' : ''),
      'Add ' + count + ' photo' + (count > 1 ? 's' : '')
    );
  }

  async function loadFavorites() {
    const state = $('favorite-picker-state');
    const grid = $('favorite-picker-grid');
    grid.innerHTML = '';
    state.hidden = false;
    $('favorite-picker-confirm').hidden = pickerMode !== 'print';
    if (!window.MSAccount?.isSignedIn()) {
      $('favorite-picker-confirm').hidden = true;
      state.innerHTML = '<b>' + copy('Connectez-vous pour retrouver vos favoris.', 'Sign in to access your favorites.') +
        '</b><button type="button" id="favorite-signin">' + copy('Se connecter', 'Sign in') + '</button>';
      $('favorite-signin').onclick = async () => {
        const ok = await window.MSAccount.requireAccount({
          eyebrow: 'L’Atelier',
          title: copy('Vos photos favorites', 'Your favorite photos'),
          message: copy('Connectez-vous pour choisir vos photographies enregistrées.',
            'Sign in to choose photographs saved in your account.')
        });
        if (ok) loadFavorites();
      };
      return;
    }
    state.textContent = copy('Chargement de vos favoris…', 'Loading your favorites…');
    const response = await window.MSAccount.request('/api/account/favorites');
    if (!response.ok) {
      $('favorite-picker-confirm').hidden = true;
      state.textContent = copy('Impossible de charger vos favoris.', 'Unable to load your favorites.');
      return;
    }
    const payload = await response.json();
    pickerFavorites = Array.isArray(payload.photos) ? payload.photos : [];
    if (!pickerFavorites.length) {
      $('favorite-picker-confirm').hidden = true;
      state.innerHTML = '<b>' + copy('Aucune photo favorite.', 'No favorite photos.') + '</b><span>' +
        copy('Ajoutez un cœur dans la galerie, puis revenez ici.', 'Add a favorite in the gallery, then return here.') +
        '</span>';
      return;
    }
    renderFavoriteGrid();
    if (pickerMode === 'print') {
      state.hidden = false;
      state.textContent = copy('Sélectionnez une ou plusieurs photos. Réglez les exemplaires ensuite.',
        'Select one or more photos. Set copy counts after that.');
    } else {
      state.hidden = true;
    }
  }

  function chooseFavorite(item) {
    const selected = { id: item.id, title: item.title || 'Photo favorite', image: abs(item.watermarkedUrl || item.previewUrl) };
    if (pickerMode === 'single') {
      photo = selected;
      openPicker(false);
      renderProduct();
      return;
    }
    if (pickerMode === 'print') {
      if (pickerSelected.has(item.id)) pickerSelected.delete(item.id);
      else if (printPhotos.length + pickerSelected.size < 50) pickerSelected.add(item.id);
      renderFavoriteGrid();
      const button = [...$('favorite-picker-grid').querySelectorAll('[data-photo]')].find(node => node.dataset.photo === item.id);
      button?.focus();
      return;
    }
    if (pickerMode === 'calendar') {
      const duplicate = calendarPhotos.findIndex((entry, slot) => slot !== pickerSlot && entry?.id === item.id);
      if (duplicate >= 0) {
        $('favorite-picker-state').hidden = false;
        $('favorite-picker-state').textContent = copy('Cette photo est déjà utilisée dans une autre case.',
          'This photo is already used in another slot.');
        return;
      }
      calendarPhotos[pickerSlot] = selected;
      openPicker(false);
      renderProduct();
      const nextEmpty = calendarPhotos.findIndex((entry, slot) => !entry && slot > pickerSlot);
      const nextSlot = nextEmpty >= 0 ? nextEmpty : calendarPhotos.findIndex(entry => !entry);
      requestAnimationFrame(() => {
        const target = nextSlot >= 0 ? [...$('shop-calendar-slots').querySelectorAll('[data-calendar-slot]')]
          .find(button => Number(button.dataset.calendarSlot) === nextSlot) : null;
        (target || $('shop-calendar-slots').querySelector('[data-calendar-slot="0"]'))?.focus();
      });
    }
  }

  $('favorite-picker-grid').addEventListener('click', event => {
    const button = event.target.closest('[data-photo]');
    if (!button || button.disabled) return;
    const item = pickerFavorites.find(entry => String(entry.id) === button.dataset.photo);
    if (item) chooseFavorite(item);
  });
  $('favorite-picker-confirm').addEventListener('click', () => {
    const additions = pickerFavorites.filter(item => pickerSelected.has(item.id) &&
      !printPhotos.some(existing => existing.id === item.id));
    additions.forEach(item => printPhotos.push({
      id: item.id,
      title: item.title || 'Photo favorite',
      image: abs(item.watermarkedUrl || item.previewUrl),
      quantity: 1
    }));
    openPicker(false);
    renderProduct();
    requestAnimationFrame(() => $('shop-add-print-photo')?.focus());
  });

  function renderUnavailable() {
    const message = unavailableReason === 'error'
      ? copy('Le catalogue est temporairement indisponible.', 'The catalog is temporarily unavailable.')
      : copy('Les créations reviennent bientôt. Retrouvez les photographies dans la galerie.',
        'Creations will be back soon. Explore the photographs in the gallery.');
    document.querySelector('.shop-shell').classList.add('is-unavailable');
    document.querySelector('.shop-stage').hidden = true;
    document.querySelector('.shop-buy').hidden = true;
    $('shop-products').insertAdjacentHTML('beforeend',
      '<a class="shop-empty-return" href="photos.html">' + copy('Retour à la galerie', 'Back to the gallery') + '</a>');
    $('shop-preview-object').hidden = true;
    $('shop-variant').disabled = true;
    $('shop-photo-choice').disabled = true;
    $('shop-index').textContent = '00 / 00';
    $('shop-stage-name').textContent = copy('Catalogue Gelato', 'Gelato catalog');
    $('shop-stage-note').textContent = message;
    $('shop-name').textContent = 'L’Atelier';
    $('shop-add').disabled = true;
    $('shop-price').textContent = '—';
    $('shop-total').textContent = '—';
    $('shop-formats').innerHTML = '<span class="shop-no-format">' + copy('Aucun produit actif', 'No active products') + '</span>';
    $('shop-stage-description').textContent = message;
  }

  async function loadCatalog() {
    try {
      const response = await fetch(API() + '/api/atelier/catalog', { credentials: 'include', cache: 'no-store' });
      if (!response.ok) throw new Error();
      const data = await response.json();
      allProducts = Array.isArray(data.products) ? data.products : [];
      products = data.enabled === false ? [] : allProducts.filter(product => Number(product.retailPrice) > 0);
      const wanted = params.get('product');
      index = Math.max(0, products.findIndex(item => item.productUid === wanted));
      renderCatalog();
      if (products.length) {
        renderProduct();
        renderCart();
      } else {
        unavailableReason = 'closed';
        renderUnavailable();
      }
    } catch (_) {
      unavailableReason = 'error';
      renderCatalog();
      renderUnavailable();
    }
  }

  function addCurrentProduct() {
    if (!products.length) return;
    const product = products[index];
    const kind = family(product);
    if (kind !== 'print' && kind !== 'calendar' && !photo.id) return openPicker(true);
    const quantity = kind === 'print' ? printCount() : Number($('shop-quantity').value || 1);
    const selectedPhotos = kind === 'print'
      ? printPhotos.map(item => ({ id: item.id, title: item.title, image: item.image, quantity: item.quantity }))
      : kind === 'calendar'
        ? calendarPhotos.map((item, slot) => ({
          id: item.id, title: item.title, image: item.image, slotIndex: slot,
          slotLabel: SLOT_NAMES[slot][0], slotLabelEn: SLOT_NAMES[slot][1]
        }))
        : [{ id: photo.id, title: photo.title, image: photo.image, quantity: 1 }];
    if (kind === 'print' && quantity < minimumQuantity(product)) return;
    if (kind === 'calendar' && selectedPhotos.length !== 14) return;
    cart.push({
      productUid: product.productUid,
      catalogUid: product.catalogUid,
      name: localized(product, 'title'),
      nameFr: product.title,
      nameEn: product.titleEn || '',
      price: Number(product.retailPrice),
      currency: product.currency || 'EUR',
      image: kind === 'print' ? printPhotos[0]?.image : kind === 'calendar' ? calendarPhotos[0]?.image : photo.image,
      family: kind,
      format,
      quantity,
      photos: selectedPhotos,
      photoId: selectedPhotos[0]?.id || '',
      photoTitle: selectedPhotos[0]?.title || ''
    });
    window.MSTrack?.event('cart_add', {
      productUid: product.productUid, productTitle: product.title, price: product.retailPrice, quantity
    });
    save();
    renderCart();
    $('shop-add').classList.add('is-added');
    $('shop-add').querySelector('span').textContent = copy('Ajouté au panier', 'Added to cart');
    setTimeout(() => {
      $('shop-add').classList.remove('is-added');
      $('shop-add').querySelector('span').textContent = copy('Ajouter au panier', 'Add to cart');
    }, 1200);
  }

  $('shop-formats').onclick = event => {
    const button = event.target.closest('[data-format]');
    if (!button) return;
    format = button.dataset.format;
    document.querySelectorAll('[data-format]').forEach(item => item.classList.toggle('is-active', item === button));
  };
  $('shop-variant').onchange = () => { index = Number($('shop-variant').value); renderProduct(); };
  $('shop-quantity').onchange = updateTotal;
  $('shop-photo-choice').onclick = () => openPicker(true);
  $('shop-add').onclick = addCurrentProduct;
  $('shop-cart-trigger').onclick = () => openCart(true);
  $('shop-cart-close').onclick = () => openCart(false);
  $('shop-cart-backdrop').onclick = () => openCart(false);
  $('favorite-picker-close').onclick = () => openPicker(false);
  document.querySelector('.favorite-picker-backdrop').onclick = () => openPicker(false);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { openCart(false); openPicker(false); }
  });
  $('shop-checkout').onclick = () => {
    if (!products.length) return;
    const valid = cart.every(item => {
      const current = products.find(product => product.productUid === item.productUid &&
        Number(product.retailPrice) === Number(item.price));
      if (!current) return false;
      if (item.family === 'print') return item.quantity >= minimumQuantity(current) && Array.isArray(item.photos) && item.photos.length > 0;
      if (item.family === 'calendar') return Array.isArray(item.photos) && item.photos.length === 14 &&
        new Set(item.photos.map(entry => entry.id)).size === 14;
      return true;
    });
    if (!valid) {
      alert(copy('Le catalogue ou les compositions ont changé. Retirez les articles concernés puis ajoutez-les à nouveau.',
        'The catalog or photo sets changed. Remove affected items and add them again.'));
      return;
    }
    cart.forEach(item => window.MSTrack?.event('checkout_start', {
      productUid: item.productUid, productTitle: item.name, price: item.price, quantity: item.quantity
    }));
    localStorage.setItem('mscomm_merch_checkout', JSON.stringify({
      cart, total: cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
      provider: 'Gelato', createdAt: new Date().toISOString()
    }));
    location.href = 'contact.html?order=shop';
  };

  $('shop-cart').inert = true;
  document.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const root = !$('favorite-picker').hidden ? $('favorite-picker') :
      $('shop-cart').classList.contains('is-open') ? $('shop-cart') : null;
    if (!root) return;
    const items = [...root.querySelectorAll('button:not(:disabled),a[href],input,select')]
      .filter(item => item.getClientRects().length);
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  new MutationObserver(() => {
    if (products.length) renderProduct();
    else if (document.querySelector('.shop-shell').classList.contains('is-unavailable')) {
      renderCatalog();
      renderUnavailable();
    }
    renderCart();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  save();
  renderCart();
  loadCatalog();
})();
