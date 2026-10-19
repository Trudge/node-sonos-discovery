'use strict';

function refreshShareIndex(this: any) {
  let player = this.getAnyPlayer();
  return player.refreshShareIndex();
}

module.exports = refreshShareIndex;
