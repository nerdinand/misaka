var events = require('events');
var path = require('path');
var request = require('request');
var Firebase = require('firebase');

// Path helper
BASE_URL = 'https://picarto.firebaseio.com';
var picarto = function(m) {
  return (m !== undefined ? (BASE_URL + '/' + m) : BASE_URL);
};

/**
 * Parse a boolean. Used for isPremium and isSubscriber.
 * @param str String to parse
 * @return true if parsed true, false if parsed false
 */
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
  this.password = opts['password'] || '';

  this.emitter = new events.EventEmitter();
  this.hasAuthed = false;
  this.rooms = {};
  this.auth = new Auth();
};

/**
 * Authenticate and set this client's authkey to the
 * newly retrieved authkey.
 * @param callback Callback
 */
Client.prototype.authenticate = function(callback) {
  var client = this,
      username = this.username,
      password = this.password;

  if(!username || !password) {
    if(callback) {
      callback(new Error('Username and password are both required to authenticate'));
    }
    return;
  }

  this.auth.username = username;
  this.auth.password = password;

  this.auth.perform(function(error, authkey) {
    if(!error) {
      client.authkey = authkey;
    }

    if(callback) callback(error);
  });
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
 * Listen for auth events. This will not fire on the initial
 * authentication, but will for all un-auth and re-auth events.
 * It provides authData to the callback in the same way that
 * Firebase's onAuth does.
 * @param callback Callback
 */
Client.prototype.onAuth = function(callback) {
  this.emitter.on('auth', callback);
};

/**
 * Listen for global messages.
 * @param callback Message callback
 */
Client.prototype.onGlobalMessage = function(callback) {
  this.globalMessagesFirebase.on('child_added', callback);
};

/**
 * Do stuff on first time being authenticated.
 * @param authData Data received after authentication.
 */
Client.prototype.initFirstAuth = function(authData) {
  if(!this.hasAuthed) {
    this.initReauth();
    this.joinDefaults();
  }
  this.hasAuthed = true;
};

/**
 * Initialize what I guess is the main Firebase instance?
 * Also authenticates.
 * @param authkey Authkey (optional)
 * @param callback Callback (optional)
 */
Client.prototype.initFirebase = function(authkey, callback) {
  var client = this;

  // If only argument is a function, assume callback
  if(arguments.length === 1 && (arguments[0] instanceof Function)) {
    callback = authkey;
    authkey = undefined;
  }

  // If no authkey provided, use this one
  if(authkey === undefined) {
    authkey = this.authkey;
  }

  this.firebase = new Firebase(picarto());
  this.firebase.authWithCustomToken(authkey, function(err, authData) {
    if(err) {
      console.warn('Authentication failed:', err);
    } else {
      console.log('Authenticated successfully');
      client.ip = authData.auth.ip;
      client.initFirstAuth();
    }

    if(callback) {
      callback(err, authData);
    }
  });

};

/**
 * Initialize the callback for deauth used for
 * re-authentication.
 */
Client.prototype.initReauth = function() {
  var client = this;

  // Setup callback to check for unauth
  this.firebase.onAuth(function(authData) {
    client.emitter.emit('auth', authData);
    if(!authData) { // Unauth'd
      client.authenticate(function(error) {
        if(!error) {
          console.log('Successfully got new authkey');
          client.initFirebase(function(error, authData) {
            if(!error) {
              console.log('Successfully re-authenticated');
            } else {
              console.warn('Error re-authenticating:', error);
            }
          });
        } else {
          console.warn('Error getting new authkey:', error);
        }
      });
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

/**
 * Construct a new room. Used when a client joins
 * a room.
 * @param client Client parent object
 * @param name Room name
 */
var Room = function(client, name) {
  this.client = client;
  this.name = name;
  this.users = {};

  this.historyCount = 15;
  this.emitter = new events.EventEmitter();
};

/**
 * Connect to this room. Should be called after all events
 * have been set. Some events like 'history' will be right
 * after connecting.
 */
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
 * Send a message to this room.
 * @param text Text to send as message
 */
Room.prototype.message = function(text) {
  var msg = this.client.createMessage(this.name, text);
  this.firebase.messages.push(msg);
};

/**
 * Get a whisper sent to this client.
 * @param id Whisper id specified in received message object
 * @param callback Callback
 */
Room.prototype.getWhisper = function(id, callback) {
  this.firebase.whispers
    .child(this.client.username)
    .child(id).once('value', function(snapshot) {
      if(callback) {
        callback(snapshot); // Wrap in whisper snapshot?
      }
    });
};

/**
 * Set a callback for chat history.
 */
Room.prototype.onHistory = function(callback) {
  this.emitter.on('history', callback);
  return this;
};

/**
 * Set a callback for when a message is received.
 * @param callback Callback
 */
Room.prototype.onMessage = function(callback) {
  this.emitter.on('message:added', callback);
  return this;
};

/**
 * Set a callback for when a user joins the room.
 * Note: This also fires for this client.
 * @param callback Callback
 */
Room.prototype.onUserJoin = function(callback) {
  this.emitter.on('user:added', callback);
  return this;
};

/**
 * Set a callback for when a user is changed.
 * @param callback Callback
 */
Room.prototype.onUserChanged = function(callback) {
  this.emitter.on('user:changed', callback);
  return this;
};

/**
 * Set a callback for when a user leaves the room.
 * @param callback Callback
 */
Room.prototype.onUserLeave = function(callback) {
  this.emitter.on('user:removed', callback);
  return this;
};

/**
 * Set a callback for when someone has whispered this client.
 * @param callback Callback
 */
Room.prototype.onWhisper = function(callback) {
  this.emitter.on('whisper', callback);
  return this;
};

/**
 * Set a callback for when this room chat has been cleared by
 * an admin.
 * @param callback Callback
 */
Room.prototype.onClear = function(callback) {
  this.emitter.on('clear', callback);
  return this;
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
      var message = new MessageSnapshot(snapshot);
      room.emitter.emit('message:added', message);

      // If a whisper to us, emit the 'whisper' event as well
      if(message.whisper === room.client.username) {
        room.getWhisper(message.message, function(snapshot) {
          var whisper = new WhisperSnapshot(snapshot, message.username);
          room.emitter.emit('whisper', whisper);
        });
      }
    }
  });

  base.on('child_changed', function(snapshot) {
    room.emitter.emit('message:changed', new MessageSnapshot(snapshot));
  });

  base.on('child_removed', function(snapshot) {
    room.emitter.emit('message:removed', new MessageSnapshot(snapshot));
  });
};

/**
 * Initialize callbacks for users (/admin, /mods, /users, /bannedUsers).
 */
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

  // Setup our user callbacks to keep track of users
  this.setupUserCallbacks();
};

/**
 * Setup callbacks to keep track of users list.
 */
Room.prototype.setupUserCallbacks = function() {
  var room = this;

  this.emitter.on('user:added', function(snapshot) {
    var name = snapshot.snapshot.key();
    room.users[name] = snapshot;
  });

  this.emitter.on('user:removed', function(snapshot) {
    var name = snapshot.snapshot.key();
    delete room.users[name];
  });
};

/**
 * Get the user by id (usually username).
 * @param id User id (username)
 * @return user snapshot from user:added, or undefined
 *         if user not found
 */
Room.prototype.getUser = function(id) {
  return this.users[id];
};

/**
 * Wrapper for user-related snapshots.
 * @param snapshot Original snapshot object
 * @param mode User mode (admin, mod, user, banned)
 */
function UserSnapshot(snapshot, mode) {
  this.snapshot = snapshot;
  // Mode should be either: admin, mod, user, banned
  this.mode = mode;

  // Assign fields from val
  var val = snapshot.val();
  this.color = val.color;
  this.ip = val.ip;
  this.premium = parseBool(val.isPremium);
  this.subscriber = parseBool(val.isSubscriber);
  this.username = val.chatUsername;
};

/**
 * Wrapper for message snapshots.
 * @param snapshot Original snapshot object
 */
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

/**
 * Wrapper for whisper snapshots (sent to this client).
 * @param snapshot Original snapshot object
 * @param from Username of user who sent the whisper
 */
function WhisperSnapshot(snapshot, from) {
  this.snapshot = snapshot;
  this.from = from;
  this.message = snapshot.val().message;
};

/**
 * Handle picarto's web authentication procedure, used
 * mainly for getting an authkey for an account.
 */
function Auth() {
  this.phpsessid = undefined;
  this.username = undefined;
  this.password = undefined;
  this.jar = request.jar(); // Cookie jar
};

/**
 * Fetch a PHPSESSID cookie.
 * @param callback Callback
 */
Auth.prototype.fetchSessionCookie = function(callback) {
  request({
    uri: 'https://www.picarto.tv/live/index.php',
    jar: this.jar,
    headers: this.getRequestHeaders()
  }, function(error, response, body) {
    if(response.statusCode !== 200 && !error) {
      error = new Error('Unexpected status code when fetching session cookie: ' + response.statusCode);
    }

    if(callback) callback(error);
  });
};

/**
 * Attempt to login to picarto.
 * @param username Username to login with
 * @param password Password to login with
 * @param callback Callback
 */
Auth.prototype.login = function(username, password, callback) {
  var auth = this, data = { uname: username, passwd: password };

  request({
    uri: 'https://www.picarto.tv/live/index.php',
    method: 'POST',
    form: data,
    jar: this.jar,
    headers: this.getRequestHeaders()
  }, function(error, response, body) {
    // Check status code
    if(response.statusCode !== 200) {
      if(!error) error = new Error('Unexpected status code while logging in: ' + response.statusCode);
    }

    if(callback && !error) {
      callback(error, auth.wasLoginSuccessful(body));
    } else if(callback) {
      callback(error);
    }
  });
};

/**
 * Fetch this user's authkey. Assumes the cookie jar has
 * PHPSESSID set to a valid session cookie.
 * @param callback Callback
 */
Auth.prototype.fetchAuthkey = function(callback) {
  var auth = this;

  request({
    uri: 'https://www.picarto.tv/live/channel.php?watch=' + this.username.toLowerCase(),
    followRedirect: false,
    jar: this.jar,
    headers: this.getRequestHeaders()
  }, function(error, response, body) {
    var status = response.statusCode;
    if(status !== 200 && status !== 302 && !error) {
      error = new Error('Unexpected status code while fetching authkey: ' + status);
    }

    // Try to parse the authkey
    var authkey;
    if(!error) {
      authkey = auth.parseAuthkey(body);
      if(!authkey) {
        error = new Error('Error parsing authkey');
      }
    }

    if(callback) callback(error, authkey);
  });
};

/**
 * Parse an authkey from html.
 * @param html Html to look through
 * @return authkey if found, undefined if not found
 */
Auth.prototype.parseAuthkey = function(html) {
  var patt = /dataRef\.auth\("([^"]+)"/,
      match = patt.exec(html);

  if(match) {
    return match[1];
  }
};

/**
 * Check if a login was successful from the body of the
 * response.
 * @param html Html received in response
 * @return true if successful, false if not
 */
Auth.prototype.wasLoginSuccessful = function(html) {
  // Check for dashboard link
  var patt = /<input type="button" id="watchlink" value="Dashboard"\/>/;
  return patt.test(html);
};

/**
 * Get the headers to send with requests.
 * @return headers object
 */
Auth.prototype.getRequestHeaders = function() {
  return { 'Referer': 'https://www.picarto.tv/live/index.php' };
};

/**
 * Grab a session cookie, login, and get the authkey.
 * @param callback Callback
 */
Auth.prototype.perform = function(callback) {
  var auth = this,
      username = auth.username, password = auth.password;

  this.fetchSessionCookie(function(error) {
    if(!error) {
      auth.login(username, password, function(error, success) {
        if(!error && success) {
          auth.fetchAuthkey(function(error, authkey) {
            callback(error, authkey);
          });
        } else if(!error && !success) {
          if(callback) callback(new Error('Login failed'));
        } else {
          if(callback) callback(error);
        }
      });
    } else {
      callback(error);
    }
  });
};

module.exports = { Auth: Auth, Client: Client, Room: Room };
