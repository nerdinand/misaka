var events = require('events');
var io = require('socket.io-client');
var path = require('path');
var request = require('request');
var _ = require('underscore');
var UserList = require(path.join(__dirname, 'user_list'));
var OnlineWatcher = require(path.join(__dirname, 'online_watcher'));
var logger = require(path.join(__dirname, 'logger'));

/**
 * Client for V7 chat.
 */
function Client(opts) {
  if(!opts) opts = {};

  this.channel = opts['channel'];
  this.token = opts['token'];
  this.userList = undefined;
  this.onlineWatcher = undefined;

  // Awaiting history until channelUsers event (UserList's "initial" event)
  this.awaitingHistory = true;
  this.history = [];

  this.emitter = new events.EventEmitter();
};

/**
 * Connect to the websocket server with an authentication token.
 * @param token Auth token (optional)
 * @return socket
 */
Client.prototype.connectWithToken = function(token) {
  // Make sure we have a token
  if(!token) {
    token = this.token;
    if(!token) {
      logger.error('Cannot connect to V7 chat without a token');
      return;
    }
  }

  logger.log('debug', 'Connecting to socket.io server');
  var socket = this.socket = io.connect('https://chat.picarto.tv:443', {
    forceNew: true,
    reconnectionDelay: 5,
    reconnectionDelayMax: 5,
    secure: true,
    transports: ['websocket'],
    query: 'token=' + token
  });

  // Unsure if this is the best place..
  this.initUserList();
  this.initOnlineWatcher();
  this.initHistory();

  return socket;
};

Client.prototype.initOnlineWatcher = function() {
  this.onlineWatcher = new OnlineWatcher(this.getChannel());
  this.onlineWatcher.setSocket(this.socket);
};

/**
 * Initialize the user list. Assumes socket has been set (this.socket).
 */
Client.prototype.initUserList = function() {
  var userList = this.userList = new UserList();
  userList.setSocket(this.socket);
};

/**
 * Initialize history stuff.
 */
Client.prototype.initHistory = function() {
  var client = this, userList = this.userList;

  this.socket.on('userMsg', function(data) {
    if(client.awaitingHistory) {
      data.history = true; // Mark this message as history
      client.history.push(data);
    }
  });

  // All messages received before initial userlist (channelUsers) are
  // part of history
  userList.on('initial', function(users) {
    client.awaitingHistory = false;
    client.emit('history', client.history);
  });
};

/**
 * Get the channel name this Client was initialized with.
 * @return {String} Channel name
 */
Client.prototype.getChannel = function() {
  return this.channel;
};

/**
 * Get the online watcher.
 * @return {Object} Online watcher
 */
Client.prototype.getOnlineWatcher = function() {
  return this.onlineWatcher;
};

/**
 * Get the socket of this client.
 * @return socket
 */
Client.prototype.getSocket = function() {
  return this.socket;
};

/**
 * Get this client's UserList for managing user events.
 * @return UserList
 */
Client.prototype.getUserList = function() {
  return this.userList;
};

/**
 * Send a request to set this client's color.
 * @param color Color to set to, should be exactly 6 hex characters
 *              (otherwise it will be ignored by the server)
 */
Client.prototype.setColor = function(color) {
  this.socket.emit('setColor', color);
};

/**
 * Send a message.
 * @text Text of message to send
 */
Client.prototype.sendMessage = function(text) {
  this.socket.emit('chatMsg', { msg: text });
};

/**
 * Send a chat command.
 * @param cmd Command name
 * @param arg Everything that follows the command name
 */
Client.prototype.sendCommand = function(cmd, arg) {
  this.sendMessage('/' + cmd + ' ' + arg);
};

/**
 * Send a ban command.
 * @param username Username of user to ban
 */
Client.prototype.ban = function(username) {
  this.sendCommand('b', username);
};

/**
 * Send an unban command.
 * @param username Username of user to unban
 */
Client.prototype.unban = function(username) {
  this.sendCommand('ub', username);
};

/**
 * Send a mod command.
 * @param username Username of user to become a moderator
 */
Client.prototype.mod = function(username) {
  this.sendCommand('m', username);
};

/**
 * Send an unmod command.
 * @param username Username of user to remove from moderators
 */
Client.prototype.unmod = function(username) {
  this.sendCommand('um', username);
};

/**
 * Send a kick command.
 * @param username Username of user to kick
 */
Client.prototype.kick = function(username) {
  this.sendCommand('kick', username);
};

/**
 * Whisper another user.
 * @param username Username of user to whisper
 * @param text Text to whisper
 */
Client.prototype.whisper = function(username, text) {
  this.sendCommand('w', username + ' ' + text);
};

/**
 * Wrapper for emitter.emit.
 */
Client.prototype.emit = function() {
  this.emitter.emit.apply(this.emitter, arguments);
};

/**
 * Wrapper for emitter.on.
 */
Client.prototype.on = function() {
  this.emitter.on.apply(this.emitter, arguments);
  return this;
};

/**
 * Handle picarto's web authentication procedure, used
 * mainly for getting an authkey for an account.
 */
function Auth() {
  this.username = undefined;
  this.password = undefined;
  this.jar = request.jar(); // Cookie jar
};

/**
 * Set the credentials (username and password) for this Auth instance.
 * @param username Username to set
 * @param password Password to set
 */
Auth.prototype.setCredentials = function(username, password) {
  this.username = username;
  this.password = password;
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
    if(response && response.statusCode !== 200 && !error) {
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
    if(response && response.statusCode !== 200) {
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
 * Parse an auth token from Html.
 * @param html Html to look through
 * @return auth token if found, undefined if not found
 */
Auth.prototype.parseAuthToken = function(html) {
  var patt = /initChatVariables\(".?",".?",".?",".?","[^"]+","[^"]+","(.+)"/,
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
 * Get the token for a room, assuming this Auth is already logged in.
 * Basically V7 version of fetchAuthkey.
 * @param roomname Name of room to get token for
 * @param callback Callback(error, token)
 */
Auth.prototype.fetchAuthToken = function(roomname, callback) {
  var auth = this;

  request({
    uri: 'https://www.picarto.tv/live/channel.php?watch=' + roomname.toLowerCase(),
    followRedirect: false,
    jar: this.jar,
    headers: this.getRequestHeaders()
  }, function(error, response, body) {
    // Check status code
    if(response && !error) {
      var status = response.statusCode;
      if(status !== 200 && status !== 302) {
        error = new Error('Unexpected status code while fetching auth token: ' + status);
      }
    }

    // Try to parse the auth token
    var authToken;
    if(!error) {
      authToken = auth.parseAuthToken(body);
      if(!authToken) {
        error = new Error('Error parsing auth token');
      }
    }

    if(callback) {
      callback(error, authToken);
    }
  });
};

module.exports = { Auth: Auth, Client: Client };
