'use strict';
import request = require('./request');
import logger = require('./logger');
import flow = require('xml-flow');
import ArgumentError = require('../errors/argument');

// disable long line check
/* jshint -W101 */
const TYPE: Record<string, string> = Object.freeze({
  SetEQ: 'urn:schemas-upnp-org:service:RenderingControl:1#SetEQ',
  Play: 'urn:schemas-upnp-org:service:AVTransport:1#Play',
  Pause: 'urn:schemas-upnp-org:service:AVTransport:1#Pause',
  Stop: 'urn:schemas-upnp-org:service:AVTransport:1#Stop',
  Next: 'urn:schemas-upnp-org:service:AVTransport:1#Next',
  Previous: 'urn:schemas-upnp-org:service:AVTransport:1#Previous',
  Mute: 'urn:schemas-upnp-org:service:RenderingControl:1#SetMute',
  GroupMute: 'urn:schemas-upnp-org:service:GroupRenderingControl:1#SetGroupMute',
  Volume: 'urn:schemas-upnp-org:service:RenderingControl:1#SetVolume',
  Seek: 'urn:schemas-upnp-org:service:AVTransport:1#Seek',
  RemoveAllTracksFromQueue: 'urn:schemas-upnp-org:service:AVTransport:1#RemoveAllTracksFromQueue',
  RemoveTrackFromQueue: 'urn:schemas-upnp-org:service:AVTransport:1#RemoveTrackFromQueue',
  RemoveTrackRangeFromQueue: 'urn:schemas-upnp-org:service:AVTransport:1#RemoveTrackRangeFromQueue',
  ReorderTracksInQueue: 'urn:schemas-upnp-org:service:AVTransport:1#ReorderTracksInQueue',
  SaveQueue: 'urn:schemas-upnp-org:service:AVTransport:1#SaveQueue',
  SetPlayMode: 'urn:schemas-upnp-org:service:AVTransport:1#SetPlayMode',
  SetCrossfadeMode: 'urn:schemas-upnp-org:service:AVTransport:1#SetCrossfadeMode',
  GetPositionInfo: 'urn:schemas-upnp-org:service:AVTransport:1#GetPositionInfo',
  ConfigureSleepTimer: 'urn:schemas-upnp-org:service:AVTransport:1#ConfigureSleepTimer',
  SetAVTransportURI: 'urn:schemas-upnp-org:service:AVTransport:1#SetAVTransportURI',
  Browse: 'urn:schemas-upnp-org:service:ContentDirectory:1#Browse',
  BecomeCoordinatorOfStandaloneGroup: 'urn:schemas-upnp-org:service:AVTransport:1#BecomeCoordinatorOfStandaloneGroup',
  RefreshShareIndex: 'urn:schemas-upnp-org:service:ContentDirectory:1#RefreshShareIndex',
  AddURIToQueue: 'urn:schemas-upnp-org:service:AVTransport:1#AddURIToQueue',
  AddMultipleURIsToQueue: 'urn:schemas-upnp-org:service:AVTransport:1#AddMultipleURIsToQueue',
  ListAvailableServices: 'urn:schemas-upnp-org:service:MusicServices:1#ListAvailableServices',
  SetTreble: 'urn:schemas-upnp-org:service:RenderingControl:1#SetTreble',
  SetBass: 'urn:schemas-upnp-org:service:RenderingControl:1#SetBass',
});

