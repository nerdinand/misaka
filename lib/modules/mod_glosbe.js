var https = require('https');

function GlosbeModule() {
  this.info = {
    name: 'Glosbe',
    command: { name: 'word', callback: GlosbeModule.prototype.onWord.bind(this) },
    definition: 'Provides commands for interacting with the glosbe.com API'
  };
}

/**
 * Get a list of all definitions from an object built from
 * a JSON response.
 * @param obj Object parsed from JSON
 * @return list of definitions
 */
GlosbeModule.prototype.getAllDefinitions = function(obj) {
  var list = [];

  if(obj && obj.tuc instanceof Array) {
    obj.tuc.forEach(function(child) {
      if(child && child.meanings instanceof Array) {
        child.meanings.forEach(function(meaning) {
          if(meaning && meaning.text !== undefined) {
            list.push(meaning.text);
          }
        });
      }
    });
  }

  return list;
};

GlosbeModule.prototype.fetchDefinition = function(phrase, callback) {
  var module = this;

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
      if(callback) callback(module.getAllDefinitions(obj));
    });
  });
  req.end();

  req.on('error', function(err) {
    if(callback) callback();
  });
};

GlosbeModule.prototype.onWord = function(data) {
  if(data.parsed.tail) {
    var phrase = data.helper.trim(data.parsed.tail),
        fixedPhrase = phrase.replace(/\s+/g, '+'); // Replace whitespace with +

    this.fetchDefinition(fixedPhrase, function(defs) {
      if(defs.length > 0) {
        var meaning = defs[0],
            full = (phrase + ': ' + meaning).substring(0, 255);
        data.send(full);
      } else {
        data.send('No definition found for: ' + phrase);
      }
    });
  }
};

module.exports = GlosbeModule;
