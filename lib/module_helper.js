function ModuleHelper() {
}

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
