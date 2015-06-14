var mailer;
var smtpPool;

try {
  mailer = require('nodemailer');
} catch(error) {
  throw new Error('`nodemailer` package not installed');
}

try {
  smtpPool = require('nodemailer-smtp-pool');
} catch(error) {
  throw new Error('`nodemailer-smtp-pool` package not installed');
}

var path = require('path');
var Promise = require('bluebird');
var Sequelize = require('sequelize');
var logger = require(path.join(__dirname, '..', 'logger'));
var i18n = require('i18next');
var t = i18n.t;

/**
 * Provides e-mail commands and functionality.
 */
function EmailModule() {
  this.info = {
    name: 'Email',
    description: 'Module for e-mail commands and functionality',
    commands: [
      { name: 'email', callback: EmailModule.prototype.onEmail.bind(this) },
      { name: 'unemail', callback: EmailModule.prototype.onUnemail.bind(this) }
    ],
    callbacks: {
      i18n: EmailModule.prototype.onI18n.bind(this),
      join: EmailModule.prototype.onJoin.bind(this),
      load: EmailModule.prototype.onLoad.bind(this)
    }
  };
}

var translations = {
  'mod_email': {
    addressAdded: 'Your e-mail address has been added to the list!',
    addressBad: 'Specified e-mail address appears invalid: __address__',
    addressRemoved: 'Your e-mail address has been removed from the list',
    addressNotRemoved: 'Your e-mail address was not found on the list',
    defaultSubject: '__channel__ is now online!',
    defaultText:
'__channel__ is now online, go to their channel at __url__\n' +
'\n' +
'If you would like to stop receiving these messages, go to the picarto.tv chatroom ' +
'at the url specified and enter into the chat: /w Misaka !unemail',
    registered: 'You are currently on the e-mail list under __address__, to remove your address whisper !unemail',
    notRegistered: 'You are not currently on the e-mail list, to sign up whisper !email [address]',
    noAddresses: 'There are no e-mail addresses to send to',
    sent: 'All e-mails sent successfully',
    sendError: 'Some error occurred while sending e-mails'
  }
};

// E-mail regular expression
var EMAIL_REGEX = /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/;

/**
 * Get the e-mail database manager.
 * @return {EmailDbManager} database manager
 */
EmailModule.prototype.getDbManager = function() {
  return this.db;
};

/**
 * Create the SMTP pool transport object from the configuration.
 * @return {Object} transporter
 */
EmailModule.prototype.createTransport = function() {
  var smtpConfig = this.data.config.transport;
  return mailer.createTransport(smtpPool(smtpConfig));
};

/**
 * Get a mail object to send to the SMTP server.
 * @param {String} channel - Channel name
 * @param {String[]} addresses - Addresses to send to
 */
EmailModule.prototype.getMailObject = function(channel, addresses) {
  var url = 'https://www.picarto.tv/live/channel.php?watch=' + channel,
      tdata = { channel: channel, url: url },
      subject = t('mod_email.defaultSubject', tdata),
      text = t('mod_email.defaultText', tdata),
      sender = this.data.config.from;

  return {
    from: sender,
    sender: sender,
    bcc: addresses,
    subject: subject,
    text: text
  };
};

/**
 * Send an e-mail to all users of a channel.
 */
EmailModule.prototype.email = function(channel, callback) {
  var database = this.getDbManager(),
      createTransport = EmailModule.prototype.createTransport.bind(this),
      getMailObject = EmailModule.prototype.getMailObject.bind(this);

  database.getAddresses(channel, function(err, addresses) {
    if(!err) {
      if(addresses.length > 0) {
        var transporter = createTransport(),
            mailObject = getMailObject(channel, addresses);
        transporter.sendMail(mailObject, function(err, info) {
          if(!err) {
            logger.log('debug', 'Sent e-mails successfully', { info: info });
          } else {
            logger.error(err);
          }

          if(callback) {
            callback(err);
          }
        });
      } else if(callback){
        callback(new Error('No addresses to send to'));
      }
    } else {
      logger.error(err);
      if(callback) {
        callback(err);
      }
    }
  });
};

