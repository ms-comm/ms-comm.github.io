const assert = require('assert');
const { shouldAbortArchive } = require('../photo-server/services/zipDownloadPolicy');

assert.strictEqual(shouldAbortArchive({ requestAborted: false, responseFinished: false, archiveFinalizing: true }), false);
assert.strictEqual(shouldAbortArchive({ requestAborted: true, responseFinished: false, archiveFinalizing: true }), false);
assert.strictEqual(shouldAbortArchive({ requestAborted: true, responseFinished: false, archiveFinalizing: false }), true);
console.log('zip download policy tests passed');
