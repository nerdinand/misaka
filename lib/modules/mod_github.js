var path = require('path');
var logger = require(path.join('..', 'logger'));

var Github;
try {
  Github = require('github');
} catch(e) {
  throw new Error('`github` package not installed');
}

function GithubModule() {
  this.info = {
    name: 'Github',
    description: 'Provides commands relating to Misaka\'s repository on Github '
               + 'and checks for new commits pushed.',
    commands: [
      { name: 'commit', callback: GithubModule.prototype.onCommit.bind(this) },
      { name: 'ghremaining', callback: GithubModule.prototype.onRemaining.bind(this) }
    ],
    callbacks: {
      join: GithubModule.prototype.onJoin.bind(this)
    },
  };

  this.github = new Github({
    version: '3.0.0'
  });

  this.current = undefined;
  this.wait = 10000;
}

GithubModule.prototype.fetchLatestCommit = function(callback) {
  var module = this;

  this.github.repos.getCommits({
    user: 'saneki',
    repo: 'misaka',
  }, function(err, res) {
    if(callback) {
      if(!err) {
        // Ratelimit check
        var meta = res['meta'];
        if(meta['x-ratelimit-limit'] === '60') {
          logger.warn('Github auth not active or failed');
        }

        module.remaining = meta['x-ratelimit-remaining'];
        callback(err, res[0]);
      } else {
        callback(err);
      }
    }
  });
};

GithubModule.prototype.getCommitString = function(commit) {
  if(!commit) commit = this.current;
  var author = commit.committer.login,
      sha = commit.sha.substring(0, 7),
      message = commit.commit.message,
      str = (author + ': ' + message + ' (sha: ' + sha + ')');
  return str;
};

GithubModule.prototype.start = function() {
  var module = this;

  this.interval = setInterval(function() {
    module.fetchLatestCommit(function(error, commit) {
      if(!error) {
        // If new commit
        if(module.current.sha !== commit.sha) {
          module.current = commit;
          module.send('New commit by ' + module.getCommitString());
        }
      } else {
        logger.warn('Error fetching latest commit:', commit);
      }
    });
  }, this.wait);
};

GithubModule.prototype.onJoin = function(data) {
  var module = this;
  this.send = data.send;
  this.token = data.config.token;

  // Token is required
  if(!this.token) {
    logger.warn('No oauth token given for Github module');
    return;
  }

  // Store auth stuff
  this.github.authenticate({
    type: 'oauth',
    token: this.token
  });

  // Fetch initial commit
  this.fetchLatestCommit(function(error, commit) {
    if(!error) {
      module.current = commit;
      module.start();
    } else {
      logger.warn('Error fetching current commit:', error);
    }
  });
};

GithubModule.prototype.onCommit = function(data) {
  if(this.current) {
    return 'Latest commit by ' + this.getCommitString(this.current);
  } else {
    return 'Initial github commit has yet to be fetched.';
  }
};

GithubModule.prototype.onRemaining = function(data) {
  if(this.remaining !== undefined) {
    return 'Remaining Github requests allowed: ' + this.remaining;
  } else {
    return 'Unknown, initial github commit has yet to be fetched.';
  }
};

module.exports = GithubModule;
