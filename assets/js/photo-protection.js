/*
 * Gallery deterrents, not DRM.
 *
 * A browser must receive image pixels to display them, so DevTools, the
 * network panel and screenshots can never be blocked reliably. This layer
 * only removes the casual extraction paths while keeping previews clean.
 * Authorised downloads continue to
 * use the normal account/ticket checks on the API.
 */
(function photoProtection() {
  'use strict';

  const root = document.documentElement;
  root.classList.add('photo-protection-enabled');

  const selector = [
    '.photos-masonry img',
    '.timeline-photos img',
    '.albums-grid img',
    '.grid-photo img',
    '#lb-img',
    '#lb-dl-preview'
  ].join(',');

  function markMedia(scope = document) {
    scope.querySelectorAll?.(selector).forEach((media) => {
      if (media.tagName === 'IMG') {
        media.classList.add('photo-protected');
        media.draggable = false;
        media.setAttribute('draggable', 'false');
        media.setAttribute('referrerpolicy', 'no-referrer');
      } else {
        media.classList.add('photo-protected');
      }
    });
  }

  function isEditable(target) {
    return target instanceof Element && (
      target.matches('input, textarea, select, [contenteditable="true"]') ||
      !!target.closest('input, textarea, select, [contenteditable="true"]')
    );
  }

  function isPhotoTarget(target) {
    return target instanceof Element && (
      !!target.closest('.photos-masonry, .timeline-photos, .albums-grid, .grid-photo, .lb-img-wrap, #lb-dl-preview')
    );
  }

  function blockMediaAction(event) {
    if (!isPhotoTarget(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
  }

  document.addEventListener('contextmenu', blockMediaAction, true);
  document.addEventListener('dragstart', blockMediaAction, true);
  document.addEventListener('selectstart', blockMediaAction, true);
  document.addEventListener('copy', blockMediaAction, true);

  /* Casual save/view-source/print shortcuts are blocked only outside form
     fields. Navigation and account inputs remain usable. */
  document.addEventListener('keydown', (event) => {
    if (isEditable(event.target)) return;
    const key = String(event.key || '').toLowerCase();
    const command = event.ctrlKey || event.metaKey;
    const galleryOpen = document.getElementById('lb-overlay')?.classList.contains('open');
    if ((command && ['s', 'u', 'p', 'c', 'a'].includes(key)) || (galleryOpen && key === 'printscreen')) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  markMedia();
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) markMedia(node);
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
