var path = require('path');
var Bot = require(path.join(__dirname, 'bot'));
var Picarto = require(path.join(__dirname, 'picarto'));

module.exports = {
  Auth: Picarto.Auth,

  // V7-specific
  Bot: Bot,
  Client: Picarto.Client
};
