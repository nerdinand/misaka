var path = require('path');
var Firebase = require('firebase');

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

  room = this.rooms[roomname] = new Room(this, roomname);
  room.join();
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

Client.prototype.onUserAdded = function(roomname, callback) {
  var room = this.rooms[roomname];
  if(!room) return;

  room.firebase.users.on('child_added', callback);
};

Client.prototype.onModAdded = function(roomname, callback) {
  var room = this.rooms[roomname];
  if(!room) return;

  room.firebase.mods.on('child_added', callback);
};

Client.prototype.onAdminAdded = function(roomname, callback) {
  var room = this.rooms[roomname];
  if(!room) return;

  room.firebase.admin.on('child_added', callback);
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
      console.log('Authenticated successfully');
      client.joinDefaults();
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
    user: this.username,
    color: this.color,
    isPremium: (this.premium ? '1' : ''),
    isSubscriber: (this.subscriber ? '1' : ''),
    message: text,
    whisper: 'none'
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
  this.infoFirebase = new Firebase(picarto('connected'));

  this.infoFirebase.on('value', function(e) {
    if(e.val() === true) {
      // Disconnect?
      console.log('Disconnect?');
    }
  });
};

var Room = function(client, name) {
  this.client = client;
  this.name = name;
  this.callbacks = {};
};

Room.prototype.join = function() {
  var room = this;
  var roomname = this.name;
  this.firebase = {};

  var me = this.firebase.me = new Firebase(picarto('rooms/' + roomname + '/users/' + this.client.username.toLowerCase()));
  this.firebase.messages = new Firebase(picarto('room-messages/' + roomname));
  this.firebase.whispers = new Firebase(picarto('room-whispers/' + roomname));
  this.firebase.clear = new Firebase(picarto('rooms/' + roomname + '/clear'));
  this.firebase.users = new Firebase(picarto('rooms/' + roomname + '/users'));
  this.firebase.admin = new Firebase(picarto('rooms/' + roomname + '/admin'));
  this.firebase.mods = new Firebase(picarto('rooms/' + roomname + '/mods'));
  this.firebase.bannedUsers = new Firebase(picarto('rooms/' + roomname + '/banned-users'));
  this.firebase.bannedIps = new Firebase(picarto('rooms/' + roomname + '/banned-ip'));

  //this.initChatHistory();

  // Initialize the callback maps
  this.initCallbacks(['messages', 'users', 'mods', 'admin', 'clear', 'bannedUsers']);

  me.set({
    color: this.client.color,
    chatUsername: this.client.username,
    isPremium: (this.client.premium ? "1" : ""),
    isSubscriber: (this.client.subscriber ? "1" : ""),
    ip: this.client.ip
  });
};

/**
 * Initialize the chat history.
 */
Room.prototype.initChatHistory = function() {
  var room = this;
  this.history = [];

  var t = (new Date).getTime();
  this.firebase.messages.endAt(t).on('value', function(e) {
    e.forEach(function(h) {
      room.history.push(h.val());
    });

    console.log([room.name, 'history', room.history]);
  });
};

Room.prototype.on = function(name, e, callback) {
  if(callback instanceof Function) {
    this.callbacks[name][e].push(callback);
  }
};

Room.prototype.message = function(text) {
  var msg = this.client.createMessage(this.name, text);
  this.firebase.messages.push(msg);
};

Room.prototype.onMessage = function(callback) {
  this.on('messages', 'child_added', callback);
};

Room.prototype.onClear = function(callback) {
  this.on('clear', 'child_added', callback);
};

/**
 * Fire each callback in a list, passing a parameter.
 * @param list List of callbacks
 * @param param Parameter to pass to each callback.
 */
Room.prototype.fireCallbacks = function(list, param) {
  for(var i = 0; i < list.length; i++) {
    var f = list[i];
    if(f instanceof Function) {
      f(param);
    }
  }
};

Room.prototype.initCallbacks = function(name) {
  if(name instanceof Array) {
    for(var i = 0; i < name.length; i++) {
      this.initCallbacks(name[i]);
    }
    return;
  }

  var room = this;
  var cb = this.callbacks[name] = {};

  cb.child_added = [];
  cb.child_removed = [];
  cb.child_changed = [];

  var m = this.firebase[name];

  m.on('child_added', function(e) {
    //console.log([name, 'child_added', e]);
    room.fireCallbacks(cb.child_added, e);
  });

  m.on('child_removed', function(e) {
    //console.log([name, 'child_removed', e]);
    room.fireCallbacks(cb.child_removed, e);
  });

  m.on('child_changed', function(e) {
    //console.log([name, 'child_changed', e]);
    room.fireCallbacks(cb.child_changed, e);
  });
};

module.exports = { Client: Client, Room: Room };
