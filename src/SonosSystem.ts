'use strict';
const path = require('path');
const util = require('util');
const requireDir = require('./helpers/require-dir');
const ssdp = require('./sonos-ssdp');
const request = require('./helpers/request');
const NotificationListener = require('./NotificationListener');
const Player = require('./models/Player');
const Subscriber = require('./Subscriber');
const EventEmitter = require('events').EventEmitter;
const soap = require('./helpers/soap');
const parseServices = require('./helpers/parse-services');
const UnknownServiceError = require('./errors/unknown-service');
const logger = require('./helpers/logger');

const RETRY_BASE_DELAY = 1000;
const RETRY_MAX_DELAY = 60000;
const DISCOVERY_RESTART_DELAY = 30000;

function isVisible(this: any, member: any) {
  // If a member has the attribute invisible == 1, it is either a
  // BRIDGE, BOOST, SUB or a right channel stereo pair
  if (Array.isArray(member)) {
    return member.some(x => x.invisible !== '1');
  }

  return member.invisible !== '1';
}

function SonosSystem(this: any, settings: any) {
  settings = Object.assign({}, settings);
  const _this: any = this;
  let listener: any;
  let playerCache: Record<string, any> = {};
  let subCache: Record<string, any> = {};
  let initFailures = 0;
  let discoveryRestartTimer: any;
  restart();

  function clearDiscoveryRestart(this: any) {
    clearTimeout(discoveryRestartTimer);
    discoveryRestartTimer = undefined;
  }

  function scheduleDiscoveryRestart(this: any) {
    if (discoveryRestartTimer) {
      return;
    }

    discoveryRestartTimer = setTimeout(() => {
      discoveryRestartTimer = undefined;

      if (_this.zones.length === 0) {
        logger.warn('No Sonos players discovered, restarting discovery');
        restart();
      }
    }, DISCOVERY_RESTART_DELAY);

    // Do not keep the process alive just to run a recovery scan.
    if (discoveryRestartTimer.unref) {
      discoveryRestartTimer.unref();
    }
  }

  _this.cancelDiscoveryRestart = clearDiscoveryRestart;

  function queueChange(this: any, uuid: any) {
    let player = _this.getPlayerByUUID(uuid);
    if (player && player.uuid) {
      _this.emit('queue-change', player);
    }
  }

  function listChange(this: any, type: any) {
    _this.emit('list-change', type);
  }

  function tryGet(this: any, cache: any, Type: any, member: any) {
    if (cache[member.uuid]) {
      return cache[member.uuid];
    }

    cache[member.uuid] = new Type(member, listener, _this);

    const channelMapSet = member.channelmapset || member.htsatchanmapset;
    cache[member.uuid].hasSub = /:SW/.test(channelMapSet);

    return cache[member.uuid];
  }

  function getPlayers(this: any, members: any) {
    if (members instanceof Array === false) {
      // single item
      const player = tryGet(playerCache, Player, members);
      return [player];
    }

    // Find normal players
    let players = members
      .filter((member: any) => {
        return isVisible(member);
      })
      .map((member: any) => {
        return tryGet(playerCache, Player, member);
      });

    return players;
  }

  function topologyChange(this: any, uuid: any, topology: any) {
    let players: any[] = [];

    let zones = topology
      .filter((zone: any) => {
        return isVisible(zone.zonegroupmember);
      })
      .map((zone: any) => {
        let members = getPlayers(zone.zonegroupmember);
        Array.prototype.push.apply(players, members);

        // fix coordinator for members
        let coordinator = playerCache[zone.$attrs.coordinator];
        members.forEach((member: any) => {
          member.coordinator = coordinator;
        });

        return {
          coordinator,
          members,
          uuid: zone.$attrs.coordinator,
          id: zone.$attrs.id
        };
      });

    _this.zones = zones;
    _this.players = players;

    if (_this.zones.length === 0) {
      // All players are offline or invisible. Nothing may ever notify us
      // again if the player we subscribed to is the one that went away, so
      // arrange a fresh discovery scan instead of waiting indefinitely.
      scheduleDiscoveryRestart();
    } else {
      clearDiscoveryRestart();
    }

    _this.emit('topology-change', zones);

    // Update available services
    const anyPlayer = _this.getAnyPlayer();
    if (!anyPlayer) {
      // The refreshed topology contains no visible player (e.g. it was
      // updated while all speakers were offline), so there is nothing to
      // query. Return early; the next topology update will retry.
      return;
    }

    soap.invoke(`${anyPlayer.baseUrl}/MusicServices/Control`, soap.TYPE.ListAvailableServices)
      .then(soap.parse)
      .then(parseServices)
      .then((availableServices: any) => {
        if (!Object.keys(_this.availableServices).length) {
          setImmediate(() => _this.emit('initialized'));
        }

        _this.availableServices = availableServices;
      });
  }

  function init(this: any, info: any) {
    if (settings.household && info.household !== settings.household) {
      ssdp.once('found', init);
      return;
    }

    ssdp.stop();

    request({
      uri: info.location,
      method: 'GET',
      type: 'stream'
    })
      .then((res: any) => {
        initFailures = 0;
        _this.localEndpoint = res.socket.address().address;
        listener = new NotificationListener(_this.localEndpoint);
        listener.on('queue-change', queueChange);
        listener.on('list-change', listChange);
        listener.on('topology', topologyChange);
        listener.on('listening', (port: any) => {
          logger.debug(`Subscribing to player ${info.ip} for topology events`);
          _this.subscriber = new Subscriber(`http://${info.ip}:1400/ZoneGroupTopology/Event`, listener.endpoint());
          _this.subscriber.once('dead', (err: any) => {
            logger.error(err);
            restart();
          });
        });
      })
      .catch((e: any) => {
        initFailures += 1;
        const delay = Math.min(RETRY_BASE_DELAY * Math.pow(2, initFailures - 1), RETRY_MAX_DELAY);
        console.error(e);

        // The device that answered the SSDP query is unreachable or went
        // offline while fetching its description. Discovery was already
        // stopped above, so start it again to keep looking. Back off
        // exponentially (up to a fixed ceiling) so a misbehaving player
        // cannot keep the process in a tight retry loop.
        setTimeout(restart, delay);
      });
  }

  function restart(this: any) {
    clearDiscoveryRestart();
    ssdp.stop();

    if (_this.subscriber) {
      _this.subscriber.dispose();
      _this.subscriber = undefined;
    }

    if (listener && listener.dispose) {
      listener.dispose();
    }

    _this.localEndpoint = '0.0.0.0';
    _this.players = [];
    _this.zones = [];
    _this.availableServices = {};
    listener = undefined;
    playerCache = {};
    subCache = {};
    ssdp.start();
    ssdp.once('found', init);
    scheduleDiscoveryRestart();
  }
}

