const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Readable } = require('stream');

const { createAlbumZipJobs } = require('../photo-server/services/albumZipJobs');
const { createAlbumZipWorker } = require('../photo-server/services/albumZipWorker');

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'album-zip-worker-'));
  let nowMs = Date.parse('2026-08-31T12:00:00.000Z');
  let sequence = 0;
  const jobs = createAlbumZipJobs({
    dataDir: root,
    now: () => nowMs,
    randomId: () => `worker-job-${++sequence}`,
    randomToken: () => `worker-token-${sequence}`
  });

  const first = await jobs.createJob({
    albumId: 'album-1',
    estimatedBytes: 30,
    photos: [
      { id: 'one', source: 'flickr-one', filename: 'one.jpg' },
      { id: 'two', source: 'flickr-two', filename: 'two.jpg' }
    ]
  });
  const order = [];
  let archiveSnapshot = null;
  const worker = createAlbumZipWorker({
    jobs,
    download: async ({ photo }) => {
      order.push(photo.id);
      return Readable.from([Buffer.from(photo.id)]);
    },
    createArchive: async ({ files, destinationPath }) => {
      archiveSnapshot = files.map(file => ({ id: file.id, exists: fs.existsSync(file.path) }));
      fs.writeFileSync(destinationPath, files.map(file => fs.readFileSync(file.path, 'utf8')).join(','));
    },
    now: () => nowMs
  });
  await worker.processJob(first.id);
  assert.deepStrictEqual(order, ['one', 'two']);
  assert.deepStrictEqual(archiveSnapshot, [
    { id: 'one', exists: true },
    { id: 'two', exists: true }
  ]);
  const completed = await jobs.getJob(first.id);
  assert.strictEqual(completed.status, 'ready');
  assert.deepStrictEqual(completed.photos.map(photo => photo.status), ['complete', 'complete']);
  assert.strictEqual(fs.readFileSync(path.join(jobs.getJobDirectory(first.id), completed.zipPath), 'utf8'), 'one,two');

  const resumed = await jobs.createJob({
    albumId: 'album-2',
    estimatedBytes: 30,
    photos: [
      { id: 'done', source: 'flickr-done', filename: 'done.jpg' },
      { id: 'remaining', source: 'flickr-remaining', filename: 'remaining.jpg' }
    ]
  });
  const resumedDir = jobs.getJobDirectory(resumed.id);
  fs.mkdirSync(path.join(resumedDir, 'photos'), { recursive: true });
  fs.writeFileSync(path.join(resumedDir, 'photos', 'done.jpg'), 'done');
  await jobs.markPhotoDownloading(resumed.id, 'done');
  await jobs.markPhotoComplete(resumed.id, 'done', { path: 'photos/done.jpg', sizeBytes: 4 });
  const resumedDownloads = [];
  const resumeWorker = createAlbumZipWorker({
    jobs,
    download: async ({ photo }) => {
      resumedDownloads.push(photo.id);
      return Readable.from([photo.id]);
    },
    createArchive: async ({ destinationPath }) => fs.writeFileSync(destinationPath, 'ready')
  });
  await resumeWorker.processJob(resumed.id);
  assert.deepStrictEqual(resumedDownloads, ['remaining']);

  const throttled = await jobs.createJob({
    albumId: 'album-3',
    estimatedBytes: 10,
    photos: [{ id: 'limited', source: 'flickr-limited', filename: 'limited.jpg' }]
  });
  const waits = [];
  let attempts = 0;
  let archiveCalled = false;
  const throttleWorker = createAlbumZipWorker({
    jobs,
    max429Retries: 2,
    sleep: async ms => waits.push(ms),
    download: async () => {
      attempts += 1;
      const error = new Error('rate limited');
      error.response = { status: 429, headers: { 'retry-after': attempts === 1 ? '2' : '5' } };
      throw error;
    },
    createArchive: async () => { archiveCalled = true; }
  });
  await throttleWorker.processJob(throttled.id);
  assert.deepStrictEqual(waits, [2000, 5000]);
  assert.strictEqual(attempts, 3);
  assert.strictEqual(archiveCalled, false);
  const paused = await jobs.getJob(throttled.id);
  assert.strictEqual(paused.status, 'paused');
  assert.strictEqual(paused.photos[0].status, 'pending');
  assert.strictEqual(paused.photos[0].attempts, 3);
  assert.strictEqual(paused.retryAfterMs, 5000);
  assert.strictEqual(fs.existsSync(path.join(jobs.getJobDirectory(throttled.id), 'album.zip')), false);

  const gateway = await jobs.createJob({ albumId: 'album-4', estimatedBytes: 10, photos: [{ id: 'gateway', source: 'flickr-gateway', filename: 'gateway.jpg' }] });
  let gatewayAttempts = 0;
  const gatewayWorker = createAlbumZipWorker({
    jobs, sleep: async ms => waits.push(ms),
    download: async () => { gatewayAttempts += 1; if (gatewayAttempts === 1) { const e = new Error('bad gateway'); e.response = { status: 502, headers: {} }; throw e; } return Readable.from(['gateway']); },
    createArchive: async ({ destinationPath }) => fs.writeFileSync(destinationPath, 'ready')
  });
  await gatewayWorker.processJob(gateway.id);
  assert.strictEqual(gatewayAttempts, 2);
  assert.strictEqual((await jobs.getJob(gateway.id)).status, 'ready');

  console.log('album ZIP worker tests passed');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
