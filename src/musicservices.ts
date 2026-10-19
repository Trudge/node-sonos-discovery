'use strict';
const requireDir = require('./helpers/require-dir');
const services: Record<string, any> = {};
const logger = require('./helpers/logger');

requireDir(__dirname + '/services', (register: any) => {
  register(services);
});

function getServiceId(this: any, uri: any) {
  const matches = /sid=(\d+)/.exec(uri);
  if (matches) {
    return matches[1];
  }
}

function tryGetHighResArt(this: any, uri: any) {
  if (uri.startsWith('http')) return Promise.resolve(uri);

  let serviceId = getServiceId(uri);

  if (!serviceId || !services[serviceId]) {
    logger.debug('No such service', uri);
    return Promise.reject('No such service');
  }

  let service = services[serviceId];

  return service.tryGetHighResArt(uri);

}

module.exports = {
  tryGetHighResArt
};
