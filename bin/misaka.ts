/// <reference path="../typings/tsd.d.ts" />

import async = require('async');
import fs = require('fs');
import i18n = require('i18next');
import minimist = require('minimist');
import path = require('path');
//import _ = require('underscore');

var Config = require(path.join(__dirname, '..', 'lib', 'config')).Config;
var DbManager = require(path.join(__dirname, '..', 'lib', 'db_manager'));
var Picarto = require(path.join(__dirname, '..', 'lib', 'picarto'));
var Bot = require(path.join(__dirname, '..', 'lib', 'bot'));
var CommandProcessor = require(path.join(__dirname, '..', 'lib', 'command_processor'));
var MessageQueue = require(path.join(__dirname, '..', 'lib', 'message_queue'));
var ModuleHelper = require(path.join(__dirname, '..', 'lib', 'module_helper'));
var ModuleManager = require(path.join(__dirname, '..', 'lib', 'module_manager'));
var SocketInterface = require(path.join(__dirname, '..', 'lib', 'interfaces', 'socket_interface'));
var logger = require(path.join(__dirname, '..', 'lib', 'logger'));

var t = function(str: string, data?: any) {
  if (data) {
    return i18n.t(str, <I18nTranslateOptions>data);
  } else {
    return i18n.t(str);
  }
};

var resources: IResourceStore = {
  'en-US': {
    translation: {
      connected: 'Connected',
      disconnected: 'Disconnected',
      chat: {
        clear: 'Room chat has been cleared by __executioner__'
      },
      command: {
        disabled: 'Command (or parent module) is disabled: __command__',
        notFound: 'No command found: __command__'
      },
      history: {
        begin: 'History Begin',
        end: 'History End'
      },
      message: {
        remove: 'Message __id__ has been removed by __executioner__'
      },
      raffle: {
        won: '__winner__ won __host__\'s raffle'
      },
      stream: {
        offline: '__channel__ is now offline.',
        online: '__channel__ is now online!'
      },
      user: {
        added: '__username__ has joined the room',
        changed: '__username__ has changed in some way',
        removed: '__username__ has left the room',
        clear: 'All messages from __user__ have been removed by __executioner__',
        list: 'Users in room: __usernames__',
        none: 'No users in the room'
      },
      whisper: {
        incoming: '__username__ whispered: __message__',
        outgoing: 'Whispered to __username__: __message__'
      }
    }
  }
};

class Misaka {

  private argv: any;
  private bot: any;
  private config: any;
  private helper: any;
  private cmdproc: any;
  private modules: any;
  private queues: any;
  private _db: any;
  private _interface: any;

  constructor() {
    this.initArgs();

    if(this.argv.help) {
      this.printHelp();
      process.exit();
    }

    this.initI18n();
    this.initLoggerLevel();

    if(this.argv['clear-sockets']) {
      logger.log('debug', 'Clearing sockets');
      this.clearSockets();
    }

    if(!this.argv['tls-reject-unauthorized']) {
      logger.log('debug', 'Disabling NODE_TLS_REJECT_UNAUTHORIZED');
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }

    // Try to initialize config
    if(!this.initConfig()) {
      logger.error('Couldn\'t read config file, aborting');
      process.exit(1);
    } else {
      logger.log('debug', 'Loaded config', { path: this.argv.config });
    }

    this.initLogger();
    this.initDbManager();
    this.initInterface();

    // For now, commands just an object: name -> module with onCommand
    this.helper = new ModuleHelper();
    this.cmdproc = new CommandProcessor();
    this.modules = new ModuleManager(this, {}, 7);
    this.initModules();

    // Message queues for rooms
    this.queues = {};

    // argv overrides config
    if(this.argv.room) this.config.setRoom(this.argv.room);

    if(this.config.getRooms().length === 0) {
      logger.error('No room to join specified, aborting');
      process.exit(1);
    }

    this.initBot();
  }

