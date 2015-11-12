import async = require('async');
import path = require('path');
import sqlize = require('sequelize');
import logger from './Logger';

var osenv = require('osenv');

export interface DbConfig {
  database?: string;
  host?: string;
  password?: string;
  username?: string;
}

export interface DbManagerOptions {
  config?: DbConfig;
}

export class DbManager {
  private _initialized: boolean;
  private _models: any;
  private _sequelize: sqlize.Sequelize;

  constructor(opts: DbManagerOptions) {
    if (!opts) opts = {};

    this._initialized = false;

    var config = opts['config'];
    if (!config) config = {};

    this.initSequelize(config);
    this.initModels();
  }

  /**
   * Initialize the sequelize instance.
   * @param {String} path - Path to sqlite3 database file
   */
  initSequelize(config: DbConfig) {
    this._sequelize = new sqlize(config.database, config.username, config.password, {
      host: config.host,
      dialect: 'mariadb',
      logging: false, // Make this optional? Debug?
      // logging: logger.log.bind(logger, 'debug'),
      // storage: path,
      define: {
        paranoid: true,
        underscored: true,
        underscoredAll: true
      }
    });
  }

  /**
   * Initialize the models.
   */
  initModels() {
    var sequelize = this.sequelize();

    this._models = {
      ChannelLog: this.sequelize().define('ChannelLog', {
        channel: { type: sqlize.STRING(64), allowNull: false },
        user: { type: sqlize.STRING(64), allowNull: false },
        action: { type: sqlize.STRING(8), allowNull: false },
        data: { type: sqlize.STRING(256), allowNull: true }
      }, {
        createdAt: 'timestamp',
        updatedAt: false,
        deletedAt: false,
        paranoid: false
      })
    };

    var _this = this;
    this.sequelize().sync().then(function() {
      _this._initialized = true;
      logger.log('debug', 'Successfully sync\'d core database tables');
    }).error(function(err) {
      logger.error(err);
    });
  }

  /**
   * Get the sequelize instance.
   * @return {Sequelize} sequelize instance
   */
  sequelize(): sqlize.Sequelize {
    return this._sequelize;
  }

  /**
   * Get the models.
   * @return {Object} Models mapped by name
   */
  models(): any {
    return this._models;
  }

  /**
   * Check whether or not this database manager is initialized.
   * If not, calls the callback with an error.
   * @param {errorCallback} callback
   * @return {Boolean} true if initialized, false if not
   */
  checkInitialized(callback: (error?: Error) => void): boolean {
    if (!this.isInitialized()) {
      if (callback) callback(new Error("Database manager isn't yet initialized"));
      return false;
    } else return true;
  }

  /**
   * Get the database file path of this database manager.
   * @return {String} Database file path
   */
  getPath(): string {
    //return this.path;
	return this.getDefaultPath();
  }

  /**
   * Get the default database file path, relative to the running user's directory.
   * @return {String} Default database file path
   */
  getDefaultPath(): string {
    return path.join(osenv.home(), '.config', 'misaka', 'misaka.db');
  }

  /**
   * Check whether or not this database has been initialized.
   * @return {Boolean} true if initialized, false if not
   */
  isInitialized(): boolean {
    return this._initialized === true;
  }

  /**
   * Get the last log entry for a user in a channel.
   * @param {String} channel Channel name
   * @param {String} username Username
   */
  getLastLogEntry(channel: string, username: string, callback: (error?: Error, row?: any) => void) {
    this.models().ChannelLog.findAll({
      where: {
        channel: channel,
        user: username,
        action: 'msg'
      },
      limit: 1,
       order: 'id DESC'
    }).then(function(rows) {
      if(rows && rows.length !== 0) {
        return rows[0];
      } else {
        throw new Error('No log entries found');
      }
    }).then(function(row) {
      if(callback) {
        callback(undefined, row);
      }
    }).catch(callback);
  }

  /**
   * Idk.
   */
  getMessageLogCount(roomname: string, dateMod: any, callback: (error?: Error, count?: number) => void) {
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
  insertMessageToLog(channel: string, username: string, msg: string, callback: (error?: Error) => void) {
    this.models().ChannelLog.create({
      channel: channel,
      user: username,
      action: 'msg',
      data: msg
    }).then(function(channelLog) {
      if(callback) {
        callback();
      }
    }).catch(callback);
  }
}

/**
 * Callback with only an error parameter.
 * @callback errorCallback
 * @param {Object} error if an error occurred
 */

export default DbManager;
