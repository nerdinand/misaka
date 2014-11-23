function PermissionsHandler() {
  // Todo
}

PermissionsHandler.prototype.load = function(obj) {
  // Todo
};

/**
 * Represents the permissions on a module or command.
 * This indicates which specific users may/may not be
 * allowed, and which types of users.
 * Also, maybe IPs?
 */
function Permissions(opts) {
  if(!(opts instanceof Object)) {
    opts = {};
  }

  this.users = new PermissionList(opts); // Names on the whitelist/blacklist

  this.types = new PermissionList({ type: 'blacklist' }); // Types (user, mod, admin) on the whitelist/blacklist 
  // IP list would generally be a blacklist
  this.ips = new PermissionList({ type: 'blacklist' }); // IPs on the whitelist/blacklist
}

/**
 * Whether or not a user is allowed according to these permissions.
 * Expects user object to have name, type, ip fields.
 * @param user User object
 * @return true if allowed, false if not
 */
Permission.prototype.isAllowed = function(user) {
  if(user.name === undefined || user.type === undefined || user.ip === undefined) {
    console.warn('Cannot check permission for users, insufficient fields');
    return false;
  }

  // Todo?: Provide a message about why we returned false

  // Leave like this for now, might add message
  if(!this.users.isAllowed(user.name)) {
    return false;
  } else if(!this.types.isAllowed(user.type)) {
    return false;
  } else if(!this.ips.isAllowed(user.ip)) {
    return false;
  }

  return true;
};

/**
 * A list of "names" and whether or not this list is
 * a whitelist or blacklist.
 */
function PermissionList(opts) {
  if(!(opts instanceof Object)) {
    opts = {};
  }

  this.list = [];
  this.type = opts['type'] || 'whitelist';
}

/**
 * Clear the list of names.
 */
PermissionList.prototype.clear = function() {
  this.list = [];
};

/**
 * Check if a name is in the list.
 * @param name Name to check
 * @return true if name in the list, false if not
 */
PermissionList.prototype.contains = function(name) {
  return (this.list.indexOf(name) >= 0);
};

/**
 * Check if a name is allowed according to this list.
 * @param name Name to check
 * @return true if allowed, false if not
 */
PermissionList.prototype.isAllowed = function(name) {
  if(this.type === 'blacklist') {
    return !this.contains(name);
  } else {
    return this.contains(name);
  }
};
