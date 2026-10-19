'use strict';
const http = require('http');
const EventEmitter = require('events').EventEmitter;
const util = require('util');
const flow = require('xml-flow');
const Readable = require('stream').Readable;
const logger = require('./helpers/logger');

const LIST_TYPE = require('./types/list-type');
const lastUpdate: Record<string, any> = {};

function createStream(this: any, str: any) {
  let stream = new Readable();
  stream._read = function noop(this: any) {
  };

  stream.push(str);
  stream.push(null);
  return stream;
}

function parseTopology(this: any, text: any) {
  return new Promise((resolve: any, reject: any) => {

    let sax = flow(createStream(text), {
      preserveMarkup: flow.NEVER,
      useArrays: flow.SOMETIMES
    }
    );

    let zoneGroups: any[] = [];

    sax.on('tag:zonegroup', (group: any) => {
      if (Array.isArray(group.zonegroupmember)) {
        group.zonegroupmember = group.zonegroupmember.map((member: any) => (member.$attrs || member));
      } else if (group.zonegroupmember.$attrs) {
        group.zonegroupmember = group.zonegroupmember.$attrs;
      }

      zoneGroups.push(group);
    });

    sax.on('end', () => {
      resolve(zoneGroups);
    });

    sax.on('error', (e: any) => {
      reject(e);
    });
  });
}

function parseLastChange(this: any, text: any) {
  return new Promise((resolve: any, reject: any) => {

    let sax = flow(createStream(text));

    sax.on('tag:instanceid', (lastChange: any) => {
      resolve(lastChange);
    });

    sax.on('error', (e: any) => {
      reject(e);
    });
  });
}

function NotificationListener(this: any, localEndpoint: any) {
  const _this: any = this;
  let server: any;
  let listeningPort = 3500;

  this.endpoint = () => {
    return `http://${localEndpoint}:${listeningPort}/`;
  };

  this.dispose = () => {
    if (!server || !server.close) {
      return;
    }

    try {
      server.close();
    } catch (e) {
      logger.error('Failed to close notification listener', e);
    }

    server = undefined;
  };

  function init(this: any) {
    server = http.createServer(notificationHandler);
    server.listen(listeningPort);

    server.on('listening', () => {
      _this.emit('listening', listeningPort);
    });

    server.on('error', (e: any) => {
      if (e.code === 'EADDRINUSE') {
        server.listen(++listeningPort);
      }
    });
  }

  function notificationHandler(this: any, req: any, res: any) {
    req.on('end', () => {
      res.writeHead(200, 'OK');
      res.end();
    });

    if (req.method !== 'NOTIFY' || !req.headers || !req.headers.sid) {
      res.end();
      return;
    }

    const matches = req.headers.sid.match(/uuid:(.+)_sub/);

    if (!matches) {
      return;
    }

    let uuid = matches[1];

    let sax = flow(req, { useArrays: flow.NEVER });

    sax.on('tag:zonegroupstate', (property: any) => {
      logger.trace(property.$text);
      parseTopology(property.$text)
        .then((topology: any) => {
          _this.emit('topology', uuid, topology);
        });
    });

    sax.on('tag:lastchange', (property: any) => {
      logger.trace(property.$text);
      parseLastChange(property.$text)
        .then((lastChange: any) => {
          _this.emit('last-change', uuid, lastChange);
        });
    });

    sax.on('tag:groupmute', (property: any) => {
      logger.trace(property.$text);
      _this.emit('group-mute', uuid, property.$text);
    });

    sax.on('tag:savedqueuesupdateid', (property: any) => {
      logger.trace('tag:savedqueuesupdateid', property.$text);
      if (lastUpdate[LIST_TYPE.SAVED_QUEUES] !== property.$text) {
        lastUpdate[LIST_TYPE.SAVED_QUEUES] = property.$text;
        _this.emit('list-change', LIST_TYPE.SAVED_QUEUES);
      }
    });

    sax.on('tag:favoritesupdateid', (property: any) => {
      logger.trace('tag:favoritesupdateid', property.$text);
      if (lastUpdate[LIST_TYPE.FAVORITES] !== property.$text) {
        lastUpdate[LIST_TYPE.FAVORITES] = property.$text;
        _this.emit('list-change', LIST_TYPE.FAVORITES);
      }
    });

    sax.on('tag:containerupdateids', (property: any) => {
      logger.trace('tag:containerupdateids', property.$text);
      if (property.$text && property.$text.indexOf('Q:0') !== -1) {
        _this.emit('queue-change', uuid);
      }

      if (property.$text && property.$text.indexOf('AI:') !== -1) {
        _this.emit('list-change', LIST_TYPE.INPUTS);
      }
    });
  }

  init();
}

util.inherits(NotificationListener, EventEmitter);

module.exports = NotificationListener;
