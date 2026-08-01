const assert = require('assert');

function optionalRequire(path) {
  try {
    return require(path);
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') return {};
    throw error;
  }
}

const serverPolicy = optionalRequire('../photo-server/services/albumAccess.js');
const browserPolicy = optionalRequire('../assets/js/album-access.js');

assert.strictEqual(typeof serverPolicy.isCodeProtectedAlbum, 'function');
assert.strictEqual(typeof serverPolicy.isHiddenAlbum, 'function');
assert.strictEqual(typeof serverPolicy.isPrivateStorageAlbum, 'function');
assert.strictEqual(typeof serverPolicy.hasValidAlbumCode, 'function');
assert.strictEqual(typeof serverPolicy.allowsOriginalDownload, 'function');
assert.strictEqual(typeof serverPolicy.selectFlickrPhotoId, 'function');
assert.strictEqual(typeof serverPolicy.resolveAlbumAccess, 'function');
assert.strictEqual(typeof serverPolicy.needsPrivateStorageTransition, 'function');
assert.strictEqual(typeof serverPolicy.resolveAlbumCode, 'function');
assert.strictEqual(typeof serverPolicy.selectPrivacyTransitionPhotos, 'function');

const originalPrivate = { type: 'private', code: 'ABC123' };
const watermarkPrivate = { type: 'private-watermark', code: 'WM1234' };
const hiddenPrivate = { type: 'private-nocode', code: null };
const publicAlbum = { type: 'public', code: null };

assert.strictEqual(serverPolicy.isCodeProtectedAlbum(originalPrivate), true);
assert.strictEqual(serverPolicy.isCodeProtectedAlbum(watermarkPrivate), true);
assert.strictEqual(serverPolicy.isCodeProtectedAlbum(hiddenPrivate), false);
assert.strictEqual(serverPolicy.isHiddenAlbum(originalPrivate), true);
assert.strictEqual(serverPolicy.isHiddenAlbum(watermarkPrivate), true);
assert.strictEqual(serverPolicy.isHiddenAlbum(hiddenPrivate), true);
assert.strictEqual(serverPolicy.isHiddenAlbum(publicAlbum), false);
assert.strictEqual(serverPolicy.isPrivateStorageAlbum(watermarkPrivate), true);
assert.strictEqual(serverPolicy.hasValidAlbumCode(watermarkPrivate, 'wm1234'), true);
assert.strictEqual(serverPolicy.hasValidAlbumCode(watermarkPrivate, 'wrong'), false);
assert.strictEqual(serverPolicy.hasValidAlbumCode(hiddenPrivate, ''), false);
assert.strictEqual(serverPolicy.allowsOriginalDownload(originalPrivate), true);
assert.strictEqual(serverPolicy.allowsOriginalDownload(watermarkPrivate), false);

assert.deepStrictEqual(serverPolicy.resolveAlbumAccess(watermarkPrivate, ''), {
  requiresCode: true,
  hasCodeAccess: false,
  canAccess: false,
  strictWatermark: false,
  canDownloadOriginal: false
});
assert.deepStrictEqual(serverPolicy.resolveAlbumAccess(watermarkPrivate, 'WM1234'), {
  requiresCode: true,
  hasCodeAccess: true,
  canAccess: true,
  strictWatermark: true,
  canDownloadOriginal: false
});
assert.strictEqual(serverPolicy.resolveAlbumAccess(originalPrivate, 'ABC123').canDownloadOriginal, true);
assert.strictEqual(serverPolicy.resolveAlbumAccess(publicAlbum, '').canAccess, true);

assert.strictEqual(serverPolicy.needsPrivateStorageTransition(publicAlbum, watermarkPrivate), true);
assert.strictEqual(serverPolicy.needsPrivateStorageTransition(originalPrivate, watermarkPrivate), false);
assert.strictEqual(serverPolicy.needsPrivateStorageTransition(watermarkPrivate, publicAlbum), false);

const generateCode = () => 'NEW123';
assert.strictEqual(serverPolicy.resolveAlbumCode('private-watermark', '', null, generateCode), 'NEW123');
assert.strictEqual(serverPolicy.resolveAlbumCode('private-watermark', undefined, 'KEEP12', generateCode), 'KEEP12');
assert.strictEqual(serverPolicy.resolveAlbumCode('public', 'IGNORED', 'OLD123', generateCode), null);

const transitionPhotos = serverPolicy.selectPrivacyTransitionPhotos([
  { id: 'active', albumId: 'album-1', deletedAt: null },
  { id: 'trash', albumId: 'album-1', deletedAt: '2026-08-01T00:00:00.000Z' },
  { id: 'other', albumId: 'album-2', deletedAt: null }
], 'album-1');
assert.deepStrictEqual(transitionPhotos.remotePhotos.map(photo => photo.id), ['active', 'trash']);
assert.deepStrictEqual(transitionPhotos.activePhotos.map(photo => photo.id), ['active']);

const bothCopies = { flickrOriginalId: 'original-id', flickrWatermarkId: 'watermark-id' };
const originalOnly = { flickrOriginalId: 'original-id', flickrWatermarkId: null };
assert.strictEqual(serverPolicy.selectFlickrPhotoId(bothCopies, 'original', false), 'original-id');
assert.strictEqual(serverPolicy.selectFlickrPhotoId(bothCopies, 'watermark', true), 'watermark-id');
assert.strictEqual(serverPolicy.selectFlickrPhotoId(originalOnly, 'watermark', true), null);
assert.strictEqual(serverPolicy.selectFlickrPhotoId(originalOnly, 'watermark', false), 'original-id');

assert.strictEqual(typeof browserPolicy.isCodeProtectedAlbumType, 'function');
assert.strictEqual(typeof browserPolicy.allowsOriginalAlbumDownload, 'function');
assert.strictEqual(typeof browserPolicy.albumDownloadModes, 'function');
assert.strictEqual(typeof browserPolicy.canRequestAlbumDownload, 'function');
assert.deepStrictEqual(browserPolicy.albumDownloadModes('private'), ['watermark', 'original']);
assert.deepStrictEqual(browserPolicy.albumDownloadModes('private-watermark'), ['watermark']);
assert.strictEqual(browserPolicy.canRequestAlbumDownload('private-watermark', 'watermark'), true);
assert.strictEqual(browserPolicy.canRequestAlbumDownload('private-watermark', 'original'), false);
assert.strictEqual(browserPolicy.canRequestAlbumDownload('private', 'original'), true);

console.log('private-watermark album tests passed');
