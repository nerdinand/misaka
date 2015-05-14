var _ = require('underscore');

/**
 * Provides commands specific to lumineko's RAWR point system and guessing game.
 * This module assumes a one-room-per-bot model.
 */
function RawrModule() {
  this.info = {
    name: 'Rawr',
    description: 'Module for lumi\'s RAWR point system and guessing game',
    // Todo: ggticket command, unsure what it's supposed to do
    commands: [
      { name: 'gg', cooldown: false, callback: RawrModule.prototype.onGame.bind(this) },
      { name: 'ggend', callback: RawrModule.prototype.onGameEnd.bind(this) },
      { name: 'guess', cooldown: false, callback: RawrModule.prototype.onGuess.bind(this) },
      { name: 'ggrules', callback: RawrModule.prototype.onGameRules.bind(this) },
      { name: 'ggticket', cooldown: false, callback: RawrModule.prototype.onGameTickets.bind(this) },
      { name: 'mark', cooldown: false, callback: RawrModule.prototype.onMarkTicket.bind(this) },
      { name: 'rp', cooldown: false, callback: RawrModule.prototype.onRawrPoints.bind(this) },
      { name: 'rpredeem', callback: RawrModule.prototype.onRawrPointsRedeem.bind(this) }

      // { name: 'give', callback: RawrModule.prototype.onGivePoints.bind(this) } // TEST
    ],
    callbacks: {
      join: RawrModule.prototype.onJoin.bind(this)
    }
  };

  /**
   * The current ongoing game. If on, will have an array of names to guess. If off, undefined.
   * {
   *   answers: ['Answer 1', 'Answer 2'],
   *   users: ['goose', 'elephant', 'giraffe', 'alligator']
   * }
   */
  this.game = undefined;
}

// Todo: Change these consts to configurable?

// 1 minute
var TIMEOUT_MILLI = 60 * 1000;

// 30 seconds
var ALERT_TIMEOUT_MILLI = 30 * 1000;

// 5 minutes
var REMINDER_INTERVAL_MILLI = 5 * 60 * 1000;

// Number of RAWR points that a ticket costs
var TICKET_COST = 50;

// Point rewards for top 5 users
var REWARDS = [ 10, 6, 4, 2, 1 ];

// Placement strings
var PLACINGS = [ '1st', '2nd', '3rd', '4th', '5th' ];

// Whether or not the admin can guess and participate in the game
var CAN_ADMIN_GUESS = true;

/**
 * Translate an individual answer before storing it.
 * @param {String} answer Original answer
 * @return {String} Translated answer that will be compared against with guesses
 */
RawrModule.prototype.translateAnswer = function(answer) {
  return answer.replace(/\s+/g, ''); // Remove whitespace
};

/**
 * Destroy game-related objects, clearing associated intervals/timeouts.
 */
RawrModule.prototype.destroyGame = function() {
  this.stopTimeout();
  this.stopReminderInterval();
  this.game = undefined;
};

/**
 * Alert the channel that the game is ending soon.
 */
RawrModule.prototype.alertEnding = function() {
  // Todo: Have '30 seconds' changeable when configurability added
  var msg = 'Someone guessed correctly, the round ends in 30 seconds but you can still guess until it\'s over!';
  this.send(msg);
};

/**
 * Alert the channel that a game is ongoing.
 */
RawrModule.prototype.alertReminder = function() {
  // Only send message if no timeout, meaning no one has guessed yet
  if(!this.hasTimeout()) {
    var msg = 'There is currently a guessing game round in session! Make your guesses with !guess "name"';
    this.send(msg);
  }
};

/**
 * Whether or not the current game has an active timeout, indicating that
 * some user has correctly guessed the answer.
 * @return {Boolean} true if timeout, false if none
 */
RawrModule.prototype.hasTimeout = function() {
  return this.isGameOngoing() && this.game.timeout !== undefined;
};

/**
 * Start the reminder interval.
 */
