var minimist = require('minimist');
var path = require('path');
var Picarto = require(path.join(__dirname, '..', 'lib', 'picarto'));

function PicartoCli() {
  this.initArgs();

  if(this.argv.help) {
    this.printHelp();
    process.exit(0);
  }

  if(this.argv['fetch-authkey']) {
    this.fetchAuthkey();
  }
};

PicartoCli.prototype.initArgs = function() {
  this.argv = minimist(process.argv.slice(2));

  if(this.argv.h) this.argv.help = true;
  if(this.argv.A) this.argv['fetch-authkey'] = true;
  if(this.argv.p) this.argv.password = this.argv.p;
  if(this.argv.u) this.argv.username = this.argv.u;
};

PicartoCli.prototype.printHelp = function() {
  var print = console.log;
  print('picarto - command line interface for interacting with picarto.tv');
  print('usage: picarto [options]');
  print('  -h, --help              Print this help message and exit');
  print('  -A, --fetch-authkey     Fetch and print authkey');
  print('  -p, --password          Specify password to authenticate with');
  print('  -u, --username          Specify username to authenticate with');
};

PicartoCli.prototype.fetchAuthkey = function() {
  var username = this.argv.username,
      password = this.argv.password;

  if(username === undefined || password === undefined) {
    console.error('Both username and password required to fetch authkey');
    process.exit(1);
  }

  console.log('Fetching authkey...');

  var auth = new Picarto.Auth();
  auth.setCredentials(username, password);
  auth.perform(function(error, authkey) {
    if(!error) {
      console.log(authkey);
      process.exit(0);
    } else {
      console.error('Error occurred while fetching authkey:', error);
      process.exit(1);
    }
  });
};

var picartoCli = new PicartoCli();
