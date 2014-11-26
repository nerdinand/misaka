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

/**
 * Parse a time string, returning the number of milliseconds
 * it represents.
 * @param str String to parse
 * @return number of milliseconds the string represents, undefined if error
 */
ModuleHelper.prototype.parseTimeString = function(str) {
  var seconds = 0, minutes = 0, hours = 0, days = 0,
      pattern = /^\s*((\d+)(s|m|h|d)\s*)+\s*$/,
      each = /\s*((\d+)(s|m|h|d))\s*/ig, match;

  if(pattern.test(str)) {
    do {
      match = each.exec(str);
      if(match) {
        var num = parseInt(match[2], 10), t = match[3].toLowerCase();
        if(t === 's') seconds = num;
        else if(t === 'm') minutes = num;
        else if(t === 'h') hours = num;
        else if(t === 'd') days = num;
      }
    } while(match);

    var total = (days * (24 * 60 * 60 * 1000))
              + (hours * (60 * 60 * 1000))
              + (minutes * (60 * 1000))
              + (seconds * 1000);

    return {
      days: days,
      hours: hours,
      minutes: minutes,
      seconds: seconds,
      total: total
    };
  }
};

/**
 * Get a time string from some number of milliseconds.
 * Factors in days, hours, minutes, then seconds. Messy.
 * @param milli Milliseconds
 * @return time as a string
 */
ModuleHelper.prototype.timeToString = function(milli) {
  var mSeconds = 1000,
      mMinutes = mSeconds * 60,
      mHours = mMinutes * 60,
      mDays = mHours * 24;

  var days = Math.floor(milli / mDays);
  milli -= (days * mDays);

  var hours = Math.floor(milli / mHours);
  milli -= (hours * mHours);

  var minutes = Math.floor(milli / mMinutes);
  milli -= (minutes * mMinutes);

  var seconds = Math.floor(milli / mSeconds);
  milli -= (seconds * mSeconds);

  var list = [];
  if(days > 0) list.push(days + ' days');
  if(hours > 0) list.push(hours + ' hours');
  if(minutes > 0) list.push(minutes + ' minutes');
  if(seconds > 0) list.push(seconds + ' seconds');

  if(list.length === 0) {
    return 'no time';
  } else {
    return list.join(', ');
  }
};

module.exports = ModuleHelper;
