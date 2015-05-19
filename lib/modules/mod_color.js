function ColorModule() {
  this.info = {
    name: 'Color',
    description: 'Set or get the chat color',
    command: { name: 'color', callback: ColorModule.prototype.onColor.bind(this) }
  };
}

ColorModule.prototype.onColor = function(data) {
  var bot = data.parent.getBot();
  if(data.parsed.tail === undefined) {
    var user = bot.getSelf();
    return 'Current chat color: ' + user.color;
  } else {
    var colortext = data.parsed.tailArray[0];
    var patt = /^#?([0-9a-f]{6})$/i;

    if(patt.test(colortext)) {
      bot.getClient().setColor(colortext.replace('#', ''));
      return 'Color successfully changed';
    } else {
      return 'Unknown color';
    }
  }
};

module.exports = ColorModule;
