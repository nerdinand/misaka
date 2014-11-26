function ColorModule() {
  this.info = {
    name: 'Color',
    command: { name: 'color', callback: ColorModule.prototype.onCommand.bind(this) },
    description: 'Set or get the chat color'
  };
}

ColorModule.prototype.onCommand = function(data) {
  if(data.parsed.tail === undefined) { // No parameter, return chat color
    return 'Current chat color: ' + data.parent.client.color;
  } else { // Set chat color
    var colortext = data.parsed.tailArray[0];
    var patt = /^#([0-9a-f]{6})?$/i;

    if(patt.test(colortext)) {
      data.parent.client.color = colortext;
      return 'Color successfully changed';
    } else {
      return 'Unknown color';
    }
  }
};

module.exports = ColorModule;
