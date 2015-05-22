function SevenModule() {
  this.info = {
    name: 'Seven',
    description: 'Test module for chat V7 stuff',
    commands: [
      { name: 'ban', callback: SevenModule.prototype.onBan.bind(this) },
      { name: 'kick', callback: SevenModule.prototype.onKick.bind(this) },
      { name: 'mod', callback: SevenModule.prototype.onMod.bind(this) },
      { name: 'online', callback: SevenModule.prototype.onOnline.bind(this) },
      { name: 'unban', callback: SevenModule.prototype.onUnban.bind(this) },
      { name: 'unmod', callback: SevenModule.prototype.onUnmod.bind(this) },
      { name: 'whisper', callback: SevenModule.prototype.onWhisper.bind(this) }
    ],
    chatVersions: 7
  };
};

SevenModule.prototype.onBan = function(data) {
  var client = data.parent.getBot().getClient();
  if(data.parsed.tail) {
    client.ban(data.parsed.tailArray[0]);
  }
};

SevenModule.prototype.onKick = function(data) {
  var client = data.parent.getBot().getClient();
  if(data.parsed.tail) {
    client.kick(data.parsed.tailArray[0]);
  }
};

SevenModule.prototype.onMod = function(data) {
  var client = data.parent.getBot().getClient();
  if(data.parsed.tail) {
    client.mod(data.parsed.tailArray[0]);
  }
};

SevenModule.prototype.onOnline = function(data) {
  var client = data.parent.getBot().getClient(),
      online = client.getOnlineWatcher().isOnline();
  data.send('Stream is currently ' + (online ? 'online' : 'offline') + '.');
};

SevenModule.prototype.onUnban = function(data) {
  var client = data.parent.getBot().getClient();
  if(data.parsed.tail) {
    client.unban(data.parsed.tailArray[0]);
  }
};

SevenModule.prototype.onUnmod = function(data) {
  var client = data.parent.getBot().getClient();
  if(data.parsed.tail) {
    client.unmod(data.parsed.tailArray[0]);
  }
};

SevenModule.prototype.onWhisper = function(data) {
  var client = data.parent.getBot().getClient();
  if(data.parsed.tail) {
    var name = data.parsed.tailArray[0];

    data.parsed.tailArray.shift();
    var text = data.parsed.tailArray.join(' ');

    client.whisper(name, text);
  }
};

module.exports = SevenModule;
