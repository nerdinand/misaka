var Promise = require('bluebird');
var path = require('path');
var Sequelize = require('sequelize');
var _ = require('underscore');
var logger = require(path.join(__dirname, '..', 'Logger'));
var i18n = require('i18next');
var t = i18n.t;

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
      { name: 'ggend', cooldown: false, callback: RawrModule.prototype.onGameEnd.bind(this) },
      { name: 'ggex', cooldown: false, callback: RawrModule.prototype.onGameExempt.bind(this) },
      { name: 'guess', cooldown: false, callback: RawrModule.prototype.onGuess.bind(this) },
      { name: 'ggrules', callback: RawrModule.prototype.onGameRules.bind(this) },
      { name: 'ggticket', cooldown: false, callback: RawrModule.prototype.onGameTickets.bind(this) },
      { name: 'mark', cooldown: false, callback: RawrModule.prototype.onMarkTicket.bind(this) },
      { name: 'rp', cooldown: false, callback: RawrModule.prototype.onRawrPoints.bind(this) },
      { name: 'rpgive', cooldown: false, callback: RawrModule.prototype.onGiveRawrPoints.bind(this) },
      { name: 'rpredeem', callback: RawrModule.prototype.onRawrPointsRedeem.bind(this) },
      { name: 'rpremind', cooldown: false, callback: RawrModule.prototype.onRawrPointsRemind.bind(this) }
    ],
    callbacks: {
      join: RawrModule.prototype.onJoin.bind(this),
      load: RawrModule.prototype.onLoad.bind(this),
      i18n: RawrModule.prototype.onI18n.bind(this),
      unload: RawrModule.prototype.onUnload.bind(this)
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

  /**
   * Passive interval which checks if the admin is streaming, and if so awards a subpoint
   * to all registered, non-banned users in the chat.
   */
  this.passiveInterval = undefined;

  /**
   * Data received from 'join' event.
   */
  this.data = undefined;
}

// Todo: Change passiveReminder to be flexible with different channel names
var translations = {
  'mod_rawr': {
    adminOnly: 'Only the room admin may use this command',
    correctGuess: 'You guessed correctly!',
    gameAlreadyOngoing: 'There is already an ongoing game',
    gameCorrectAnswer: 'The correct answer was: __answer__',
    gameCorrectAnswers: 'The correct answers were: __answers__',
    gameEnded: 'The Guessing Game has ended unexpectedly',
    gameEnding: 'Ending round!',
    gameEndingSoon: 'Someone guessed correctly, the round ends in 30 seconds but you can still guess until it\'s over!',
    gameExempt: 'Exempting __username__ from the current game',
    gameExemptProvideUser: 'Provide a username to exempt from the current game',
    gameNoneOngoing: 'There is no ongoing game',
    gameProvideAnswer: 'Provide at least one answer to start a game',
    gameRegister: 'You must be registered to participate in the game',
    gameReminder: 'There is currently a guessing game round in session! Make your guesses with !guess "name"',
    gameRewardWhisper: 'You have been awarded __points__ for placing __placement__!',
    gameStarting: 'The Guessing Game starts now!',
    gameWinners: 'The winners of this round are: __winners__',
    gavePoints: 'Gave __points__ points to __username__',
    giveUserNotFound: 'No user is present with the username __username__',
    giveUserNotRegistered: '__username__ is not a registered user',
    passiveReminder: 'RAWR! You have won a RAWR point! Thank you for watching Lumineko\'s stream! To stop receiving these reminders, whisper !rpremind off',
    passiveReminderDisabled: 'You will no longer be reminded when you earn RAWR points passively',
    passiveReminderEnabled: 'You will now be reminded when you earn RAWR points passively',
    pointTotal: 'RAWR point total: __points__',
    noUserFound: 'No user found with the username __username__',
    noUsersWithTickets: 'There are currently no users with tickets',
    ticketAlreadyHave: 'You already have an unused RAWR ticket',
    ticketMarked: 'RAWR ticket for __username__ has been marked as used!',
    ticketNotEnoughPoints: 'You don\'t have enough points to purchase a RAWR ticket',
    ticketNotFound: 'No unused RAWR ticket found for __username__',
    ticketPurchased: 'Successfully purchased a RAWR ticket',
    tookPoints: 'Took __points__ points from __username__',
    usersWithTickets: 'Users with tickets: __usernames__'
  }
};

