/* Phase 3 verification: the enriched admin client sheet.
   insights.js reads db/*.json relative to DATA_DIR, so the whole test runs on
   a temp fixture and never touches the Fly volume. */
'use strict';
const assert = require('assert');
const fs   = require('fs');
const os   = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mscomm-detail-'));
fs.mkdirSync(path.join(tmp, 'db'));
process.env.DATA_DIR = tmp;

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const iso = ms => new Date(ms).toISOString();
const writeDb = (name, data) =>
  fs.writeFileSync(path.join(tmp, 'db', name + '.json'), JSON.stringify(data));

const ACC = 'acc-lois';

writeDb('photos', [
  { id: 'p1', title: 'Photo 1', albumId: 'a1', downloadType: 'paid',  createdAt: iso(now - 30 * DAY) },
  { id: 'p2', title: 'Photo 2', albumId: 'a1', downloadType: 'free',  createdAt: iso(now - 30 * DAY) },
  { id: 'p3', title: 'Photo 3', albumId: 'a2', downloadType: 'free',  createdAt: iso(now - 30 * DAY) },
  { id: 'p4', title: 'Corbeille', albumId: 'a2', deletedAt: iso(now - DAY), createdAt: iso(now - 30 * DAY) }
]);
writeDb('albums', [
  { id: 'a1', name: 'Gala 2026', type: 'public' },
  { id: 'a2', name: 'Mariage',   type: 'public' }
]);
writeDb('accounts', [{
  id: ACC, email: 'Lois@Example.com', emailNormalized: 'lois@example.com',
  firstName: 'Loïs', lastName: 'ADAM', status: 'active',
  createdAt: iso(now - 20 * DAY), lastLoginAt: iso(now - 2 * DAY),
  lastSeenAt: iso(now - DAY), marketingOptIn: true, passwordHash: 'x'
}]);
/* The order was placed BEFORE signup, with a differently-cased email: it must
   still land on the account sheet. */
writeDb('orders', [{
  id: 'o1', status: 'completed', total: 40, subtotal: 40,
  customer: { email: 'lois@example.com', firstName: 'Lois', lastName: 'Adam', phone: '0600000000' },
  photos: [{ photoId: 'p1', title: 'Photo 1', price: 40 }],
  createdAt: iso(now - 25 * DAY), completedAt: iso(now - 25 * DAY)
}, {
  id: 'o2', status: 'completed', total: 20, subtotal: 20,
  customer: { email: 'guest@example.com', firstName: 'Marie', lastName: 'DUPONT' },
  photos: [{ photoId: 'p2', title: 'Photo 2', price: 20 }],
  createdAt: iso(now - 3 * DAY), completedAt: iso(now - 3 * DAY)
}]);
writeDb('favorites', [
  { accountId: ACC, photoId: 'p2', createdAt: iso(now - 5 * DAY) },
  { accountId: ACC, photoId: 'p3', createdAt: iso(now - 4 * DAY) },
  { accountId: ACC, photoId: 'p4', createdAt: iso(now - 4 * DAY) }   /* trashed -> hidden */
]);
writeDb('creations', [
  { id: 'c1', accountId: ACC, photoId: 'p1', product: 'poster', status: 'draft', createdAt: iso(now - DAY) }
]);
writeDb('client-events', [
  { accountId: ACC, type: 'login',      ts: now - 2 * DAY },
  { accountId: ACC, type: 'album_view', albumId: 'a1', ts: now - 6 * DAY },
  { accountId: ACC, type: 'album_view', albumId: 'a1', ts: now - 5 * DAY },
  { accountId: ACC, type: 'album_view', albumId: 'a2', ts: now - 5 * DAY },
  { accountId: ACC, type: 'photo_view', photoId: 'p3', albumId: 'a2', ts: now - 5 * DAY },
  { accountId: ACC, type: 'download',   photoId: 'p2', albumId: 'a1', ts: now - 4 * DAY },
  { accountId: ACC, type: 'download',   photoId: 'p3', albumId: 'a2', ts: now - 4 * DAY },
  { accountId: 'someone-else', type: 'download', photoId: 'p1', ts: now - DAY }
]);
writeDb('scan-jobs', []);
writeDb('settings', {});

const insights = require('../photo-server/services/insights');

/* ── The pre-signup order lands on the account, not on a separate guest ── */
const all = insights.buildClients();
assert.strictEqual(all.length, 2, 'one account + one guest buyer');
const lois = all.find(c => c.id === ACC);
assert.ok(lois, 'account record keyed by id');
assert.strictEqual(lois.type, 'account');
assert.strictEqual(lois.orders, 1, 'pre-signup order attached by normalised email');
assert.strictEqual(lois.spent, 40);
assert.strictEqual(lois.phone, '0600000000', 'phone falls back to the checkout form');
assert.strictEqual(lois.status, 'active');
assert.strictEqual(lois.marketingOptIn, true);
assert.strictEqual(lois.albumsViewed, 2, 'two DISTINCT albums, three views');
assert.strictEqual(lois.downloads, 2);
assert.strictEqual(lois.photoViews, 1);
assert.strictEqual(lois.logins, 1);
assert.strictEqual(lois.favorites, 3, 'raw favourite rows, trash filtered at detail level');
assert.strictEqual(lois.creations, 1);

