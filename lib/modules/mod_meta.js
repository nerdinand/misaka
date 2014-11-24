var fs = require('fs');
var path = require('path');

function MetaModule() {
  this.info = {
    name: 'Meta',
    commands: [
      { name: 'repo', callback: MetaModule.prototype.onRepo.bind(this) }
    ],
    description: 'Provides commands for meta-functionality, relating to Misaka'
  };

  this.package = this.parsePackage();
}

/**
 * Parse the package.json file and return the object.
 * @return object parsed from package.json, or undefined if an error occurred
 */
MetaModule.prototype.parsePackage = function() {
  var p = path.join(__dirname, '..', '..', 'package.json');
  var data = fs.readFileSync(p);
  if(data) {
    return JSON.parse(data);
  }
};

MetaModule.prototype.onRepo = function(data) {
  if(!this.package) {
    return 'No package object from package.json, an error may have occurred while parsing it.';
  } else if(!this.package.repository || !this.package.repository.url) {
    return 'No repository url in package.json.';
  } else {
    return 'Misaka\'s repository: ' + this.package.repository.url;
  }
};

module.exports = MetaModule;