// Todo: Change these consts to configurable?

// 1 minute
var TIMEOUT_MILLI = 60 * 1000;

// 30 seconds
var ALERT_TIMEOUT_MILLI = 30 * 1000;

// 5 minutes
var REMINDER_INTERVAL_MILLI = 5 * 60 * 1000;

// 1 minute
var PASSIVE_INTERVAL_MILLI = 60 * 1000;

// Number of subpoints that make up 1 point
var SUBPOINT_ROOF = 60;

// Number of RAWR points that a ticket costs
var TICKET_COST = 50;

// Point rewards for top 5 users
var REWARDS = [ 10, 6, 4, 2, 1 ];

// Placement strings
var PLACINGS = [ '1st', '2nd', '3rd', '4th', '5th' ];

// Whether or not the admin can guess and participate in the game
var CAN_ADMIN_GUESS = true;

// Sketch ticket type identifier
var TTYPE_SKETCH = 'sketch';

/**
 * Start the passive interval.
 */
RawrModule.prototype.startPassiveInterval = function() {
  var awardSubpoints = RawrModule.prototype.awardSubpoints.bind(this),
      watcher = this.client.getOnlineWatcher();

  this.passiveInterval = setInterval(function() {
    if(watcher.isOnline()) {
      awardSubpoints();
    }
  }, PASSIVE_INTERVAL_MILLI);
};

/**
 * Award subpoints to all registered, non-banned users in the room.
 */
RawrModule.prototype.awardSubpoints = function() {
  var users = this.client.getUserList(),
      names = users.createNameList(),
      awardSubpointTo = RawrModule.prototype.awardSubpointTo.bind(this);

  names.forEach(function(username) {
    awardSubpointTo(username);
  });
};

/**
 * Award a subpoint to a user if they satisfy the requirements.
 * @param {String} username Username of user to award to
 */
RawrModule.prototype.awardSubpointTo = function(username) {
  var users = this.client.getUserList(),
      user = users.getUser(username),
      isMe = this.data.parent.getBot().getSelf().username.toLowerCase() === username.toLowerCase(),
      whisper = this.whisper,
      channel = this.channel,
      pointManager = this.getPointManager();

  if(user !== undefined && user.registered && !user.admin && !user.banned && !isMe) {
    pointManager.queueSubpoint(channel, username, function(err, rawruser, awarded) {
      if(!err) {
        if(awarded && rawruser.remind) {
          whisper(username, t('mod_rawr.passiveReminder'));
        }
      } else {
        logger.log('debug', 'Error occurred while awarding subpoint', { error: err, user: username });
      }
    });
  }
};

/**
 * Translate an individual answer before storing it.
 * @param {String} answer Original answer
 * @return {String} Translated answer that will be compared against with guesses
 */