/* Another account's events must never leak into this sheet. */
const guest = all.find(c => c.type === 'guest');
assert.strictEqual(guest.downloads, 0, 'guest has no journal');

/* ── Detail: counters ─────────────────────────────────────────────────── */
const d = insights.getClientDetail(ACC);
assert.ok(d, 'detail found');
assert.strictEqual(d.counters.orders, 1);
assert.strictEqual(d.counters.spent, 40);
assert.strictEqual(d.counters.photosBought, 1);
assert.strictEqual(d.counters.favorites, 2, 'the trashed favourite is not shown');
assert.strictEqual(d.counters.downloads, 2);
assert.strictEqual(d.counters.creations, 1);
assert.strictEqual(d.counters.albumsViewed, 2);
assert.strictEqual(d.counters.photoViews, 1);
assert.strictEqual(d.counters.logins, 1);

/* ── Engagement ───────────────────────────────────────────────────────── */
assert.strictEqual(d.engagement.daysSinceSignup, 20);
assert.strictEqual(d.engagement.avgOrderValue, 40);
assert.strictEqual(d.engagement.activityByDay.length, 30, 'always 30 points, gaps included');
assert.strictEqual(
  d.engagement.activityByDay[d.engagement.activityByDay.length - 1].day,
  new Date(new Date().setHours(0, 0, 0, 0)).toISOString().slice(0, 10),
  'the series ends today');
const activityTotal = d.engagement.activityByDay.reduce((s, x) => s + x.count, 0);
assert.strictEqual(activityTotal, 8, '7 journal events + 1 order, all inside 30 days');

/* ── Album affinity keeps bought and browsed apart ────────────────────── */
const a1 = d.topAlbums.find(a => a.id === 'a1');
const a2 = d.topAlbums.find(a => a.id === 'a2');
assert.strictEqual(a1.purchased, 1);
assert.strictEqual(a1.viewed, 2);
assert.strictEqual(a2.purchased, 0, 'browsed but never bought');
assert.strictEqual(a2.viewed, 1);
assert.strictEqual(d.topAlbums[0].id, 'a1', 'buyers rank above browsers');

/* ── Lists ────────────────────────────────────────────────────────────── */
assert.strictEqual(d.favorites.length, 2);
assert.strictEqual(d.favorites[0].photoId, 'p3', 'newest favourite first');
assert.ok(d.favorites.every(f => f.photoId !== 'p4'), 'trashed photo excluded');
assert.strictEqual(d.downloads.length, 2);
assert.ok(d.downloads.every(x => x.at && x.title), 'downloads carry a date and a title');
assert.strictEqual(d.creations[0].thumb, '/storage/previews/p1.jpg');

/* ── Timeline ─────────────────────────────────────────────────────────── */
assert.strictEqual(d.timeline.length, 9, '7 events + 1 order + 1 synthesised signup');
assert.ok(d.timeline.every(e => e.at), 'every entry carries an ISO date');
for (let i = 1; i < d.timeline.length; i++) {
  assert.ok(d.timeline[i - 1].ts >= d.timeline[i].ts, 'timeline is newest-first');
}
/* The order predates the account, so it stays the oldest entry: the timeline
   must show the purchase history that existed before signup. */
assert.strictEqual(d.timeline[d.timeline.length - 1].type, 'order', 'the pre-signup order is the oldest entry');
assert.ok(d.timeline.some(e => e.type === 'signup'), 'signup is synthesised into the timeline');
const order = d.timeline.find(e => e.type === 'order');
assert.strictEqual(order.orderId, 'o1');
const view = d.timeline.find(e => e.type === 'album_view');
assert.strictEqual(view.detail, 'Gala 2026', 'album name resolved for display');
assert.strictEqual(d.timeline.find(e => e.type === 'photo_view').detail, 'Photo 3');

/* ── A guest sheet must be an honest empty, not a broken account ──────── */
const gd = insights.getClientDetail(guest.id);
assert.strictEqual(gd.type, 'guest');
assert.strictEqual(gd.createdAt, gd.firstOrderAt, 'guest signup date proxies the first order');
assert.strictEqual(gd.counters.favorites, 0);
assert.strictEqual(gd.counters.downloads, 0);
assert.strictEqual(gd.timeline.length, 1, 'orders only');
assert.strictEqual(gd.timeline[0].type, 'order');
assert.strictEqual(gd.engagement.activityByDay.length, 30, 'series shape is stable for guests');
assert.strictEqual(gd.orders.length, 1);
assert.strictEqual(gd.orders[0].photos[0].thumb, '/storage/previews/p2.jpg');

/* ── Summary sees the account ─────────────────────────────────────────── */
const listed = insights.getClients({});
assert.strictEqual(listed.summary.totalAccounts, 1);
assert.strictEqual(listed.summary.accountsEnabled, true);
assert.strictEqual(listed.summary.guestBuyers, 1);
assert.strictEqual(listed.summary.withOrders, 2);

fs.rmSync(tmp, { recursive: true, force: true });
console.log('insights detail tests passed');