  initArgs() {
    var argv = this.argv = minimist(process.argv.slice(2), {
      alias: {
        help: ['h'],
        room: ['r'],
        config: ['c'],
        'clear-sockets': ['s'],
        'no-tls-reject-unauthorized': ['t']
      },
      boolean: ['help', 'tls-reject-unauthorized', 'clear-sockets'],
      string: ['config', 'room'],
      default: {
        config: Config.getDefaultPath('misaka'),
        help: false,
        'clear-sockets': false,
        'tls-reject-unauthorized': true
      }
    });

    if(argv['no-tls-reject-unauthorized'])
      argv['tls-reject-unauthorized'] = false;
  }

  /**
   * Initialize the bot.
   */
  initBot() {
    var misaka = this,
        bot = this.bot = new Bot({
      username: this.config.getUsername(),
      password: this.config.getPassword(),
      authtoken: this.config.getAuthToken(),
      color: this.config.getColor(),
      room: this.config.getRooms()[0],
      unescape: true
    });

    bot.connect(function(error, client) {
      if(!error) {
        misaka.setupEvents(client);
      } else {
        logger.error(error, { msg: 'Error connecting to room', room: misaka.getConfig().getRooms()[0] });
        process.exit(1);
      }
    });
  }

  initI18n() {
    i18n.init({
      lng: 'en-US',
      resStore: resources,
      //shortcutFunction: 'sprintf',
      // Disable key (.) and namespace (:) support to make i18next play
      // more like i18n for now
      //keyseparator: undefined,
      //nsseparator: undefined
    }, function() {
      logger.log('debug', 'i18next initialized');
    });
  }

  /**
   * Clear all sockets.
   */
  clearSockets() {
    SocketInterface.clear();
  };

  /**
   * Setup events for a client.
   * @param client Client
   */
  setupEvents(client: any) {
    var misaka: Misaka = this,
        socket: any = client.getSocket(),
        roomname: string = misaka.config.getRooms()[0];

    this.initMessageQueue(client);
    // Consider room joined
    this.fireRoomJoin(roomname);

    // Note: i18next typescript has no isInitialized()?
    //if(i18n.isInitialized()) {
      this.fireI18n();
    //} else {
    //  logger.error('i18next still hasn\'t initialized, aborting');
    //  throw new Error('i18next not initialized');
    //}

    console.log(t('connected'));

    socket.on('disconnect', function() {
      console.log(t('disconnected'));
    });

    socket.on('meMsg', function(data) {
      misaka.print('** ' + data.username + ' ' + data.msg + ' **');
    });

    socket.on('srvMsg', function(msg) {
      misaka.print('** [Server] ' + msg + ' **');
    });

    socket.on('whisper', function(data) {
      // If enableReply === false, is from Misaka
      var fromMe = !data.enableReply,
          username = data.username,
          message = data.msg;

      if(fromMe) {
        misaka.print(t('whisper.outgoing', { username: username, message: message }));
      } else {
        misaka.print(t('whisper.incoming', { username: username, message: message }));
      }

      // Check if command
      if(!fromMe && misaka.cmdproc.isCommand(username, message)
          && username.toLowerCase() != misaka.getConfig().getUsername().toLowerCase()) {
        misaka.processCommand(data, 'whisper');
      }
    });

    socket.on('userMsg', function(data) {
      if(!data.history) {
        var username = data.username,
            message = data.msg;

        misaka.print(username + ': ' + message);

        var db = misaka.getDbManager();

        db.insertMessageToLog(roomname, username, message, function(err) {
          if(err) {
            logger.error(err, { msg: 'Error logging message' });
          }
        });

        // Check if command
        if(misaka.cmdproc.isCommand(username, message)
            && username.toLowerCase() != misaka.getConfig().getUsername().toLowerCase()) {
          misaka.processCommand(data, 'chat');
        }
      }
    });

    socket.on('clearChat', function(data) {
      misaka.print('*** ' + t('chat.clear', data) + ' ***');
    });

    socket.on('removeMsg', function(data) {
      logger.log('debug', t('message.remove', data));
    });

    socket.on('clearUser', function(data) {
      logger.log('debug', t('user.clear', data));
    });

    socket.on('wonRaffle', function(data) {
      misaka.print('*** ' + t('raffle.won', data) + ' ***');
    });

    socket.on('adultMode', function(enabled) {
      logger.log('debug', 'adultMode', { enabled: enabled });
    });

    socket.on('commissionsAvailable', function(available) {
      logger.log('debug', 'commissionsAvailable', { available: available });
    });

    socket.on('contentType', function() {
      logger.log('debug', 'contentType');
    });

    socket.on('descriptionChange', function() {
      logger.log('debug', 'descriptionChange');
    });

    socket.on('commissionInfoChanged', function() {
      logger.log('debug', 'commissionInfoChanged');
    });

    socket.on('gameMode', function() {
      logger.log('debug', 'gameMode');
    });

    socket.on('warnAdult', function() {
      logger.log('debug', 'warnAdult');
    });

    socket.on('warnMovies', function() {
      logger.log('debug', 'warnMovies');
    });

    socket.on('multiStatus', function(a) {
      logger.log('debug', 'multiStatus', a);
    });

    client.on('history', function(history) {
      console.log('--- ' + t('history.begin') + ' ---');
      history.forEach(function(data) {
        console.log(data.username + ': ' + data.msg);
      });
      console.log('--- ' + t('history.end') + ' ---');
    });

    var onlineWatcher = client.getOnlineWatcher();

    onlineWatcher.on('mainStateChanged', function(online) {
      logger.log('debug', 'mainStateChanged detected', { online: online });
      if(online) {
        misaka.send(t('stream.online', { channel: roomname }));
      } else {
        misaka.send(t('stream.offline', { channel: roomname }));
      }
    });

    onlineWatcher.on('stateChanged', function(channel, online) {
      logger.log('debug', 'stateChanged detected', { channel: channel, online: online });
    });

    // Setup userlist events
    var userList = client.getUserList();

    userList.on('initial', function(users) {
      var usernames = [];
      users.forEach(function(user) {
        if(!user.banned) {
          usernames.push(user.username);
        }
      });

      if(usernames.length !== 0) {
        //console.log(t('Users in room: %s', usernames.join(', ')));
        console.log(t('user.list', { usernames: usernames.join(', ') }));
      } else {
        //console.log(t('No users in the room'));
        console.log(t('user.none'));
      }
    });

    userList.on('userAdded', function(user) {
      misaka.print('*** ' + t('user.added', { sprintf: { username: user.username } }) + ' ***');
    });

    userList.on('userChanged', function(diff) {
      misaka.print('*** ' + t('user.changed', { username: diff[0].username }) + ' ***');
    });

    userList.on('userRemoved', function(user) {
      misaka.print('*** ' + t('user.removed', { username: user.username }) + ' ***');
    });
  }

