var minimist = require('minimist');
var path = require('path');
var Picarto = require(path.join(__dirname, '..', 'lib', 'picarto'));

function PicartoCli() {
  this.initArgs();

  if(this.argv.help) {
    this.printHelp();
    process.exit(0);
  }

  if(this.argv['fetch-authtoken']) {
    this.fetchAuthToken();
  }
};

PicartoCli.prototype.initArgs = function() {
  this.argv = minimist(process.argv.slice(2));

  if(this.argv.h) this.argv.help = true;
  if(this.argv.A) this.argv['fetch-authtoken'] = true;
  if(this.argv.p) this.argv.password = this.argv.p;
  if(this.argv.r) this.argv.room = this.argv.r;
  if(this.argv.u) this.argv.username = this.argv.u;
};

PicartoCli.prototype.printHelp = function() {
  var print = console.log;
  print('picarto - command line interface for interacting with picarto.tv');
  print('usage: picarto [options]');
  print('  -h, --help              Print this help message and exit');
  print('  -A, --fetch-authtoken   Fetch and print auth token');
  print('  -p, --password          Specify password to authenticate with');
  print('  -r, --room              Room name to use');
  print('  -u, --username          Specify username to authenticate with');
};

PicartoCli.prototype.fetchAuthToken = function() {
  var username = this.argv.username,
      password = this.argv.password,
      room = this.argv.room;

  // Have room default to user's room
  if(room === undefined) {
    room = username;
  }

  if(username === undefined || password === undefined) {
    console.error('Both username and password required to fetch auth token');
    process.exit(1);
  }

  console.log('Fetching authkey...');

  var auth = new Picarto.Auth();
  auth.login(username, password, function(err, success) {
    if(!err && success) {
      auth.fetchAuthToken(room, function(err, token) {
        if(!err) {
          console.log(token);
          process.exit(0);
        } else {
          console.error('Error occurred while fetching auth token:', err);
          process.exit(1);
        }
      });
    } else if(err) {
      console.error('Error occurred while authenticating:', err);
    } else {
      console.error('Authentication not successful');
    }
  });
};

var picartoCli = new PicartoCli();
