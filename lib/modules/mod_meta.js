var execSync = require('execSync');
var fs = require('fs');
var path = require('path');

function MetaModule() {
  this.info = {
    name: 'Meta',
    commands: [
      { name: 'repo', callback: MetaModule.prototype.onRepo.bind(this) },
      { name: 'version', callback: MetaModule.prototype.onVersion.bind(this) }
    ],
    description: 'Provides commands for meta-functionality, relating to Misaka'
  };

  this.package = this.parsePackage();
  this.revision = this.parseRevision();
}

MetaModule.prototype.parseRevision = function() {
  // Todo: support windows?
  var countResult = execSync.exec('git rev-list --count HEAD');
  var hashResult = execSync.exec('git rev-parse --short HEAD');

  if(countResult.code === 0 && hashResult.code === 0) {
    return (countResult.stdout.replace('\n', '')
    + '.' + hashResult.stdout.replace('\n', ''));
  }
};

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

MetaModule.prototype.onVersion = function(data) {
  var pkgver;
  if(this.package) {
    pkgver = this.package.version;
  }

  if(pkgver && this.revision) {
    return 'Version ' + pkgver + ' (revision ' + this.revision + ')';
  } else if(pkgver) {
    return 'Version ' + pkgver;
  } else {
    return 'Couldn\'t get version.';
  }
};

module.exports = MetaModule;
