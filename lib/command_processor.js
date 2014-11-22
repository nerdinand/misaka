var CommandProcessor = function() {
  this.prefix = '!';
};

CommandProcessor.prototype.isCommand = function(user, message) {
  s = message.split(/\s+/);
  if(s.length === 0) return false;

  return (s[0].length >= this.prefix.length &&
    s[0].substring(0, this.prefix.length) === this.prefix)
};

CommandProcessor.prototype.getCommandName = function(message) {
  s = message.split(/\s+/);
  if(s.length === 0) return;

  return s[0].substring(this.prefix.length);
};

module.exports = CommandProcessor;
