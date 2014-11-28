var fs = require('fs');
var path = require('path');
var Config = require(path.join(__dirname, '..', 'lib', 'config')).Config;
var Picarto = require(path.join(__dirname, '..', 'lib', 'picarto'));
var CommandProcessor = require(path.join(__dirname, '..', 'lib', 'command_processor'));
var MessageQueue = require(path.join(__dirname, '..', 'lib', 'message_queue'));
var ModuleHelper = require(path.join(__dirname, '..', 'lib', 'module_helper'));
var ModuleManager = require(path.join(__dirname, '..', 'lib', 'module_manager'));
var logger = require(path.join(__dirname, '..', 'lib', 'logger'));

var Misaka = function() {
  this.initArgs();

  if(this.argv.help) {
    this.printHelp();
    process.exit();
  }

  // Try to initialize config
  if(!this.initConfig()) {
    console.error('Couldn\'t read config file, aborting');
    process.exit(1);
  }

  this.initLogger();

  // For now, commands just an object: name -> module with onCommand
  this.helper = new ModuleHelper();
  this.cmdproc = new CommandProcessor();
  this.modules = new ModuleManager();
  this.initModules();

  // Message queues for rooms
  this.queues = {};

  // argv overrides config
  if(this.argv.room) this.config.room = this.argv.room;

  if(this.config.room === undefined) {
    console.error('No room to join specified, aborting');
    process.exit(1);
  }

  this.initClient();
};

Misaka.prototype.initArgs = function() {
  this.argv = require('minimist')(process.argv.slice(2));

  if(this.argv.h) this.argv.help = true;
  if(this.argv.r) this.argv.room = this.argv.r;
};

Misaka.prototype.initClient = function() {
  if(this.config === undefined) {
    return new Error('Cannot initialize client without config');
  }

  this.client = new Picarto.Client({
    authkey: this.config.authkey,
    color: this.config.color,
    username: this.config.username
  });

  // Connect
  var misaka = this;
  this.client.initFirebase(function(err, authData) {
    // Join room
    var room = misaka.client.join(misaka.config.room);

    misaka.initRoom(room);
  });
};

/**
 * Initialize the config file at the default path
 * (config/misaka.json)
 * @return true on success, false on error loading config
 */
Misaka.prototype.initConfig = function() {
  var defaultPath = path.join(__dirname, '..', 'config', 'misaka.json');
  this.config = new Config();
  return this.config.readSync(defaultPath);
};

Misaka.prototype.initModules = function() {
  this.modules.loadFromDirectory();

  // Load from lib/modules/private if it exists
  var privPath = path.join(__dirname, '..', 'lib', 'modules', 'private'),
      stat = fs.statSync(privPath);

  if(stat && stat.isDirectory()) {
    this.modules.loadFromDirectory(privPath);
  }
};

/**
 * Initialize the singleton logger.
 */
Misaka.prototype.initLogger = function() {
  // Set logging config stuff
  if(this.config.logging) {
    if(this.config.logging.detection !== undefined) {
      logger.enableDetection(!!this.config.logging.detection);
    }
  }
};

/**
 * Send a message, which really just pushes the message to
 * the room's message queue.
 * @param roomname Name of room to send message to
 * @param message Message to send
 */
Misaka.prototype.send = function(roomname, message) {
  var queue = this.queues[roomname];
  if(queue) {
    queue.push(message);
  } else {
    console.warn('Cannot push message to non-existant queue: %s', roomname);
  }
};

/**
 * Initialize the message queue for a given room.
 * @param room Room the message queue is for
 */
Misaka.prototype.initMessageQueue = function(room) {
  var queue = new MessageQueue({
    send: Picarto.Room.prototype.message.bind(room),
    wait: 1000
  });

  this.queues[room.name] = queue;
};

/**
 * Get the master user's name if we have one.
 * @return master user's name, or undefined if none
 */
Misaka.prototype.getMasterName = function() {
  return this.config.master;
};

