import events = require('events');

export interface UserListUpdateData {
  added: any[],
  changed: any[],
  removed: any[]
}

/**
 * Create a new UserList to keep track of user events.
 */
export class UserList {
  private users: any;
  private current: any;
  private emitter: events.EventEmitter;
  private socket: any;
  private initial: any;

  constructor() {
    this.users = {};
    this.current = [];
    this.emitter = new events.EventEmitter();
    this.socket = undefined;
  }

  /**
   * Get a user from this list by username.
   * @param username Username of user to get
   * @return user object, or undefined if no user found
   */
  getUser(username: string): any {
    return this.users[username.toLowerCase()];
  }

  /**
   * Setup socket events. UserList will need to listen for channelUsers
   * and update according to changes, emitting its own events for when
   * users join, leave, or change (userAdded, userChanged, userRemoved).
   * @param socket Socket to listen on
   */
  setSocket(socket: any) {
    var userlist = this;
    this.socket = socket;

    socket.on('channelUsers', function(data) {
      // If initial, handle differently
      if(userlist.initial === undefined) {
        userlist.initial = data;
        userlist.update(data);
        userlist.emit('initial', data);
      } else {
        var results = userlist.update(data),
            added = results.added, changed = results.changed, removed = results.removed;

        added.forEach(function(user) {
          userlist.emit('userAdded', user);
        });

        changed.forEach(function(diff) {
          userlist.emit('userChanged', diff);
        });

        removed.forEach(function(user) {
          userlist.emit('userRemoved', user);
        });
      }
    });
  }

  /**
   * Update the users map using data received in a channelUsers event.
   * @param data Data received from channelUsers
   * @return object with the following fields:
   *           added:   Array of user objects that have joined (new in list)
   *           changed: Array of user objects that have changed
   *           removed: Array of user objects that have left (no longer in list)
   */
  update(data: any): UserListUpdateData {
    var userlist = this, users = this.users, current = this.current,
        namelist = this.createNameList(),
        ret: UserListUpdateData = { added: [], changed: [], removed: [] };

    data.forEach(function(user) {
      // Use array of names (namelist) to check for removed users
      var index = namelist.indexOf(user.username);
      if(index >= 0) { // Name found, removing
        namelist.splice(index, 1);
      }

      var existing = users[user.username.toLowerCase()];
      if(existing) {
        // Check for change
        if(!userlist.compareUsers(existing, user)) {
          ret.changed.push([existing, user]);
        }
      } else {
        ret.added.push(user);
      }

      users[user.username.toLowerCase()] = user;
    });

    // Whatever names are left in the list have left
    namelist.forEach(function(remaining) {
      var user = users[remaining.toLowerCase()];
      ret.removed.push(user);
      delete users[remaining.toLowerCase()];
    });

    this.current = data;

    return ret;
  }

  /**
   * Compare two user objects.
   * @param u1 User object
   * @param u2 User object
   * @return true if users are identical, false if they differ
   */
  compareUsers(u1: any, u2: any): boolean {
    return (
      u1.admin === u2.admin &&
      u1.banned === u2.banned &&
      u1.color === u2.color &&
      u1.mod === u2.mod &&
      u1.premium === u2.premium &&
      u1.ptvadmin === u2.ptvadmin &&
      u1.registered === u2.registered &&
      u1.username === u2.username
    );
  }

  /**
   * Create a list of usernames from the most recent channelUsers event (current).
   * @return array of usernames, or an empty array if none
   */
  createNameList(): string[] {
    var names: string[] = [];
    this.current.forEach(function(user) {
      names.push(<string>user.username);
    });
    return names;
  }

  /**
   * Wrapper for emitter.emit.
   */
  emit(event: string, ...args: any[]): boolean {
    return this.emitter.emit(event, args);
  };

  /**
   * Wrapper for emitter.on.
   */
  on(event: string, listener: Function): UserList {
    this.emitter.on(event, listener);
    return this;
  }
}
