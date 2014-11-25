function ModuleHelper() {
}

/**
 * Get all the command names provided by a module.
 * @param module Module instance
 * @return array of names, or empty array if none
 */
ModuleHelper.prototype.getCommandNames = function(module) {
  var list = [], commands = module.commands();
  commands.forEach(function(info) {
    if(info && info.name !== undefined) {
      list.push(info.name);
    }
  });
  return list;
};

/**
 * "Wrap" a command instance with stuff.
 * @param command Command instance to wrap
 */
ModuleHelper.prototype.wrapCommand = function(command) {
  command.enabled = true;
};

/**
 * "Wrap" a module (loaded directly from a mod_blah.js file)
 * with other functions/fields.
 * @param module Module to wrap
 */
ModuleHelper.prototype.wrapModule = function(module) {
  module.enabled = true;
};

/**
 * Helper function for parsing a command string.
 * @param str Command string to parse
 * @return map with fields
 */
ModuleHelper.prototype.parseCommandMessage = function(str) {
  var r = {
    full: str
  };

  var s = str.split(/\s+/);
  r['head'] = s[0];

  if(s.length === 1) {
    // Empty tail/tailArray if only head
    r['tail'] = '';
    r['tailArray'] = [];
  } else {
    r['head'] = s[0];
    s.splice(0, 1);

    r['tail'] = s.join(' ');
    r['tailArray'] = s;
  }

  return r;
};

module.exports = ModuleHelper;
