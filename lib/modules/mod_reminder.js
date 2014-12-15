var events = require('events');

var moment;
try {
  moment = require('moment');
} catch(e) {
  throw new Error('`moment` package not installed');
}

function ReminderModule() {
  this.info = {
    name: 'Reminder',
    description: 'State reminders',
    callbacks: {
      join: ReminderModule.prototype.onJoin.bind(this)
    }
  };

  this.reminders = [];
  this.send = undefined;
}

/**
 * @param {Object} data
 */
ReminderModule.prototype.onJoin = function(data) {
  var roomname = data.room.name,
      config = data.config[roomname];

  this.send = data.send;

  if(config) {
    var reminder = new Reminder(config, [roomname]);
    this.initEvents(reminder);
    this.reminders.push(reminder);
  }
};

/**
 * Initialize the events for a reminder.
 * @param {Reminder} reminder
 */
ReminderModule.prototype.initEvents = function(reminder) {
  var send = this.send;
  reminder.on('alert', function(alert) {
    send(alert.toString());
  });
};

function Reminder(data, rooms, callback) {
  // Example of 'data':
  // {
  //   name: 'Reminder name',       // Name of reminder
  //   repeat: 'daily',             // When the event repeats (only daily supported for now)
  //   time: '',                    // DateTime String?
  //   alert: [[1, 'hours'],        // When to remind before the event occurs
  //           [30, 'minutes'],
  //           [10, 'minutes']]
  //                                // Always use this timezone?
  // }

  this.data = data;
  this.rooms = rooms;
  this.emitter = new events.EventEmitter();
  this.alerts = [];
  this.setupTimeouts();
};

/**
 * Wrapper method for emitter.on.
 */
Reminder.prototype.on = function() {
  this.emitter.on.apply(this.emitter, arguments);
};

/**
 * Wrapper method for emitter.emit.
 */
Reminder.prototype.emit = function() {
  this.emitter.emit.apply(this.emitter, arguments);
};

/**
 * Get data for alerts.
 * @return {[[Number, String]]}
 */
Reminder.prototype.getAlertsData = function() {
  return this.data.alert;
};

/**
 * Get the reminder's name.
 * @return {String}
 */
Reminder.prototype.getName = function() {
  return this.data.name;
};

/**
 * Get the Moment at which the next event occurs.
 * If daily, it would be either today or tomorrow.
 * Currently assumed daily.
 * @return {Moment}
 */
Reminder.prototype.getNextDate = function() {
  var eventTime = this.parseTime(this.data.time),
      now = moment(), e = moment();

  //console.log(['eventTime', eventTime]);

  e.hours(eventTime.hour);
  e.minutes(eventTime.minute);
  e.seconds(eventTime.second);

  if(e.isBefore(now)) {
    e.add(1, 'days');
  }

  //var diff = moment.duration(now.diff(e));
  //console.log(['diff', diff.toString()]);

  return e;
};

/**
 * Parse a time string.
 * @param {String} str
 * @return
 */
Reminder.prototype.parseTime = function(str) {
  var patt = /^(\d{1,2})(:\d{1,2}(:\d{1,2})?)?$/,
      match = str.match(patt);

  if(match) {
    var vals = match[0].split(':');
    for(var i = 0; i < vals.length; i++) {
      if(vals[i] > 23) {
        vals[i] = 0;
      }
    }

    if(vals.length === 1) {
      return { hour: vals[0], minute: 0, second: 0 };
    } else if(vals.length === 2) {
      return { hour: vals[0], minute: vals[1], second: 0 };
    } else {
      return { hour: vals[0], minute: vals[1], second: vals[2] };
    }
  }
};

/**
 * Setup alerts.
 */
Reminder.prototype.setupTimeouts = function() {
  if(this.data.repeat === 'daily') {
    var reminder = this,
        next = this.getNextDate(),
        alerts = this.getAlertsData();

    alerts.forEach(function(data) {
      var when = moment(next);
      when.subtract(data[0], data[1]);

      var alert = new ReminderAlert(reminder, data, when, function(alert) {
        reminder.emit('alert', alert);
      });
      reminder.alerts.push(alert);
    });

  } else {
    // Todo: Use logger
    console.warn('Only \'daily\' repeat for reminders is currently supported, ignoring for room ' + this.rooms[0]);
  }
};

/**
 * @param {Reminder} reminder
 * @param {Object} alertData
 * @param {Moment} when
 */
function ReminderAlert(reminder, alertData, when, callback) {
  this.parent = reminder;
  this.data = alertData;
  this.timeout = undefined;
  this.when = when;
  this.callback = callback;
  this.initTimeout();
}

/**
 * Clear the timeout.
 */
ReminderAlert.prototype.clearTimeout = function() {
  clearTimeout(this.timeout);
};

/**
 * Get the milliseconds until the alert.
 * @return {Number}
 */
ReminderAlert.prototype.getMillisecondsUntil = function() {
  var now = moment(), when = moment(this.when);
  return when.diff(now);
};

/**
 * Initialize the timeout. Will advance once timeout completes.
 */
ReminderAlert.prototype.initTimeout = function() {
  var alert = this, callback = this.callback,
      milli = this.getMillisecondsUntil();

  if(milli >= 0) {
    this.timeout = setTimeout(function() {
      if(callback) {
        callback(alert);
      }
      alert.advance();
    }, milli);
  } else {
    this.advance();
  }
};

/**
 * Advance alert date to the next day and initialize timeout again.
 */
ReminderAlert.prototype.advance = function() {
  this.when.add(1, 'days');
  this.initTimeout();
};

/**
 * Get a String representation of this alert.
 * @return {String}
 */
ReminderAlert.prototype.toString = function() {
  var val = this.data[0], unit = this.data[1],
      name = this.parent.getName();
  return (val + ' ' + unit + ' until ' + name);
};

module.exports = ReminderModule;
