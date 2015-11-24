var nodemw = require('nodemw');
var path = require('path');
var logger = require(path.join('..', 'Logger')).default;

function MediaWikiModule() {
  this.info = {
    name: 'MediaWiki',
    command: { name: 'wiki', callback: MediaWikiModule.prototype.onWiki.bind(this) },
    description: 'Command for looking stuff up on Wikipedia'
  };

  this.mediawiki = new nodemw({
    server: 'en.wikipedia.org',
    path: '/w'
  });
}

MediaWikiModule.prototype.fixExtract = function(extract) {
  extract = extract.replace(/<\/?[a-z0-9]*\/?>/gi, '');
  extract = extract.split(/\. [A-Z0-9]/, 1)[0] + '.'; // First sentence
  extract = extract.replace(/\s+$/, ''); // Trim end

  // Todo: 256 limit handling via client
  return extract.substring(0, 255);
};

MediaWikiModule.prototype.fetchSummary = function(query, callback) {
  var params = {
    action: 'query',
    prop: 'extracts',
    exintro: '',
    redirects: '',
    titles: query
  };

  var module = this;
  this.mediawiki.api.call(params, function(err, info, next, data) {
    if(!err) {
      // Only one page, but we don't know the key
      var pages = info && info.pages;
      var keys = Object.keys(pages);
      if(keys.length === 0 || keys[0] === '-1') {
        callback();
        return;
      }

      var page = pages[keys[0]];

      if(callback) {
        callback(err, module.fixExtract(page.extract));
      }
    } else if(callback) {
      callback(err);
    }
  });
};

MediaWikiModule.prototype.onWiki = function(data) {
  if(data.parsed.tail.length > 0) {
    var query = data.parsed.tail;

    this.fetchSummary(query, function(err, summary) {
      if(!err) {
        if(summary !== undefined) {
          data.send(summary);
        } else {
          data.send('Nothing found for: ' + query);
        }
      } else {
        logger.error(err, 'Error fetching summary', { query: query });
      }
    });

    //return 'Looking up: "' + query + '"';
  }
};

module.exports = MediaWikiModule;
