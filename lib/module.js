var events = require('events');
var _ = require('underscore');

/**
 * Construct a module from whatever was exported by a module
 * file in module.exports.
 */
function Module(M) {
  this.export = new M();
  this.enabled = true;
  this.initEvents();
}

/**
 * Initialize the event emitter using the callbacks in the module's info.callbacks.
 */
Module.prototype.initEvents = function() {
  this.emitter = new events.EventEmitter();

  var callbacks = this.export.info.callbacks;
  for(var name in callbacks) {
    var callback = callbacks[name];
    this.on(name, callback);
  }
};

Module.prototype.isEnabled = function() {
  return this.enabled;
};

/**
 * Get all the command names provided by this module.
 * @return array of names, or empty array if none
 */
Module.prototype.getCommandNames = function() {
  var list = [], commands = this.commands();
  commands.forEach(function(info) {
    if(info && info.name !== undefined) {
      list.push(info.name);
    }
  });
  return list;
};

/**
 * Get the array of command metadata this module provides via info.
 * This will always return an array, even if the module provides
 * no commands.
 * @return array of command metadata, an empty array if no commands
 */
Module.prototype.commands = function() {
  var cmds = [], info = this.export.info;

  if(info.command) {
    cmds.push(info.command);
  }

  if(info.commands && info.commands instanceof Array) {
    info.commands.forEach(function(cmd) {
      cmds.push(cmd);
    });
  }

  return cmds;
};

/**
 * Get this module's description.
 * @return module description
 */
Module.prototype.description = function() {
  return this.export.info.description;
};

/**
 * Get this module's name.
 * @return module name
 */
Module.prototype.name = function() {
  return this.export.info.name;
};

/**
 * A module isn't considered master-only unless specifically set
 * to true in info.
 * @return true if master-only, false if not
 */
Module.prototype.isMasterOnly = function() {
  return this.export.info.master === true;
};

/**
 * A module isn't considered unloadable unless specifically declared.
 * This will probably be reserved for the 'Module' module.
 * @return true if unloadable, false if not unloadable
 */
Module.prototype.isUnloadable = function() {
  return this.export.info.unloadable !== false;
};

Module.prototype.getCallback = function(name) {
  if(this.export.info.callbacks) {
    return this.export.info.callbacks[name];
  }
};

/**
 * Get the chat versions this module supports.
 * @return chat version numbers in an array
 */
Module.prototype.getSupportedVersions = function() {
  var versions = this.export.info.chatVersions;
  if(_.isNumber(versions)) {
    return [versions];
  } else if(_.isArray(versions)) {
    // Assume Number array for now
    return versions;
  } else {
    // If nothing specified, assume 6 and 7
    return [ 6, 7 ];
  }
};

/**
 * Check if a specific chat version is supported by this module.
 * @param version Version number to check
 * @return true if supported, false if not supported
 */
Module.prototype.isVersionSupported = function(version) {
  return this.getSupportedVersions().indexOf(version) >= 0;
};

/**
 * Wrapper method for this.emitter.on.
 */
Module.prototype.on = function() {
  this.emitter.on.apply(this.emitter, arguments);
};

/**
 * Wrapper method for this.emitter.emit.
 */
Module.prototype.emit = function() {
  this.emitter.emit.apply(this.emitter, arguments);
};

module.exports = Module;
