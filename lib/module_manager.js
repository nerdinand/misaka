var fs = require('fs');
var path = require('path');
var _ = require('underscore');
var Command = require(path.join(__dirname, 'command'));
var Module = require(path.join(__dirname, 'module'));

/**
 * Construct a ModuleManager. Handles modules and commands that are
 * loaded from them.
 * @param config Module config object
 * @param chatVersion Chat version this module manager is for (optional)
 */
function ModuleManager(config, chatVersion) {
  if(!config) config = {};

  this.chatVersion = chatVersion;
  if(this.chatVersion === undefined) this.chatVersion = 6;

  this.modules = {};
  this.commands = {};
  this.config = config;
};

/**
 * Get the chat version this module manager is for.
 * @return chat version as number
 */
ModuleManager.getChatVersion = function() {
  return this.chatVersion;
};

/**
 * Get the config object for a specific module.
 * @param name Module name to get config for
 * @return config object for specified module, or undefined if none
 */
ModuleManager.prototype.getConfig = function(name) {
  if(this.config[name]) {
    return this.config[name];
  }
};

/**
 * Do something for each module.
 * @param callback For-each callback
 */
ModuleManager.prototype.forEach = function(callback) {
  if(!callback) return;

  for(var key in this.modules) {
    var module = this.modules[key];
    callback(module);
  }
};

/**
 * Load commands from a module.
 * @param module Module instance
 */
ModuleManager.prototype.loadCommands = function(module) {
  var manager = this,
      cmds = module.commands();

  cmds.forEach(function(cmd) {
    var command = Command.fromInfo(module, cmd);

    if(command) {
      var existing = manager.commands[command.name().toLowerCase()];
      if(existing) {
        console.warn('Overwriting command ' + existing.getFullName() + ' with ' + command.getFullName());
      }

      manager.commands[command.name().toLowerCase()] = command;
    }
  });
};

/**
 * Unload all commands from a module.
 * @param module Module instance
 */
ModuleManager.prototype.unloadCommands = function(module) {
  var manager = this,
      cmds = module.commands();

  cmds.forEach(function(cmd) {
    var command = Command.fromInfo(module, cmd);
    var existing = manager.commands[command.name().toLowerCase()];

    // Check if the full names match, in which case same command from same module
    if(command.getFullName() === existing.getFullName()) {
      delete manager.commands[command.name().toLowerCase()];
    }
  });
};

/**
 * Get a loaded command by name.
 * @param name Command name
 * @return command instance, or undefined if none found
 */
ModuleManager.prototype.getCommand = function(name) {
  return this.commands[name.toLowerCase()];
};

/**
 * Load a module. If a module with the same name already exists, the existing module
 * will be unloaded and replaced with this module. This will emit the 'load' module
 * event.
 * @param module Module instance to load
 */
ModuleManager.prototype.load = function(module) {
  if(!module) return;

  if(!module.isVersionSupported(this.chatVersion)) {
    console.warn('Not loading module `' + module.name() + '` (doesn\'t support version ' + this.chatVersion + ')');
    return;
  }

  var name = module.name().toLowerCase(),
      existing = this.modules[name];

  if(existing) {
    console.warn('Overwriting existing module with name ' + module.name());
    this.unload(existing);
  }

  this.modules[name] = module;
  this.loadCommands(module);

  module.emit('load', this.getConfig(module.name()));
};

/**
 * Unload an already loaded module. This will emit the 'unload' module event.
 * @param modname Module name or instance to unload
 * @return true if module found and unloaded, false if nothing unloaded
 */
ModuleManager.prototype.unload = function(module) {
  if(_.isString(module)) {
    module = this.get(module);
  }

  if(module && module.isUnloadable()) {
    this.unloadCommands(module);
    delete this.modules[module.name()];
    module.emit('unload');
    return true;
  } else if(module) {
    console.warn('Cannot unload module: ' + module.name());
  }

  return false;
};

/**
 * Get a module by name.
 * @param name Name of module to get
 * @return module instance, or undefined if none
 */
ModuleManager.prototype.get = function(name) {
  return this.modules[name.toLowerCase()];
};

/**
 * Load all detected modules from a directory. This won't search recursively and
 * will only look for filenames matching mod_*.js.
 * @param dir Path to look in (optional)
 */
ModuleManager.prototype.loadFromDirectory = function(dir) {
  var manager = this,
      loaded = [];

  if(!dir) {
    dir = path.join(__dirname, 'modules');
  }

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
  loaded.forEach(function(ex) {
    // Todo: somehow get filepath/filename from module
    if(ex instanceof Function) {
      manager.loadFromExport(ex);
    } else {
      console.warn('exports of module is not a function, ignoring');
    }
  });
};

/**
 * Load a module from the export retrieved by calling require() on a file.
 * @param M export returned from require()
 */
ModuleManager.prototype.loadFromExport = function(M) {
  var module = new Module(M);
  this.load(module);
};

module.exports = ModuleManager;