EmailModule.prototype.onEmail = function(data) {
  var database = this.getDbManager(),
      channel = data.roomname,
      user = data.user,
      username = data.sender,
      whisper = data.whisper;

  if(user.admin) {
    if(data.parsed.tailArray.length > 0) {
      var subcommand = data.parsed.tailArray[0];
      if(subcommand.toLowerCase() === 'send') {
        this.email(channel, function(err) {
          if(!err) {
            whisper(t('mod_email.sent'));
          } else {
            if(/no addresses to send to/i.test(err)) {
              whisper(t('mod_email.noAddresses'));
            } else {
              whisper(t('mod_email.sendError'));
            }
          }
        });
      }
    }
  } else if(user.registered) {
    // Setting an e-mail address
    if(data.parsed.tailArray.length > 0) {
      var address = data.parsed.tailArray[0];
      if(EMAIL_REGEX.test(address)) {
        database.setAddress(channel, username, address, function(err) {
          if(!err) {
            whisper(t('mod_email.addressAdded', { address: address }));
          } else {
            logger.error(err);
          }
        });
      } else {
        whisper(t('mod_email.addressBad', { address: address }));
      }
    } else { // Checking if user is on the e-mail list
      database.getAddress(channel, username, function(err, address) {
        if(!err) {
          if(address !== undefined) {
            whisper(t('mod_email.registered', { address: address }));
          } else {
            whisper(t('mod_email.notRegistered'));
          }
        } else {
          logger.error(err);
        }
      });
    }
  }
};

EmailModule.prototype.onUnemail = function(data) {
  var database = this.getDbManager(),
      channel = data.roomname,
      user = data.user,
      username = data.sender,
      whisper = data.whisper;

  if(!user.admin && user.registered) {
    database.removeAddress(channel, username, function(err, success) {
      if(!err) {
        if(success) {
          whisper(t('mod_email.addressRemoved'));
        } else {
          whisper(t('mod_email.addressNotRemoved'));
        }
      } else {
        logger.error(err);
      }
    });
  }
};

EmailModule.prototype.onLoad = function(data) {
  this.db = new EmailDbManager(data.database);
};

EmailModule.prototype.onI18n = function() {
  i18n.addResourceBundle('en-US', translations);
};

EmailModule.prototype.onJoin = function(data) {
  this.data = data;
};

/**
 * E-mail database manager.
 * @param {DbManager} db - Core database manager
 */
var EmailDbManager = function(db) {
  this._db = db;
  this.initModels();
};

/**
 * Initialize models.
 */
EmailDbManager.prototype.initModels = function() {
  var models = this.models(), sequelize = this.sequelize();

  //
  // EmailUser
  //
  var EmailUser = models.EmailUser = sequelize.define('EmailUser', {
    channel: { type: Sequelize.STRING(64), allowNull: false },
    username: { type: Sequelize.STRING(64), allowNull: false },
    address: { type: Sequelize.STRING(64), allowNull: false },
  });

  EmailUser.sync().then(function() {
    logger.log('debug', 'Successfully sync\'d Email database tables');
  }).error(function(err) {
    logger.error(err);
  });
};

/**
 * Get the sequelize instance from the parent database manager.
 * @return {Sequelize}
 */
EmailDbManager.prototype.sequelize = function() {
  return this._db.sequelize();
};

/**
 * Get the e-mail models.
 * @return {Object} Object with e-mail models mapped by name
 */
EmailDbManager.prototype.models = function() {
  return this._db.models();
};

/**
 * Remove an e-mail address for a user of a channel.
 * @param {String} channel - Channel name
 * @param {String} username - Username
 */
EmailDbManager.prototype.removeAddress = function(channel, username, callback) {
  this.models().EmailUser.findOne({
    where: {
      channel: channel,
      username: username
    }
  }).then(function(user) {
    if(user) {
      return user.destroy().then(function() { return true });
    } else {
      return false;
    }
  }).then(function(success) {
    if(callback) {
      callback(undefined, success);
    }
  }).catch(callback);
};

/**
 * Set an e-mail address for a user of a channel.
 * @param {String} channel - Channel name
 * @param {String} username - Username
 * @param {String} address - E-mail address
 */
EmailDbManager.prototype.setAddress = function(channel, username, address, callback) {
  this.models().EmailUser.findOrCreate({
    where: {
      channel: channel,
      username: username
    },
    defaults: {
      address: address
    }
  }).spread(function(user, created) {
    if(!created) {
      return user.update({ address: address });
    }
  }).then(function() {
    if(callback) {
      callback();
    }
  }).catch(callback);
};

/**
 * Get all e-mail addresses for a specific channel.
 * @param {String} channel - Channel name
 */
EmailDbManager.prototype.getAddresses = function(channel, callback) {
  this.models().EmailUser.findAll({
    where: {
      channel: channel
    }
  }).map(function(user) {
    return user.address;
  }).then(function(addresses) {
    if(callback) {
      callback(undefined, addresses);
    }
  }).catch(callback);
};

/**
 * Get the e-mail address of a user of a channel.
 * @param {String} channel - Channel name
 * @param {String} username - Username
 */
EmailDbManager.prototype.getAddress = function(channel, username, callback) {
  this.models().EmailUser.findOne({
    where: {
      channel: channel,
      username: username
    }
  }).then(function(user) {
    var address = (user ? user.address : undefined);
    if(callback) {
      callback(undefined, address);
    }
  }).catch(callback);
};

module.exports = EmailModule;
