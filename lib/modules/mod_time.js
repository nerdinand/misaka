/**
 * Module for handling !time command.
 */
function TimeModule() {
  this.info = {
    name: 'Time',
    command: { name: 'time', callback: TimeModule.prototype.onCommand.bind(this) },
    description: 'Example module for displaying the time',
    permissions: 'all'
  };
}

TimeModule.prototype.onCommand = function() {
  return (new Date()).toString();
};

module.exports = TimeModule;
