function XModule() {
  this.info = {
    name: 'X',
    commands: [
      { name: 'xadduser', callback: XModule.prototype.onXAddUser.bind(this) },
      { name: 'xremoveuser', callback: XModule.prototype.onXRemoveUser.bind(this) },
      { name: 'xsetname', callback: XModule.prototype.onXSetName.bind(this) },
      { name: 'xkillfakes', callback: XModule.prototype.onXKillFakes.bind(this) }
    ],
    description: 'Experimental'
  };
}

/**
 * Update name in the room list.
 * @param data Command data
 */
XModule.prototype.onXSetName = function(data) {
  var client = data.parent.client,
      room = data.room;

  if(data.parsed.tail) {
    var name = data.parsed.tailArray[0];

    var user = client.createUser();
    user.chatUsername = name;

    room.firebase.me.update(user, function(err) {
      if(err) {
        data.send('Couldn\'t update name.');
      } else {
        data.send('Name updated to ' + name + ' in the chatlist.');
      }
    });
  }
};

/**
 * Remove a fake user from the list.
 * @param data Command data
 */
XModule.prototype.onXRemoveUser = function(data) {
  var room = data.room;

  if(data.parsed.tail) {
    var name = data.parsed.tailArray[0];
    room.firebase.users.child(name).remove(function(err) {
      if(err) {
        data.send('Couldn\'t remove user with id ' + name + ', maybe they don\'t exist?');
      } else {
        data.send('User removed.');
      }
    });
  }
};

/**
 * Add a fake user to the list.
 * @param data Command data
 */
XModule.prototype.onXAddUser = function(data) {
  var client = data.parent.client,
      room = data.room;

  if(data.parsed.tail) {
    var newname = data.parsed.tailArray[0];

    var user = client.createUser();
    user.chatUsername = newname;

    var ref = room.firebase.users.push(user, function(err) {
      if(err) {
        data.send('Couldn\'t add user.');
      } else {
        data.send('User ' + newname + ' added with id ' + ref.name());
      }
    });
  }
};

/**
 * Detect and kill all fake users.
 * Note: This is a mess, implement with promises later?
 * @param data Command data
 */
XModule.prototype.onXKillFakes = function(data) {
  var room = data.room;
  room.firebase.users.once('value', function(snapshot) {
    var val = snapshot.val();
    var toKill = [];

    for(var key in val) {
      // If id starts with -, kill it
      if(key.length > 0 && key[0] === '-') {
        console.log('checking id: ' + key);
        toKill.push(key);
      }
    }

    if(toKill.length === 0) {
      data.send('No fake users detected');
    } else {
      var successes = 0, fails = 0;
      toKill.forEach(function(id) {
        room.firebase.users.child(id).remove(function(err) {
          if(err) fails++;
          else successes++;

          // If done
          if((fails + successes) === toKill.length) {
            if(fails === 0) {
              data.send('Killed ' + successes + ' fake user(s).');
            } else {
              data.send('Killed ' + successes + '/' + toKill.length + ' fake user(s).');
            }
          }
        });
      });
    }
  });
};

module.exports = XModule;
