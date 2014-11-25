var fs = require('fs');
var path = require('path');
var Command = require(path.join(__dirname, 'command'));
var Module = require(path.join(__dirname, 'module'));

/**
 * Construct a ModuleManager. Handles modules and commands that are
 * loaded from them.
 */
function ModuleManager() {
  this.modules = {};
  this.commands = {};
};

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
 * Get a loaded command by name.
 * @param name Command name
 * @return command instance, or undefined if none found
 */
ModuleManager.prototype.getCommand = function(name) {
  return this.commands[name.toLowerCase()];
};

/**
 * Add a module to this manager.
 * @param module Module instance to add
 */
ModuleManager.prototype.set = function(module) {
  if(!module) return;

  var name = module.name().toLowerCase(),
      existing = this.modules[name];

  if(existing) {
    console.warn('Overwriting existing module with name ' + module.name());
  }

  this.modules[name] = module;
  this.loadCommands(module);
};

/**
 * Get a module by name.
 * @param name Name of module to get
 * @return module instance, or undefined if none
 */
ModuleManager.prototype.get = function(name) {
  return this.modules[name.toLowerCase()];
};

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

ModuleManager.prototype.loadFromExport = function(M) {
  var module = new Module(M);
  this.set(module);
};

module.exports = ModuleManager;
