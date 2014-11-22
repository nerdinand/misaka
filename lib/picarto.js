var path = require('path');
var Firebase = require('firebase');
//var Config = require(path.join(__dirname,'/config')).Config;

// Path helper
BASE_URL = 'https://picarto.firebaseio.com';
var picarto = function(m) {
  return (m !== undefined ? (BASE_URL + '/' + m) : BASE_URL);
};

/**
 * Construct a Picarto client.
 * @param opts Map of options
 */
var Client = function(opts) {
  this.authkey = opts['authkey'] || '';
  this.color = opts['color'] || '#';
  this.ip = opts['ip'] || '';
  this.premium = !!opts['premium'];
  this.subscriber = !!opts['subscriber'];
  this.username = opts['username'] || '';

  this.rooms = {};
};

/**
 * Join a room, adding it to the `rooms` map.
 * @param roomname Name of room to join
 * @return room object
 */
Client.prototype.join = function(roomname) {
  roomname = roomname.toLowerCase();
  // Check if in room
  var room = this.rooms[roomname];
  if(room !== undefined) {
    console.log('Already in room: ' + roomname)
    return;
  }

  room = { name: roomname };
  room.firebase = {};
  var me = room.firebase.me = new Firebase(picarto('rooms/' + roomname + '/users/' + this.username.toLowerCase()));
  room.firebase.messages = new Firebase(picarto('room-messages/' + roomname));
  room.firebase.whispers = new Firebase(picarto('room-whispers/' + roomname));
  room.firebase.clear = new Firebase(picarto('rooms/' + roomname + '/clear'));
  room.firebase.users = new Firebase(picarto('rooms/' + roomname + '/users'));
  room.firebase.admin = new Firebase(picarto('rooms/' + roomname + '/admin'));
  room.firebase.mods = new Firebase(picarto('rooms/' + roomname + '/mods'));
  room.firebase.bannedUsers = new Firebase(picarto('rooms/' + roomname + '/banned-users'));
  room.firebase.bannedIps = new Firebase(picarto('rooms/' + roomname + '/banned-ip'));

  me.set({
    color: this.color,
    chatUsername: this.username,
    isPremium: (this.premium ? "1" : ""),
    isSubscriber: (this.subscriber ? "1" : ""),
    ip: this.ip
  });

  return room;
};

/**
 * Shortcut for room.firebase.messages.on.
 * @param roomname Name of room to listen on
 * @param callback Message callback
 */
Client.prototype.onMessage = function(roomname, callback) {
  var room = this.rooms[roomname];
  if(!room) return;

  // Unsure what limit() does for now
  room.firebase.messages.limit(15).on('child_added', callback);
};

/**
 * Listen for global messages.
 * @param callback Message callback
 */
Client.prototype.onGlobalMessage = function(callback) {
  this.globalMessagesFirebase.on('child_added', callback);
};

/**
 * Shortcut for room.firebase.clear.on.
 * @param roomname Name of room to listen on
 * @param callback Clear callback
 */
Client.prototype.onClear = function(roomname, callback) {
  var room = this.rooms[roomname];
  if(!room) return;

  room.firebase.clear.on('child_added', callback);
};

/**
 * Initialize what I guess is the main Firebase instance?
 * Also authenticates.
 * @param authkey Authkey (optional)
 * @param callback Callback (optional)
 */
Client.prototype.initFirebase = function(authkey, callback) {
  // If only argument is a function, assume callback
  if(arguments.length === 1 && (arguments[0] instanceof Function)) {
    callback = authkey;
    authkey = undefined;
  }

  // If no authkey provided, use this one
  if(authkey === undefined) {
    authkey = this.authkey;
  }

  var client = this;
  this.firebase = new Firebase(picarto());
  this.firebase.authWithCustomToken(authkey, function(err, authData) {
    if(err) {
      console.warning('Authentication failed:', err);
    } else {
      console.log('Authenticated successfully:', authData);
    }

    client.ip = authData.auth.ip;

    if(callback) {
      callback(err, authData);
    }
  });
};

/**
 * Create a message object from text that can be pushed
 * to firebase.
 * @param roomname Where this message will be pushed to
 * @param text Message text
 * @return Message object to push
 */
Client.prototype.createMessage = function(roomname, text) {
  return {
    user: this.config.username,
    color: this.config.color,
    isPremium: (this.config.isPremium ? "1" : ""),
    // isSubscriber depends on the room I think? Always false for now.
    isSubscriber: false, // (this.config.isSubscriber ? "1" : ""),
    message: text,
    whisper: "none"
  };
};

/**
 * Send a message to a room.
 * @param roomname Name of room to send message to
 * @param msg Text of message to send
 */
Client.prototype.message = function(roomname, msg) {
  var room = this.rooms[roomname];
  if(!room) return;

  var message = this.createMessage(msg);
  room.firebase.messages.push(message);
};

Client.prototype.whisper = function(roomname, user, msg) {
  var room = this.rooms[roomname];
  if(!room) return;
  // Does nothing for now
};

/**
 * Initialize default firebase stuff. Currently just global-messages.
 */
Client.prototype.joinDefaults = function() {
  this.globalMessagesFirebase = new Firebase(picarto('global-messages'));

  // Parts of the client-side script seemed to remove the .info/, so maybe
  // it should just be 'connected'
  this.infoFirebase = new Firebase(picarto('.info/connected'));

  this.infoFirebase.on('value', function(e) {
    if(e.val() === true) {
      // Disconnect?
      console.log('Disconnect?');
    }
  });
};

module.exports = { Client: Client };
