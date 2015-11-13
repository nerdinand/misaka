import pluralize = require('pluralize');

export interface ParsedCommand {
  head: string;
  full: string;
  tail: string;
  tailArray: string[];
}

export interface ParsedTime {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

export class ModuleHelper {
  /**
   * Helper function for parsing a command string.
   * @param str Command string to parse
   * @return map with fields
   */
  parseCommandMessage(str: string): any {
    var r: ParsedCommand = {
      full: str,
      head: '',
      tail: '',
      tailArray: []
    };

    str = this.trim(str);
    str = str.replace(/\s\s+/g, ' '); // All multi-whitespace -> ' '
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
  parseTimeString(str: string): ParsedTime {
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
  }

  /**
   * Get a time string from some number of milliseconds.
   * Factors in days, hours, minutes, then seconds. Messy.
   * @param milli Milliseconds
   * @return time as a string
   */
  timeToString(milli: number): string {
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
    if(days > 0) list.push(pluralize('day', days, true));
    if(hours > 0) list.push(pluralize('hour', hours, true)); //hours + ' hours');
    if(minutes > 0) list.push(pluralize('minute', minutes, true)); //minutes + ' minutes');
    if(seconds > 0) list.push(pluralize('second', seconds, true)); //seconds + ' seconds');

    if(list.length === 0) {
      return 'no time';
    } else {
      return list.join(', ');
    }
  }

  trim(str: string): string {
    return str.replace(/^\s+/, '').replace(/\s+$/, '');
  }

  /**
   * Try to parse some on/off choice. If neither could be parsed,
   * will return undefined.
   * @param {String} str - String to parse
   * @return {Boolean} true if on, false if off, undefined if neither
   */
  parseChoice(str: string): boolean {
    var on = /^((on)|(enable))/i,
        off = /^((off)|(disable))/i;
    if(on.test(str)) {
      return true;
    } else if(off.test(str)) {
      return false;
    }
  }
}

export default ModuleHelper;
