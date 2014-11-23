var nodemw = require('nodemw');

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
  this.mediawiki.api.call(params, function(info, next, data) {
    if(!callback) {
      return;
    }

    // Only one page, but we don't know the key
    var pages = info && info.pages;
    var keys = Object.keys(pages);
    if(keys.length === 0 || keys[0] === '-1') {
      callback();
      return;
    }

    var page = pages[keys[0]];
    callback(module.fixExtract(page.extract));
  });
};

MediaWikiModule.prototype.onWiki = function(data) {
  var full = data.message;

  // Make a helper for this later..?
  var s = full.split(/\s+/);
  if(s.length > 1) {
    s.splice(0, 1); // Remove the first element
    var query = s.join(' ');

    this.fetchSummary(query, function(summary) {
      if(summary !== undefined) {
        data.send(summary);
      } else {
        data.send('Nothing found for: ' + query);
      }
    });

    //return 'Looking up: "' + query + '"';
  }
};

module.exports = MediaWikiModule;
