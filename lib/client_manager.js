var path = require('path');
var Picarto = require(path.join(__dirname, 'picarto'));

var ClientManager = function() {
  this.clients = {}; // Clients mapped by roomname
};

/**
 * Attempt to join a room.
 * @param roomname Name of room to join
 * @param authToken Token to authenticate with
 * @param callback Callback(error) (optional)
 */
ClientManager.prototype.join = function(roomname, authToken, callback) {
  var manager = this;

  if(roomname !== undefined && authToken && !this.hasClient(roomname)) {
    var client = new Picarto.Client({ channel: roomname, token: authToken }),
        socket = client.connectWithToken();

    manager.clients[roomname] = client;

    if(callback) {
      socket.once('connect', function() {
        callback();
      });
      // This doesn't get triggered on bad token, find a better way?
      socket.once('connect_failed', function(reason) {
        callback(reason);
      });
    }

    //if(callback) {
    //  callback(null, client, socket);
    //}
  } else if(callback) {
    if(roomname === undefined) {
      callback(new Error('No room name specified'));
    } else if(!authToken) {
      callback(new Error('Room-specific auth token required to connect'));
    } else {
      callback(new Error('A client for this room already exists'));
    }
  }
};

/**
 * Whether or not this manager has a client for a specific room.
 * @return true if there's a client for this room, false if not
 */
ClientManager.prototype.hasClient = function(roomname) {
  return !!this.getClient(roomname);
};

/**
 * Get a client by roomname.
 * @return client
 */
ClientManager.prototype.getClient = function(roomname) {
  return this.clients[roomname];
};

module.exports = ClientManager;
