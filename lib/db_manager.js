var async = require('async');
var osenv = require('osenv');
var path = require('path');
var sql = require('sql');
var sqlite3 = require('sqlite3');
var logger = require(path.join(__dirname, 'logger'));

var DbManager = function(opts) {
  if(!opts) opts = {};
  this.path = opts['path'];

  if(this.path === undefined || this.path === null) {
    this.path = this.getDefaultPath();
  }

  this._initialized = false;
  var _this = this;

  this.initTableHandlers();
  this.initDatabase(function(err) {
    if(!err) {
      _this._initialized = true;
      logger.log('debug', 'Successfully initialized database', { path: _this.getPath() });
    } else {
      logger.error(err, { msg: 'Error initializing database' });
    }
  });
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
 * Get the last log entry for a user in a channel. Untested.
 * @param {String} channel Channel name
 * @param {String} username Username
 */
DbManager.prototype.getLastLogEntry = function(channel, username, callback) {
  if(!this.checkInitialized(callback)) {
    return;
  }

  var channel_log = this._tables.channel_log,
      query = channel_log.select(channel_log.star()).from(channel_log)
                .where(channel_log.channel.equals(channel).and(channel_log.user.equals(username)))
                .order(channel_log.id.desc).limit(1)
                .toString();

  // Hacky workaround for node-sql's lack of specifying case insensitive field
  query = query.replace(')) ORDER', ' COLLATE NOCASE)) ORDER');
  //logger.log('debug', 'getLastLogEntry', { query: query });

  this._db.all(query, function(err, rows) {
    var row;
    if(!err && rows.length > 0) {
      row = rows[0];
    }

    if(callback) {
      callback(err, row);
    }
  });
};

DbManager.prototype.getMessageLogCount = function(roomname, dateMod, callback) {
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
};

/**
 * Insert a message into the log table.
 * @param {String} channel Channel name
 * @param {String} username Username
 * @param {String} msg Message text
 * @param {errorCallback} callback
 */
DbManager.prototype.insertMessageToLog = function(channel, username, msg, callback) {
  if(!this.checkInitialized(callback)) {
    return;
  }

  var channel_log = this._tables.channel_log,
      query = channel_log.insert(
                channel_log.channel.value(channel),
                channel_log.user.value(username),
                channel_log.action.value('msg'),
                channel_log.data.value(msg))
              .toString();
  //logger.log('debug', 'insertMessageToLog', { query: query });
  this._db.run(query, callback);
};

/**
 * Give a user RAWR points.
 * @param {String} channel Channel name
 * @param {String} username Username
 * @param {Number} points Points to give
 * @param {errorCallback} callback
 */
DbManager.prototype.addRawrPoints = function(channel, username, points, callback) {
  if(!this.checkInitialized(callback)) {
    return;
  }

  var db = this._db,
      table = this._tables.rawr_points,
      query = table.select().from(table)
                .where(table.channel.equals(channel)).and(table.user.equals(username))
                .limit(1)
                .toString();

  db.all(query, function(err, rows) {
    if(!err) {
      var q;

      if(rows.length > 0) {
        // Calculate the new point total. If less than 0, consider the transaction
        // as failed.
        var newTotal = rows[0].points + points;
        if(newTotal < 0) {
          // Transaction failed
          if(callback) {
            callback('RAWR point transaction failed');
          }
          return;
        }

        q = table.update({ points: newTotal })
                 .where(table.channel.equals(channel).and(table.user.equals(username)))
                 .toString();
      } else if(points >= 0) {
        q = table.insert({
              channel: channel,
              user: username,
              points: ((points < 0) ? 0 : points)
            }).toString();
      } else {
        if(callback) {
          callback('RAWR point transaction failed');
        }
        return;
      }

      // Run the insert or update query, indicating a successful transaction
      db.run(q, callback);
    } else {
      if(callback) {
        callback(err);
      }
    }
  });
};

/**
 * Get all usernames with unused RAWR tickets for a channel.
 * @param {String} channel Channel name
 * @return {Object} Ticket type names -> Array of usernames
 */
DbManager.prototype.getAllRawrTickets = function(channel, callback) {
  if(!this.checkInitialized(callback)) {
    return;
  }

  var db = this._db,
      table = this._tables.rawr_tickets,
      query = table.select()
                .where(table.channel.equals(channel))
                .and(table.used.equals(0))
              .toString();

  db.all(query, function(err, rows) {
    if(!err) {
      var data = { 'sketch': [], 'speedpaint': [] };
      rows.forEach(function(row) {
        if(!data[row.type]) {
          data[row.type] = [row.user];
        } else {
          data[row.type].push(row.user);
        }
      });

      if(callback) {
        callback(undefined, data);
      }
    } else if(callback) {
      callback(err);
    }
  });
};

/**
 * Check whether or not a user has an unused RAWR ticket.
 * @param {String} channel Channel name
 * @param {String} username Username
 * @param {String} type Ticket type
 */
DbManager.prototype.hasRawrTicket = function(channel, username, type, callback) {
  if(!this.checkInitialized(callback)) {
    return;
  }

  var db = this._db,
      table = this._tables.rawr_tickets,
      query = table.select()
                .where(table.channel.equals(channel))
                .and(table.user.equals(username))
                .and(table.used.equals(0))
                .and(table.type.equals(type))
              .limit(1)
              .toString();

  db.all(query, function(err, rows) {
    if(!err && callback) {
      callback(err, rows.length > 0);
    } else if(callback) {
      callback(err);
    }
  });
};

/**
 * Mark a RAWR ticket as used.
 * @param {String} channel Channel name
 * @param {String} username Username
 * @param {String} type Ticket type
 */
DbManager.prototype.markRawrTicket = function(channel, username, type, callback) {
  if(!this.checkInitialized(callback)) {
    return;
  }

  var db = this._db,
      table = this._tables.rawr_tickets,
      query = table.update({ used: 1, update_timestamp: new Date() })
                .where(table.channel.equals(channel))
                .and(table.user.equals(username))
                .and(table.used.equals(0))
                .and(table.type.equals(type))
              .toString();

  db.run(query, callback);
};

/**
 * Exchange points for a RAWR ticket.
 * @param {String} channel Channel name
 * @param {String} username Username of buying user
 * @param {String} type Ticket type
 * @param {Number} cost Cost of ticket
 */
DbManager.prototype.purchaseRawrTicket = function(channel, username, type, cost, callback) {
  if(!this.checkInitialized(callback)) {
    return;
  }

  var db = this._db,
      table = this._tables.rawr_tickets,
      addRawrPoints = DbManager.prototype.addRawrPoints.bind(this);

  this.hasRawrTicket(channel, username, type, function(err, has) {
    if(!err) {
      if(!has) {
        addRawrPoints(channel, username, (cost * -1), function(err) {
          if(!err) {
            // Transaction successful, give ticket
            var q = table.insert({
              channel: channel,
              user: username,
              type: type,
              used: 0
            }).toString();
            db.run(q, callback);
          } else if(callback) {
            callback(err);
          }
        });
      } else if(callback) {
        callback('User already has an unused RAWR ticket');
      }
    } else if(callback) {
      callback(err);
    }
  });
};

/**
 * Get a user's RAWR points.
 * @param {String} channel Channel name
 * @param {String} username Username
 * @param {errorCallback} callback
 */
DbManager.prototype.getRawrPoints = function(channel, username, callback) {
  if(!this.checkInitialized(callback)) {
    return;
  }

  var db = this._db;
  var table = this._tables.rawr_points,
      query = table.select().from(table)
                .where(table.channel.equals(channel).and(table.user.equals(username)))
                .limit(1)
                .toString();

  db.all(query, function(err, rows) {
    if(!err) {
      var points = 0;
      if(rows.length !== 0) {
        points = rows[0].points;
      }

      if(callback) {
        callback(undefined, points);
      }
    } else {
      if(callback) {
        callback(err);
      }
    }
  });
};

/**
 * Initialize _tables.
 */
DbManager.prototype.initTableHandlers = function() {
  var sqlite = new sql.Sql('sqlite');
  this._tables = {
    channel_log: sqlite.define({
      name: 'channel_log',
      columns: [
        { name: 'id', dataType: 'INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL' },
        { name: 'channel', dataType: 'varchar(64)', notNull: true },
        { name: 'user', dataType: 'varchar(64)', notNull: true },
        { name: 'action', dataType: 'varchar(8)', notNull: true },
        { name: 'data', dataType: 'varchar(256)' },
        { name: 'timestamp', dataType: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' }
      ],
      charset: 'utf8'
    }),

    rawr_points: sqlite.define({
      name: 'rawr_points',
      columns: [
        { name: 'id', dataType: 'INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL' },
        { name: 'channel', dataType: 'varchar(64) COLLATE NOCASE', notNull: true },
        { name: 'user', dataType: 'varchar(64) COLLATE NOCASE', notNull: true },
        { name: 'points', dataType: 'integer', notNull: true },
        { name: 'create_timestamp', dataType: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
        { name: 'update_timestamp', dataType: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' }
      ],
    }),

    rawr_tickets: sqlite.define({
      name: 'rawr_tickets',
      columns: [
        { name: 'id', dataType: 'INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL' },
        { name: 'channel', dataType: 'varchar(64) COLLATE NOCASE', notNull: true },
        { name: 'user', dataType: 'varchar(64) COLLATE NOCASE', notNull: true },
        { name: 'type', dataType: 'varchar(16)', notNull: true },
        { name: 'used', dataType: 'integer', default: 0, notNull: true },
        { name: 'create_timestamp', dataType: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
        { name: 'update_timestamp', dataType: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' }
      ],
    })
  };
};

/**
 * Initialize the sqlite3 database.
 * @param {errorCallback} callback
 */
DbManager.prototype.initDatabase = function(callback) {
  // Unsure if this is always async, or only if passed a callback
  var _this = this;
  var db = this._db = new sqlite3.Database(this.path, function(err) {
    if(!err) {
      _this.createTables(callback);
    } else if(callback) {
      callback(err);
    }
  });
};

/**
 * Create the tables for the database if they don't exist.
 * @param {errorCallback} callback
 */
DbManager.prototype.createTables = function(callback) {
  var db = this._db, tables = this._tables,
      channelLogQuery = tables.channel_log.create().ifNotExists().toQuery().text,
      rawrPointsQuery = tables.rawr_points.create().ifNotExists().toQuery().text,
      rawrTicketsQuery = tables.rawr_tickets.create().ifNotExists().toQuery().text;

  logger.log('debug', 'Creating channel_log table if it doesn\'t exist', { query: channelLogQuery });
  logger.log('debug', 'Creating rawr_points table if it doesn\'t exist', { query: rawrPointsQuery });
  logger.log('debug', 'Creating rawr_tickets table if it doesn\'t exist', { query: rawrTicketsQuery });

  async.series([
    db.run.bind(db, channelLogQuery),
    db.run.bind(db, rawrPointsQuery),
    db.run.bind(db, rawrTicketsQuery)
  ], callback);
};

/**
 * Callback with only an error parameter.
 * @callback errorCallback
 * @param {Object} error if an error occurred
 */

module.exports = DbManager;
