var path = require('path');
var Config = require(path.join(__dirname, '..', 'lib', 'config')).Config;
var Picarto = require(path.join(__dirname, '..', 'lib', 'picarto'));
//require('firebase').enableLogging(true);

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
    var room = client.join('saneki');

    room.onMessage(function(e) {
      //console.log(['message', e.val()]);
      var data = e.val();
      console.log(data.user + ': ' + data.message);

      if(data.user === 'saneki' && data.message === '!salute') {
        room.message('*salutes*');
      }
    });

    room.onClear(function(e) {
      console.log(['clear', e.val()]);
    });
  });
});
