import events = require('events');
import path = require('path');
var _ = require('underscore');

/**
 * Watches for the V7 event 'onlineState'.
 * @class
 */
export class OnlineWatcher {
  private _emitter: events.EventEmitter;
  private _mainChannel: string;
  private _socket: any;
  private _state: any;

  constructor(mainChannel: string) {
    this._emitter = new events.EventEmitter();
    this._mainChannel = mainChannel;
    this._socket = undefined;
    this._state = {};
  }

  /**
   * Set the socket to listen on.
   * @param {Object} socket
   */
  setSocket(socket: any) {
    var socket = this._socket = socket,
        _this = this,
        emit = OnlineWatcher.prototype._emit.bind(this),
        hasMainChannel = OnlineWatcher.prototype.hasMainChannel.bind(this),
        isMainChannel = OnlineWatcher.prototype.isMainChannel.bind(this);

    socket.on('onlineState', function(data) {
      var online = (data.viewers !== -1),
          channel = data.channel;

      if(channel === undefined && hasMainChannel()) {
        // If no 'channel' specified, assume main channel
        channel = _this._mainChannel;
      } else if(channel === undefined) {
        // If no main channel, this OnlineWatcher doesn't know what channel this
        // is for, so ignore
        return;
      }

      // If we don't have the initial online state yet,
      // set it without emitting
      if(_this._state[channel] === undefined) {
        _this._state[channel] = online;
      } else if(online !== _this._state[channel]) {
        _this._state[channel] = online;
        emit('stateChanged', channel, online);
        if(isMainChannel(channel)) {
          emit('mainStateChanged', online);
        }
      }
    });
  }

  /**
   * Whether or not this watcher has a main channel.
   * @param {Boolean} true if has a main channel, false if not
   */
  hasMainChannel(): boolean {
    return <boolean>_.isString(this._mainChannel);
  }

  /**
   * Whether or not some channel is the main channel of this watcher.
   * @param {String} channel - Channel name to check
   * @return {Boolean} true if main channel, false if not (or no main channel)
   */
  isMainChannel(channel: string): boolean {
    return this._mainChannel != null && this._mainChannel.toLowerCase() === channel.toLowerCase();
  }

  /**
   * Whether or not the state is online.
   * @param {String} [channel] - Channel name to check, if none provided will try
   *                             using the main channel
   * @return {Boolean} true if online, false if offline
   */
  isOnline(channel: string): boolean {
    if(channel === undefined && this.hasMainChannel()) {
      channel = this._mainChannel;
    }

    return !!this._state[channel];
  }

  /**
   * Wrapper for _emitter.emit.
   */
  _emit(event: string, ...args: any[]): boolean {
    return <boolean>this._emitter.emit.apply(this._emitter, [event].concat(args));
  }

  /**
   * Wrapper for _emitter.on.
   */
  on(event: string, listener: Function): OnlineWatcher {
    this._emitter.on(event, listener);
    return this;
  }
}
