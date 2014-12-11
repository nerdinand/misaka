var path = require('path');
var Bot = require(path.join(__dirname, 'bot'));
var Picarto = require(path.join(__dirname, 'picarto'));

module.exports = {
  Auth: Picarto.Auth,

  // V6-specific
  Client: Picarto.Client,
  Room: Picarto.Room,

  // V7-specific
  Bot: Bot,
  ClientV7: Picarto.ClientV7
};
