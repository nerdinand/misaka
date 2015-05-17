var async = require('async');
var osenv = require('osenv');
var path = require('path');
var Sequelize = require('sequelize');
var logger = require(path.join(__dirname, 'logger'));

var DbManager = function(opts) {
  if(!opts) opts = {};
  this.path = opts['path'];

  if(this.path === undefined || this.path === null) {
    this.path = this.getDefaultPath();
  }

  this._initialized = false;

  this.initSequelize(this.path);
  this.initModels();
};

/**
 * Initialize the sequelize instance.
 * @param {String} path - Path to sqlite3 database file
 */
DbManager.prototype.initSequelize = function(path) {
  this._sequelize = new Sequelize(null, null, null, {
    dialect: 'sqlite',
    logging: false, // Make this optional? Debug?
    storage: path,
    define: {
      paranoid: true,
      underscored: true,
      underscoredAll: true
    }
  });
};

/**
 * Initialize the models.
 */
DbManager.prototype.initModels = function() {
  var sequelize = this.sequelize();

  this._models = {
    ChannelLog: this.sequelize().define('ChannelLog', {
      channel: { type: Sequelize.STRING(64), collate: 'NOCASE', allowNull: false },
      user: { type: Sequelize.STRING(64), collate: 'NOCASE', allowNull: false },
      action: { type: Sequelize.STRING(8), allowNull: false },
      data: { type: Sequelize.STRING(256), allowNull: true }
    }, {
      createdAt: 'timestamp',
      updatedAt: false,
      deletedAt: false
    })
  };

  var _this = this;
  this.sequelize().sync().then(function() {
    _this._initialized = true;
    logger.log('debug', 'Successfully sync\'d core database tables');
  }).error(function(err) {
    logger.error(err);
  });
};

/**
 * Get the sequelize instance.
 * @return {Sequelize} sequelize instance
 */
DbManager.prototype.sequelize = function() {
  return this._sequelize;
};

/**
 * Get the models.
 * @return {Object} Models mapped by name
 */
DbManager.prototype.models = function() {
  return this._models;
};

/**
 * Check whether or not this database manager is initialized.
 * If not, calls the callback with an error.
 * @param {errorCallback} callback
 * @return {Boolean} true if initialized, false if not
 */
DbManager.prototype.checkInitialized = function(callback) {
  if(!this.isInitialized()) {
    var err = new Error('Database manager isn\'t yet initialized');
    if(callback) {
      callback(err);
    }

    return false;
  }

  return true;
};

/**
 * Get the database file path of this database manager.
 * @return {String} Database file path
 */
DbManager.prototype.getPath = function() {
  return this.path;
};

/**
 * Get the default database file path, relative to the running user's directory.
 * @return {String} Default database file path
 */
DbManager.prototype.getDefaultPath = function() {
  return path.join(osenv.home(), '.config', 'misaka', 'misaka.db');
};

/**
 * Check whether or not this database has been initialized.
 * @return {Boolean} true if initialized, false if not
 */
DbManager.prototype.isInitialized = function() {
  return this._initialized === true;
};

/**
 * Get the last log entry for a user in a channel.
 * @param {String} channel Channel name
 * @param {String} username Username
 */
DbManager.prototype.getLastLogEntry = function(channel, username, callback) {
  this.models().ChannelLog.findAll({
    where: {
      channel: channel,
      user: username
    },
    limit: 1,
    order: 'id DESC'
  })
  .then(function(rows) {
    if(rows && rows.length === 0 && callback) {
      callback(undefined, rows[0]);
    } else if(callback) {
      callback('No log entries found');
    }
  })
  .catch(callback);
};

/**
 * Idk.
 */
DbManager.prototype.getMessageLogCount = function(roomname, dateMod, callback) {
  if(callback) {
    callback(new Error('I forgot what this does'));
  }

  /*
  if(!this.checkInitialized(callback)) {
    return;
  }

  var channel_log = this._tables.channel_log,
      query = channel_log.select(channel_log.id.count().distinct().as('count'))
		.from(channel_log)
	      .toString();

  query += ' WHERE "timestamp" > DATETIME("now", "' + dateMod + '")';

  this._db.all(query, function(err, row) {
    var count;
    if(!err) {
      count = row[0].count;;
    }

    if(callback) {
      callback(err, count);
    }
  });
  */
};

/**
 * Insert a message into the log table.
 * @param {String} channel Channel name
 * @param {String} username Username
 * @param {String} msg Message text
 * @param {errorCallback} callback
 */
DbManager.prototype.insertMessageToLog = function(channel, username, msg, callback) {
  this.models().ChannelLog.create({
    channel: channel,
    user: username,
    action: 'msg',
    data: msg
  }).then(function(channelLog) {
    if(callback) {
      callback(undefined);
    }
  }).catch(callback);
};

/**
 * Callback with only an error parameter.
 * @callback errorCallback
 * @param {Object} error if an error occurred
 */

module.exports = DbManager;
