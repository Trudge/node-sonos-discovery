'use strict';
const logger = require('../../helpers/logger');

function isRadio(this: any, uri: any) {
  return uri.startsWith('x-sonosapi-stream:') ||
    uri.startsWith('x-sonosapi-radio:') ||
    uri.startsWith('pndrradio:') ||
    uri.startsWith('x-sonosapi-hls:') ||
    uri.startsWith('x-sonosprog-http:');
}

function replaceWithFavorite(this: any, favoriteName: any) {
  logger.debug(`replacing with favorite ${favoriteName}`);
  return this.system.getFavorites()
    .then((favorites: any) => {
      logger.debug(`found favorites`, favorites.map((x: any) => x.title));
      return favorites.find((fav: any) => fav.title.toLowerCase() === favoriteName.toLowerCase() || fav.uri.toLowerCase() === favoriteName.toLowerCase());
    })
    .then((favorite: any) => {
      if (!favorite) {
        throw new Error('Favorite not found');
      }

      if (isRadio(favorite.uri)) {
        logger.debug(`favorite is radiostation`);
        return favorite;
      }

      logger.debug('clearing queue');
      return this.clearQueue()
        .then(() => logger.debug(`Adding ${favorite.uri} to queue with metadata ${favorite.metadata}`))
        .then(() => this.addURIToQueue(favorite.uri, favorite.metadata))
        .then(() => logger.debug(`triggering queue mode`))
        .then(() => {
          return { uri: `x-rincon-queue:${this.uuid}#0` };
        });
    })
    .then((favorite: any) => {
      logger.debug(`setting AVTransport to ${favorite.uri} with metadata ${favorite.metadata}`);
      if (this.avTransportUri === favorite.uri) {
        logger.debug(`already has ${favorite.uri} as AVTransport, skipping`);
        return;
      }

      return this.setAVTransport(favorite.uri, favorite.metadata);
    });
}

module.exports = replaceWithFavorite;
