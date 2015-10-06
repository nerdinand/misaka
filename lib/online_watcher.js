var events = require('events');
var path = require('path');
var _ = require('underscore');

/**
 * Watches for the V7 event 'onlineState'.
 * @class
 */
var OnlineWatcher = function(mainChannel) {
  this._emitter = new events.EventEmitter();
  this._mainChannel = mainChannel;
  this._socket = undefined;
  this._state = {};
};

/**
 * Set the socket to listen on.
 * @param {Object} socket
 */
OnlineWatcher.prototype.setSocket = function(socket) {
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
};

/**
 * Whether or not this watcher has a main channel.
 * @param {Boolean} true if has a main channel, false if not
 */
OnlineWatcher.prototype.hasMainChannel = function() {
  return _.isString(this._mainChannel);
};

/**
 * Whether or not some channel is the main channel of this watcher.
 * @param {String} channel - Channel name to check
 * @return {Boolean} true if main channel, false if not (or no main channel)
 */
OnlineWatcher.prototype.isMainChannel = function(channel) {
  return _.isString(this._mainChannel) && this._mainChannel.toLowerCase() === channel.toLowerCase();
};

/**
 * Whether or not the state is online.
 * @param {String} [channel] - Channel name to check, if none provided will try
 *                             using the main channel
 * @return {Boolean} true if online, false if offline
 */
OnlineWatcher.prototype.isOnline = function(channel) {
  if(channel === undefined && this.hasMainChannel()) {
    channel = this._mainChannel;
  }

  return !!this._state[channel];
};

/**
 * Wrapper for _emitter.emit.
 */
OnlineWatcher.prototype._emit = function() {
  this._emitter.emit.apply(this._emitter, arguments);
};

/**
 * Wrapper for _emitter.on.
 */
OnlineWatcher.prototype.on = function() {
  this._emitter.on.apply(this._emitter, arguments);
};

module.exports = OnlineWatcher;
