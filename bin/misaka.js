var fs = require('fs');
var path = require('path');
var Config = require(path.join(__dirname, '..', 'lib', 'config')).Config;
var Picarto = require(path.join(__dirname, '..', 'lib', 'picarto'));
var Command = require(path.join(__dirname, '..', 'lib', 'command'));
var CommandProcessor = require(path.join(__dirname, '..', 'lib', 'command_processor'));
var MessageQueue = require(path.join(__dirname, '..', 'lib', 'message_queue'));
var ModuleHelper = require(path.join(__dirname, '..', 'lib', 'module_helper'));

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

  // For now, commands just an object: name -> module with onCommand
  this.helper = new ModuleHelper();
  this.cmdproc = new CommandProcessor();
  this.modules = {};
  this.commands = {};
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
  var misaka = this;

  var dir = path.join(__dirname, '..', 'lib', 'modules');
  var loaded = [];

  var list = fs.readdirSync(dir);
  list.forEach(function(file) {
    // Only consider a module file if it matches specified pattern
    if(!/^mod_.*\.js$/.test(file)) {
      return;
    }

    var fpath = path.join(dir, file);

    // Try to require the module
    try {
      loaded.push(require(fpath));
    } catch(e) {
      console.warn('Error loading module at ' + fpath + ': ', e);
    }
  });

  console.log('Loaded ' + loaded.length + ' module(s)');

  // Load each module
  loaded.forEach(function(module) {
    // Todo: somehow get filepath/filename from module
    if(module instanceof Function) {
      misaka.loadModule(module);
    } else {
      console.warn('exports of module is not a function, ignoring');
    }
  });
};

Misaka.prototype.loadModule = function(Module) {
  var misaka = this;

  var module = new Module();
  this.helper.wrapModule(module); // Wrap module instance with stuff

  var existing = this.modules[module.info.name.toLowerCase()];
  if(existing) {
    console.warn('Overwriting existing module with name ' + module.info.name);
  }
  this.modules[module.info.name.toLowerCase()] = module;

  // Set the 'parent' field of the module instance
  module.parent = this;

  if(!(module.info instanceof Object)) {
    return;
  }

  var cmds = Command.getAllFromModule(module);
  cmds.forEach(function(c) {
    misaka.helper.wrapCommand(c);

    // Warn if overwriting an existing module by name
    var existing = misaka.commands[c.name];
    if(existing) {
      console.warn('Overwriting command ' + existing.getFullName() + ' with ' + c.getFullName());
    }

    misaka.commands[c.name] = c;
    console.log('Added command ' + c.getFullName());
  });
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
  return this.commands[name.toLowerCase()];
};

/**
 * Get a module by name.
 * @param name Module name
 * @return module instance if found, undefined if not found
 */
Misaka.prototype.getModule = function(name) {
  return this.modules[name.toLowerCase()];
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
  return command.enabled && (command.module ? command.module.enabled : true);
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

      // Hardcoded check for now: Only master can use enable/disable
      if(cmdname.toLowerCase() === 'enable' || cmdname.toLowerCase() === 'disable') {
        if(username !== misaka.getMasterName()) {
          console.warn('Non-master trying to use enable/disable');
          return;
        }
      }

      var command = misaka.getCommand(cmdname);
      if(command && misaka.isCommandEnabled(command)) {

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
      } else {
        console.warn('Command (or parent module) is disabled: ' + cmdname);
      }
    }

  }).onUserJoin(function(snapshot) {
    //var data = snapshot.val();
    console.log('*** ' + snapshot.username + ' has joined the room ***');
  }).onUserLeave(function(snapshot) {
    //var data = snapshot.val();
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
