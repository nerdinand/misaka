var _ = require('underscore');

function ModchatModule() {
  this.info = {
    name: 'Modchat',
    description: 'Modchat',
    commands: [
      { name: 'modchat', callback: ModchatModule.prototype.onModchat.bind(this) }
    ],
    callbacks: {
      join: ModchatModule.prototype.onJoin.bind(this)
    },
    credits: {
      DerpVulpes: 'Idea of modchat'
    }
  };

  this.enabled = false;
}

/**
 * Whether or not modchat is enabled.
 * @param {Boolean} true if enabled, false if not
 */
ModchatModule.prototype.isEnabled = function() {
  return this.enabled;
};

/**
 * Enable or disable modchat.
 * @param {Boolean} enabled - true to enable, false to disable
 */
ModchatModule.prototype.setEnabled = function(enabled) {
  this.enabled = enabled;
};

ModchatModule.prototype.onModchat = function(data) {
  var respond = data.respond,
      user = data.user,
      enable = data.helper.parseChoice(data.parsed.tail);

  if(user.admin && _.isBoolean(enable)) {
    if(this.isEnabled() !== enable) {
      this.setEnabled(enable);
      respond('Modchat is now ' + (enable ? 'enabled' : 'disabled'));
    }
  }
};

ModchatModule.prototype.onJoin = function(data) {
  this.data = data;
  var client = data.client,
      onWhisper = ModchatModule.prototype.onWhisper.bind(this);

  client.getSocket().on('whisper', onWhisper);
};

/**
 * Callback for whispers.
 * @param {Object} data - Whisper data
 */
ModchatModule.prototype.onWhisper = function(data) {
  var fromMe = !data.enableReply,
      username = data.username,
      message = data.msg,
      channel = this.data.roomname,
      users = this.data.client.getUserList(),
      user = users.getUser(username),
      cmdProc = this.data.parent.getCommandProcessor(),
      whisper = this.data.whisper;

  if(this.isEnabled()
      && (user.mod || user.admin) && !user.banned
      && !fromMe && !cmdProc.isCommand(username, message)) {
    var receivers = this.getModerators();

    receivers.forEach(function(receiver) {
      if(receiver !== username) {
        whisper(receiver, username + ': ' + message);
      }
    });
  }
};

/**
 * Get an array of moderator/admin usernames who are currently in the chat.
 * @return {String[]} array of moderator/admin usernames
 */
ModchatModule.prototype.getModerators = function() {
  var users = this.data.client.getUserList(),
      usernames = users.createNameList(),
      mods = [];

  usernames.forEach(function(username) {
    var user = users.getUser(username);
    if((user.admin || user.mod) && !user.banned) {
      mods.push(username);
    }
  });

  return mods;
};

module.exports = ModchatModule;
