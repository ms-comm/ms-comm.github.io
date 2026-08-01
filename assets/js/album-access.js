(function initAlbumAccess(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MSAlbumAccess = api;
})(typeof window !== 'undefined' ? window : globalThis, function createAlbumAccess() {
  function isCodeProtectedAlbumType(type) {
    return type === 'private' || type === 'private-watermark';
  }

  function allowsOriginalAlbumDownload(type) {
    return type === 'private';
  }

  function albumDownloadModes(type) {
    return allowsOriginalAlbumDownload(type)
      ? ['watermark', 'original']
      : ['watermark'];
  }

  function canRequestAlbumDownload(type, mode) {
    return albumDownloadModes(type).includes(mode);
  }

  return {
    isCodeProtectedAlbumType,
    allowsOriginalAlbumDownload,
    albumDownloadModes,
    canRequestAlbumDownload
  };
});