// This needs to be before all prototype methods!
util.inherits(SonosSystem, EventEmitter);

SonosSystem.prototype.getPlayer = function getPlayer(this: any, name: any) {
  return this.players.find((player: any) => player.roomName.toLowerCase() === name.toLowerCase());
};

SonosSystem.prototype.getPlayerByUUID = function getPlayerByUUID(this: any, uuid: any) {
  return this.players.find((player: any) => player.uuid === uuid);
};

let playerIndex = 0;

SonosSystem.prototype.getAnyPlayer = function getAnyPlayer(this: any) {
  return this.players[playerIndex++ % this.players.length];
};

SonosSystem.prototype.dispose = function dispose(this: any) {
  if (this.cancelDiscoveryRestart) this.cancelDiscoveryRestart();
  if (this.subscriber && this.subscriber.dispose) this.subscriber.dispose();
  this.players.forEach((player: any) => {
    if (player.sub && player.sub.dispose) player.sub.dispose();
    if (player.dispose) player.dispose();
  });
};

SonosSystem.prototype.getServiceId = function getServiceId(this: any, serviceName: any) {
  if (!this.availableServices[serviceName]) {
    throw new UnknownServiceError(serviceName);
  }

  return this.availableServices[serviceName].id;
};

SonosSystem.prototype.getServiceType = function getServiceType(this: any, serviceName: any) {
  if (!this.availableServices[serviceName]) {
    throw new UnknownServiceError(serviceName);
  }

  return this.availableServices[serviceName].type;
};

requireDir(path.join(__dirname, '/prototypes/SonosSystem'), (proto: any) => {
  SonosSystem.prototype[proto.name] = proto;
});

module.exports = SonosSystem;