  /**
   * Whisper something to a user. This function is a bit weird because it's meant
   * to be passed as a part of command data, so when used with one arg (message) it
   * responds to the command sender. With two args, it assumes (user, message).
   * @param roomname Room name
   * @param sender Command sender
   * @param message Message (or user to whisper, if 4 args)
   * @param [realMessage] Message if 4 args
   */
  whisper(roomname: string, sender: string, message: string, realMessage?: string) {
    if(arguments.length === 4) {
      sender = message;
      message = realMessage;
    }

    this.send('/w ' + sender + ' ' + message);

    //var client = this.getBot().getClientManager().getClient(roomname);
    //if(client) {
    //  client.whisper(sender, message);
    //}
  };

  /**
   * Process a command message given a message object.
   * @param data Message object received from userMsg event.
   * @param mode Message mode, 'chat' or 'whisper'
   */
  processCommand(data: any, mode: string) {
    var misaka: Misaka = this,
        username: string = data.username,
        message: string = data.msg,
        cmdname: string = misaka.cmdproc.getCommandName(message),
        command: any = misaka.getCommand(cmdname),
        roomname: string = this.config.getRooms()[0],
        client: any = this.getBot().getClientManager().getClient(roomname),
        user: Object = client.getUserList().getUser(username);

    if(command && command.isEnabled() && command.isMasterOnly()
      && username !== misaka.getMasterName()) {
      logger.warn('Non-master trying to use a master-only command', { username: username, command: command.name() });
    } else if(command && !command.canBeUsed(username)) {
      logger.warn('Cooldown prevented command execution', { username: username, command: command.name() });
      this.whisper(roomname, username, 'Your command was ignored due to cooldown, please try again in a few seconds');
    } else if(command && command.isEnabled()) {
      command.used(username);

      var send = Misaka.prototype.send.bind(misaka, roomname),
          whisper = Misaka.prototype.whisper.bind(misaka, roomname, username),
          respond = (mode === 'chat' ? send : whisper);

      var result = command.execute({
        client: client,
        database: this.getDbManager(),
        helper: misaka.helper, // Module helper
        logger: logger,
        message: message, // Full message
        mode: mode,
        parent: misaka,
        parsed: misaka.helper.parseCommandMessage(message),
        respond: respond,
        room: { name: roomname }, // Backwards compatibility for modules
        roomname: roomname,
        send: send,
        sender: username,
        user: user, // User object of sender
        whisper: whisper
      });

      // If a result was returned, assume it's a message, enqueue
      if(result !== undefined) {
        // Changing from `send` to `respond` may cause issues?
        // misaka.send(roomname, result);
        respond(result);
      }
    } else if(!command) {
      misaka.print(t('command.notFound', { command: cmdname }));
    } else if(!command.isEnabled()) {
      misaka.print(t('command.disabled', { command: cmdname }));
    }
  };