RawrModule.prototype.startReminderInterval = function() {
  var reminderCallback = RawrModule.prototype.alertReminder.bind(this);
  if(this.isGameOngoing()) {
    this.game.reminder = setInterval(reminderCallback, REMINDER_INTERVAL_MILLI);
  }
};

/**
 * Stop the reminder interval.
 */
RawrModule.prototype.stopReminderInterval = function() {
  if(this.isGameOngoing()) {
    if(this.game.reminder !== undefined) {
      clearInterval(this.game.reminder);
      this.game.reminder = undefined;
    }
  }
};

/**
 * Start the timeout which triggers the end of the game.
 */
RawrModule.prototype.startTimeout = function() {
  if(this.isGameOngoing()) {
    var endCallback = RawrModule.prototype.endGame.bind(this);
    this.game.timeout = setTimeout(endCallback, TIMEOUT_MILLI);

    var alertCallback = RawrModule.prototype.alertEnding.bind(this);
    this.game.alertTimeout = setTimeout(alertCallback, ALERT_TIMEOUT_MILLI);
  }
};

/**
 * Stop the timeout before it ends.
 */
RawrModule.prototype.stopTimeout = function() {
  if(this.isGameOngoing()) {
    if(this.game.timeout !== undefined) {
      clearTimeout(this.game.timeout);
      this.game.timeout = undefined;
    }

    if(this.game.alertTimeout !== undefined) {
      clearTimeout(this.game.alertTimeout);
      this.game.alertTimeout = undefined;
    }
  }
};

/**
 * Get the point manager.
 * @return {RawrPointManager} Point manager
 */
RawrModule.prototype.getPointManager = function() {
  return this.pointManager;
};

/**
 * Whether or not there is an ongoing game.
 * @return {Boolean} true if ongoing game, false if none
 */
RawrModule.prototype.isGameOngoing = function() {
  return this.game !== undefined;
};

/**
 * Whether or not a game has finished (no answers remaining).
 * @return {Boolean} true if finished, false if not
 */
RawrModule.prototype.isGameFinished = function() {
  return this.game.answers.length === 0;
};

/**
 * Attempt to start a game.
 * @param {String} names String containing names (answers) separated by commas
 * @return {Boolean} true if game successfully started, false if insufficient names
 */
RawrModule.prototype.startGame = function(names) {
  if(/^\s*$/.test(names)) {
    return false;
  }

  names = names.replace(/\s*,\s*/g, ',')
               .replace(/\s+/g, ' ')
               .split(',');

  // Translate each name
  var translate = RawrModule.prototype.translateAnswer.bind(this);
  names = _.map(names, translate);

  this.game = {
    answers: names,
    users: []
  };

  return true;
};

/**
 * End a game, and award RAWR points to the top 5 users.
 * @todo Award points
 */
RawrModule.prototype.endGame = function() {
  var topUsers = this.getTopUsers(),
      topUsersStr = this.getUsersString(topUsers);
  this.destroyGame();
  this.send(topUsersStr);
  this.send('Ending round!');

  var rewards = REWARDS, placings = PLACINGS;
  for(var i = 0; i < topUsers.length; i++) {
    this.rewardUser(topUsers[i], placings[i], rewards[i]);
  }
};

/**
 * Reward a user with points and inform them that they have been rewarded.
 * @param {String} username Username of user to reward
 * @param {String} placing Placing string
 * @param {Number} points Points to award
 */
RawrModule.prototype.rewardUser = function(username, placing, points) {
  var whisper = this.whisper;
  this.getPointManager().queueTransaction(this.channel, username, points, function(err) {
    if(!err) {
      var pointsStr = (points !== 1 ? (points + ' points') : (points + ' point'));
      whisper(username, 'You have been awarded ' + pointsStr + ' for placing ' + placing + '!');
    }
  });
};

/**
 * Get the usernames of the top 5 (or less) users.
 * @return {String[]} usernames
 */
