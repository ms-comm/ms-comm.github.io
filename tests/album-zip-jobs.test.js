const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createAlbumZipJobs } = require('../photo-server/services/albumZipJobs');

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'album-zip-jobs-'));
  let nowMs = Date.parse('2026-08-31T10:00:00.000Z');
  let sequence = 0;
  const options = {
    dataDir: root,
    maxJobBytes: 1000,
    readyTtlMs: 60 * 60 * 1000,
    abandonedTtlMs: 30 * 60 * 1000,
    now: () => nowMs,
    randomId: () => `job-${++sequence}`,
    randomToken: () => `token-${sequence}`
  };
  const jobs = createAlbumZipJobs(options);

  const created = await jobs.createJob({
    albumId: 'album-private',
    policy: 'private',
    mode: 'watermark',
    estimatedBytes: 600,
    photos: [
      { id: 'photo-1', source: 'watermark-1', filename: 'one.jpg' },
      { id: 'photo-2', source: 'watermark-2', filename: 'two.jpg' }
    ]
  });
  assert.strictEqual(created.id, 'job-1');
  assert.strictEqual(created.status, 'queued');
  assert.strictEqual(created.downloadToken, 'token-1');
  assert.strictEqual((await jobs.findReusableJob({ albumId: 'album-private', mode: 'watermark', policy: 'private', photos: created.photos })).id, 'job-1');
  assert.strictEqual(await jobs.findReusableJob({
    albumId: 'album-private',
    mode: 'watermark',
    policy: 'private-watermark',
    photos: created.photos.map(photo => ({ ...photo, source: `${photo.source}-strict` }))
  }), null);
  assert.deepStrictEqual(created.photos.map(photo => photo.status), ['pending', 'pending']);

  const reloaded = createAlbumZipJobs(options);
  assert.strictEqual((await reloaded.getJob('job-1')).albumId, 'album-private');
  const legacyFile = path.join(root, 'db', 'album-zip-jobs.json');
  const legacyData = JSON.parse(fs.readFileSync(legacyFile, 'utf8'));
  delete legacyData['job-1'].dedupeKey;
  fs.writeFileSync(legacyFile, JSON.stringify(legacyData));
  assert.strictEqual((await reloaded.findReusableJob({ albumId: 'album-private', mode: 'watermark', policy: 'private', photos: created.photos })).id, 'job-1');

  await assert.rejects(
    jobs.createJob({ albumId: 'missing-source', mode: 'watermark', policy: 'private-watermark', photos: [{ id: 'unsafe', filename: 'unsafe.jpg' }] }),
    error => error && error.code === 'ZIP_JOB_SOURCE_MISSING'
  );

  await jobs.markPhotoDownloading('job-1', 'photo-1');
  await jobs.markPhotoComplete('job-1', 'photo-1', { path: 'photos/one.jpg', sizeBytes: 123 });
  const checkpointed = await jobs.getJob('job-1');
  assert.strictEqual(checkpointed.status, 'running');
  assert.deepStrictEqual(checkpointed.photos[0], {
    id: 'photo-1',
    source: 'watermark-1',
    filename: 'one.jpg',
    status: 'complete',
    attempts: 0,
    path: 'photos/one.jpg',
    sizeBytes: 123,
    completedAt: '2026-08-31T10:00:00.000Z'
  });

  await jobs.pauseForRateLimit('job-1', {
    photoId: 'photo-2',
    retryAfterMs: 120000,
    attempts: 3,
    message: 'Flickr 429'
  });
  const paused = await jobs.getJob('job-1');
  assert.strictEqual(paused.status, 'paused');
  assert.strictEqual(paused.pauseReason, 'flickr-429');
  assert.strictEqual(paused.retryAfterMs, 120000);
  assert.strictEqual(paused.resumeAt, '2026-08-31T10:02:00.000Z');
  assert.strictEqual(paused.photos[1].attempts, 3);

  await assert.rejects(
    jobs.createJob({ albumId: 'too-large', estimatedBytes: 1001, photos: [] }),
    error => error && error.code === 'ZIP_JOB_BUDGET_EXCEEDED'
  );

  await jobs.markPhotoDownloading('job-1', 'photo-2');
  await jobs.markPhotoComplete('job-1', 'photo-2', { path: 'photos/two.jpg', sizeBytes: 321 });
  const ready = await jobs.markReady('job-1', { zipPath: 'album.zip', sizeBytes: 444 });
  assert.strictEqual(ready.status, 'ready');
  assert.strictEqual(ready.expiresAt, '2026-08-31T11:00:00.000Z');
  assert.strictEqual((await jobs.findReusableJob({ albumId: 'album-private', mode: 'watermark', policy: 'private', photos: created.photos })).id, 'job-1');

  const jobDir = jobs.getJobDirectory('job-1');
  fs.mkdirSync(jobDir, { recursive: true });
  fs.writeFileSync(path.join(jobDir, 'album.zip'), 'temporary zip');
  nowMs += 60 * 60 * 1000 + 1;
  assert.strictEqual(await jobs.findReusableJob({ albumId: 'album-private', mode: 'watermark', policy: 'private', photos: created.photos }), null);
  const cleanup = await jobs.cleanup();
  assert.deepStrictEqual(cleanup.removedJobIds, ['job-1']);
  assert.strictEqual(await jobs.getJob('job-1'), null);
  assert.strictEqual(fs.existsSync(jobDir), false);

  const retryable = await jobs.createJob({
    albumId: 'album-retry',
    mode: 'watermark',
    policy: 'private',
    estimatedBytes: 20,
    photos: [
      { id: 'kept', source: 'flickr-kept', filename: 'kept.jpg' },
      { id: 'failed', source: 'flickr-failed', filename: 'failed.jpg' }
    ]
  });
  await jobs.markPhotoDownloading(retryable.id, 'kept');
  await jobs.markPhotoComplete(retryable.id, 'kept', { path: 'photos/kept.jpg', sizeBytes: 10 });
  await jobs.markFailed(retryable.id, 'Échec après 3 tentatives', {
    photoId: 'failed',
    attempts: 3,
    status: 502
  });
  assert.strictEqual((await jobs.findReusableJob({
    albumId: 'album-retry',
    mode: 'watermark',
    policy: 'private',
    photos: retryable.photos
  })).status, 'failed');

  const manualRetry = await jobs.retryFailedJob(retryable.id);
  assert.strictEqual(manualRetry.status, 'queued');
  assert.strictEqual(manualRetry.error, undefined);
  assert.strictEqual(manualRetry.photos[0].status, 'complete');
  assert.strictEqual(manualRetry.photos[1].status, 'pending');
  assert.strictEqual(manualRetry.photos[1].attempts, 0);

  await jobs.markFailed(retryable.id, 'Toujours indisponible', {
    photoId: 'failed',
    attempts: 3,
    status: 502
  });
  nowMs += options.abandonedTtlMs + 1;
  assert.strictEqual(await jobs.findReusableJob({
    albumId: 'album-retry',
    mode: 'watermark',
    policy: 'private',
    photos: retryable.photos
  }), null);

  const archiving = await jobs.createJob({
    albumId: 'album-archive',
    mode: 'watermark',
    policy: 'public',
    photos: [{ id: 'archive-photo', source: 'flickr-archive', filename: 'archive.jpg' }]
  });
  await jobs.markArchiving(archiving.id);
  nowMs += options.abandonedTtlMs - 1;
  await jobs.touch(archiving.id);
  nowMs += options.abandonedTtlMs - 1;
  assert.strictEqual((await jobs.cleanup()).removedJobIds.includes(archiving.id), false);
  assert.strictEqual((await jobs.getJob(archiving.id)).status, 'archiving');

  console.log('album ZIP jobs tests passed');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
