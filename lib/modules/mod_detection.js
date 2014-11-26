var https = require('https');

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

  this.channel = undefined;
  this.on = true;
  this.state = this.getDefaultState();
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
 * Fetch the HTML of a picarto channel.
 * Todo: Use this for !multistream?
 * @param name Name of channel
 * @param callback Callback
 */
DetectionModule.prototype.fetchChannelHtml = function(name, callback) {
  var req = https.request({
    host: 'www.picarto.tv',
    path: '/live/channel.php?watch=' + name,
    method: 'GET'
  }, function(res) {
    var str = '';

    res.on('data', function(chunk) {
      str += chunk;
    });

    res.on('end', function() {
      if(callback) callback(str.toString());
    });
  });
  req.end();

  req.on('error', function(e) {
    if(callback) callback();
  });
};

/**
 * Fetch the state of a picarto channel.
 * @param name Channel name
 * @param callback Callback
 */
DetectionModule.prototype.fetchState = function(name, callback) {
  var module = this;

  this.fetchChannelHtml(name, function(html) {
    if(html) {
      var state = module.parseState(html);
      if(callback) callback(state);
    } else {
      if(callback) callback();
    }
  });
};

/**
 * Parse a state given some channel's html.
 * @param html Html of channel page to parse
 * @return state object
 */
DetectionModule.prototype.parseState = function(html) {
  var state = this.getDefaultState();

  //var multistreamPattern = /<div\s+id='channelheadname(2|3)'>\s*([^< ]+)\s*<\/div>/;

  // Check if NSFW
  var nsfwPattern = /<img title='This Stream contains NSFW Content' src='..\/img\/18plusicon\.png'>/;
  state.nsfw = nsfwPattern.test(html);

  return state;
};

// Todo?
DetectionModule.prototype.getStateString = function(state) {
  if(!state) state = this.state;
};

/**
 * Get a string detailing the change in state.
 * @param newState New state to compare to current state (this.state)
 * @return string representing the change in state, or undefined
 *         if no detected change
 */
DetectionModule.prototype.getStateDiffString = function(newState) {
  // Only check nsfw for now
  if(newState.nsfw !== this.state.nsfw) {
    return (this.channel + '\'s channel is now ' + (newState.nsfw ? 'NSFW' : 'SFW'));
  }
};

/**
 * Upon joining a channel, grab the initial state and
 * start.
 * @param data Callback data
 */
DetectionModule.prototype.onJoin = function(data) {
  var module = this;

  this.channel = data.room.name;
  this.send = data.send;

  this.fetchState(this.channel, function(state) {
    if(state) {
      module.state = state;
      module.start();
    } else {
      console.log('Error getting initial state');
    }
  });
};

/**
 * Start the interval that checks for changes in state.
 */
DetectionModule.prototype.start = function() {
  var module = this;
  if(this.interval !== undefined) {
    return; // Already started
  }

  this.interval = setInterval(function() {
    module.fetchState(module.channel, function(state) {
      if(state) {
        var diffString = module.getStateDiffString(state);
        if(diffString) {
          module.send(diffString);
        }
        module.state = state;
      }
    });
  }, 10000);
};

/**
 * Stop the interval that checks for changes in state.
 */
DetectionModule.prototype.stop = function() {
  if(this.interval !== undefined) {
    clearInterval(this.interval);
    this.interval = undefined;
  }
};

DetectionModule.prototype.onDetect = function(data) {
  if(data.parsed.tail) {
    var cmd = data.parsed.tailArray[0].toLowerCase();
    if(cmd === 'on' || cmd === 'yes' || cmd === 'true') {
      if(this.on) {
        data.send('Detection is already active');
      } else {
        this.on = true;
        data.send('Detection is now active');
      }
    } else if(cmd === 'off' || cmd === 'no' || cmd === 'false') {
      if(!this.on) {
        data.send('Detection is already inactive');
      } else {
        this.on = false;
        data.send('Detection is now inactive');
      }
    }
  }
};

DetectionModule.prototype.onState = function(data) {
  // Todo
};

module.exports = DetectionModule;
