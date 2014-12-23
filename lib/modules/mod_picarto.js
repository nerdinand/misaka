var request = require('request');

function PicartoModule() {
  this.info = {
    name: 'Picarto',
    description: 'Provides commands relating to the picarto.tv website',
    commands: [
      { name: 'multistream', callback: PicartoModule.prototype.onMultistream.bind(this) },
      { name: 'nsfw', callback: PicartoModule.prototype.onNsfw.bind(this) }
    ]
  };
}

PicartoModule.prototype.getStatusCodeError = function(response) {
  if(response && response.statusCode !== 200 && response.statusCode !== 302) {
    return new Error('Unexpected status code: ' + response.statusCode);
  }
};

PicartoModule.prototype.fetchMultistreamHtml = function(name, callback) {
  var module = this;

  request({
    url: 'https://www.picarto.tv/live/multistream.php?watch=' + name,
    followRedirect: false
  }, function(error, response, body) {
    // Check for status code error
    if(!error) {
      var statusError = module.getStatusCodeError(response);
      if(statusError) error = statusError;
    }

    if(callback) {
      callback(error, body);
    }
  });
};

/**
 * Fetch the HTML of a picarto channel.
 * Todo: Use this for !multistream?
 * @param name Name of channel
 * @param callback Callback
 */
PicartoModule.prototype.fetchChannelHtml = function(name, callback) {
  var module = this;

  request({
    url: 'https://www.picarto.tv/live/channel.php?watch=' + name,
    followRedirect: false
  }, function(error, response, body) {
    // Check for status code error
    if(!error) {
      var statusError = module.getStatusCodeError(response);
      if(statusError) error = statusError;
    }

    if(callback) {
      callback(error, body);
    }
  });
};

/**
 * Check if this room has a multistream going on, and with who.
 * @param data Command data
 */
PicartoModule.prototype.onMultistream = function(data) {
  var roomname = data.room.name;
  if(data.parsed.tail) {
    // If an argument given, use that as roomname
    roomname = data.parsed.tailArray[0];
  }

  this.fetchMultistreamHtml(roomname, function(error, str) {
    if(!error) {
      // Old:
      // <div id='channeldescriptiontxt'><p>Multistreaming with: Name!</p>
      // <div id='channeldescriptiontxt'><p>Multistreaming with: Name1 and Name2!</p>
      // ---
      // <div id='channelheadname2'>Name1</div>
      // <div id='channelheadname3'>Name2</div>

      html = str.toString();

      // Check if non-existant user
      // Will need to do after 301...?
      //if(/<h1>Oh no! This channel does not exist\.<\/h1>/.test(html)) {
      //  data.send('Who is ' + roomname + '?');
      //  return;
      //}

      var patt = /<div\s+id='channelheadname(2|3)'>\s*([^< ]+)\s*<\/div>/;
      var match = patt.exec(html);
      var names = [];

      while(match) {
        // Couldn't find, assume no multistream
        if(match.length === 0) {
          break;
        } else {
          names.push(match[2]);
        }

        html = html.substring(match.index + match[0].length);
        match = patt.exec(html);
      }

      if(names.length === 0) {
        data.send(roomname + ' doesn\'t seem to be multistreaming at the moment.');
      } else {
        data.send(roomname + ' is multistreaming with ' + names.join(' and ') + '!');
      }
    } else {
      console.error('Error fetching multistream html:', error);
      data.send('Error occurred while checking for multistream status');
    }
  });
};

PicartoModule.prototype.onNsfw = function(data) {
  var name = data.room.name;
  if(data.parsed.tail) {
    name = data.parsed.tailArray[0];
  }

  this.fetchChannelHtml(name, function(error, html) {
    if(!error) {
      var patt = /<img title='This Stream contains NSFW Content' src='..\/img\/18plusicon\.png'>/;
      if(patt.test(html)) {
        data.send('Channel of ' + name + ' appears to be doing NSFW stuff');
      } else {
        data.send('Channel of ' + name + ' appears safe for work');
      }
    } else {
      console.error('Error fetching channel html:', error);
      data.send('Error occurred while checking for NSFW status');
    }
  });
};

module.exports = PicartoModule;
