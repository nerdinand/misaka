function ModuleModule() {
  this.info = {
    name: 'Module',
    commands: [
      { name: 'commands', callback: ModuleModule.prototype.onCommands.bind(this) },
      { name: 'enable', callback: ModuleModule.prototype.onEnable.bind(this) },
      { name: 'disable', callback: ModuleModule.prototype.onDisable.bind(this) },
      { name: 'module', callback: ModuleModule.prototype.onModule.bind(this) },
      { name: 'modules', callback: ModuleModule.prototype.onModules.bind(this) }
    ],
    description: 'Manage and get info about modules'
  };
}

/**
 * Checks if a name appears to be a command name (starts with
 * a lowercase letter or a number).
 * @param name Name to check
 * @return true if command name, false if not
 */
ModuleModule.prototype.isCommandName = function(name) {
  return (/^[a-z0-9]/.test(name));
};

/**
 * Checks if a name appears to be a module name (starts with
 * an uppercase letter).
 * @param name Name to check
 * @return true if module name, false if not
 */
ModuleModule.prototype.isModuleName = function(name) {
  return (/^[A-Z]/.test(name));
};

/**
 * Enable or disable a specified module or command.
 * Helper for enable/disable commands.
 * @param data Command data
 * @param status true if enable, false if disable
 * @return Message to send, undefined if nothing to send
 */
ModuleModule.prototype.onSetStatus = function(data, status) {
  var statusName = (status ? 'enabled' : 'disabled');

  if(data.parsed.tail) {
    var name = data.parsed.tailArray[0];

    if(this.isModuleName(name)) {
      var module = data.parent.getModule(name);
      if(module) {
        if(module.enabled === status) {
          return 'Module `' + module.name() + '` is already ' + statusName;
        } else {
          module.enabled = status;
          return 'Module `' + module.name() + '` has been ' + statusName;
        }
      } else {
        return 'Module `' + name + '` not found';
      }
    } else if(this.isCommandName(name)) {
      var command = data.parent.getCommand(name);
      if(command) {
        if(command.enabled === status) {
          return 'Command `' + command.name() + '` is already ' + statusName;
        } else {
          command.enabled = status;
          return 'Command `' + command.name() + '` has been ' + statusName;
        }
      } else {
        return 'Command `' + name + '` not found';
      }
    }
  }
};

/**
 * Get a list of commands provided by a module.
 * @param data Command data
 */
ModuleModule.prototype.onCommands = function(data) {
  if(data.parsed.tail) {
    var modname = data.parsed.tailArray[0];
    var module = data.parent.getModule(modname);
    if(module) {
      var cmds = data.helper.getCommandNames(module);
      if(cmds.length === 0) {
        return 'No commands provided by module `' + module.name() + '`';
      } else {
        var str = 'Commands provided by module `' + module.name() + '`: ';
        str += cmds.shift();
        cmds.forEach(function(name) {
          str += ', ' + name;
        });
        return str;
      }
    } else {
      return 'Module `' + modname + '` not found.';
    }
  }
};

/**
 * Disable a specified module or command.
 * @param data Command data
 */
ModuleModule.prototype.onDisable = function(data) {
  return this.onSetStatus(data, false);
};

/**
 * Enable a specified module or command.
 * @param data Command data
 */
ModuleModule.prototype.onEnable = function(data) {
  return this.onSetStatus(data, true);
};

/**
 * Provide information about a module.
 * @param data Command data
 */
ModuleModule.prototype.onModule = function(data) {
  var s = data.message.split(/\s+/);
  if(s.length > 1) {
    var modname = s[1].toLowerCase();
    var module = this.parent.modules[modname];

    if(module) {
      if(module.description() !== undefined) {
        return module.description();
      } else {
        return 'Description not set for module `' + modname + '`';
      }
    } else {
      return 'Module not found: `' + modname + '`';
    }
  }
};

ModuleModule.prototype.onModules = function(data) {
  var names = [];

  data.parent.modules.forEach(function(module) {
    names.push(module.name());
  });

  var str = names.length + ' modules loaded: ';
  var first = names.shift();
  str = str + first;
  names.forEach(function(name) {
    str = str + ', ' + name;
  });

  return str;
};

module.exports = ModuleModule;
