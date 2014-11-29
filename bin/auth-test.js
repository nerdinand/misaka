var path = require('path');
var Picarto = require(path.join(__dirname, '..', 'lib', 'picarto'));

process.argv.shift(); process.argv.shift();

if(process.argv.length > 1) {
  var username = process.argv[0], password = process.argv[1],
      auth = new Picarto.Auth();

  console.log('username=' + username + ';password=' + password);

  auth.username = username;
  auth.password = password;

  auth.perform(function(error, authkey) {
    if(!error) {
      console.log(['authkey', authkey]);
    } else {
      console.log(['error', error]);
    }
  });
} else {
  console.log('insufficient arguments');
}
