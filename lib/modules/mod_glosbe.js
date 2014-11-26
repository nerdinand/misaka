var https = require('https');

function GlosbeModule() {
  this.info = {
    name: 'Glosbe',
    command: { name: 'word', callback: GlosbeModule.prototype.onWord.bind(this) },
    definition: 'Provides commands for interacting with the glosbe.com API'
  };
}

GlosbeModule.prototype.fetchDefinition = function(phrase, callback) {
  var req = https.request({
    hostname: 'glosbe.com',
    path: '/gapi/translate?from=eng&dest=eng&format=json&phrase=' + phrase
  }, function(res) {
    var str = '';
    res.on('data', function(chunk) {
      str += chunk;
    });

    res.on('end', function() {
      var obj = JSON.parse(str);
      if(callback) callback(obj);
    });
  });
  req.end();

  req.on('error', function(err) {
    if(callback) callback();
  });
};

GlosbeModule.prototype.onWord = function(data) {
  if(data.parsed.tail) {
    var phrase = data.parsed.tail;

    this.fetchDefinition(phrase, function(obj) {
      if(obj && obj.tuc instanceof Array) {
        var meaning = obj.tuc[0].meanings[0].text;
        if(meaning) {
          var full = (phrase + ': ' + meaning).substring(0, 255);
          data.send(full);
        }
      } else {
        data.send('Couldn\'t find definition for: ' + phrase);
      }
    });
  }
};

module.exports = GlosbeModule;
