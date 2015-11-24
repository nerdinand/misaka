var async = require('async');
var path = require('path');
var request = require('request');

var logger = require(path.join(__dirname, '..', 'Logger')).default;

/**
 * Module for managing detection of changes of a channel. This involves
 * sending multiple HTTP requests constantly.
 * Todo: + setFetching(bool), isFetching() for checking if still fetching
 *         to prevent request overlap?
 */
function DetectionModule() {
  this.info = {
    name: 'Detection',
    commands: [
      { name: 'detect', callback: DetectionModule.prototype.onDetect.bind(this) },
      { name: 'state', callback: DetectionModule.prototype.onState.bind(this) }
    ],
    description: 'Detects changes to a channel',
    callbacks: {
      'join': DetectionModule.prototype.onJoin.bind(this)
    },
    master: true
  };

  // Certain things to check for when detecting changes
  // in state
  this.check = {
    multistream: true,
    nsfw: true,
    // Online/offline check seems weird, disable by default for now
    online: false
  };

  // Descriptions for certain things to check.
  this.descriptions = {
    multistream: 'when multistreams occur',
    nsfw: 'when the stream toggles between NSFW and SFW',
    online: 'when the stream goes online/offline'
  };

  this.channel = undefined;
  this.on = true;
  this.state = this.getDefaultState();
  this.deltaTime = 7500; // 7.5 seconds
}

/**
 * Get an object representing the default state.
 * @return default state object
 */
DetectionModule.prototype.getDefaultState = function() {
  return {
    nsfw: false,
    online: false,
    multistream: [
      { name: undefined, online: false },
      { name: undefined, online: false }
    ]
  };
};

/**
 * Get a URI for a channel.
 * @param name Name of channel
 * @param type Either 'channel' or 'multistream' depending
 *             on the desired data
 * @return URI of channel
 */
DetectionModule.prototype.getChannelUri = function(name, type) {
  return 'https://www.picarto.tv/live/' + type + '.php?watch=' + name;
};

/**
 * Fetch the initial state of a channel. This requires sending
 * multiple HTTP requests to get the desired data.
 * @param name Name of channel
 */
DetectionModule.prototype.fetchInitialState = function(name, callback) {
  var module = this,
      state = this.getDefaultState();

  async.series([
    DetectionModule.prototype.fetchChannelHtml.bind(this, name),
    DetectionModule.prototype.fetchMultistreamHtml.bind(this, name),
    DetectionModule.prototype.fetchSearchHtml.bind(this, name)
  ], function(error, results) {
    if(!error) {
      module.setChannelState(state, results[0]);
      module.setMultistreamState(state, results[1]);
      module.setSearchState(state, results[2]);

      logger.logDetectionHtml('channel', results[0]);
      logger.logDetectionHtml('multistream', results[1]);
      logger.logDetectionHtml('search', results[2]);

      if(callback) {
        callback(error, state);
      }
    } else {
      if(callback) {
        callback(error);
      }
    }
  });
};

/**
 * Fetch the HTML of a picarto channel in multistream mode.
 * Needed for getting who is part of a multistream.
 * Todo: Use this for !multistream?
 * @param name Name of channel
 * @param callback Callback
 */
DetectionModule.prototype.fetchMultistreamHtml = function(name, callback) {
  request({
    uri: this.getChannelUri(name, 'multistream'),
    followRedirect: false
  }, function(error, response, body) {
    // Check for good status code
    if(response && response.statusCode !== 200 && response.statusCode !== 302) {
      if(!error) error = new Error('Unexpected status code from multistream request: ' + response.statusCode);
    }

    if(callback) {
      callback(error, body);
    }
  });
};

/**
 * Fetch the search ajax HTML for a given channel. Needed for
 * getting the online state of the channel.
 * Note: This may not always contain info about the desired channel,
 *       even though name is posted as exact channel name. This is
 *       if there are many other names that contain that name itself,
 *       as Picarto is awful and only returns 10 names that contain
 *       the specified substring (which may not include the name itself).
 * @param name Name of channel
 * @param callback Callback
 */
DetectionModule.prototype.fetchSearchHtml = function(name, callback) {
  request({
    uri: 'https://www.picarto.tv/live/searchChannelsAjax.php',
    method: 'POST',
    formData: { channel_name: name }
  }, function(error, response, body) {
    // Check for good status code
    if(response && response.statusCode !== 200) {
      if(!error) error = new Error('Unexpected status code from search request: ' + response.statusCode);
    }

    if(callback) {
      callback(error, body);
    }
  });
};

/**
 * Fetch the HTML of a picarto channel. Needed for getting
 * NSFW status of a channel.
 * @param name Name of channel
 * @param callback Callback
 */
