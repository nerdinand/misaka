/**
 * Module for handling !time command.
 */
function TimeModule() {
  this.info = {
    name: 'Time',
    command: 'time',
    permissions: 'all', // user, mod, admin
  };
}

TimeModule.prototype.onCommand = function(full) {
  return (new Date()).toString();
};

module.exports = TimeModule;
