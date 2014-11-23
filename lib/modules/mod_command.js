function CommandModule() {
  this.info = {
    name: 'Command',
    command: { name: 'command', callback: CommandModule.prototype.onCommand.bind(this) },
    description: 'Get info about commands'
  };
}

CommandModule.prototype.onCommand = function(data) {
  var full = data.message;

  var s = full.split(/\s+/);
  if(s.length > 1) {
    var cmdname = s[1].toLowerCase();

    var command = this.parent.commands[cmdname];
    if(command) {
      return 'Command `' + command.name + '` provided by module `' + command.getFullName() + '`';
    } else {
      return 'Command not found: `' + cmdname + '`';
    }
  }
};

module.exports = CommandModule;
