const assert = require('assert');

const { asyncRoute } = require('../photo-server/services/asyncRoute');

async function captureNext(handler) {
  return new Promise(resolve => handler({}, {}, resolve));
}

async function main() {
  const asyncError = new Error('async failure');
  const syncError = new Error('sync failure');

  assert.strictEqual(await captureNext(asyncRoute(async () => { throw asyncError; })), asyncError);
  assert.strictEqual(await captureNext(asyncRoute(() => { throw syncError; })), syncError);

  console.log('async route tests passed');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
