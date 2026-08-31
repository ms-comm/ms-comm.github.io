const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { PassThrough } = require('stream');

const { createZipArchive } = require('../photo-server/services/zipArchive');

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zip-archive-'));
  const source = path.join(root, 'photo.jpg');
  const destination = path.join(root, 'album.zip');
  fs.writeFileSync(source, 'jpeg bytes');

  await createZipArchive({
    files: [{ path: source, filename: 'photo.jpg' }],
    destinationPath: destination
  });
  assert.ok(fs.statSync(destination).size > 0);

  const warning = new Error('source disappeared');
  warning.code = 'ENOENT';
  const fakeArchive = new PassThrough();
  fakeArchive.file = () => {};
  fakeArchive.finalize = async () => { process.nextTick(() => fakeArchive.emit('warning', warning)); };

  await assert.rejects(
    createZipArchive({
      files: [{ path: source, filename: 'photo.jpg' }],
      destinationPath: path.join(root, 'warning.zip'),
      archiverFactory: () => fakeArchive,
      outputFactory: () => new PassThrough()
    }),
    error => error === warning
  );

  console.log('ZIP archive tests passed');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