RawrModule.prototype.translateAnswer = function(answer) {
  return answer.replace(/(\s|['"])+/g, ''); // Remove whitespace and quotes
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
  var msg = t('mod_rawr.gameEndingSoon');
  this.send(msg);
};

/**
 * Alert the channel that a game is ongoing.
 */
RawrModule.prototype.alertReminder = function() {
  // Only send message if no timeout, meaning no one has guessed yet
  if(!this.hasTimeout()) {
    this.send(t('mod_rawr.gameReminder'));
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

  var originalNames = names.replace(/\s*,\s*/g, ',')
                      .replace(/\s+/g, ' ')
                      .split(',');

  // Translate each name
  var translate = RawrModule.prototype.translateAnswer.bind(this);
  names = _.map(originalNames, translate);

  this.game = {
    originalAnswers: originalNames,
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
      topUsersStr = this.getUsersString(topUsers),
      answersStr = this.getAnswersString();

  this.destroyGame();

  this.send(answersStr);
  this.send(topUsersStr);
  this.send(t('mod_rawr.gameEnding')); // this.send('Ending round!');

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
      whisper(username, t('mod_rawr.gameRewardWhisper', { points: pointsStr, placement: placing }));
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
 * @todo Clean up all this string concatenation?
 */
RawrModule.prototype.getUsersString = function(users) {
  if(users.length === 0) {
    return t('mod_rawr.gameWinners', { winners: 'nobody?' });
  }

  // Create winners string
  var winners = '';
  for(var i = 0; i < users.length && i < 5; i++) {
    if(i !== 0) {
      winners += ', ';
    }

    var reward = '(' + REWARDS[i] + ')',
        segment = PLACINGS[i] + ' ' + reward + ' - ' + users[i];
    winners += segment;
  }
  winners += '!';

  return t('mod_rawr.gameWinners', { winners: winners });
};

/**
 * Get a string to post to chat with the correct answers.
 * @return {String} answers string, or an empty string if no ongoing game
 */
RawrModule.prototype.getAnswersString = function() {
  var answerString = '';
  if(this.isGameOngoing()) {
    var answers = this.game.originalAnswers;
    if(answers.length <= 1) {
      answerString = t('mod_rawr.gameCorrectAnswer', { answer: answers[0] });
    } else {
      answerString = t('mod_rawr.gameCorrectAnswers', { answers: answers.join(', ') });
    }
  }
  return answerString;
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
 * Exempt a user from the current game.
 * @param {String} username Username of user to exempt
 */
RawrModule.prototype.setExempted = function(username) {
  if(this.isGameOngoing()) {
    this.game.exempted = username;
  }
};

/**
 * Check whether or not a user is exempt from the current game.
 * @return {Boolean} true if exempt, false if not
 */
RawrModule.prototype.isExempted = function(username) {
  return this.isGameOngoing()
    && _.isString(this.game.exempted)
    && this.game.exempted.toLowerCase() === username.toLowerCase();
};

/**
 * Get the RAWR database manager.
 * @return {RawrDbManager} database manager
 */
RawrModule.prototype.getDbManager = function() {
  return this.db;
};

/**
 * Setup the RAWR point manager and other things.
 * @param {Object} data
 */
RawrModule.prototype.onJoin = function(data) {
  this.data = data;
  this.client = data.client;
  this.send = data.send;
  this.channel = data.roomname;
  this.whisper = data.whisper;

  this.initUserEvents(data);
  this.startPassiveInterval();
};

RawrModule.prototype.onLoad = function(data) {
  this.db = new RawrDbManager(data.database);
  this.pointManager = new RawrPointManager(this.getDbManager());
};

RawrModule.prototype.onI18n = function() {
  //logger.log('debug', 'Adding i18next resource bundle');
  i18n.addResourceBundle('en-US', translations);
};

RawrModule.prototype.onUnload = function() {
};

/**
 * Initialize user events.
 */
RawrModule.prototype.initUserEvents = function(data) {
  var whisper = data.whisper,
      client = data.parent.getBot().getClientManager().getClient(data.roomname),
      isGameOngoing = RawrModule.prototype.isGameOngoing.bind(this);

  client.getUserList().on('userAdded', function(user) {
    if(user.registered && isGameOngoing()) {
      whisper(user.username, t('mod_rawr.gameReminder'));
    }
  });
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
          send(t('mod_rawr.gameStarting'));
        } else {
          whisper(t('mod_rawr.gameProvideAnswer'));
        }
      } else {
        whisper(t('mod_rawr.gameAlreadyOngoing'));
      }
    } else {
      // Have this message somewhere where it can be used across modules?
      whisper(t('mod_rawr.adminOnly'));
    }
  }
};

RawrModule.prototype.onGameEnd = function(data) {
  var send = data.send, respond = data.respond,
      user = data.user;

  if(user.admin) {
    if(this.isGameOngoing()) {
      this.destroyGame();
      send(t('mod_rawr.gameEnded'));
    } else {
      respond(t('mod_rawr.gameNoneOngoing'));
    }
  }
};

RawrModule.prototype.onGameExempt = function(data) {
  var whisper = data.whisper,
      user = data.user,
      users = data.client.getUserList();

  if(user.admin && this.isGameOngoing()) {
    if(data.parsed.tailArray.length > 0) {
      var target = users.getUser(data.parsed.tailArray[0]);
      if(target !== undefined) {
        this.setExempted(target.username);
        whisper(t('mod_rawr.gameExempt', { username: target.username }));
      } else {
        whisper(t('mod_rawr.noUserFound', { username: data.parsed.tailArray[0] }));
      }
    } else {
      whisper(t('mod_rawr.gameExemptProvideUser'));
    }
  }
};

RawrModule.prototype.onGuess = function(data) {
  var respond = data.respond, whisper = data.whisper,
      user = data.user;

  if(user.registered) {
    if(this.isGuessCorrect(data.parsed.tail) && !this.hasWon(data.sender)
      && (CAN_ADMIN_GUESS || !user.admin) && !this.isExempted(data.sender)) {
      // Start the timeout
      if(!this.hasTimeout()) {
        this.startTimeout();
      }

      this.game.users.push(data.sender);
      var ranking = this.game.users.length;

      whisper(t('mod_rawr.correctGuess'));
    }
  } else {
    whisper(t('mod_rawr.gameRegister'));
  }
};

RawrModule.prototype.onGameRules = function(data) {
  return 'http://www.lumineko.com/gg';
};

RawrModule.prototype.onGameTickets = function(data) {
  var database = this.getDbManager(),
      whisper = data.whisper,
      user = data.user;

  if(user.admin) {
    database.getAllRawrTickets(data.roomname, TTYPE_SKETCH, function(err, usernames) {
      if(!err) {
        if(usernames.length !== 0) {
          // Todo: Substring if too long?
          whisper(t('mod_rawr.usersWithTickets', { usernames: usernames.join(', ') }));
        } else {
          whisper(t('mod_rawr.noUsersWithTickets'));
        }
      } else {
        whisper('Error getting RAWR tickets: ' + err);
      }
    });
  }
};

RawrModule.prototype.onMarkTicket = function(data) {
  var database = this.getDbManager(),
      whisper = data.whisper,
      user = data.user;

  if(user.admin) {
    if(data.parsed.tailArray.length > 0 && data.parsed.tailArray[0].length > 0) {
      var toCheck = data.parsed.tailArray[0];
      database.hasRawrTicket(data.roomname, toCheck, TTYPE_SKETCH, function(err, has) {
        if(!err) {
          if(has) {
            database.markRawrTicket(data.roomname, toCheck, TTYPE_SKETCH, function(err) {
              if(!err) {
                whisper(t('mod_rawr.ticketMarked', { username: toCheck }));
              } else {
                whisper('Error marking unused RAWR ticket for ' + toCheck + ': ' + err);
              }
            });
          } else {
            whisper(t('mod_rawr.ticketNotFound', { username: toCheck }));
          }
        } else {
          whisper('Error checking for unused RAWR ticket: ' + err);
        }
      });
    }
  }
};

RawrModule.prototype.onRawrPoints = function(data) {
  var database = this.getDbManager(),
      whisper = data.whisper,
      user = data.user;

  if(user.registered) {
    database.getRawrPoints(data.roomname, data.sender, function(err, points) {
      if(!err) {
        whisper(t('mod_rawr.pointTotal', { points: points }));
      } else {
        whisper('An error occurred while checking your RAWR point total: ' + err);
      }
    });
  }
};

RawrModule.prototype.onRawrPointsRedeem = function(data) {
  var whisper = data.whisper;

  this.getPointManager().queuePurchase(data.roomname, data.sender, function(err) {
    if(!err) {
      whisper(t('mod_rawr.ticketPurchased'));
    } else {
      // Error regex matching might not be the best way to translate to user-friendly messages
      if(/not enough points/i.test(err)) {
        whisper(t('mod_rawr.ticketNotEnoughPoints'));
      } else if(/already has an unused RAWR ticket/i.test(err)) {
        whisper(t('mod_rawr.ticketAlreadyHave'));
      } else {
        whisper('Could not purchase RAWR ticket: ' + err);
      }
    }
  });
};

RawrModule.prototype.onGiveRawrPoints = function(data) {
  var send = data.send, whisper = data.whisper,
      users = data.parent.getBot().getClientManager().getClient(data.roomname).getUserList();

  if(data.user.admin) {
    var toGive = undefined, points = 0;

    if(data.parsed.tailArray.length === 1 && !isNaN(data.parsed.tail)) {
      toGive = data.sender;
      points = parseInt(data.parsed.tail);
    } else if(data.parsed.tailArray.length > 1 && !isNaN(data.parsed.tailArray[1])) {
      toGive = data.parsed.tailArray[0];
      points = parseInt(data.parsed.tailArray[1]);
    }

    if(toGive !== undefined && points !== 0) {
      var user = users.getUser(toGive);
      if(user !== undefined && user.registered) {
        this.getPointManager().queueTransaction(data.roomname, toGive, points, function(err) {
          if(!err) {
            if(points > 0) {
              whisper(t('mod_rawr.gavePoints', { points: points, username: toGive }));
            } else {
              whisper(t('mod_rawr.tookPoints', { points: (points * -1), username: toGive }));
            }
          } else {
            whisper('Error occurred while giving points: ' + err);
          }
        });
      } else if(user === undefined) {
        whisper(t('mod_rawr.giveUserNotFound', { username: toGive }));
      } else if(!user.registered) {
        whisper(t('mod_rawr.giveUserNotRegistered', { username: toGive }));
      }
    }
  }
};

RawrModule.prototype.onRawrPointsRemind = function(data) {
  var whisper = data.whisper,
      database = this.getDbManager(),
      helper = data.helper,
      roomname = data.roomname,
      sender = data.sender,
      user = data.user;

  var enable = helper.parseChoice(data.parsed.tail);

  if(user.registered && _.isBoolean(enable)) {
    database.getRawrUser(roomname, sender).then(function(rawruser) {
      if(rawruser.remind !== enable) {
        return Promise.props({ modified: true, update: rawruser.update({ remind: enable }) });
      } else {
        return Promise.props({ modified: false });
      }
    }).then(function(props) {
      if(props.modified) {
        if(enable) {
          whisper(t('mod_rawr.passiveReminderEnabled'));
        } else {
          whisper(t('mod_rawr.passiveReminderDisabled'));
        }
      }
    }).catch(function(err) {
      logger.err(err, 'Error occurred while updating remind settings', { channel: roomname, username: sender });
    });
  }
};

/**
 * Construct a new RAWR point manager.
 * @param {RawrDbManager} database
 */
var RawrPointManager = function(database) {
  this._database = database;
  this._queue = {};
};

/**
 * Get the DbManager.
 * @return {RawrDbManager} database manager
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
 * Queue a subpoint increment for a user.
 * @param {String} channel Channel name
 * @param {String} username Username
 */
RawrPointManager.prototype.queueSubpoint = function(channel, username, callback) {
  this.queue({
    type: 'subpoint',
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
    // this.getDbManager().addRawrPoints(channel, username, action.points, callback);
    this.performGive(channel, username, action.points, callback);
  } else if(action.type === 'purchase') {
    // this.getDbManager().purchaseRawrTicket(channel, username, TTYPE_SKETCH, TICKET_COST, callback);
    this.performPurchase(channel, username, TTYPE_SKETCH, TICKET_COST, callback);
  } else if(action.type === 'subpoint') {
    // this.getDbManager().incrementRawrSubpoint(channel, username, SUBPOINT_ROOF, callback);
    this.performIncrementSubpoints(channel, username, SUBPOINT_ROOF, callback);
  }
};

RawrPointManager.prototype.onActionFinished = function(action, err) {
  var args = Array.prototype.slice.call(arguments);
  args.shift();

  if(action.callback) {
    action.callback.apply(undefined, args);
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

/**
 * Perform a ticket purchase.
 * @param {String} channel - Channel name
 * @param {String} username - Username
 * @param {String} type - Ticket type
 * @param {Number} cost - Ticket cost
 */
RawrPointManager.prototype.performPurchase = function(channel, username, type, cost, callback) {
  var db = this.getDbManager(),
      purchaseTicketTransaction = RawrPointManager.prototype.purchaseTicketTransaction.bind(this);

  db.getRawrUser(channel, username).then(function(user) {
    return Promise.props({ user: user, has: user.hasTicket(type) });
  }).then(function(data) {
    if(!data.has) {
      return data.user;
    } else {
      throw new Error('User already has an unused RAWR ticket');
    }
  }).then(function(user) {
    return purchaseTicketTransaction(user, type, cost);
  }).then(function() {
    if(callback) {
      return callback();
    }
  }).catch(callback);
};

/**
 * Give a user points. If point count goes below 0, will simply set points to 0.
 * @param {String} channel - Channel name
 * @param {String} username - Username
 * @param {Number} points - Points to give
 */
RawrPointManager.prototype.performGive = function(channel, username, points, callback) {
  var db = this.getDbManager();
  db.getRawrUser(channel, username).then(function(user) {
    // Keep points from falling below 0
    var newPoints = (user.points + points);
    if(newPoints < 0) {
      newPoints = 0;
    }
    return user.update({ points: newPoints });
  }).then(function() {
    if(callback) {
      callback();
    }
  }).catch(callback);
};

/**
 * Increment a user's subpoints. If subpoint count hits the roof, will reset to 0 and award
 * the user a point.
 * @param {String} channel - Channel name
 * @param {String} username - Username
 * @param {Number} roof - Subpoint roof
 */
RawrPointManager.prototype.performIncrementSubpoints = function(channel, username, roof, callback) {
  //logger.log('debug', 'Incrementing subpoint', { channel: channel, username: username });
  var db = this.getDbManager();
  db.getRawrUser(channel, username).then(function(user) {
    if((user.subpoints + 1) === roof) {
      return user.update({ points: (user.points + 1), subpoints: 0 }).then(function() {
        return { added: true, user: user };
      });
    } else {
      return user.update({ subpoints: (user.subpoints + 1) }).then(function() {
        return { added: false, user: user };
      });
    }
  }).then(function(props) {
    if(callback) {
      callback(undefined, props.user, props.added);
    }
  }).catch(callback);
};

/**
 * Perform the transaction of subtracting points and giving a ticket.
 * @param {RawrUser} user - RawrUser sequelize object
 * @param {String} type - Ticket type
 * @param {Number} cost - Ticket cost
 * @return {Promise}
 */
RawrPointManager.prototype.purchaseTicketTransaction = function(user, type, cost) {
  var db = this.getDbManager(),
      sequelize = db.sequelize(),
      RawrTicket = db.models().RawrTicket;

  if(user.points >= cost) {
    return sequelize.transaction(function(t) {
      // Update user's points
      return user.update({
        points: (user.points - cost)
      }, { transaction: t }).then(function() {
        // Add the ticket
        var ticket = RawrTicket.build({
          type: type,
          RawrUser: user
        });
        return user.addRawrTicket(ticket, { transaction: t });
      });
    });
  } else {
    throw new Error('Not enough points to purchase ticket');
  }
};

/**
 * RAWR database manager.
 * @param {DbManager} db - Core database manager
 */
var RawrDbManager = function(db) {
  this._db = db;
  this.initModels();
};

/**
 * Initialize models specific to the RAWR system.
 */
RawrDbManager.prototype.initModels = function() {
  var models = this.models(), sequelize = this.sequelize();

  //
  // RawrUser
  //
  var RawrUser = models.RawrUser = sequelize.define('RawrUser', {
    channel: { type: Sequelize.STRING(64), allowNull: false },
    username: { type: Sequelize.STRING(64), allowNull: false },
    points: { type: Sequelize.INTEGER, defaultValue: 0, allowNull: false },
    subpoints: { type: Sequelize.INTEGER, defaultValue: 0, allowNull: false },
    remind: { type: Sequelize.BOOLEAN, defaultValue: true, allowNull: false }
  }, {
    instanceMethods: {
      /**
       * Whether or not this user has a ticket of a specific type.
       * @param {String} type Ticket type to check for
       */
      hasTicket: function(type) {
        return this.getRawrTickets({ where: { type: type } }).then(function(tickets) {
          return tickets && tickets.length > 0;
        });
      }
    }
  });

  //
  // RawrTicket
  //
  var RawrTicket = models.RawrTicket = sequelize.define('RawrTicket', {
    type: { type: Sequelize.ENUM('sketch'), defaultValue: 'sketch', allowNull: false }
  }, {
    updatedAt: false
  });

  RawrTicket.belongsTo(RawrUser);
  RawrUser.hasMany(RawrTicket);

  Promise.join(RawrUser.sync(), RawrTicket.sync(), function() {
    logger.log('debug', 'Successfully sync\'d RAWR database tables');
  }).catch(function(err) {
    logger.error(err);
  });
};

/**
 * Get the sequelize instance from the parent database manager.
 * @return {Sequelize}
 */
RawrDbManager.prototype.sequelize = function() {
  return this._db.sequelize();
};

/**
 * Get the RAWR models.
 * @return {Object} Object with RAWR models mapped by name
 */
RawrDbManager.prototype.models = function() {
  return this._db.models();
};

/**
 * Get a RAWR user for a channel, creating a default user if none exists.
 * @param {String} channel - Channel name
 * @param {String} username - Username
 * @return {Promise}
 */
RawrDbManager.prototype.getRawrUser = function(channel, username) {
  return this.models().RawrUser.findOrCreate({
    where: {
      channel: channel,
      username: username
    }
  }).spread(function(user, created) {
    return user;
  });
};

/**
 * Get all RAWR tickets for a channel.
 * @param {String} channel - Channel name
 */
RawrDbManager.prototype.getAllRawrTickets = function(channel, type, callback) {
  var RawrTicket = this.models().RawrTicket,
      RawrUser = this.models().RawrUser;

  var p = RawrTicket.findAll({
    where: {
      type: type
    },
    include: [ { model: RawrUser, where: { channel: channel } } ]
  }).map(function(ticket) {
    return ticket.getRawrUser();
  }).map(function(user) {
    return user.username;
  }).then(function(usernames) {
    if(callback) {
      callback(undefined, usernames);
    }
  }).catch(callback);
};

/**
 * Get a user's RAWR point count.
 * @param {String} channel - Channel name
 * @param {String} username - Username
 */
RawrDbManager.prototype.getRawrPoints = function(channel, username, callback) {
  logger.log('debug', 'Getting rawr points', { channel: channel, username: username });
  var p = this.getRawrUser(channel, username).then(function(user) {
    if(callback) {
      callback(undefined, user.points);
    }
  }).catch(callback);
};

/**
 * Check if a user has a RAWR ticket of a specific type.
 * @param {String} channel - Channel name
 * @param {String} username - Username
 * @param {String} type - Ticket type
 */
RawrDbManager.prototype.hasRawrTicket = function(channel, username, type, callback) {
  var p = this.getRawrUser(channel, username).then(function(user) {
    return user.hasTicket(type);
  }).then(function(has) {
    if(callback) {
      callback(undefined, has);
    }
  }).catch(callback);
};

/**
 * Mark a RAWR ticket as used.
 * @param {String} channel - Channel name
 * @param {String} username - Username
 * @param {String} type - Ticket type
 */
RawrDbManager.prototype.markRawrTicket = function(channel, username, type, callback) {
  this.getRawrUser(channel, username).then(function(user) {
    return user.getRawrTickets({ where: { type: type } });
  }).then(function(tickets) {
    if(tickets && tickets.length > 0) {
      return tickets[0].destroy();
    } else {
      throw new Error('No ticket to mark');
    }
  }).then(function() {
    if(callback) {
      callback();
    }
  }).catch(callback);
};

module.exports = RawrModule;
