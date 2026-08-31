const assert = require('assert');
const { Readable } = require('stream');

const { createFlickrZipDownloader, FLICKR_BROWSER_USER_AGENT } = require('../photo-server/services/flickrZipDownloader');

async function main() {
  const sourceCalls = [];
  const httpCalls = [];
  const flickr = {
    async getPhotoInfo(id) {
      sourceCalls.push(id);
      return {
        id: '10',
        server: '1',
        secret: 'secret',
        originalsecret: 'original-secret',
        originalformat: 'jpg'
      };
    }
  };
  const axiosGet = async (url, options) => {
    httpCalls.push({ url, options });
    if (httpCalls.length < 3) {
      const error = new Error('CloudFront rejected source');
      error.response = { status: 502, headers: {} };
      throw error;
    }
    return { data: Readable.from(['jpeg']) };
  };
  const download = createFlickrZipDownloader({
    flickr,
    axiosGet,
    now: () => 123456,
    log: () => {}
  });
  const photo = { id: 'photo-1', source: 'flickr-1' };

  await assert.rejects(download({ photo, attempt: 0 }), error => error.response?.status === 502);
  await assert.rejects(download({ photo, attempt: 1 }), error => error.response?.status === 502);
  const stream = await download({ photo, attempt: 2 });
  assert.strictEqual(stream.read().toString(), 'jpeg');

  assert.deepStrictEqual(sourceCalls, ['flickr-1']);
  assert.deepStrictEqual(httpCalls.map(call => new URL(call.url).pathname), [
    '/1/10_original-secret_o.jpg',
    '/1/10_secret_k.jpg',
    '/1/10_secret_b.jpg'
  ]);
  assert.strictEqual(new Set(httpCalls.map(call => new URL(call.url).pathname)).size, 3);
  for (const call of httpCalls) {
    assert.strictEqual(new URL(call.url).searchParams.get('zip_retry'), '123456');
    assert.strictEqual(call.options.headers['User-Agent'], FLICKR_BROWSER_USER_AGENT);
    assert.match(call.options.headers.Accept, /image\/\*/);
    assert.strictEqual(call.options.responseType, 'stream');
  }

  console.log('Flickr ZIP downloader tests passed');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
