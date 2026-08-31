/* Regression test for the real bug: on a throttled connection the album ZIP
   always died at the same photo (reported: image 142/302, three runs in a row).

   Cause: HTTP 429 was treated as a download failure, so it consumed one of the
   three attempts. Three 429 in ~3 s = album aborted. A rate limit is not a
   failure: it must pause, keep the same photo, and slow the cadence down. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'photos.html'), 'utf8');
const start = html.indexOf('async function fetchAlbumPhotoBytes({');
const end = html.indexOf('\ndocument.addEventListener', start);
assert.ok(start > 0 && end > start, 'fetchAlbumPhotoBytes must be extractable from photos.html');
const source = html.slice(start, end);

const context = { console, Uint8Array, Number, Math, Date, Error, Promise, setTimeout, ArrayBuffer };
vm.createContext(context);
vm.runInContext(source + '\nthis.fetchAlbumPhotoBytes = fetchAlbumPhotoBytes;', context);
const fetchAlbumPhotos = context.fetchAlbumPhotoBytes;

function makeList(count) {
  return Array.from({ length: count }, (_, i) => ({ filename: `IMG_${i + 1}.jpg`, directUrl: `https://live.staticflickr.com/${i + 1}.jpg` }));
}

function okResponse() {
  return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(8) };
}

function rateLimited(retryAfter) {
  return { ok: false, status: 429, headers: { get: name => (name === 'retry-after' && retryAfter ? String(retryAfter) : null) } };
}

/* Virtual clock: the real policy waits minutes, the test must not. */
function harness() {
  let clock = 0;
  const slept = [];
  return {
    slept,
    now: () => clock,
    sleep: async ms => { slept.push(ms); clock += ms; }
  };
}

async function run() {
  /* 1. A burst of 429 on one photo must NOT abort the album. */
  {
    const list = makeList(200);
    const h = harness();
    let calls = 0;
    const limitedAt = new Map([[142, 3]]);
    const files = [];
    const fetchImpl = async url => {
      calls++;
      const index = Number(url.match(/\/(\d+)\.jpg$/)[1]);
      const remaining = limitedAt.get(index) || 0;
      if (remaining > 0) { limitedAt.set(index, remaining - 1); return rateLimited(); }
      return okResponse();
    };
    await fetchAlbumPhotos({ list, onPhoto: name => files.push(name), fetchImpl, sleep: h.sleep, now: h.now, log: () => {} });
    assert.strictEqual(files.length, 200, 'every photo is downloaded despite three 429 on photo 142');
    assert.strictEqual(calls, 203, '3 extra calls: the rate-limited photo is retried, not skipped');
    assert.strictEqual(files[141], 'IMG_142.jpg', 'the rate-limited photo is present in the archive');
  }

  /* 2. A 429 must not consume a failure attempt, and must slow the cadence. */
  {
    const list = makeList(3);
    const h = harness();
    let served = 0;
    const fetchImpl = async () => (++served <= 4 ? rateLimited() : okResponse());
    await fetchAlbumPhotos({ list, onPhoto: () => {}, fetchImpl, sleep: h.sleep, now: h.now, log: () => {} });
    const pauses = h.slept.filter(ms => ms >= 20000);
    assert.deepStrictEqual(pauses, [20000, 45000, 90000, 120000], 'backoff grows on each pause');
    const cadences = h.slept.filter(ms => ms < 20000);
    assert.ok(cadences.includes(8000), 'inter-photo cadence is raised after repeated 429');
  }

  /* 3. Retry-After is honoured when Flickr sends it. */
  {
    const list = makeList(1);
    const h = harness();
    let served = 0;
    const fetchImpl = async () => (++served === 1 ? rateLimited(30) : okResponse());
    await fetchAlbumPhotos({ list, onPhoto: () => {}, fetchImpl, sleep: h.sleep, now: h.now, log: () => {} });
    assert.ok(h.slept.includes(30000), 'Retry-After: 30 is respected instead of the default backoff');
  }

  /* 4. Real failures still abort after exactly three attempts. */
  {
    const list = makeList(5);
    const h = harness();
    const fetchImpl = async url => (url.endsWith('/3.jpg')
      ? { ok: false, status: 404, headers: { get: () => null } }
      : okResponse());
    let thrown = null;
    try {
      await fetchAlbumPhotos({ list, onPhoto: () => {}, fetchImpl, sleep: h.sleep, now: h.now, log: () => {} });
    } catch (error) { thrown = error; }
    assert.ok(thrown, 'a genuine HTTP error still aborts');
    assert.match(thrown.message, /IMG_3\.jpg/, 'the failing file is named');
    assert.match(thrown.message, /HTTP 404/, 'the real status is reported');
  }

  /* 5. An endlessly throttled connection stops with an actionable message. */
  {
    const list = makeList(2);
    const h = harness();
    const fetchImpl = async () => rateLimited();
    let thrown = null;
    try {
      await fetchAlbumPhotos({ list, onPhoto: () => {}, fetchImpl, sleep: h.sleep, now: h.now, log: () => {} });
    } catch (error) { thrown = error; }
    assert.ok(thrown, 'a permanently throttled connection eventually stops');
    assert.match(thrown.message, /HTTP 429/, 'the message explains it is a rate limit');
    assert.match(thrown.message, /dizaine de minutes/, 'the message tells the visitor what to do');
    assert.strictEqual(h.slept.filter(ms => ms >= 20000).length, 6, 'exactly six pauses before giving up');
  }

  console.log('album ZIP browser rate-limit tests passed');
}

run().catch(error => { console.error(error); process.exit(1); });
