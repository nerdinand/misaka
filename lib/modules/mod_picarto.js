var https = require('https');

function PicartoModule() {
  this.info = {
    name: 'Picarto',
    command: { name: 'multistream', callback: PicartoModule.prototype.onMultistream.bind(this) },
    description: 'Provides commands relating to the picarto.tv website'
  };
}

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
    //data.send('Response received, awaiting data (HTML) ...');
    res.on('data', function(html) {
      // <div id='channeldescriptiontxt'><p>Multistreaming with: Name!</p>
      // <div id='channeldescriptiontxt'><p>Multistreaming with: Name1 and Name2!</p>

      html = html.toString(); // Is a buffer
      //console.log(html);

      // Check if non-existant user
      // Will need to do after 301...?
      //if(/<h1>Oh no! This channel does not exist\.<\/h1>/.test(html)) {
      //  data.send('Who is ' + roomname + '?');
      //  return;
      //}

      var patt = /<div\s+id='channeldescriptiontxt'>\s*<p>Multistreaming with: ([^!]+)/;
      var match = patt.exec(html);

      // Couldn't find, assume no multistream
      if(!match || match.length === 0) {
        data.send(roomname + ' doesn\'t seem to be multistreaming at the moment.');
      } else {
        var names = match[1];
        data.send(roomname + ' is multistreaming with ' + names + '!');
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

module.exports = PicartoModule;