RawrModule.prototype.getTopUsers = function() {
  return this.game.users.slice(0, 5);
};

/**
 * Get the top 5 users string.
 * @param {String[]} usernames, no more than 5
 * @return {String} string to send
 */
RawrModule.prototype.getUsersString = function(users) {
  var fullString = 'The winners of this round are: ';

  if(users.length === 0) {
    return fullString + 'nobody?';
  }

  var titles = PLACINGS, rewards = REWARDS;
  for(var i = 0; i < users.length && i < 5; i++) {
    if(i !== 0) {
      fullString += ', ';
    }

    var reward = '(' + rewards[i] + ')';
    var segment = titles[i] + ' ' + reward + ' - ' + users[i];
    fullString += segment;
  }
  fullString += '!';

  return fullString;
};

/**
 * Whether or not a user is in the users list of the current game.
 * @param {String} username Username to check for
 * @return {Boolean} true if in list, false if not
 */
RawrModule.prototype.hasWon = function(username) {
  return (this.isGameOngoing() && this.game.users.indexOf(username) !== -1);
};

/**
 * Check whether or not a guess is correct.
 * @param {String} name Guessed name
 * @return {Boolean} true if correct and spliced from answers array, false if incorrect
 */
RawrModule.prototype.isGuessCorrect = function(name) {
  name = this.translateAnswer(name);
  if(this.isGameOngoing() && !this.isGameFinished()) {
    for(var i = 0; i < this.game.answers.length; i++) {
      var answer = this.game.answers[i];
      if(answer !== undefined && name.toLowerCase() === answer.toLowerCase()) {
        return true;
      }
    }
  }

  return false;
};

/**
 * Setup the RAWR point manager and other things.
 * @param {Object} data
 */
RawrModule.prototype.onJoin = function(data) {
  this.send = data.send;
  this.channel = data.roomname;
  this.whisper = data.whisper;
  this.pointManager = new RawrPointManager(data.database);
};

RawrModule.prototype.onGame = function(data) {
  var chat = data.chat, send = data.send, whisper = data.whisper,
      isWhisper = data.mode === 'whisper',
      user = data.user;

  if(user !== undefined && isWhisper) {
    if(user.admin) {
      if(!this.isGameOngoing()) {
        if(this.startGame(data.parsed.tail)) {
          this.startReminderInterval();
          send('The Guessing Game starts now!');
        } else {
          whisper('Provide at least one answer to start a game');
        }
      } else {
        whisper('There is already an ongoing game');
      }
    } else {
      // Have this message somewhere where it can be used across modules?
      whisper('Only the room admin may use this command');
    }
  }
};

RawrModule.prototype.onGameEnd = function(data) {
  var send = data.send, respond = data.respond,
      user = data.user;

  if(user.admin) {
    if(this.isGameOngoing()) {
      this.destroyGame();
      send('The Guessing Game has ended unexpectedly');
    } else {
      respond('There is no ongoing game');
    }
  }
};

RawrModule.prototype.onGuess = function(data) {
  var respond = data.respond, whisper = data.whisper,
      user = data.user;

  if(user.registered) {
    if(this.isGuessCorrect(data.parsed.tail) && !this.hasWon(data.sender)
      && (CAN_ADMIN_GUESS || !user.admin)) {
      // Start the timeout
      if(!this.hasTimeout()) {
        this.startTimeout();
      }

      this.game.users.push(data.sender);
      var ranking = this.game.users.length;

      whisper('You guessed correctly!');
    }
  } else {
    respond('You must be registered to participate in the game');
  }
};

RawrModule.prototype.onGameRules = function(data) {
  return 'http://www.lumineko.com/gg';
};

