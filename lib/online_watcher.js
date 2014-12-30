var events = require('events');
var path = require('path');
var logger = require(path.join(__dirname, 'logger'));

/**
 * Watches for the V7 event 'onlineState'.
 * @class
 */
var OnlineWatcher = function() {
  this._emitter = new events.EventEmitter();
  this._hasInitial = false;
  this._socket = undefined;
  this._state = undefined;
};

/**
 * Set the socket to listen on.
 * @param {Object} socket
 */
OnlineWatcher.prototype.setSocket = function(socket) {
  var socket = this._socket = socket,
      _this = this;

  socket.on('onlineState', function(data) {
    //logger.log('debug', 'onlineState event received', data);
    var online = (data.viewers >= 0);

    // If we don't have the initial online state yet,
    // set it without emitting
    if(!_this._hasInitial) {
      _this._hasInitial = true;
      _this._state = online;
      return;
    }

    if(online !== _this._state) {
      _this._state = online;
      _this._emit('stateChanged', online);
    }
  });
};

/**
 * Whether or not the state is online.
 * @return {Boolean} true if online, false if offline
 */
OnlineWatcher.prototype.isOnline = function() {
  return this._state;
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
