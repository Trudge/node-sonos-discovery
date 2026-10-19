'use strict';
function recalculateGroupVolume(this: any) {
  const zone = this.system.zones.find((zone: any) => zone.uuid === this.uuid);
  const relevantMembers = zone.members
    .filter((player: any) => !player.outputFixed)
    .map((player: any) => player.state.volume);

  if (relevantMembers.length === 0) {
    return;
  }

  const totalVolume = relevantMembers
    .reduce((prev: any, current: any) => {
      return prev + current;
    });

  if (!this._previousGroupVolume) {
    this._previousGroupVolume = this.groupState.volume;
  }

  this.groupState.volume = Math.round(totalVolume / zone.members.length);
  clearTimeout(this._groupVolumeTimer);
  this._groupVolumeTimer = setTimeout(() => {
    this.emit('group-volume', {
      oldVolume: this._previousGroupVolume,
      newVolume: this.groupState.volume,
      roomName: this.roomName
    });

    this.system.emit('group-volume', {
      uuid: this.uuid,
      oldVolume: this._previousGroupVolume,
      newVolume: this.groupState.volume,
      roomName: this.roomName
    });

    delete this._groupVolumeTimer;
    delete this._previousGroupVolume;
  }, 100);
}

module.exports = recalculateGroupVolume;
