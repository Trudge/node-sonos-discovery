'use strict';

function getFavorites(this: any) {
  return this.getAnyPlayer().browseAll('FV:2');
}

module.exports = getFavorites;
