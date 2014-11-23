/**
 * Module for handling !time command.
 */
function TimeModule() {
  this.info = {
    // Module name
    name: 'Time',

    // Commands this module provides
    commands: [
      { name: 'time', callback: TimeModule.prototype.onCommand.bind(this) },
    ],

    permissions: 'all', // user, mod, admin
  };
}

TimeModule.prototype.onCommand = function(full) {
  return (new Date()).toString();
};

module.exports = TimeModule;
