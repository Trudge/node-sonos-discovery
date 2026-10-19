'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
function getFavorites() {
    return this.getAnyPlayer().browseAll('FV:2');
}
module.exports = getFavorites;
