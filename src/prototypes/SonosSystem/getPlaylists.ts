'use strict';

function getPlaylists(this: any) {
  return this.getAnyPlayer().browseAll('SQ:');
}

module.exports = getPlaylists;