const TEMPLATES: Record<string, string> = Object.freeze({
  [TYPE.SetEQ]: '<u:SetEQ xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1"><InstanceID>0</InstanceID><EQType>{eqType}</EQType><DesiredValue>{value}</DesiredValue></u:SetEQ>',
  [TYPE.Play]: '<u:Play xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><Speed>1</Speed></u:Play>',
  [TYPE.Pause]: '<u:Pause xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID></u:Pause>',
  [TYPE.Stop]: '<u:Stop xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID></u:Stop>',
  [TYPE.Next]: '<u:Next xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID></u:Next>',
  [TYPE.Previous]: '<u:Previous xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID></u:Previous>',
  [TYPE.Mute]: '<u:SetMute xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1"><InstanceID>0</InstanceID><Channel>Master</Channel><DesiredMute>{mute}</DesiredMute></u:SetMute>',
  [TYPE.GroupMute]: '<u:SetGroupMute xmlns:u="urn:schemas-upnp-org:service:GroupRenderingControl:1"><InstanceID>0</InstanceID><Channel>Master</Channel><DesiredMute>{mute}</DesiredMute></u:SetGroupMute>',
  [TYPE.Volume]: '<u:SetVolume xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1"><InstanceID>0</InstanceID><Channel>Master</Channel><DesiredVolume>{volume}</DesiredVolume></u:SetVolume>',
  [TYPE.Seek]: '<u:Seek xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><Unit>{unit}</Unit><Target>{value}</Target></u:Seek>',
  [TYPE.RemoveAllTracksFromQueue]: '<u:RemoveAllTracksFromQueue xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID></u:RemoveAllTracksFromQueue>',
  [TYPE.RemoveTrackFromQueue]: '<u:RemoveTrackFromQueue xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><ObjectID>Q:0/{track}</ObjectID></u:RemoveTrackFromQueue>',
  [TYPE.RemoveTrackRangeFromQueue]: '<u:RemoveTrackRangeFromQueue xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><UpdateID>0</UpdateID><StartingIndex>{startIndex}</StartingIndex><NumberOfTracks>{numberOfTracks}</NumberOfTracks></u:RemoveTrackRangeFromQueue>',
  [TYPE.ReorderTracksInQueue]: '<u:ReorderTracksInQueue xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><UpdateID>0</UpdateID><StartingIndex>{startIndex}</StartingIndex><NumberOfTracks>{numberOfTracks}</NumberOfTracks><InsertBefore>{insertBefore}</InsertBefore></u:ReorderTracksInQueue>',
  [TYPE.SaveQueue]: '<u:SaveQueue xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><Title>{title}</Title><ObjectID></ObjectID></u:SaveQueue>',
  [TYPE.SetPlayMode]: '<u:SetPlayMode xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><NewPlayMode>{playMode}</NewPlayMode></u:SetPlayMode>',
  [TYPE.SetCrossfadeMode]: '<u:SetCrossfadeMode xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><CrossfadeMode>{crossfadeMode}</CrossfadeMode></u:SetCrossfadeMode>',
  [TYPE.GetPositionInfo]: '<u:GetPositionInfo xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID></u:GetPositionInfo>',
  [TYPE.ConfigureSleepTimer]: '<u:ConfigureSleepTimer xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><NewSleepTimerDuration>{time}</NewSleepTimerDuration></u:ConfigureSleepTimer>',
  [TYPE.SetAVTransportURI]: '<u:SetAVTransportURI xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><CurrentURI>{uri}</CurrentURI><CurrentURIMetaData>{metadata}</CurrentURIMetaData></u:SetAVTransportURI>',
  [TYPE.Browse]: '<u:Browse xmlns:u="urn:schemas-upnp-org:service:ContentDirectory:1"><ObjectID>{objectId}</ObjectID><BrowseFlag>BrowseDirectChildren</BrowseFlag><Filter /><StartingIndex>{startIndex}</StartingIndex><RequestedCount>{limit}</RequestedCount><SortCriteria /></u:Browse>',
  [TYPE.BecomeCoordinatorOfStandaloneGroup]: '<u:BecomeCoordinatorOfStandaloneGroup xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID></u:BecomeCoordinatorOfStandaloneGroup>',
  [TYPE.RefreshShareIndex]: '<u:RefreshShareIndex xmlns:u="urn:schemas-upnp-org:service:ContentDirectory:1"><AlbumArtistDisplayOption></AlbumArtistDisplayOption></u:RefreshShareIndex>',
  [TYPE.AddURIToQueue]: '<u:AddURIToQueue xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><EnqueuedURI>{uri}</EnqueuedURI><EnqueuedURIMetaData>{metadata}</EnqueuedURIMetaData><DesiredFirstTrackNumberEnqueued>{desiredFirstTrackNumberEnqueued}</DesiredFirstTrackNumberEnqueued><EnqueueAsNext>{enqueueAsNext}</EnqueueAsNext></u:AddURIToQueue>',
  [TYPE.AddMultipleURIsToQueue]: '<u:AddMultipleURIsToQueue xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><UpdateID>0</UpdateID><NumberOfURIs>{amount}</NumberOfURIs><EnqueuedURIs>{uris}</EnqueuedURIs><EnqueuedURIsMetaData>{metadatas}</EnqueuedURIsMetaData><ContainerURI>{containerURI}</ContainerURI><ContainerMetaData>{containerMetadata}</ContainerMetaData><DesiredFirstTrackNumberEnqueued>{desiredFirstTrackNumberEnqueued}</DesiredFirstTrackNumberEnqueued><EnqueueAsNext>{enqueueAsNext}</EnqueueAsNext></u:AddMultipleURIsToQueue>',
  [TYPE.ListAvailableServices]: '<u:ListAvailableServices xmlns:u="urn:schemas-upnp-org:service:MusicServices:1"></u:ListAvailableServices>',
  [TYPE.SetTreble]: '<u:SetTreble xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1"><InstanceID>0</InstanceID><DesiredTreble>{level}</DesiredTreble></u:SetTreble>',
  [TYPE.SetBass]: '<u:SetBass xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1"><InstanceID>0</InstanceID><DesiredBass>{level}</DesiredBass></u:SetBass>',
});