RawrModule.prototype.onGameTickets = function(data) {
  var database = data.database,
      whisper = data.whisper,
      user = data.user;

  if(user.admin) {
    database.getAllRawrTickets(data.roomname, function(err, users) {
      if(!err) {
        if(users.length !== 0) {
          // Todo: Substring if too long?
          whisper('Users with tickets: ' + users.join(', '));
        } else {
          whisper('There are currently no users with tickets');
        }
      } else {
        whisper('Error getting RAWR tickets: ' + err);
      }
    });
  }
};

RawrModule.prototype.onMarkTicket = function(data) {
  var database = data.database,
      whisper = data.whisper,
      user = data.user;

  if(user.admin) {
    var toCheck = data.parsed.tailArray[0];
    database.hasRawrTicket(data.roomname, toCheck, function(err, has) {
      if(!err) {
        if(has) {
          database.markRawrTicket(data.roomname, toCheck, function(err) {
            if(!err) {
              whisper('RAWR ticket for ' + toCheck + ' has been marked as used!');
            } else {
              whisper('Error marking unused RAWR ticket for ' + toCheck + ': ' + err);
            }
          });
        } else {
          whisper('No unused RAWR ticket found for ' + toCheck);
        }
      } else {
        whisper('Error checking for unused RAWR ticket: ' + err);
      }
    });
  }
};

RawrModule.prototype.onRawrPoints = function(data) {
  var database = data.database,
      whisper = data.whisper,
      user = data.user;

  if(user.registered) {
    data.database.getRawrPoints(data.roomname, data.sender, function(err, points) {
      if(!err) {
        whisper('RAWR point total: ' + points);
      } else {
        whisper('An error occurred while checking your RAWR point total');
      }
    });
  }
};

RawrModule.prototype.onRawrPointsRedeem = function(data) {
  var whisper = data.whisper;

  this.getPointManager().queuePurchase(data.roomname, data.sender, function(err) {
    if(!err) {
      whisper('Successfully purchased a RAWR ticket');
    } else {
      // Error regex matching might not be the best way to translate to user-friendly messages
      if(/transaction failed/i.test(err)) {
        whisper('You don\'t have enough points to purchase a RAWR ticket');
      } else if(/already has an unused RAWR ticket/i.test(err)) {
        whisper('You already have an unused RAWR ticket');
      } else {
        whisper('Could not purchase RAWR ticket: ' + err);
      }
    }
  });
};

/**
RawrModule.prototype.onGivePoints = function(data) {
  var send = data.send;

  // TEMP: Have this command give points
  if(!isNaN(data.parsed.tail)) {
    var points = parseInt(data.parsed.tail);
    this.getPointManager().queueTransaction(data.roomname, data.sender, points, function(err) {
      if(!err) {
        send('Points added: ' + points);
      } else {
        send('Error occurred while adding points');
      }
    });
  } else {
    return 'Couldn\'t parse the number of points to give';
  }
};
**/

/**
 * Construct a new RAWR point manager.
 * @param {DbManager} database
 */
var RawrPointManager = function(database) {
  this._database = database;
  this._queue = {};
};

/**
 * Get the DbManager.
 * @return {DbManager} database manager
 */
RawrPointManager.prototype.getDbManager = function() {
  return this._database;
};

/**
 * Get a queue key from channel and username.
 * @param {String} channel Channel name
 * @param {String} username Username
 */
RawrPointManager.prototype.getKey = function(channel, username) {
  return channel + '/' + username;
};

/**
 * Queue a point transaction for a user.
 * @param {String} channel Channel name
 * @param {String} username Username
 * @param {Number} points Points to add (positive) or subtract (negative), should be an integer
 */
RawrPointManager.prototype.queueTransaction = function(channel, username, points, callback) {
  this.queue({
    type: 'transaction',
    channel: channel,
    username: username,
    points: points,
    callback: callback
  });
};

/**
 * Queue a ticket purchase for a user.
 * @param {String} channel Channel name
 * @param {String} username Username
 */
RawrPointManager.prototype.queuePurchase = function(channel, username, callback) {
  this.queue({
    type: 'purchase',
    channel: channel,
    username: username,
    callback: callback
  });
};