  /**
   * Initialize the config file at the default path
   * (config/misaka.json)
   * @return true on success, false on error loading config
   */
  initConfig(): boolean {
    this.config = new Config();
    this.config.createDirectorySync();

    var success: boolean = false;
    try {
      success = this.config.readSync(this.argv.config);
    } catch (e) {
      logger.error(e, 'Error reading config');
    }

    return success;
  };

  /**
   * Initialize the database manager.
   */
  initDbManager() {
    this._db = new DbManager({
      // path: this.config.getDbPath()
      config: this.config.getDb()
    });
  };

  /**
   * Initialize the interface (for now, always the SocketInterface).
   */
  initInterface() {
    var send = Misaka.prototype.send.bind(this);

    this._interface = new SocketInterface();
    this._interface.on('sendMsg', function(msg) {
      send(msg);
    });
  };

  /**
   * Get the database manager instance.
   * @return {DbManager} Database manager instance
   */
  getDbManager(): any {
    return this._db;
  };

  initModules() {
    this.modules.loadFromDirectory();

    // Load from lib/modules/private if it exists
    var privPath = path.join(__dirname, '..', 'lib', 'modules', 'private'),
        stat = fs.statSync(privPath);

    if(stat && stat.isDirectory()) {
      this.modules.loadFromDirectory(privPath);
    }

    logger.info(this.modules.toString());
  }

  /**
   * Initialize the logger level. This allows for logging after parsing argv
   * but before loading the config file.
   */
  initLoggerLevel() {
    if(this.argv.debug) {
      logger.setLevel('debug');
    }
  }

  /**
   * Initialize the singleton logger.
   */
  initLogger() {
    // Set logging config stuff
    if(this.config.logging) {
      if(this.config.logging.detection !== undefined) {
        logger.enableDetection(!!this.config.logging.detection);
      }
    }

    if(this.argv.debug) {
      logger.setLevel('debug');
    }
  }

  /**
   * Set all queues to connected or disconnected.
   * @param c Connected state, true if connected or false
   *          if disconnected
   */
  setConnected(c: boolean) {
    for(var key in this.queues) {
      var queue = this.queues[key];
      if(queue) {
        queue.setConnected(c);
      }
    }
  };

  /**
   * Send a message, which really just pushes the message to
   * the room's message queue.
   * @param roomname Name of room to send message to
   * @param message Message to send
   */
  send(roomname: string, message?: string) {
    // If only one arg, assume message and use the default room name
    if (message == null) {
      message = roomname;
      roomname = this.config.getRooms()[0];
    }
    //if(arguments.length === 1) {
    //  message = roomname;
    //  roomname = this.config.getRooms()[0];
    //}

    var queue: any = this.queues[roomname];
    if(queue) {
      queue.push(message);
    } else {
      logger.warn('Cannot push message to non-existant queue', { room: roomname });
    }
  };

