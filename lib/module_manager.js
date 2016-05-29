var fs = require('fs');
var path = require('path');
var _ = require('underscore');
var Command = require(path.join(__dirname, 'command'));
var Module = require(path.join(__dirname, 'module'));
var logger = require(path.join(__dirname, 'logger'));

/**
 * Construct a ModuleManager. Handles modules and commands that are
 * loaded from them.
 * @param config Module config object
 * @param chatVersion Chat version this module manager is for (optional)
 */
function ModuleManager(misaka, config, chatVersion) {
  if(!config) config = {};

  this.misaka = misaka;
  this.chatVersion = (_.isNumber(chatVersion) ? chatVersion : 7);
  this.modules = {};
  this.commands = {};
  this.config = config;
};

/**
 * Get the Misaka instance.
 * @return {Misaka} misaka
 */
ModuleManager.prototype.getMisaka = function() {
  return this.misaka;
};

/**
 * Get the chat version this module manager is for.
 * @return chat version as number
 */
ModuleManager.prototype.getChatVersion = function() {
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
        logger.warn('Overwriting command', { old: existing.getFullName(), new: command.getFullName() });
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
    //console.warn('Not loading module `' + module.name() + '` (doesn\'t support version ' + this.chatVersion + ')');
    return;
  }

  var name = module.name().toLowerCase(),
      existing = this.modules[name];

  if(existing) {
    logger.warn('Overwriting existing module', { module: module.name() });
    this.unload(existing);
  }

  this.modules[name] = module;
  this.loadCommands(module);

  module.emit('load', {
    channel: this.getMisaka().getConfig().getChannel(),
    config: this.getConfig(module.name()),
    database: this.getMisaka().getDbManager(),
    parent: this.getMisaka()
  });
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
    logger.warn('Cannot unload module', { module: module.name() });
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
ModuleManager.prototype.loadFromDirectory = function(dir, disabledModules) {
  var manager = this,
      loaded = [];

  if(!dir) {
    dir = path.join(__dirname, 'modules');
  }

  if(!disabledModules) {
    disabledModules = [];
  }

  var list = fs.readdirSync(dir);

  list.forEach(function(file) {
    // Only consider a module file if it matches specified pattern
    if(!/^mod_.*\.js$/.test(file)) {
      return;
    }

    if(_.contains(disabledModules, file)) {
      logger.info("Skip loading of " + file + " as per `disabled_modules` definition in config file.");
      return;
    }

    var fpath = path.join(dir, file);

    // Try to require the module
    try {
      loaded.push({ module: require(fpath), path: fpath });
    } catch(e) {
      logger.error(e, { msg: 'Error loading module', path: fpath });
    }
  });

  // Load each module
  loaded.forEach(function(obj) {
    var ex = obj.module,
        fpath = obj.path;
    if(ex instanceof Function) {
      manager.loadFromExport(ex);
    } else {
      logger.warn('Exports of module is not a function, ignoring', { path: fpath });
    }
  });
};

/**
 * Load a module from the export retrieved by calling require() on a file.
 * @param M export returned from require()
 */
ModuleManager.prototype.loadFromExport = function(M) {
  var module = new Module(this, M);
  this.load(module);
};

/**
 * Get the number of modules currently loaded.
 * @return count of modules loaded
 */
ModuleManager.prototype.getModuleCount = function() {
  return _.size(this.modules);
};

/**
 * Get a string with the number of modules currently loaded
 * and their names.
 * @return info string
 */
ModuleManager.prototype.toString = function() {
  var str = 'Modules loaded: (' + this.getModuleCount() + '): ',
      list = [];

  for(var key in this.modules) {
    var module = this.modules[key];
    list.push(module.name());
  }

  return (str + list.join(', '));
};

module.exports = ModuleManager;
