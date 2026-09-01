/* =========================================================================
   MS Comm' — Espace client (phase 2, docs/PLAN_REFONTE.md)

   Browsing is anonymous. Taking bytes out of the gallery is not: any
   download opens the sign-in sheet, and the pending action is replayed
   once the visitor is signed in.

   Loaded on every public page. Injects the account control into the
   existing .topbar-inner and owns a single auth dialog.
   ========================================================================= */
(function () {
  'use strict';

  const API = (
    window.location.protocol === 'file:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === ''
  ) ? 'http://localhost:3000' : 'https://ms-comm-server.fly.dev';

  const state = {
    account: null,
    counts: null,
    dlTicket: null,
    ticketAt: 0,
    favorites: new Set(),
    ready: false,
    pending: null           /* action to replay after a successful sign-in */
  };

  const listeners = new Set();
  function emit() {
    /* The header shows live counters (favourites), so any state change has to
       repaint it, not just notify page listeners. */
    render();
    listeners.forEach(fn => { try { fn(state); } catch (_) {} });
  }

  async function api(pathname, options) {
    const opts = Object.assign({ credentials: 'include' }, options || {});
    if (opts.body && typeof opts.body !== 'string') {
      opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
      opts.body = JSON.stringify(opts.body);
    }
    const res = await fetch(API + pathname, opts);
    let data = null;
    try { data = await res.json(); } catch (_) {}
    return { ok: res.ok, status: res.status, data: data || {} };
  }

  /* ── Session ─────────────────────────────────────────────────────────── */

  function applySession(data) {
    state.account  = (data && data.account) || null;
    state.counts   = (data && data.counts) || null;
    state.dlTicket = (data && data.dlTicket) || null;
    state.ticketAt = state.dlTicket ? Date.now() : 0;
    if (!state.account) state.favorites = new Set();
    render();
    emit();
  }

  async function refresh() {
    const r = await api('/api/account/me');
    applySession(r.ok ? r.data : null);
    state.ready = true;
    if (state.account) loadFavorites();
    return state.account;
  }

  /* The ticket authorises browser-initiated downloads across the
     GitHub Pages / Fly origin boundary. It lives 10 minutes server-side;
     refresh it at 8 so a long gallery session never hands out a dead one. */
  async function downloadTicket() {
    if (!state.account) return null;
    if (state.dlTicket && Date.now() - state.ticketAt < 8 * 60 * 1000) return state.dlTicket;
    const r = await api('/api/account/download-ticket');
    if (r.ok && r.data.dlTicket) {
      state.dlTicket = r.data.dlTicket;
      state.ticketAt = Date.now();
    }
    return state.dlTicket;
  }

  /** Append the ticket to a download URL. Returns null when signed out. */
  async function signDownloadUrl(url) {
    const ticket = await downloadTicket();
    if (!ticket) return null;
    return url + (url.indexOf('?') === -1 ? '?' : '&') + 'dlTicket=' + encodeURIComponent(ticket);
  }

  /* ── Favorites ───────────────────────────────────────────────────────── */

  async function loadFavorites() {
    const r = await api('/api/account/favorites');
    if (r.ok) {
      state.favorites = new Set(r.data.ids || []);
      emit();
    }
    return state.favorites;
  }

  function isFavorite(photoId) { return state.favorites.has(photoId); }

  async function toggleFavorite(photoId) {
    const signedIn = await requireAccount({
      eyebrow: 'Favoris',
      title: 'Enregistrer cette photo',
      message: 'Créez votre espace pour retrouver vos photos favorites à chaque visite.',
      replay: () => toggleFavorite(photoId)
    });
    if (!signedIn) return null;

    if (state.favorites.has(photoId)) {
      state.favorites.delete(photoId); emit();
      const r = await api('/api/account/favorites/' + encodeURIComponent(photoId), { method: 'DELETE' });
      if (!r.ok) { state.favorites.add(photoId); emit(); }
      return false;
    }
    state.favorites.add(photoId); emit();
    const r = await api('/api/account/favorites', { method: 'POST', body: { photoId } });
    if (!r.ok) { state.favorites.delete(photoId); emit(); }
    return true;
  }

  function logEvent(type, extra) {
    if (!state.account) return;
    api('/api/account/events', { method: 'POST', body: Object.assign({ type }, extra || {}) })
      .catch(() => {});
  }

  /* ── Auth dialog ─────────────────────────────────────────────────────── */

  let dialog = null;
  let mode = 'login';

  function buildDialog() {
    if (dialog) return dialog;
    dialog = document.createElement('div');
    dialog.className = 'acct-overlay';
    dialog.id = 'acct-overlay';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'acct-title');
    dialog.innerHTML = [
      '<div class="acct-sheet">',
      '  <button class="acct-close" type="button" aria-label="Fermer">',
      '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      '  </button>',
      '  <p class="acct-reason" id="acct-reason"></p>',
      '  <h2 class="acct-title" id="acct-title">Mon espace</h2>',
      '  <p class="acct-sub" id="acct-sub">Retrouvez vos favoris, vos téléchargements et vos commandes.</p>',
      '  <div class="acct-tabs" role="tablist">',
      '    <button class="acct-tab is-on" type="button" data-mode="login" role="tab" aria-selected="true">Se connecter</button>',
      '    <button class="acct-tab" type="button" data-mode="register" role="tab" aria-selected="false">Créer un compte</button>',
      '  </div>',
      '  <form class="acct-form" novalidate>',
      '    <div class="acct-row acct-names">',
      '      <label class="acct-field"><span>Prénom</span><input name="firstName" type="text" autocomplete="given-name" /></label>',
      '      <label class="acct-field"><span>Nom</span><input name="lastName" type="text" autocomplete="family-name" /></label>',
      '    </div>',
      '    <label class="acct-field"><span>Adresse e-mail</span>',
      '      <input name="email" type="email" autocomplete="email" required placeholder="vous@exemple.fr" /></label>',
      '    <label class="acct-field"><span>Mot de passe</span>',
      '      <input name="password" type="password" autocomplete="current-password" required placeholder="••••••••••" /></label>',
      '    <p class="acct-hint" id="acct-hint">10 caractères minimum.</p>',
      '    <p class="acct-error" id="acct-error" role="alert"></p>',
      '    <button class="acct-submit" type="submit"><span>Se connecter</span></button>',
      '  </form>',
      '  <p class="acct-switch"><span id="acct-switch-text">Pas encore de compte ?</span> <button type="button" class="acct-link" id="acct-switch-btn">Créer un compte</button></p>',
      '</div>'
    ].join('');
    document.body.appendChild(dialog);

    dialog.addEventListener('click', e => { if (e.target === dialog) closeDialog(); });
    dialog.querySelector('.acct-close').addEventListener('click', closeDialog);
    dialog.querySelectorAll('.acct-tab').forEach(btn => {
      btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });
    dialog.querySelector('#acct-switch-btn').addEventListener('click', () => {
      setMode(mode === 'login' ? 'register' : 'login');
    });
    dialog.querySelector('.acct-form').addEventListener('submit', onSubmit);
    return dialog;
  }

  function setMode(next) {
    mode = next === 'register' ? 'register' : 'login';
    const d = buildDialog();
    d.querySelectorAll('.acct-tab').forEach(b => {
      const on = b.dataset.mode === mode;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    d.querySelector('.acct-names').style.display = mode === 'register' ? '' : 'none';
    d.querySelector('#acct-hint').style.display  = mode === 'register' ? '' : 'none';
    d.querySelector('.acct-submit span').textContent = mode === 'register' ? 'Créer mon espace' : 'Se connecter';
    d.querySelector('[name=password]').setAttribute('autocomplete', mode === 'register' ? 'new-password' : 'current-password');
    d.querySelector('#acct-switch-text').textContent = mode === 'register' ? 'Vous avez déjà un compte ?' : 'Pas encore de compte ?';
    d.querySelector('#acct-switch-btn').textContent  = mode === 'register' ? 'Se connecter' : 'Créer un compte';
    d.querySelector('#acct-error').textContent = '';
  }

  let lastFocus = null;

  function openDialog(opts) {
    const o = opts || {};
    const d = buildDialog();
    lastFocus = document.activeElement;
    /* The eyebrow carries the trigger ("Téléchargement"), the title carries
       the ask. Repeating the same sentence twice was pure noise. */
    const reason = d.querySelector('#acct-reason');
    reason.textContent = o.eyebrow || '';
    reason.style.display = o.eyebrow ? '' : 'none';
    d.querySelector('#acct-title').textContent = o.title || 'Mon espace';
    d.querySelector('#acct-sub').textContent = o.message
      || 'Retrouvez vos favoris, vos téléchargements et vos commandes.';
    /* Someone stopped mid-download is trying to come back, not to enrol:
       default to sign-in, with account creation one tap away. */
    setMode(o.mode || 'login');
    d.classList.add('is-open');
    document.body.classList.add('acct-locked');
    setTimeout(() => { const f = d.querySelector('[name=email]'); if (f) f.focus(); }, 60);
    document.addEventListener('keydown', onKeydown);
  }

  function closeDialog() {
    if (!dialog) return;
    dialog.classList.remove('is-open');
    document.body.classList.remove('acct-locked');
    document.removeEventListener('keydown', onKeydown);
    if (state.pending && state.pending.reject) state.pending.reject();
    state.pending = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function onKeydown(e) {
    if (e.key === 'Escape') { closeDialog(); return; }
    if (e.key !== 'Tab' || !dialog) return;
    const focusables = dialog.querySelectorAll('button, input, [href]');
    if (!focusables.length) return;
    const first = focusables[0], last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  async function onSubmit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const btn  = form.querySelector('.acct-submit');
    const err  = form.querySelector('#acct-error');
    const data = {
      email:    form.email.value.trim(),
      password: form.password.value
    };
    if (mode === 'register') {
      data.firstName = form.firstName.value.trim();
      data.lastName  = form.lastName.value.trim();
    }
    err.textContent = '';
    btn.disabled = true;
    btn.classList.add('is-busy');
    try {
      const r = await api('/api/account/' + mode, { method: 'POST', body: data });
      if (!r.ok) {
        err.textContent = r.data.error || 'Une erreur est survenue. Réessayez.';
        return;
      }
      applySession(r.data);
      await loadFavorites();
      const pending = state.pending;
      state.pending = null;
      dialog.classList.remove('is-open');
      document.body.classList.remove('acct-locked');
      document.removeEventListener('keydown', onKeydown);
      form.reset();
      toast(mode === 'register' ? 'Espace créé. Bienvenue !' : 'Vous êtes connecté.');
      if (pending && pending.resolve) pending.resolve(true);
    } catch (_) {
      err.textContent = 'Serveur injoignable. Réessayez dans un instant.';
    } finally {
      btn.disabled = false;
      btn.classList.remove('is-busy');
    }
  }

  /**
   * Gate an action behind an account.
   * Resolves true when already signed in or after a successful sign-in,
   * false when the visitor closes the sheet.
   */
  function requireAccount(opts) {
    if (state.account) return Promise.resolve(true);
    return new Promise(resolve => {
      state.pending = { resolve, reject: () => resolve(false) };
      openDialog(opts || {});
    });
  }

  async function logout() {
    await api('/api/account/logout', { method: 'POST' });
    applySession(null);
    toast('Vous êtes déconnecté.');
  }

  /* ── Toast ───────────────────────────────────────────────────────────── */

  let toastEl = null, toastTimer = null;
  function toast(message) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'acct-toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 3200);
  }

  /* ── Header control ──────────────────────────────────────────────────── */

  const MENU = [
    { href: 'compte.html#favoris',   label: 'Mes favoris',   key: 'favorites' },
    { href: 'compte.html#commandes', label: 'Mes commandes', key: 'orders' },
    { href: 'compte.html#profil',    label: 'Mes informations' }
  ];

  function mount() {
    const host = document.querySelector('.topbar-inner');
    if (!host || document.getElementById('acct-control')) return;
    const cta = host.querySelector('.nav-cta');
    const wrap = document.createElement('div');
    wrap.className = 'acct-control';
    wrap.id = 'acct-control';
    /* Placed just before the quote CTA: the primary action of the site stays
       the primary action; the account is a persistent secondary affordance. */
    if (cta && cta.parentNode) cta.parentNode.insertBefore(wrap, cta);
    else host.appendChild(wrap);
    render();
  }

  function initials(account) {
    const a = (account.firstName || '').trim();
    const b = (account.lastName || '').trim();
    if (a || b) return ((a[0] || '') + (b[0] || '')).toUpperCase();
    return (account.email || '?')[0].toUpperCase();
  }

  function render() {
    const wrap = document.getElementById('acct-control');
    if (!wrap) return;

    if (!state.account) {
      wrap.innerHTML =
        '<button class="acct-trigger" type="button" id="acct-signin">' +
        '  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">' +
        '    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
        '  <span>Mon espace</span></button>';
      wrap.querySelector('#acct-signin').addEventListener('click', () => openDialog({}));
      return;
    }

    const name = state.account.firstName || state.account.displayName || 'Mon espace';
    const c = state.counts || {};
    wrap.innerHTML = [
      '<button class="acct-trigger is-in" type="button" id="acct-menu-btn" aria-haspopup="menu" aria-expanded="false">',
      '  <span class="acct-avatar" aria-hidden="true">' + initials(state.account) + '</span>',
      '  <span class="acct-name">' + escapeHtml(name) + '</span>',
      '</button>',
      '<div class="acct-menu" id="acct-menu" role="menu" hidden>',
      '  <div class="acct-menu-head">',
      '    <strong>' + escapeHtml(state.account.displayName || state.account.email) + '</strong>',
      '    <span>' + escapeHtml(state.account.email) + '</span>',
      '  </div>',
      '  <div class="acct-menu-stats">',
      '    <a href="compte.html#favoris"><b>' + (state.favorites.size || c.favorites || 0) + '</b><span>Favoris</span></a>',
      '    <a href="compte.html#commandes"><b>' + (c.orders || 0) + '</b><span>Commandes</span></a>',
      '    <a href="compte.html#commandes"><b>' + (c.photosBought || 0) + '</b><span>Photos</span></a>',
      '  </div>',
      MENU.map(m => '<a role="menuitem" href="' + m.href + '">' + m.label + '</a>').join(''),
      '  <button role="menuitem" type="button" id="acct-logout">Se déconnecter</button>',
      '</div>'
    ].join('');

    const btn  = wrap.querySelector('#acct-menu-btn');
    const menu = wrap.querySelector('#acct-menu');
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const open = !menu.hidden;
      menu.hidden = open;
      btn.setAttribute('aria-expanded', open ? 'false' : 'true');
    });
    wrap.querySelector('#acct-logout').addEventListener('click', () => { menu.hidden = true; logout(); });
    document.addEventListener('click', () => {
      if (menu && !menu.hidden) { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
    });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    ));
  }

  /* ── Boot ────────────────────────────────────────────────────────────── */

  function boot() {
    mount();
    refresh().catch(() => { state.ready = true; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.MSAccount = {
    get account()   { return state.account; },
    get counts()    { return state.counts; },
    get favorites() { return state.favorites; },
    isSignedIn: () => !!state.account,
    refresh, requireAccount, openDialog, logout,
    signDownloadUrl, downloadTicket,
    loadFavorites, isFavorite, toggleFavorite,
    logEvent, toast,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    API
  };
})();
