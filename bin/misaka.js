var fs = require('fs');
var path = require('path');
var Config = require(path.join(__dirname, '..', 'lib', 'config')).Config;
var Picarto = require(path.join(__dirname, '..', 'lib', 'picarto'));
var Command = require(path.join(__dirname, '..', 'lib', 'command'));
var CommandProcessor = require(path.join(__dirname, '..', 'lib', 'command_processor'));

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
  this.cmdproc = new CommandProcessor();
  this.commands = {};
  this.initModules();

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
  this.modules = [];

  var dir = path.join(__dirname, '..', 'lib', 'modules');
  var loaded = [];

  var list = fs.readdirSync(dir);
  list.forEach(function(file) {
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
    misaka.loadModule(module);
  });
};

Misaka.prototype.loadModule = function(Module) {
  var misaka = this;
  var module = new Module();

  // Set the 'parent' field of the module instance
  module.parent = this;

  if(!(module.info instanceof Object)) {
    return;
  }

  //if(module.info.command !== undefined) {
  //  this.commands[module.info.command] = module;
  //}

  var cmds = Command.getAllFromModule(module);
  cmds.forEach(function(c) {
    // Warn if overwriting an existing module by name
    var existing = misaka.commands[c.name];
    if(existing) {
      console.warn('Overwriting command ' + existing.getFullName() + ' with ' + c.getFullName());
    }

    misaka.commands[c.name] = c;
    console.log('Added command ' + c.getFullName());
  });
};

Misaka.prototype.initRoom = function(room) {
  var misaka = this;

  room.onMessage(function(snapshot) {
    var data = snapshot.val();
    console.log(data.user + ': ' + data.message);

    // Check if command
    if(misaka.cmdproc.isCommand(data.user, data.message)) {
      var cmdname = misaka.cmdproc.getCommandName(data.message);

      var command = misaka.commands[cmdname];
      if(command) {
        // For now, result is message to say in chat
        result = command.execute(data.message);

        if(result !== undefined) {
          room.message(result);
        }
      } else {
        console.warn('No module found for command: ' + cmdname);
      }
    }

    //if(data.user === 'saneki' && data.message === '!time') {
    //  room.message('Current time: ' + (new Date()).toString());
    //}

  }).onUserJoin(function(snapshot) {
    var data = snapshot.val();
    console.log('*** ' + data.chatUsername + ' has joined the room ***');
  }).onUserLeave(function(snapshot) {
    var data = snapshot.val();
    console.log('*** ' + data.chatUsername + ' has left the room ***');
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
