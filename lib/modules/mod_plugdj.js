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
      { name: 'dj', callback: PlugDJModule.prototype.onDj.bind(this) },
      { name: 'song', callback: PlugDJModule.prototype.onSong.bind(this) },
      { name: 'songurl', callback: PlugDJModule.prototype.onSongUrl.bind(this) }
    ],
    callbacks: {
      join: PlugDJModule.prototype.onJoin.bind(this)
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

  new PlugAPI({
    email: this.email,
    password: this.password
  }, function(error, plugapi) {
    if(!error) {
      module.plugapi = plugapi;

      plugapi.on('roomJoin', function(room) {
        console.log('Joined plug.dj room: ' + room);
      });

      plugapi.on('advance', function(data) {
        module.advance = data;
      });

      // Reconnect if close/error events occur
      var reconn = function() {
        console.log('Reconnecting to plug.dj room...');
        plugapi.connect(module.room);
      };
      plugapi.on('close', reconn);
      plugapi.on('error', reconn);

      // Connect to room
      if(module.room !== undefined) {
        console.log('Connecting to ' + module.room + ' on plug.dj...');
        plugapi.connect(module.room);
      }
    } else {
      console.error('Error while using PlugAPI:', error);
    }
  });
};

PlugDJModule.prototype.getSongUrl = function() {
  var media = this.advance && this.advance.media;
  if(media && media.cid && media.image && /ytimg/.test(media.image)) {
    return 'https://www.youtube.com/watch?v=' + media.cid;
  }
};

PlugDJModule.prototype.getFullSongName = function() {
  var media = this.advance && this.advance.media;
  if(media) {
    if(media.author) {
      return (media.author + ' - ' + media.title);
    } else {
      return media.title;
    }
  } else {
    return 'None';
  }
};

/**
 * Inform users who is currently DJ-ing.
 * @param data Command data
 */
PlugDJModule.prototype.onDj = function(data) {
  if(this.advance) {
    var dj = this.advance.currentDJ;

    if(dj) {
      return 'Current dj is ' + dj.username;
    } else {
      return 'Dunno';
    }
  } else {
    return 'Plug.dj module has yet to connect.';
  }
};

/**
 * Inform users about the current song playing.
 * @param data Command data
 */
PlugDJModule.prototype.onSong = function(data) {
  if(this.advance) {
    return this.getFullSongName();
  } else {
    return 'Plug.dj module has yet to connect.';
  }
};

PlugDJModule.prototype.onSongUrl = function(data) {
  if(this.advance) {
    var url = this.getSongUrl();
    if(url) {
      return 'Song: ' + url;
    } else {
      return 'Dunno the url, yo!';
    }
  } else {
    return 'Plug.dj module has yet to connect.';
  }
};

module.exports = PlugDJModule;
