'use strict';
const EventEmitter = require('events').EventEmitter;
const util = require('util');
const request = require('./helpers/request');
const logger = require('./helpers/logger');
const DEFAULT_RETRY_INTERVAL = 5000;
const DEFAULT_SUBSCRIPTION_INTERVAL = 600;
const RETRIES_BEFORE_CONSIDERED_DEAD = 5;

function Subscriber(this: any, subscribeUrl: any, notificationUrl: any, _subscriptionInterval: any, _retryInterval: any) {
  const _this: any = this;
  let sid: any;
  let timer: any;
  let errorCount = 0;
  let disposed = false;

  // This is configurable just for testing purposes
  const subscriptionInterval = _subscriptionInterval || DEFAULT_SUBSCRIPTION_INTERVAL;
  const retryInterval = _retryInterval || DEFAULT_RETRY_INTERVAL;

  this.dispose = function dispose(this: any) {
    if (disposed) {
      return;
    }

    disposed = true;
    clearTimeout(timer);

    if (!sid) {
      return;
    }

    request({
      headers: {
        SID: sid
      },
      uri: subscribeUrl,
      method: 'UNSUBSCRIBE',
      type: 'stream'
    }).then(() => {
      logger.trace('successfully unsubscribed from', subscribeUrl);
    }).catch((e: any) => {
      logger.error(`unsubscribe from sid ${sid} failed`, e);
    });
  };

  function subscribe(this: any) {
    clearTimeout(timer);
    const headers: Record<string, string> = {
      TIMEOUT: `Second-${subscriptionInterval}`
    };

    if (sid) {
      headers.SID = sid;
    } else {
      headers.CALLBACK = `<${notificationUrl}>`;
      headers.NT = 'upnp:event';
    }

    request({
      headers,
      uri: subscribeUrl,
      method: 'SUBSCRIBE',
      type: 'stream'
    }).then((res: any) => {
      if (disposed) {
        return;
      }

      sid = res.headers.sid;
      timer = setTimeout(subscribe, subscriptionInterval * 500);
      errorCount = 0;
    }).catch((e: any) => {
      if (disposed) {
        return;
      }

      logger.warn(`resubscribing to sid ${sid} failed`, e);
      sid = null;
      errorCount++;
      timer = setTimeout(subscribe, retryInterval);
      if (errorCount === RETRIES_BEFORE_CONSIDERED_DEAD) {
        _this.emit('dead', `Endpoint has probably died`);
      }
    });
  }

  subscribe();
}

util.inherits(Subscriber, EventEmitter);

module.exports = Subscriber;
