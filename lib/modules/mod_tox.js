var osenv = require('osenv');
var path = require('path');
var logger = require(path.join('..', 'Logger')).default;

var toxcore;
try {
  toxcore = require('toxcore');
} catch(e) {
  throw new Error('`toxcore` package not installed');
}

function ToxModule() {
  this.info = {
    name: 'Tox',
    description: 'Experimental tox integration',
    callbacks: {
      join: ToxModule.prototype.onJoin.bind(this)
    }
  };
}

ToxModule.prototype.onJoin = function(data) {
  this.data = data;
  this.initTox();

  if(this.tox()) {
    this.bootstrap();
    this.initEvents();
    this.tox().start();
  }
};

/**
 * Initialize tox.
 */
ToxModule.prototype.initTox = function() {
  var toxpath = this._toxpath = this.getDefaultToxPath();

  try {
    var tox = this._tox = new toxcore.Tox({ data: toxpath });
    logger.log('debug', 'Initialized tox', { address: tox.getAddressHexSync() });
  } catch(err) {
    logger.error(err, 'Error loading tox', { data: toxpath });
  }
};

/**
 * Bootstrap.
 */
ToxModule.prototype.bootstrap = function() {
  var tox = this.tox(),
      nodes = [
    { maintainer: 'saneki',
      address: '96.31.85.154',
      port: 33445,
      key: '674153CF49616CD1C4ADF44B004686FC1F6C9DCDD048EF89B117B3F02AA0B778' },
    { maintainer: 'Impyy',
      address: '178.62.250.138',
      port: 33445,
      key: '788236D34978D1D5BD822F0A5BEBD2C53C64CC31CD3149350EE27D4D9A2F9B6B' },
    { maintainer: 'sonOfRa',
      address: '144.76.60.215',
      port: 33445,
      key: '04119E835DF3E78BACF0F84235B300546AF8B936F035185E2A8E9E0A67C8924F' }
  ];

  nodes.forEach(function(node) {
    try {
      tox.bootstrapSync(node.address, node.port, node.key);
      logger.log('debug', 'Successfully bootstrapped to tox node', { maintainer: node.maintainer });
    } catch(err) {
      logger.error(err, 'Error bootstrapping to tox node', { maintainer: node.maintainer });
    }
  });
};

/**
 * Initialize tox events.
 */
ToxModule.prototype.initEvents = function() {
  var tox = this.tox(),
      save = ToxModule.prototype.save.bind(this);

  tox.on('selfConnectionStatus', function(e) {
    logger.log('debug', (e.isConnected() ? 'Connected to' : 'Disconnected from') + ' the tox network');
  });

  tox.on('friendRequest', function(e) {
    logger.log('debug', 'Accepting tox friend request', { publicKey: e.publicKeyHex(), message: e.message() });
    tox.addFriendNoRequestSync(e.publicKey());
    save();
  });

  tox.on('friendMessage', function(e) {
    var friendName = tox.getFriendNameSync(e.friend());
    logger.log('debug', 'Received friend message', { friendNumber: e.friend(), friend: friendName, message: e.message() });
  });
};

/**
 * Save tox state to a file.
 */
ToxModule.prototype.save = function() {
  var tox = this.tox();

  if(tox) {
    tox.saveToFile(this.getPath(), function(err) {
      if(!err) {
        logger.log('debug', 'Saved tox state to file');
      } else {
        logger.error(err, 'Error occurred while saving tox state to file');
      }
    });
  }
};

/**
 * Get the tox instance.
 * @return {Tox} tox instance
 */
ToxModule.prototype.tox = function() {
  return this._tox;
};

/**
 * Get the toxfile path.
 * @return {String} toxfile path
 */
ToxModule.prototype.getPath = function() {
  return this._toxpath;
};

/**
 * Get the default toxfile path.
 * @return {String} toxfile path
 */
ToxModule.prototype.getDefaultToxPath = function() {
  // Todo: Helper function to get default misaka config dir path
  return path.join(osenv.home(), '.config', 'misaka', 'misaka.tox');
};

module.exports = ToxModule;