DetectionModule.prototype.fetchChannelHtml = function(name, callback) {
  request({
    uri: this.getChannelUri(name, 'channel'),
    followRedirect: false
  }, function(error, response, body) {
    // Check for good status code
    if(response && response.statusCode !== 200 && response.statusCode !== 302) {
      if(!error) error = new Error('Unexpected status code from channel request: ' + response.statusCode);
    }

    if(callback) {
      callback(error, body);
    }
  });
};

/**
 * Fetch the state of a picarto channel.
 * @param name Channel name
 * @param callback Callback
 */
DetectionModule.prototype.fetchState = function(name, callback) {
  var module = this;

  this.fetchChannelHtml(name, function(error, html) {
    if(!error) {
      var state = module.parseState(html);
      if(callback) callback(state);
    } else {
      if(callback) callback();
    }
  });
};

/**
 * Parse the channel state of a channel's html and
 * modify the given state accordingly.
 * @param html Html of channel page to parse
 * @param state State object to modify
 */
DetectionModule.prototype.setChannelState = function(state, html) {
  // Check if NSFW
  var nsfwPattern = /<img title='This Stream contains NSFW Content' src='..\/img\/18plusicon\.png'>/;
  state.nsfw = nsfwPattern.test(html);
};

/**
 * Parse the multistream state of a channel's html and
 * modify the given state accordingly.
 * @param state State object to modify
 * @param html Channel html
 */
DetectionModule.prototype.setMultistreamState = function(state, html) {
  var patt = /<div id='channelheadname(2|3)'>([^< ]+)<\/div>/,
      names = [];

  do {
    match = patt.exec(html);
    if(match) {
      // Couldn't find, assume no multistream
      if(match.length === 0) {
        break;
      } else {
        names.push(match[2]);
      }

      html = html.substring(match.index + match[0].length);
      match = patt.exec(html);
    }
  } while(match);

  for(var i = 0; i < names.length; i++) {
    state.multistream[i].name = names[i];
  }
};

/**
 * Parse the online state of a channel given the html returned
 * by the search ajax.
 * @param state State object to modify
 * @param html Html of search ajax
 */
DetectionModule.prototype.setSearchState = function(state, html) {
  var patt = /<div id='searchedChannelLink'>([^<]+)<\/div><div id='onstatussearch'><img src='\.\.\/img\/onsearch\.png'/,
      match;

  do {
    match = patt.exec(html);
    if(match) {
      var name = match[1];
      if(name.toLowerCase() === this.channel.toLowerCase()) {
        state.online = true;
        break;
      }
    }
  } while(match);
};

/**
 * Get a string representation of a state.
 * @param state State to get string for, if not specified
 *              the current state will be used.
 * @return string representation of given state
 */
DetectionModule.prototype.getStateString = function(state) {
  if(!state) state = this.state;
};

/**
 * Check if two multistream objects are considered equal.
 * @param m1 First multistream object
 * @param m2 Second multistream object
 * @return true if equal, false if not
 */
DetectionModule.prototype.areMultistreamsEqual = function(m1, m2) {
  if(!m1 || !m2) {
    if(!m1 && !m2) return true;
    else return false;
  }

  return (m1[0].name === m2[0].name && m1[1].name === m2[1].name);
};

/**
 * Check if a multistream is empty.
 * @param m Multistream object
 * @return true if empty, false otherwise
 */
DetectionModule.prototype.isMultistreamEmpty = function(m) {
  return m[0].name === undefined && m[1].name === undefined;
};

/**
 * Get a string detailing the change in state.
 * @param newState New state to compare to current state (this.state)
 * @return string representing the change in state, or undefined
 *         if no detected change
 */
DetectionModule.prototype.getStateDiffString = function(newState) {
  var list = [];

  // Check online (sometimes this will detect offline when not?)
  if(this.check.online) {
    if(newState.online !== this.state.online) {
      list.push(this.channel + ' is now ' + (newState.online ? 'online' : 'offline'));
    }
  }

  // Check NSFW
  if(this.check.nsfw) {
    if(newState.nsfw !== this.state.nsfw) {
      list.push(this.channel + '\'s channel is now ' + (newState.nsfw ? 'NSFW' : 'SFW'));
    }
  }

  // Check multistreams
  if(this.check.multistream) {
    if(!this.areMultistreamsEqual(newState.multistream, this.state.multistream)) {
      if(this.isMultistreamEmpty(newState.multistream)) {
        list.push(this.channel + ' is no longer multistreaming');
      } else {
        var guests = [];

        for(var i = 0; i < newState.multistream.length; i++) {
          var name = newState.multistream[i].name;
          if(name !== undefined) {
            guests.push(name);
          }
        }

        list.push(this.channel + ' is multistreaming with ' + guests.join(' and '));
      }
    }
  }

  if(list.length > 0) {
    return list.join(', ');
  }
};

