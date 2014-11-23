function ColorModule() {
  this.info = {
    name: 'Color',
    command: { name: 'color', callback: ColorModule.prototype.onCommand.bind(this) },
    description: 'Set or get the chat color'
  };
}

ColorModule.prototype.onCommand = function(data) {
  var full = data.message;

  var s = full.split(/\s+/);
  if(s.length === 1) { // No parameter, return chat color
    return 'Current chat color: ' + this.parent.client.color;
  } else if (s.length > 1) { // Set chat color
    var colortext = s[1];
    var patt = /^#([0-9a-f]{6})?$/i;

    if(patt.test(colortext)) {
      this.parent.client.color = colortext;
      return 'Color successfully changed';
    } else {
      return 'Unknown color';
    }
  }
};

module.exports = ColorModule;
