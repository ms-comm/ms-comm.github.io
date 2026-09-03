/* MS Comm' — visitor tracking (docs/tracking.md §1).
 * Anonymous by default: vid (localStorage) + sid (sessionStorage, 30 min gap).
 * Batches events, flushes every 5 s or on pagehide via sendBeacon.
 * Public API: window.MSTrack.event(type, data), MSTrack.identify(accountId), MSTrack.vid.
 */
(function () {
  'use strict';
  if (window.MSTrack) return;

  var API = (
    location.protocol === 'file:' || location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' || location.hostname === ''
  ) ? 'http://localhost:3000' : 'https://ms-comm-server.fly.dev';
  var ENDPOINT = API + '/api/public/track';
  var FLUSH_MS = 5000, HEARTBEAT_MS = 20000, SESSION_GAP_MS = 30 * 60 * 1000;

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '');
    var s = '', c = 'abcdefghijklmnopqrstuvwxyz0123456789';
    for (var i = 0; i < 24; i++) s += c[Math.floor(Math.random() * c.length)];
    return s;
  }
  function store(kind, key, val) {
    try { var st = kind === 'local' ? localStorage : sessionStorage; if (val === undefined) return st.getItem(key); st.setItem(key, val); } catch (_) { return null; }
  }

  var vid = store('local', 'ms_vid');
  if (!vid) { vid = uid(); store('local', 'ms_vid', vid); }

  var sid = store('session', 'ms_sid');
  var lastAt = parseInt(store('session', 'ms_sid_at') || '0', 10) || 0;
  var isNewSession = false;
  if (!sid || Date.now() - lastAt > SESSION_GAP_MS) { sid = uid(); store('session', 'ms_sid', sid); isNewSession = true; }
  store('session', 'ms_sid_at', String(Date.now()));

  var pageName = (function () {
    var f = (location.pathname.split('/').pop() || 'index.html').replace(/\.html?$/, '');
    return f || 'index';
  })();
  var path = location.pathname + location.search;

  function ctx() {
    var n = navigator, s = screen || {};
    return {
      ua: n.userAgent, lang: n.language, langs: (n.languages || []).slice(0, 4).join(','),
      ref: document.referrer || '', tz: (function () { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (_) { return ''; } })(),
      screen: s.width + 'x' + s.height, viewport: innerWidth + 'x' + innerHeight,
      platform: (n.userAgentData && n.userAgentData.platform) || n.platform || '',
      touch: ('ontouchstart' in window) || (n.maxTouchPoints > 0), dpr: devicePixelRatio || 1,
      connection: (n.connection && n.connection.effectiveType) || ''
    };
  }

  var queue = [], timer = null;
  function push(type, data) {
    var d = data || {};
    var ev = { t: type, ts: Date.now(), path: path, page: pageName };
    if (d.photoId) ev.photoId = String(d.photoId);
    if (d.albumId) ev.albumId = String(d.albumId);
    var meta = {};
    var hasMeta = false;
    for (var k in d) if (Object.prototype.hasOwnProperty.call(d, k) && k !== 'photoId' && k !== 'albumId' && d[k] != null) { meta[k] = d[k]; hasMeta = true; }
    if (hasMeta) ev.meta = meta;
    queue.push(ev);
    store('session', 'ms_sid_at', String(ev.ts));
    if (queue.length >= 40) flush(); else if (!timer) timer = setTimeout(flush, FLUSH_MS);
  }

  function flush(useBeacon) {
    if (timer) { clearTimeout(timer); timer = null; }
    if (!queue.length) return;
    var batch = queue.splice(0, 100);
    var body = JSON.stringify({ vid: vid, sid: sid, ctx: ctx(), events: batch });
    var sent = false;
    if (useBeacon && navigator.sendBeacon) {
      try { sent = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain' })); } catch (_) { sent = false; }
    }
    if (!sent) {
      try {
        fetch(ENDPOINT, { method: 'POST', body: body, headers: { 'Content-Type': 'text/plain' }, credentials: 'include', keepalive: true }).catch(function () {});
      } catch (_) {}
    }
    if (queue.length) timer = setTimeout(flush, FLUSH_MS);
  }

  /* Active time: only counted while the tab is visible. */
  var activeSince = document.visibilityState === 'visible' ? Date.now() : 0;
  var activeAcc = 0;
  function takeActive() {
    if (activeSince) { activeAcc += Date.now() - activeSince; activeSince = Date.now(); }
    var v = activeAcc; activeAcc = 0; return v;
  }
  setInterval(function () {
    if (document.visibilityState !== 'visible') return;
    var a = takeActive();
    if (a > 1000) push('heartbeat', { activeMs: a });
  }, HEARTBEAT_MS);

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      var a = takeActive(); activeSince = 0;
      push('heartbeat', { activeMs: a });
      flush(true);
    } else activeSince = Date.now();
  });
  addEventListener('pagehide', function () {
    var a = takeActive(); activeSince = 0;
    push('session_end', { activeMs: a });
    flush(true);
  });

  if (isNewSession) push('session_start', { landing: path, ref: document.referrer || '' });
  push('page_view', { title: document.title });

  window.MSTrack = {
    vid: vid, sid: sid,
    event: function (type, data) { try { push(type, data); } catch (_) {} },
    /* The link vid ↔ account is made server-side (session cookie on ingest,
       X-MS-Vid header on account calls); identify() just pushes pending
       events so the link happens right away. */
    identify: function () { flush(); },
    flush: function () { flush(); }
  };
})();
