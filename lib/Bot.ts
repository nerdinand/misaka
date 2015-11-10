import path = require('path');
import ClientManager from './ClientManager';
import * as Picarto from './Picarto';
import logger from './Logger';

export interface BotOptions {
  username?: string;
  password?: string;
  authtoken?: string;
  room?: string;
  shouldUnescape?: boolean;
  color?: string;
  auth?: Picarto.Auth;
  manager?: ClientManager;
  authenticated?: boolean;
}

export interface BotLoginOptions {
  force?: boolean;
}

export class Bot {
  private username: string;
  private password: string;
  private authtoken: string;
  private room: string;
  private shouldUnescape: boolean;
  private color: string;
  private auth: any;
  private manager: any;
  private authenticated: boolean;

  constructor(opts: BotOptions) {
    this.username = opts['username'];
    this.password = opts['password'];
    this.authtoken = opts['authtoken'];
    this.room = opts['room'];
    this.shouldUnescape = opts['unescape'] || false;
    this.color = opts['color'];

    this.auth = new Picarto.Auth();
    this.manager = new ClientManager();

    this.authenticated = false;
  }

  /**
   * Get the auth token used to connect to the socket server.
   */
  getAuthToken(): string {
    return this.authtoken;
  }

  /**
   * Set the auth token.
   */
  setAuthToken(authToken: string) {
    this.authtoken = authToken;
  }

  hasAuthToken(): boolean {
    return this.authtoken != null;
  }

  /**
   * Have the bot join a room using the room and authtoken specified in
   * the constructor.
   */
  join(callback: (error: Error, client?: any) => void) {
    var bot = this,
        manager = this.manager,
        roomname = this.room,
        token = this.getAuthToken();
    manager.join(roomname, token, function(error: Error) {
      if(!error) {
        bot.initClient(manager.getClient(roomname));
      }
      if(callback) {
        callback(error, manager.getClient(roomname));
      }
    });
  }

  /**
   * Have the bot login. If already detected as logged in (and not
   * forcing a new login), don't re-login.
   * @param opts Map of options (optional)
   * @param callback Callback(error, success) (optional)
   */
  login(opts?: BotLoginOptions, callback?: (error: Error, success?: boolean) => void) {
    // If passed one argument (Function), use as callback
    //if(arguments.length === 1 && (opts instanceof Function)) {
    //  callback = opts;
    //  opts = undefined;
    //}

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
  }

  /**
   * Have the bot connect to the room. This will login if not yet
   * authenticated, then fetch the auth token from the room's Html
   * for connecting.
   * @param callback Callback(error, client)
   */
  connect(callback: (error: Error, client?: Picarto.Client) => void) {
    var bot = this,
        auth = this.auth,
        manager = this.manager,
        roomname = this.room;

    if(this.hasAuthToken()) {
      this.join(callback);
    } else {
      this.login(function(error, success) {
        if(!error && success) {
          logger.log('debug', 'Logged in, fetching auth token for room', { room: roomname });
          auth.fetchAuthToken(roomname, function(error: Error, token?: string) {
            if(!error) {
              logger.log('debug', 'Got auth token, joining room', { room: roomname });
              bot.authtoken = token;
              bot.join(callback);
              //manager.join(roomname, token, function(error) {
              //  if(!error) {
              //    bot.initClient(manager.getClient(roomname));
              //  }
              //  if(callback) {
              //    callback(error, manager.getClient(roomname));
              //  }
              //});
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
    }
  }

  /**
   * Initialize a client. This will do optional stuff.
   * @param client Client to initialize
   */
  initClient(client: any) {
    var bot: Bot = this;

    if(this.shouldUnescape) {
      // Replace msg data with unescaped msg data
      client.getSocket().on('userMsg', function(data) {
        data.msg = bot.unescape(data.msg);
      });
      client.getSocket().on('whisper', function(data) {
        data.msg = bot.unescape(data.msg);
      });
    }

    if(this.color !== undefined) {
      var color = this.color.replace('#', '');
      if(/^[a-f0-9]{6}$/i.test(color)) {
        client.setColor(color);
      } else {
        logger.warn('Invalid color, ignoring', { color: color });
      }
    }
  }

  /**
   * Get the auth manager used by this bot.
   * @return auth manager
   */
  getAuth(): any {
    return this.auth;
  }

  /**
   * Get the client manager of this bot.
   * @return client manager
   */
  getClientManager(): any {
    return this.manager;
  }

  /**
   * Get the room name this bot connects to.
   * @return room name
   */
  getRoomName(): string {
    return this.room;
  }

  /**
   * Get the client. Assumes one-room model.
   * @return client or undefined if none
   */
  getClient(): any {
    if(this.room !== undefined && this.manager !== undefined) {
      return this.manager.getClient(this.room);
    }
  }

  /**
   * Get the user object of this bot. Assumes one-room model.
   * @return bot's user object, or undefined if none
   */
  getSelf(): any {
    var client = this.getClient();
    if(this.username !== undefined && client) {
      return client.getUserList().getUser(this.username);
    }
  }

  /**
   * Unescape a string.
   * @param str String to unescape
   * @return unescaped string
   */
  unescape(str: string): string {
    // return entities.decode(str);
    str = str.replace(/&#38;/g, '&');
    str = str.replace(/&#60;/g, '<');
    str = str.replace(/&#62;/g, '>');
    str = str.replace(/&#39;/g, '\'');
    str = str.replace(/&#34;/g, '"');
    return str;
  }
}

export default Bot;
