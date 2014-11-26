var https = require('https');

function PicartoModule() {
  this.info = {
    name: 'Picarto',
    commands: [
      { name: 'multistream', callback: PicartoModule.prototype.onMultistream.bind(this) },
      { name: 'nsfw', callback: PicartoModule.prototype.onNsfw.bind(this) }
    ],
    description: 'Provides commands relating to the picarto.tv website'
  };
}

/**
 * Fetch the HTML of a picarto channel.
 * Todo: Use this for !multistream?
 * @param name Name of channel
 * @param callback Callback
 */
PicartoModule.prototype.fetchChannelHtml = function(name, callback) {
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
 * Check if this room has a multistream going on, and with who.
 * @param data Command data
 */
PicartoModule.prototype.onMultistream = function(data) {
  var roomname = data.room.name;
  if(data.parsed.tail) {
    // If an argument given, use that as roomname
    roomname = data.parsed.tailArray[0];
  }

  var req = https.request({
    host: 'www.picarto.tv',
    path: '/live/multistream.php?watch=' + roomname,
    method: 'GET'
  }, function(res) {
    var str = '';

    res.on('data', function(chunk) {
      str += chunk;
    });

    res.on('end', function() {
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
    });
  });
  req.end();

  req.on('error', function(e) {
    console.warn('Error while checking for multistream:', e);
    data.send('An error occurred while checking for multistream, sorry!');
  });

  //return 'Checking if multistream (sending HTTP request...)';
};

PicartoModule.prototype.onNsfw = function(data) {
  var name = data.room.name;
  if(data.parsed.tail) {
    name = data.parsed.tailArray[0];
  }

  this.fetchChannelHtml(name, function(html) {
    if(html) {
      var patt = /<img title='This Stream contains NSFW Content' src='..\/img\/18plusicon\.png'>/;
      if(patt.test(html)) {
        data.send('Channel of ' + name + ' appears to be doing NSFW stuff');
      } else {
        data.send('Channel of ' + name + ' appears safe for work');
      }
    } else {
      data.send('Couldn\'t retrieve channel HTML');
    }
  });
};

module.exports = PicartoModule;