  /**
   * Initialize the message queue for a given room.
   * @param client Client the message queue is for
   */
  initMessageQueue(client: any) {
    var queue = new MessageQueue({
      send: Picarto.Client.prototype.sendMessage.bind(client),
      wait: 1000
    });

    var roomname: string = this.config.getRooms()[0];
    this.queues[roomname] = queue;
  };

  /**
   * Get the bot instance.
   * @return bot instance
   */
  getBot(): any {
    return this.bot;
  };

  /**
   * Chat version Misaka is for.
   * @return chat version as number
   */
  getChatVersion(): number {
    return 7;
  }

  /**
   * Get the command processor.
   * @return {CommandProcessor} processor
   */
  getCommandProcessor(): any {
    return this.cmdproc;
  };

  /**
   * Get the config object.
   * @return config object
   */
  getConfig(): any {
    return this.config;
  }

  /**
   * Get the master user's name if we have one.
   * @return master user's name, or undefined if none
   */
  getMasterName(): string {
    return this.config.getMaster();
  }

  /**
   * Get the module manager.
   * @return Module manager
   */
  getModuleManager(): any {
    return this.modules;
  };

  /**
   * Get a command by name.
   * @param name Command name
   * @return command instance if found, undefined if not found
   */
  getCommand(name: string): any {
    return this.modules.getCommand(name.toLowerCase());
  }

  /**
   * Get a module by name.
   * @param name Module name
   * @return module instance if found, undefined if not found
   */
  getModule(name: string): any {
    return this.modules.get(name.toLowerCase());
  }

  /**
   * Check if a command is enabled.
   * @param command Command instance or name as a string. If
   *        a string is given, will return false if command
   *        not found.
   * @return true if command enabled, false if not enabled
   *         (or command not found)
   */
  isCommandEnabled(command: any|string): boolean {
    if(command instanceof String) {
      command = this.getCommand(command);
      if(!command) return false; // Command not found, return false
    }

    // If command has a module, check if that's enabled too
    return command.isEnabled(); // && (command.module ? command.module.enabled : true);
  }

  /**
   * Fire the 'i18n' event for all modules, indicating that i18next has initialized.
   */
  fireI18n() {
    this.modules.forEach(function(module) {
      module.emit('i18n');
    });
  }

  /**
   * Fire the 'join' event for all modules. Should probably move this later.
   * @param room Room name of joined room
   */
  fireRoomJoin(roomname: string) {
    var misaka = this;

    this.modules.forEach(function(module) {
      var config = misaka.config.getModuleConfig(module.name());
      if(!config) config = {};

      module.emit('join', {
        client: misaka.getBot().getClientManager().getClient(roomname),
        config: config,
        database: misaka.getDbManager(),
        logger: logger,
        parent: misaka,
        room: { name: roomname },
        roomname: roomname,
        send: Misaka.prototype.send.bind(misaka, roomname),
        whisper: Misaka.prototype.whisper.bind(misaka, roomname)
      });
    });
  }

  /**
   * Print something to console with a date string.
   * @param s String to print
   */
  print(s: string) {
    var date = (new Date()).toTimeString().split(' ')[0];
    console.log('[' + date + '] ' + s);
  }

  teardown(callback: Function) {
    var asyncTasks = [];

    // If interface, close it
    if(this._interface) {
      asyncTasks.push(this._interface.close.bind(this._interface));
    }

    async.parallel(asyncTasks, function() {
      // Assuming the logger hasn't been torn down
      logger.log('debug', 'Tearing down complete (async)', { count: asyncTasks.length });

      if(callback) {
        callback();
      }
    });
  }

  printHelp() {
    console.log('Misaka - picarto.tv bot');
    console.log('usage: misaka [options]');
    console.log('');
    console.log('options:');
    console.log('  -h, --help    print this help message');
    console.log('  -r, --room    room to join');
    console.log('  -s, --clear-sockets');
    console.log('  -t, --no-tls-reject-unauthorized');
    console.log('  --debug       enable debug logger');
  }

}

var misaka: Misaka = new Misaka();

// Handle SIGINT and stuff
(function() {
  process.stdin.resume();
  process.on('SIGINT', function() {
    misaka.teardown(function() {
      process.exit();
    });
  });
})();
