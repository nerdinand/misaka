var events = require('events');
var path = require('path');
var Firebase = require('firebase');

// Path helper
BASE_URL = 'https://picarto.firebaseio.com';
var picarto = function(m) {
  return (m !== undefined ? (BASE_URL + '/' + m) : BASE_URL);
};

var fixIP = function(str) {
  return str;
  //return str.replace('-', '.');
};

var parseBool = function(str) {
  // '1' if true, '' if false
  return str === '1';
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
    return room;
  }

  room = this.rooms[roomname] = new Room(this, roomname);
  return room;
};

/**
 * Get a room by name.
 */
Client.prototype.getRoom = function(roomname) {
  return this.rooms[roomname];
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
      console.warn('Authentication failed:', err);
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
 * Create our user object to push.
 * @return user object to push
 */
Client.prototype.createUser = function() {
  return {
    color: this.color,
    chatUsername: this.username,
    isPremium: (this.premium ? '1' : ''),
    isSubscriber: (this.subscriber ? '1' : ''),
    ip: this.ip
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

  this.historyCount = 15;
  this.initEventEmitter();

  // Do this here so we can setup callbacks prior to connecting?
  this.setupChildCallbackArrays(['messages', 'users', 'mods', 'admin', 'clear', 'bannedUsers']);
};

Room.prototype.initEventEmitter = function() {
  this.emitter = new events.EventEmitter();
};

Room.prototype.connect = function() {
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

  // Initialize events
  this.initHistoryCallback();
  this.initUserCallbacks();

  me.set(this.client.createUser());
};

/**
 * Initialize the chat history.
 */
Room.prototype.initChatHistory = function() {
  var room = this;
  this.history = [];

  var t = (new Date).getTime();
  this.firebase.messages.endAt(t).once('value', function(e) {
    e.forEach(function(h) {
      room.history.push(h.val());
    });

    console.log('History: ' + room.history.length + ' lines, printing 15');
    console.log('--- History ---');

    // Start index
    var s = room.history.length - 15;
    if(s < 0) s = 0;

    for(var i = s; i < room.history.length; i++) {

      var msg = room.history[i];
      console.log(msg.user + ': ' + msg.message);
    }
    console.log('--- End History ---');
  });
};

Room.prototype.on = function(name, e, callback) {
  if(callback instanceof Function) {
    if(this.callbacks[name] !== undefined &&
       this.callbacks[name][e] instanceof Array) {
      this.callbacks[name][e].push(callback);
    }
  }

  return this;
};

Room.prototype.message = function(text) {
  var msg = this.client.createMessage(this.name, text);
  this.firebase.messages.push(msg);
};

/**
 * Set a callback for chat history.
 */
Room.prototype.onHistory = function(callback) {
  this.emitter.on('history', callback);
  return this;
};

Room.prototype.onMessage = function(callback) {
  this.emitter.on('message:added', callback);
  return this;
};

Room.prototype.onUserJoin = function(callback) {
  this.emitter.on('user:added', callback);
  return this;
};

Room.prototype.onUserChanged = function(callback) {
  this.emitter.on('user:changed', callback);
  return this;
};

Room.prototype.onUserLeave = function(callback) {
  this.emitter.on('user:removed', callback);
  return this;
};

Room.prototype.onClear = function(callback) {
  this.emitter.on('clear', callback);
  return this;
};

Room.prototype.setupChildCallbackArrays = function(name) {
  if(name instanceof Array) {
    for(var i = 0; i < name.length; i++) {
      this.setupChildCallbackArrays(name[i]);
    }
    return;
  }

  var cb = this.callbacks[name] = {};
  cb.child_added = [];
  cb.child_removed = [];
  cb.child_changed = [];
};

/**
 * Initialize the history callback. This will initialize the
 * messages callbacks as well.
 */
Room.prototype.initHistoryCallback = function() {
  var room = this,
      base = this.firebase.messages;

  base.limit(this.historyCount).once('value', function(snapshot) {
    room.history = snapshot.val(); // Set this history field
    room.emitter.emit('history', room.history);

    // Only after the history has been received should the messages
    // callbacks be setup
    room.initMessagesCallbacks();
  });
};

/**
 * Initialize callbacks for messages.
 */
Room.prototype.initMessagesCallbacks = function() {
  var room = this,
      base = this.firebase.messages;

  this.ignoreCount = Object.keys(this.history).length;

  base.limit(this.historyCount).on('child_added', function(snapshot) {
    // If still messages to ignore (that are in history),
    // ignore them and decrement counter
    if(room.ignoreCount > 0) {
      room.ignoreCount--;
    } else {
      room.emitter.emit('message:added', new MessageSnapshot(snapshot));
    }
  });

  base.on('child_changed', function(snapshot) {
    room.emitter.emit('message:changed', new MessageSnapshot(snapshot));
  });

  base.on('child_removed', function(snapshot) {
    room.emitter.emit('message:removed', new MessageSnapshot(snapshot));
  });
};

Room.prototype.initUserCallbacks = function() {
  var room = this;
  var init = {
    'admin': this.firebase.admin,
    'mod': this.firebase.mods,
    'user': this.firebase.users,
    'banned': this.firebase.bannedUsers
  };

  for(var key in init) {
    var mode = key,
        firebase = init[key];

    firebase.on('child_added', function(snapshot) {
      room.emitter.emit('user:added', new UserSnapshot(snapshot, mode));
    });

    firebase.on('child_changed', function(snapshot) {
      room.emitter.emit('user:changed', new UserSnapshot(snapshot, mode));
    });

    firebase.on('child_removed', function(snapshot) {
      room.emitter.emit('user:removed', new UserSnapshot(snapshot, mode));
    });
  }
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

  var cb = this.callbacks[name];

  var m = this.firebase[name];
  var t = (new Date()).getTime();

  m.on('child_added', function(e) {
    e.timestamp = new Date();
    room.fireCallbacks(cb.child_added, e);
  });

  m.on('child_removed', function(e) {
    e.timestamp = new Date();
    room.fireCallbacks(cb.child_removed, e);
  });

  m.on('child_changed', function(e) {
    e.timestamp = new Date();
    room.fireCallbacks(cb.child_changed, e);
  });
};

function UserSnapshot(snapshot, mode) {
  this.snapshot = snapshot;
  // Mode should be either: admin, mod, user, banned
  this.mode = mode;

  // Assign fields from val
  var val = snapshot.val();
  this.color = val.color;
  this.ip = fixIP(val.ip);
  this.premium = parseBool(val.isPremium);
  this.subscriber = parseBool(val.isSubscriber);
  this.username = val.chatUsername;
};

function MessageSnapshot(snapshot) {
  this.snapshot = snapshot;

  var val = snapshot.val();
  this.color = val.color;
  this.message = val.message;
  this.premium = parseBool(val.isPremium);
  this.subscriber = parseBool(val.isSubscriber);
  this.username = val.user;
  this.whisper = (val.whisper === 'none' ? undefined : val.whisper);
};

module.exports = { Client: Client, Room: Room };
