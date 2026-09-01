const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

/* insights.js reads db/*.json relative to DATA_DIR. Point it at a temp
   fixture so the test never depends on the real Fly volume content. */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mscomm-insights-'));
fs.mkdirSync(path.join(tmp, 'db'));
process.env.DATA_DIR = tmp;

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();

const writeDb = (name, data) =>
  fs.writeFileSync(path.join(tmp, 'db', name + '.json'), JSON.stringify(data));

writeDb('photos', [
  { id: 'p1', title: 'Photo 1', albumId: 'a1', downloadType: 'paid',
    flickrOriginalId: '1', flickrWatermarkId: 'w1', createdAt: iso(now - 10 * DAY) },
  { id: 'p2', title: 'Photo 2', albumId: 'a1', downloadType: 'paid',
    flickrOriginalId: '2', flickrWatermarkId: null, createdAt: iso(now - 5 * DAY) },
  { id: 'p3', title: 'Corbeille', albumId: 'a1', downloadType: 'private',
    deletedAt: iso(now - DAY), createdAt: iso(now - 40 * DAY) }
]);
writeDb('albums', [
  { id: 'a1', name: 'Album public', type: 'public', code: null, coverId: 'p1' },
  { id: 'a2', name: 'Album prive', type: 'private', code: null }
]);
writeDb('orders', [
  /* Loic: two paid orders inside the 30d window -> repeat buyer */
  { id: 'o1', status: 'completed', total: 10, subtotal: 10,
    customer: { email: 'Loic@Example.com', firstName: 'Loic', lastName: 'ADAM' },
    photos: [{ photoId: 'p1', title: 'Photo 1', price: 10 }],
    createdAt: iso(now - 3 * DAY), completedAt: iso(now - 3 * DAY) },
  { id: 'o2', status: 'completed', total: 20, subtotal: 20,
    customer: { email: 'loic@example.com', firstName: 'loic', lastName: 'adam' },
    photos: [{ photoId: 'p2', title: 'Photo 2', price: 20 }],
    createdAt: iso(now - 2 * DAY), completedAt: iso(now - 2 * DAY) },
  /* Marie: one paid order in the PREVIOUS window -> feeds deltaPct */
  { id: 'o3', status: 'completed', total: 5, subtotal: 5,
    customer: { email: 'marie@example.com', firstName: 'Marie', lastName: 'DUPONT' },
    photos: [{ photoId: 'p1', title: 'Photo 1', price: 5 }],
    createdAt: iso(now - 40 * DAY), completedAt: iso(now - 40 * DAY) },
  /* Stale pending order -> attention queue */
  { id: 'o4', status: 'pending', total: 99,
    customer: { email: 'attente@example.com', firstName: 'En', lastName: 'Attente' },
    photos: [], createdAt: iso(now - 5 * DAY) }
]);
writeDb('analytics-visits', [
  { path: '/photos', ts: now - 2 * DAY, ip: 'ipA', albumId: 'a1' },
  { path: '/photos', ts: now - 2 * DAY, ip: 'ipA', albumId: 'a1' },
  { path: '/albums', ts: now - DAY,     ip: 'ipB' },
  { path: '/albums', ts: now - 40 * DAY, ip: 'ipC' }
]);
writeDb('analytics-downloads', [
  { photoId: 'p1', ts: now - DAY, ip: 'ipA' },
  { photoId: 'p1', ts: now - DAY, ip: 'ipB' },
  { photoId: 'p2', ts: now - 2 * DAY, ip: 'ipA' }
]);
writeDb('scan-jobs', []);
writeDb('settings', {});

const insights = require('../photo-server/services/insights');

/* ── deltaPct ─────────────────────────────────────────────────────────── */
assert.strictEqual(insights.deltaPct(30, 10), 200, 'delta +200%');
assert.strictEqual(insights.deltaPct(5, 10), -50, 'delta -50%');
assert.strictEqual(insights.deltaPct(0, 0), 0, 'no data both windows -> 0');
assert.strictEqual(insights.deltaPct(7, 0), null, 'growth from zero is not a percentage');

/* ── Client aggregation: case-insensitive email is one single client ──── */
const clients = insights.buildClients();
const loic = clients.find(c => c.email.toLowerCase() === 'loic@example.com');
assert.ok(loic, 'Loic aggregated');
assert.strictEqual(clients.filter(c => c.email.toLowerCase() === 'loic@example.com').length, 1,
  'Loic@Example.com and loic@example.com must collapse into one client');
assert.strictEqual(loic.orders, 2, 'two paid orders');
assert.strictEqual(loic.spent, 30, 'total spent 30');
assert.strictEqual(loic.type, 'guest', 'no account file yet -> guest');
assert.strictEqual(loic.displayName, 'Loic ADAM', 'display name from first order seen');

/* A pending-only order still creates the client but counts zero revenue. */
const attente = clients.find(c => c.email === 'attente@example.com');
assert.ok(attente, 'pending-only buyer is listed');
assert.strictEqual(attente.orders, 0, 'pending order is not counted as paid');
assert.strictEqual(attente.spent, 0, 'pending order brings no revenue');