/**
 * Upon joining a channel, grab the initial state and start.
 * @param data Callback data
 */
DetectionModule.prototype.onJoin = function(data) {
  var module = this;

  this.channel = data.room.name;
  this.send = data.send;

  this.start();
};

/**
 * Update the current state with a new state.
 * @param newState New state.
 */
DetectionModule.prototype.updateState = function(newState) {
  if(newState) {
    // Testing, clear multistream
    //newState.nsfw = false;
    //newState.multistream = this.getDefaultState().multistream;
    //newState.online = true;

    var diffString = this.getStateDiffString(newState);
    if(diffString) {
      logger.logDetectionStateChange(newState, diffString);
      this.send(diffString);
    }
    this.state = newState;
  }
};

/**
 * Check if this module is active.
 * @return true if active, false if not
 */
DetectionModule.prototype.isActive = function() {
  return this.active === true;
};

/**
 * Start the interval that checks for changes in state.
 */
DetectionModule.prototype.start = function() {
  var module = this, channel = this.channel;

  // Check if already started (active)
  if(this.isActive()) {
    return; // Already started
  }
  this.active = true;

  // Fetch initial state
  this.fetchInitialState(channel, function(error, state) {
    logger.logDetectionState(true, channel, state);
    if(!error) {
      module.state = state;
      // Start interval
      module.interval = setInterval(function() {
        module.fetchInitialState(channel, function(error, state) {
          logger.logDetectionState(false, channel, state);
          if(!error) {
            module.updateState(state);
          } else {
            logger.logError('Error getting state:' + error.toString());
          }
        });
      }, module.deltaTime);
    } else {
      logger.logError('Error getting initial state:' + error.toString());
    }
  });
};

/**
 * Stop the interval that checks for changes in state.
 */
DetectionModule.prototype.stop = function() {
  if(this.interval !== undefined) {
    clearInterval(this.interval);
    this.interval = undefined;
  }
  this.active = false;
};

/**
 * Turn the detection interval on/off.
 * @param data Command data
 */
DetectionModule.prototype.onDetect = function(data) {
  if(this.channel === undefined) {
    return 'No channel has been set, can\'t detect anything.';
  }

  if(data.parsed.tail) {
    var cmd = data.parsed.tailArray[0].toLowerCase(),
        set;

    if(cmd === 'on' || cmd === 'yes' || cmd === 'true') {
      set = true;
    } else if(cmd === 'off' || cmd === 'no' || cmd === 'false') {
      set = false;
    }

    // Check what is being set on/off
    if(set !== undefined && data.parsed.tailArray.length > 1) {
      var what = data.parsed.tailArray[1].toLowerCase();
      if(this.check[what] !== undefined) {
        if(this.check[what] === set) {
          if(set) {
            return 'Already detecting ' + this.descriptions[what];
          } else {
            return 'Already not detecting ' + this.descriptions[what];
          }
        } else {
          this.check[what] = set;
          if(set) {
            return 'Now detecting ' + this.descriptions[what];
          } else {
            return 'No longer detecting ' + this.descriptions[what];
          }
        }
      }
    } else {
      // Just turning detection itself on/off
      if(set) {
        if(this.isActive()) {
          data.send('Detection is already active.');
        } else {
          this.setActive(true);
          data.send('Detection is now active.');
        }
      } else {
        if(!this.isActive()) {
          data.send('Detection is already inactive.');
        } else {
          this.setActive(false);
          data.send('Detection is now inactive.');
        }
      }
    }
  } else {
    data.send('Detection is currently ' + (this.isActive() ? 'active' : 'inactive') + '.');
  }
};

/**
 * Set whether or not detection is active. If changed to
 * true, this will start detection. If changed to false,
 * this will stop detections.
 * @param active Active state to change to
 */
DetectionModule.prototype.setActive = function(active) {
  if(this.isActive() === active) {
    return;
  }

  if(active) {
    this.start();
  } else {
    this.stop();
  }
};

/**
 * Send the current state of the channel as is saved.
 * @param data Command data
 */
DetectionModule.prototype.onState = function(data) {
  if(this.channel === undefined) {
    return 'No state detected as no channel has been set.';
  }
  else if(this.state) {
    return (this.channel + ' is currently ' + (this.state.nsfw ? 'NSFW' : 'SFW'));
  }
};

// Disable module for now
// module.exports = DetectionModule;
