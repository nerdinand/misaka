var moment;
try {
  moment = require('moment');
} catch(error) {
  throw new Error('`moment` package not installed');
}

function DatabaseModule() {
  this.info = {
    name: 'Database',
    description: 'Provides commands for interacting with the sqlite3 database',
    commands: [
      { name: 'lastlog', callback: DatabaseModule.prototype.onLastLog.bind(this) },
      { name: 'seen', callback: DatabaseModule.prototype.onSeen.bind(this) }
    ],
    // V7 chat hasn't been up in awhile, limiting to V6 for convenience
    chatVersions: 6
  };
}

DatabaseModule.prototype.onLastLog = function(data) {
  var room = data.room,
      roomname = data.room.name,
      db = data.database,
      logger = data.logger,
      send = data.send;

  if(data.parsed.tail) {
    var username;
    if(data.parsed.tailArray.length === 1) {
      username = data.parsed.tailArray[0];
    } else {
      roomname = data.parsed.tailArray[0];
      username = data.parsed.tailArray[1];
    }

    db.getLastLogEntry(roomname, username, function(err, row) {
      if(!err && row) {
        send('[' + row.timestamp + '] ' + row.user + ': ' + row.data);
      } else {
        if(err) {
          logger.error(err);
        }

        send('No logs found for ' + username + '.');
      }
    });
  }
};

DatabaseModule.prototype.onSeen = function(data) {
  var room = data.room,
      roomname = data.room.name,
      db = data.database,
      helper = data.helper,
      logger = data.logger,
      send = data.send;

  if(data.parsed.tail) {
    var username = data.parsed.tailArray[0],
        snapshot = room.getUser(username.toLowerCase());
    if(snapshot && snapshot.isPresent()) {
      return (snapshot.username + ' is currently in the room, baka.');
    }

    db.getLastLogEntry(roomname, username, function(err, row) {
      if(!err && row) {
        logger.log('debug', 'getLastLogEntry', { row: row });

        var timestamp = moment(row.timestamp + ' +0000', 'YYYY-MM-DD HH:mm:ss Z'),
            now = moment(),
            diff = now.diff(timestamp),
            timeStr = helper.timeToString(Number(diff.toString()));

        send(username + ' was last seen: ' + timeStr + ' ago.');
      } else {
        if(err) {
          logger.error(err);
        }

        send(username + ' has never been seen.');
      }
    });
  }
};

module.exports = DatabaseModule;
