var sqlite3 = require('sqlite3');
var util = require('util');

var addUser = function(user) {
  var query = util.format('INSERT INTO rawr_users (channel, username, points, subpoints, created_at, updated_at) '
                        + 'VALUES ("%s", "%s", %d, %d, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
                        user.channel, user.user, user.points, user.subpoints);
  db.run(query, function(err) {
    if(!err) {
      console.log(util.format('Successfully added RawrUser: %s, %s, %d, %d',
                  user.channel, user.user, user.points, user.subpoints));
    } else {
      console.log(err);
    }
  });
};

var fixDb = function(db) {
  db.all('SELECT * FROM rawr_points', function(err, rows) {
    rows.forEach(addUser);
  });
};

var args = process.argv.slice(2),
    databasePath = args[0],
    db = new sqlite3.Database(databasePath, function(err) {
      if(!err) {
        fixDb(db);
      } else {
        console.log(err);
      }
    });
