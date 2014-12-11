var path = require('path');
var ClientManager = require(path.join(__dirname, 'client_manager'));
var Picarto = require(path.join(__dirname, 'picarto'));
var logger = require(path.join(__dirname, 'logger'));

var Bot = function(opts) {
  this.username = opts['username'];
  this.password = opts['password'];
  this.room = opts['room'];
  this.unescape = opts['unescape'] || false;

  this.auth = new Picarto.Auth();
  this.manager = new ClientManager();

  this.authenticated = false;
};

/**
 * Have the bot login. If already detected as logged in (and not
 * forcing a new login), don't re-login.
 * @param opts Map of options (optional)
 * @param callback Callback(error, success) (optional)
 */
Bot.prototype.login = function(opts, callback) {
  // If passed one argument (Function), use as callback
  if(arguments.length === 1 && (opts instanceof Function)) {
    callback = opts;
    opts = undefined;
  }

  if(!opts) opts = {};
  var force = opts['force'] || false;

  // If not forcing a new login, and we've already logged in,
  // just call the callback immediately
  if(!force && this.authenticated) {
    if(callback) {
      callback(null, true);
    }
    return;
  }

  // Check for username/password presence
  if(this.username === undefined || this.password === undefined) {
    if(callback) {
      callback(new Error('Username and password both required to authenticate'));
    }
    return;
  }

  var bot = this, auth = this.auth,
      username = this.username, password = this.password;
  this.authenticated = false;

  // Getting the session cookie beforehand not needed
  logger.log('debug', 'Logging in', { username: username });
  auth.login(username, password, function(error, success) {
    bot.authenticated = !error && success;
    if(callback) {
      callback(error, success);
    }
  });
};

/**
 * Have the bot connect to the room. This will login if not yet
 * authenticated, then fetch the auth token from the room's Html
 * for connecting.
 * @param callback Callback(error, client)
 */
Bot.prototype.connect = function(callback) {
  var bot = this,
      auth = this.auth,
      manager = this.manager,
      roomname = this.room;

  this.login(function(error, success) {
    if(!error && success) {
      logger.log('debug', 'Logged in, fetching auth token for room', { room: roomname });
      auth.fetchAuthToken(roomname, function(error, token) {
        if(!error) {
          logger.log('debug', 'Got auth token, joining room', { room: roomname });
          manager.join(roomname, token, function(error) {
            if(!error) {
              bot.initClient(manager.getClient(roomname));
            }

            if(callback) {
              callback(error, manager.getClient(roomname));
            }
          });
        } else {
          logger.error(error, { msg: 'Error fetching V7 auth token', room: bot.getRoomName() });
          if(callback) {
            callback(error);
          }
        }
      });
    } else if(!error && !success) {
      if(callback) {
        callback(new Error('Authentication attempt was unsuccessful'));
      }
    } else {
      if(callback) {
        callback(error);
      }
    }
  });
};

/**
 * Initialize a client. This will do optional stuff.
 * @param client Client to initialize
 */
Bot.prototype.initClient = function(client) {
  var unescape = Bot.prototype.unescape.bind(this);

  if(this.unescape) {
    // Replace msg data with unescaped msg data
    client.getSocket().on('userMsg', function(data) {
      data.msg = unescape(data.msg);
    });
  }
};

/**
 * Get the auth manager used by this bot.
 * @return auth manager
 */
Bot.prototype.getAuth = function() {
  return this.auth;
};

/**
 * Get the client manager of this bot.
 * @return client manager
 */
Bot.prototype.getClientManager = function() {
  return this.manager;
};

/**
 * Get the room name this bot connects to.
 * @return room name
 */
Bot.prototype.getRoomName = function() {
  return this.room;
};

/**
 * Get the client. Assumes one-room model.
 * @return client or undefined if none
 */
Bot.prototype.getClient = function() {
  if(this.room !== undefined && this.manager !== undefined) {
    return this.manager.getClient(this.room);
  }
};

/**
 * Get the user object of this bot. Assumes one-room model.
 * @return bot's user object, or undefined if none
 */
Bot.prototype.getSelf = function() {
  var client = this.getClient();
  if(this.username !== undefined && client) {
    return client.getUserList().getUser(this.username);
  }
};

/**
 * Unescape a string.
 * @param str String to unescape
 * @return unescaped string
 */
Bot.prototype.unescape = function(str) {
  str = str.replace(/&#38;/g, '&');
  str = str.replace(/&#60;/g, '<');
  str = str.replace(/&#62;/g, '>');
  str = str.replace(/&#39;/g, '\'');
  str = str.replace(/&#34;/g, '"');
  return str;
};

module.exports = Bot;