/**
 * Get a command by name.
 * @param name Command name
 * @return command instance if found, undefined if not found
 */
Misaka.prototype.getCommand = function(name) {
  return this.modules.getCommand(name.toLowerCase());
};

/**
 * Get a module by name.
 * @param name Module name
 * @return module instance if found, undefined if not found
 */
Misaka.prototype.getModule = function(name) {
  return this.modules.get(name.toLowerCase());
};

/**
 * Check if a command is enabled.
 * @param command Command instance or name as a string. If
 *        a string is given, will return false if command
 *        not found.
 * @return true if command enabled, false if not enabled
 *         (or command not found)
 */
Misaka.prototype.isCommandEnabled = function(command) {
  if(command instanceof String) {
    command = this.getCommand(command);
    if(!command) return false; // Command not found, return false
  }

  // If command has a module, check if that's enabled too
  return command.isEnabled(); // && (command.module ? command.module.enabled : true);
};

/**
 * Fire the 'join' event for all modules. Should probably
 * move this later.
 * @param room Joined room
 */
Misaka.prototype.fireRoomJoin = function(room) {
  var misaka = this;
  this.modules.forEach(function(module) {
    var callback = module.getCallback('join');
    if(callback) {
      callback({
        room: room,
        send: Misaka.prototype.send.bind(misaka, room.name)
      });
    }
  });
};

Misaka.prototype.initRoom = function(room) {
  var misaka = this;

  // Initialize the message queue for this room
  this.initMessageQueue(room);

  room.onMessage(function(snapshot) {
    var username = snapshot.username,
        message = snapshot.message;

    if(snapshot.whisper === undefined) {
      console.log(username + ': ' + message);
    } else {
      console.log(username + ' -> ' + snapshot.whisper + ': ' + message);
    }

    // Check if command
    if(misaka.cmdproc.isCommand(username, message)) {
      var cmdname = misaka.cmdproc.getCommandName(message);

      var command = misaka.getCommand(cmdname);
      if(command && command.isEnabled() && command.isMasterOnly()
        && username !== misaka.getMasterName()) {
        console.warn('Non-master trying to use a master-only command `' + command.name() + '`');
      }
      else if(command && command.isEnabled()) {

        result = command.execute({
          helper: misaka.helper, // Module helper
          message: message, // Full message
          parent: misaka,
          parsed: misaka.helper.parseCommandMessage(message),
          room: room, // Room this is from
          send: Misaka.prototype.send.bind(misaka, room.name)
        });

        // If a result was returned, assume it's a message, enqueue
        if(result !== undefined) {
          misaka.send(room.name, result);
        }
      } else if(!command) {
        console.warn('No command found: ' + cmdname);
      } else if(!command.isEnabled()) {
        console.warn('Command (or parent module) is disabled: ' + cmdname);
      }
    }

  }).onUserJoin(function(snapshot) {
    console.log('*** ' + snapshot.username + ' has joined the room *** (' + snapshot.snapshot.key() + ')');
  }).onUserLeave(function(snapshot) {
    console.log('*** ' + snapshot.username + ' has left the room ***');
  }).onHistory(function(history) {
    // Not a snapshot for now
    // This may not order correctly?
    console.log('--- History ---');
    for(var key in history) {
      var message = history[key];
      console.log(message.user + ': ' + message.message);
    }
    console.log('--- End History ---');

    // Hacky for now.. Consider this point as "room joined"
    misaka.fireRoomJoin(room);
  }).onWhisper(function(snapshot) {
    console.log('*whisper* ' + snapshot.from + ': ' + snapshot.message);
  });

  room.connect();
};

Misaka.prototype.printHelp = function() {
  console.log('Misaka - picarto.tv bot');
  console.log('usage: misaka [options]');
  console.log('');
  console.log('options:');
  console.log('  -h, --help    print this help message');
  console.log('  -r, --room    room to join');
};

var misaka = new Misaka();
