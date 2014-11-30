var PlugAPI;
try {
  PlugAPI = require('plugapi');
} catch(error) {
  throw new Error('`plugapi` package not installed');
}

/**
 * Module for interacting with the plug.dj api. This doesn't
 * work quite yet because of recent changes in their api and
 * the plugapi package acting strangely?
 */
function PlugDJModule() {
  // Commands/callbacks commented out for now until things work
  this.info = {
    name: 'PlugDJ',
    description: 'Provides commands for the plug.dj API and watching for the next song.',
    commands: [
      //{ name: 'dj', callback: PlugDJModule.prototype.onDj.bind(this) },
      //{ name: 'song', callback: PlugDJModule.prototype.onSong.bind(this) }
    ],
    callbacks: {
      //join: PlugDJModule.prototype.onJoin.bind(this)
    }
  };

  this.email = undefined;
  this.password = undefined;
  this.room = undefined;
  this.advance = undefined;
}

PlugDJModule.prototype.onJoin = function(data) {
  this.send = data.send;

  if(!data.config || data.config.email === undefined
      || data.config.password === undefined) {
    console.warn('E-mail and password needed for plug.dj module');
    return;
  }

  this.email = data.config.email;
  this.password = data.config.password;
  this.room = data.config.room;

  this.initClient();
};

/**
 * Initialize the plug.dj api client.
 * This currently inf-loops for some reason.
 */
PlugDJModule.prototype.initClient = function() {
  var module = this;

  // This seems to inf loop block, uh...
  this.plugapi = new PlugAPI({
    email: this.email,
    password: this.password
  });

  this.plugapi.on('roomJoin', function(room) {
    console.log('Joined plug.dj room: ' + room);
  });

  this.plugapi.on('djAdvance', function(data) {
    // Keep track of the advance data
    console.log(['djAdvance', data]);
    module.advance = data;
  });

  // Connect to room
  if(this.room !== undefined) {
    console.log('Connecting to ' + this.room + ' on plug.dj...');
    this.plugapi.connect(this.room);
  }
};

/**
 * Inform users who is currently DJ-ing.
 * @param data Command data
 */
PlugDJModule.prototype.onDj = function(data) {
  if(this.advance && this.advance.dj && this.advance.dj.user) {
    return 'Current dj is ' + this.advance.dj.user.username;
  } else {
    return 'Dunno';
  }
};

/**
 * Inform users about the current song playing.
 * @param data Command data
 */
PlugDJModule.prototype.onSong = function(data) {
  if(this.advance && this.advance.media) {
    return 'Current song: ' + this.advance.media.title;
  } else {
    return 'Dunno';
  }
};

module.exports = PlugDJModule;
