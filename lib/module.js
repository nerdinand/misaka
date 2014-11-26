/**
 * Construct a module from whatever was exported by a module
 * file in module.exports.
 */
function Module(M) {
  this.export = new M();
  this.enabled = true;
}

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

Module.prototype.description = function() {
  return this.export.info.description;
};

Module.prototype.name = function() {
  return this.export.info.name;
};

Module.prototype.isMasterOnly = function() {
  return this.export.info.master === true;
};

module.exports = Module;