/**
 * Queue an action.
 * @param {Object} action Action to queue
 */
RawrPointManager.prototype.queue = function(action) {
  var key = this.getKey(action.channel, action.username);

  if(this._queue[key] === undefined) {
    this._queue[key] = { active: false, actions: [ action ] };
  } else {
    this._queue[key].actions.push(action);
  }

  this.tryBegin(action.channel, action.username);
};

/**
 * Try and begin the queued actions for a specific user. If they are already ongoing,
 * this will do nothing.
 * @param {String} channel Channel name
 * @param {String} username Username
 */
RawrPointManager.prototype.tryBegin = function(channel, username) {
  var key = this.getKey(channel, username),
      info = this._queue[key];

  if(info !== undefined && !info.active) {
    info.active = true;
    this.perform(info.actions[0]);
  }
};

/**
 * Perform an action.
 * @param {Object} action Action to perform
 */
RawrPointManager.prototype.perform = function(action) {
  var channel = action.channel,
      username = action.username,
      callback = RawrPointManager.prototype.onActionFinished.bind(this, action);

  if(action.type === 'transaction') {
    this.getDbManager().addRawrPoints(channel, username, action.points, callback);
  } else if(action.type === 'purchase') {
    this.getDbManager().purchaseRawrTicket(channel, username, TICKET_COST, callback);
  }
};

RawrPointManager.prototype.onActionFinished = function(action, err) {
  if(action.callback) {
    action.callback(err);
  }

  var key = this.getKey(action.channel, action.username),
      info = this._queue[key];
  info.actions.splice(0, 1);

  if(info.actions.length !== 0) {
    this.perform(info.actions[0]);
  } else {
    info.active = false;
  }
};

module.exports = RawrModule;

/** Functions that I wrote by accident. Maybe they'll come in handy some day?

/!**
 * Number -> String with leading zeroes, resulting in a string
 * of length 8.
 *!/
var formatNumber = function(num) {
  var s = num + '',
      len = s.length;
  for(var i = 0; i < (8 - len); i++) {
    s = ('0' + s);
  }
  return s;
};

/!**
 * Old getTopUsers() function.
 * Get a string of the top 5 users and their points.
 * @return {String} users and their points
 *!/
RawrModule.prototype._getTopUsers = function() {
  // Testing
  //this.game.users = {
  //  'bob': 10,
  //  'george': 10,
  //  'timmy': 1,
  //  'fred': 0,
  //  'zebra': 11,
  //  'elephant': 1,
  //  'horse': 11,
  //  'pineapple': 11
  //};

  var users = [];
  for(var username in this.game.users) {
    if (this.game.users.hasOwnProperty(username)) {
      var score = this.game.users[username];
      if(score > 0) {
        users.push(formatNumber(score) + ' ' + username);
      }
    }
  }

  users = users.sort().reverse();

  var t = [];
  for(var i = 0; i < users.length && i < 5; i++) {
    t.push(users[i].split(' ', 2));
  }

  var results = [];
  for(var i = 0; i < t.length; i++) {
    var m = [t[i][1]];
    results.push(m);

    while(i < (t.length - 1) && t[i][0] === t[i+1][0]) {
      m.push(t[i+1][1]);
      results.push([]);
      i++;
    }
  }

  return results;
};

RawrModule.prototype._getUsersString = function(users) {
  var fullString = 'The winners of this round are: ';

  if(users.length === 0) {
    return fullString + 'nobody?';
  }

  var titles = ['1st', '2nd', '3rd', '4th', '5th'];
  for(var i = 0; i < users.length && i < 5; i++) {
    if(users[i].length > 0) {
      if(i !== 0) {
        fullString += ', ';
      }

      var segment = titles[i] + ' - ' + users[i].join(', ');
      fullString += segment;
    }
  }
  fullString += '!';

  return fullString;
};

**/
