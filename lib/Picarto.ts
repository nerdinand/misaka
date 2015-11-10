import events = require('events');
import io = require('socket.io-client');
import path = require('path');
import request = require('request');
var _ = require('underscore');

import { UserList } from './UserList'
import { OnlineWatcher } from './OnlineWatcher'
import logger from './Logger'

/**
 * Client for V7 chat.
 */
export class Client {
  private channel: any;
  private token: any;
  private userList: any;
  private onlineWatcher: any;

  private awaitingHistory: any;
  private history: any;
  private emitter: any;
  private socket: any;

  constructor(opts: any) {
    if(!opts) opts = {};

    this.channel = opts['channel'];
    this.token = opts['token'];
    this.userList = undefined;
    this.onlineWatcher = undefined;

    // Awaiting history until channelUsers event (UserList's "initial" event)
    this.awaitingHistory = true;
    this.history = [];

    this.emitter = new events.EventEmitter();
  }

  /**
   * Connect to the websocket server with an authentication token.
   * @param token Auth token (optional)
   * @return socket
   */
  connectWithToken(token?: string): any {
    // Make sure we have a token
    if(!token) {
      token = this.token;
      if(!token) {
        logger.error('Cannot connect to V7 chat without a token');
        return;
      }
    }

    logger.log('debug', 'Connecting to socket.io server');
    var socket = this.socket = io.connect('https://nd1.picarto.tv:443', {
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
  }

  initOnlineWatcher() {
    this.onlineWatcher = new OnlineWatcher(this.getChannel());
    this.onlineWatcher.setSocket(this.socket);
  }

  /**
   * Initialize the user list. Assumes socket has been set (this.socket).
   */
  initUserList() {
    var userList = this.userList = new UserList();
    userList.setSocket(this.socket);
  }

  /**
   * Initialize history stuff.
   */
  initHistory() {
    var client = this, userList = this.userList;

    this.socket.on('userMsg', function(data) {
      if(client.awaitingHistory) {
        data.history = true; // Mark this message as history
        client.history.push(data);
      }
    });

    this.socket.on('endHistory', function() {
      client.awaitingHistory = false;
      client.emit('history', client.history);
    });
  }

  /**
   * Get the channel name this Client was initialized with.
   * @return {String} Channel name
   */
  getChannel(): string {
    return this.channel;
  }

  /**
   * Get the online watcher.
   * @return {Object} Online watcher
   */
  getOnlineWatcher(): any {
    return this.onlineWatcher;
  }

  /**
   * Get the socket of this client.
   * @return socket
   */
  getSocket(): any {
    return this.socket;
  }

  /**
   * Get this client's UserList for managing user events.
   * @return UserList
   */
  getUserList(): any {
    return this.userList;
  }

  /**
   * Send a request to set this client's color.
   * @param color Color to set to, should be exactly 6 hex characters
   *              (otherwise it will be ignored by the server)
   */
  setColor(color: string) {
    this.socket.emit('setColor', color);
  }

  /**
   * Send a message.
   * @text Text of message to send
   */
  sendMessage(text: string) {
    this.socket.emit('chatMsg', { msg: text });
  }

  /**
   * Send a chat command.
   * @param cmd Command name
   * @param arg Everything that follows the command name
   */
  sendCommand(cmd: string, arg: string) {
    this.sendMessage('/' + cmd + ' ' + arg);
  }

  /**
   * Send a ban command.
   * @param username Username of user to ban
   */
  ban(username: string) {
    this.sendCommand('b', username);
  }

  /**
   * Send an unban command.
   * @param username Username of user to unban
   */
  unban(username: string) {
    this.sendCommand('ub', username);
  }

  /**
   * Send a mod command.
   * @param username Username of user to become a moderator
   */
  mod(username: string) {
    this.sendCommand('m', username);
  }

  /**
   * Send an unmod command.
   * @param username Username of user to remove from moderators
   */
  unmod(username: string) {
    this.sendCommand('um', username);
  }

  /**
   * Send a kick command.
   * @param username Username of user to kick
   */
  kick(username: string) {
    this.sendCommand('kick', username);
  }

  /**
   * Whisper another user.
   * @param username Username of user to whisper
   * @param text Text to whisper
   */
  whisper(username: string, text: string) {
    this.sendCommand('w', username + ' ' + text);
  }

  /**
   * Wrapper for emitter.emit.
   */
  emit(event: string, ...args: any[]): boolean {
    return this.emitter.emit(event, args);
  }

  /**
   * Wrapper for emitter.on.
   */
  on(event: string, listener: Function): Client {
    this.emitter.on(event, listener)
    return this;
  }
}

/**
 * Handle picarto's web authentication procedure, used
 * mainly for getting an authkey for an account.
 */
export class Auth {
  private username: string;
  private password: string;
  private jar: request.CookieJar;

  constructor() {
    this.username = undefined;
    this.password = undefined;
    this.jar = request.jar(); // Cookie jar
  }

  /**
   * Set the credentials (username and password) for this Auth instance.
   * @param username Username to set
   * @param password Password to set
   */
  setCredentials(username: string, password: string) {
    this.username = username;
    this.password = password;
  }

  /**
   * Fetch a PHPSESSID cookie.
   * @param callback Callback
   */
  fetchSessionCookie(callback: Function) {
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
  }

  /**
   * Attempt to login to picarto.
   * @param username Username to login with
   * @param password Password to login with
   * @param callback Callback
   */
  login(username: string, password: string, callback: Function) {
    var auth = this, data = { username: username, password: password, staylogged: false };

    request({
      uri: 'https://picarto.tv/process/login',
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
  }

  /**
   * Parse an auth token from Html.
   * @param html Html to look through
   * @return auth token if found, undefined if not found
   */
  parseAuthToken(html: string): string {
    var patt = /initChatVariables\(.*,'(.+)'\)/,
        match = patt.exec(html);

    if(match) {
      return match[1];
    }
  }

  /**
   * Check if a login was successful from the body of the
   * response.
   * @param html Html received in response
   * @return true if successful, false if not
   */
  wasLoginSuccessful(response: string): boolean {
    var json = JSON.parse(response);
    logger.log('debug', 'Login object', { json: json });
    return json['loginstatus'] === true;
  }

  /**
   * Get the headers to send with requests.
   * @return headers object
   */
  getRequestHeaders(): Object {
    return { 'Referer': 'https://www.picarto.tv/live/index.php' };
  }

  /**
   * Get the token for a room, assuming this Auth is already logged in.
   * Basically V7 version of fetchAuthkey.
   * @param roomname Name of room to get token for
   * @param callback Callback(error, token)
   */
  fetchAuthToken(roomname: string, callback: Function) {
    var auth = this;

    request({
      uri: 'https://picarto.tv/' + roomname,
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
  }
}
