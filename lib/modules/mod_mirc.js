var util = require('util');

/**
 * mIRC commands.
 */
function MircModule() {
  this.info = {
    name: 'Mirc',
    description: 'Provides mIRC-like commands',
    commands: [
      { name: 'slap', callback: MircModule.prototype.onSlap.bind(this) }
    ],
  };
}

MircModule.prototype.onSlap = function(data) {
  var misaka = data.parent,
      send = data.send,
      toSlap = data.sender,
      users = data.parent.getBot().getClientManager().getClient(data.roomname).getUserList();

  if(data.parsed.tailArray.length >= 1) {
    toSlap = data.parsed.tailArray[0];
  }

  var user = users.getUser(toSlap);

  // 10% chance
  var chance = (Math.random() * 10) > 9;

  // If '!slap <someoneElse>`
  if(user !== undefined && user.username.toLowerCase() !== data.user.username.toLowerCase()) {
    if(chance) {
      user = data.user;
      send(util.format('/me slaps %s around a bit with a large trout instead', user.username));
      return;
    }
  }

  // If `!slap Misaka`, disobey
  if(user && user.username.toLowerCase() === misaka.getConfig().getUsername().toLowerCase()) {
    user = data.user;
    send(util.format('/me disobeys %s before slapping them a bit with a large trout', user.username));
    return;
  }

  if(user) {
    send(util.format('/me slaps %s around a bit with a large trout', user.username));
  } else {
    send(util.format('/me looks around a bit for %s before giving up', toSlap));
  }
};

module.exports = MircModule;
