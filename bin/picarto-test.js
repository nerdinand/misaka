var path = require('path');
var Config = require(path.join(__dirname, '..', 'lib', 'config')).Config;
var Picarto = require(path.join(__dirname, '..', 'lib', 'picarto'));

var config = new Config();
config.read(path.join(__dirname, '..', 'config', 'misaka.json'), function(err) {
  if(err) {
    console.log('Error reading config', err);
    return;
  }

  // Test script
  var client = new Picarto.Client({
    authkey: config.authkey,
    username: config.username,
    color: config.color
  });

  console.log('Initializing firebase...');
  client.initFirebase(function(err, authData) {
    if(err) return;

    console.log('Joining room...');
    var room = client.join('lumineko');

    //client.message('lumineko', 'test');

    client.onMessage('lumineko', function(msg) {
      console.log(['message', msg]);
    });

    client.onClear('lumineko', function() {
      console.log(['clear']);
    });
  });
});