function substitute(this: any, soapAction: string, substitutions?: Record<string, string>): string {
  let template = TEMPLATES[soapAction];
  let body = template;
  if (substitutions) {
    body = template.replace(/{([a-z]+)}/gi, function (match: any, group1: any) {
      return (substitutions.hasOwnProperty(group1)) ? substitutions[group1] : match;
    });
  }

  return `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body>${body}</s:Body></s:Envelope>`;
}
/* jshint +W101 */

function invoke(this: any, url: string, action: string, values?: Record<string, string>): Promise<any> {
  let soapBody: string | undefined;
  try {
    soapBody = substitute(action, values);
  } catch (e) {
    return Promise.reject(e);
  }

  logger.trace(url, action, soapBody);

  let body = Buffer.alloc(0);
  if (soapBody) {
    body = Buffer.from(soapBody, 'utf8');
  }

  return request({
    uri: url,
    method: 'POST',
    headers: {
      'CONTENT-TYPE': 'text/xml; charset="utf-8"',
      SOAPACTION: `"${action}"`,
      'CONTENT-LENGTH': body.length
    },
    body,
    type: 'stream'
  })
    .then(res => {
      logger.trace(`status code: ${res.statusCode}`);
      return res;
    });
}

function parse(this: any, stream: any): Promise<any> {
  return new Promise((resolve: any, reject: any) => {
    if (!stream) reject(new ArgumentError(`Expected a stream or string as argument, got ${stream}`));

    let returnResult: any = {};

    const sax = flow(stream, { preserveMarkup: flow.NEVER });

    sax.on('tag:s:body', (node: any) => {
      if (!node) return;

      delete node.$name;
      delete node.$attrs;
      let keys = Object.keys(node);

      if (keys.length === 1) {
        returnResult = node[keys[0]];
        delete returnResult.$attrs;
      }
    });

    sax.on('end', () => {
      logger.trace(returnResult);
      resolve(returnResult);
    });

    sax.on('error', (error: any) => {
      reject(error);
    });
  });
}

export = {
  invoke,
  parse,
  TYPE,
  TEMPLATES
};