/* ── Summary and segments ─────────────────────────────────────────────── */
const listed = insights.getClients({ segment: 'repeat' });
assert.strictEqual(listed.clients.length, 1, 'one repeat buyer');
assert.strictEqual(listed.clients[0].email.toLowerCase(), 'loic@example.com');
assert.strictEqual(listed.summary.withOrders, 2, 'Loic + Marie have paid orders');
assert.strictEqual(listed.summary.withoutOrders, 1, 'the pending-only buyer');
assert.strictEqual(listed.summary.repeatBuyers, 1);
assert.strictEqual(listed.summary.totalRevenue, 35, '30 + 5');
assert.strictEqual(listed.summary.totalAccounts, 0, 'no accounts.json yet');
assert.strictEqual(listed.summary.accountsEnabled, false);

const searched = insights.getClients({ search: 'marie' });
assert.strictEqual(searched.clients.length, 1, 'search by name/email');

const paged = insights.getClients({ pageSize: 1, page: 2, sort: 'spent' });
assert.strictEqual(paged.clients.length, 1);
assert.strictEqual(paged.totalPages, 3);

/* ── Client detail ────────────────────────────────────────────────────── */
const detail = insights.getClientDetail(loic.id);
assert.ok(detail, 'detail found by id');
assert.strictEqual(detail.orders.length, 2);
assert.strictEqual(detail.orders[0].photos[0].thumb, '/storage/previews/p2.jpg',
  'photo line resolves a thumbnail');
assert.strictEqual(detail.topAlbums[0].id, 'a1', 'album affinity from bought photos');
assert.strictEqual(detail.timeline.length, 2, 'two order events in the timeline');
assert.strictEqual(insights.getClientDetail('guest:inconnu@example.com'), null,
  'unknown client returns null');

/* ── Overview: current vs previous window ─────────────────────────────── */
const ov = insights.getOverview('30d');
assert.strictEqual(ov.range, '30d');
assert.strictEqual(ov.granularity, 'day');
assert.strictEqual(ov.kpis.revenue.value, 30, 'revenue in the last 30 days');
assert.strictEqual(ov.kpis.revenue.previous, 5, 'revenue in the previous 30 days');
assert.strictEqual(ov.kpis.revenue.deltaPct, 500, '(30-5)/5');
assert.strictEqual(ov.kpis.orders.value, 2);
assert.strictEqual(ov.kpis.clients.value, 1, 'one distinct buyer in window');
assert.strictEqual(ov.kpis.aov.value, 15);
assert.strictEqual(ov.kpis.downloads.value, 3);
assert.strictEqual(ov.kpis.visits.value, 3);
assert.strictEqual(ov.kpis.uniqueVisitors.value, 2, 'ipA counted once');
assert.strictEqual(ov.series.revenue.length, 30, 'one point per day');
assert.strictEqual(ov.series.traffic.length, 30);
assert.strictEqual(ov.series.hourly.length, 24);
assert.strictEqual(ov.series.photoGrowth.length, 12);
assert.strictEqual(
  ov.series.revenue.reduce((s, d) => s + d.revenue, 0), 30,
  'daily series sums to the KPI');

/* 12m range must switch to monthly buckets, not 365 daily points. */
const year = insights.getOverview('12m');
assert.strictEqual(year.granularity, 'month');
assert.strictEqual(year.series.revenue.length, 12);

/* Unknown range falls back to 30d instead of throwing. */
assert.strictEqual(insights.getOverview('bogus').range, '30d');

/* ── Top lists ────────────────────────────────────────────────────────── */
assert.strictEqual(ov.top.photos[0].id, 'p1', 'p1 downloaded twice');
assert.strictEqual(ov.top.albums[0].id, 'a1');
assert.strictEqual(ov.top.sold.length, 2);
assert.strictEqual(ov.top.clients[0].spent, 30, 'top client by revenue');

/* ── Health ───────────────────────────────────────────────────────────── */
assert.strictEqual(ov.health.storage.photos, 2, 'trashed photo excluded');
assert.strictEqual(ov.health.storage.trash, 1);
assert.strictEqual(ov.health.storage.albums, 2);

/* ── Attention queue ──────────────────────────────────────────────────── */
const codes = ov.attention.map(a => a.code);
assert.ok(codes.includes('photos_without_watermark'), 'p2 has no watermark copy');
assert.ok(codes.includes('private_album_without_code'), 'a2 is private without code');
assert.ok(codes.includes('orders_pending'), 'o4 pending for 5 days');
assert.ok(codes.includes('trash_not_empty'), 'p3 is trashed');
const levels = ov.attention.map(a => a.level);
assert.deepStrictEqual(levels, [...levels].sort(
  (a, b) => ({ error: 0, warn: 1, info: 2 })[a] - ({ error: 0, warn: 1, info: 2 })[b]),
  'attention items are sorted by severity');

fs.rmSync(tmp, { recursive: true, force: true });
console.log('insights tests passed');

