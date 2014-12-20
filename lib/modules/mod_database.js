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
      { name: 'seen', callback: DatabaseModule.prototype.onSeen.bind(this) }
    ]
  };
}

DatabaseModule.prototype.onSeen = function(data) {
  var roomname = data.room.name,
      db = data.database,
      helper = data.helper,
      logger = data.logger,
      send = data.send;

  if(data.parsed.tail) {
    var username = data.parsed.tailArray[0];
    db.getLastLogEntry(roomname, username, function(err, row) {
      logger.log('debug', 'getLastLogEntry', { row: row });

      var timestamp = moment(row.timestamp + ' +0000', 'YYYY-MM-DD HH:mm:ss Z'),
          now = moment(),
          diff = now.diff(timestamp),
          timeStr = helper.timeToString(Number(diff.toString()));

      send(username + ' was last seen: ' + timeStr);
    });
  }
};

module.exports = DatabaseModule;
