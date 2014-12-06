var request = require('request');

// Todo: derpibooru node package and use that
function DerpibooruModule() {
  this.info = {
    name: 'Derpibooru',
    command: { name: 'derpi', callback: DerpibooruModule.prototype.onDerpi.bind(this) },
    description: 'Provides commands for interacting with derpiboo.ru'
  };
}

DerpibooruModule.prototype.fixQuery = function(query) {
  query = query.replace('+', ''); // Remove +s

  var tags = query.split(',');
  for(var i = 0; i < tags.length; i++) {
    tags[i] = tags[i].split(/\s+/).join('+'); // Replace whitespace with +
  }

  query = tags.join(',');
  query = query.replace(/,,+/, ',');
  return query;
};

DerpibooruModule.prototype.fetchRandomWithQuery = function(query, callback) {
  var module = this;

  if(query === '') query = 'safe'; // Default
  query = '&q=' + this.fixQuery(query);

  request('https://derpiboo.ru/search.json?sf=_random' + query, function(error, response, body) {
    var data;

    if(!error) {
      var obj = JSON.parse(body);

      if(obj && obj.search && obj.search.length > 0) {
        data = obj.search[0];
      } else {
        error = new Error('Unexpected format of JSON response');
      }
    }

    if(callback) {
      callback(error, data);
    }
  });
};

DerpibooruModule.prototype.getPrefix = function(tags) {
  var prefix = '';
  // A bit lazy
  if(tags.indexOf('suggestive') >= 0) {
    prefix += '(Suggestive) ';
  }
  if(tags.indexOf('explicit') >= 0) {
    prefix += '(Explicit) ';
  }
  if(tags.indexOf('questionable') >= 0) {
    prefix += '(Questionable) ';
  }
  if(tags.indexOf('grimdark') >= 0) {
    prefix += '(Grimdark) ';
  }

  return prefix;
};

DerpibooruModule.prototype.onDerpi = function(data) {
  var module = this;

  var query = data.parsed.tail || '';
  this.fetchRandomWithQuery(query, function(error, obj) {
    if(!error) {
      var tags = obj.tag_ids;
      var prefix = module.getPrefix(tags);
      var link = 'https://derpiboo.ru/images/' + obj.id_number;
      data.send(prefix + link);
    } else {
      console.error('Error fetching derpibooru image:', error);
      data.send('Something weird happened while getting a derpibooru image, sorry!');
    }
  });
};

module.exports = DerpibooruModule;
