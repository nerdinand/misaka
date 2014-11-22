var fs = require('fs');

var DEFAULT_COLOR = '#000000';

var Config = function() {
  this.initDefault();

  // Todo: Load stuff

  // If bad color, use default
  if(!this.checkColor(this.color)) {
    this.color = DEFAULT_COLOR;
  }
};

Config.prototype.initDefault = function() {
  this.authkey = '';
  this.color = '#ac0000';
  this.username = '';
};

Config.prototype.checkColor = function(color) {
  return (/^#[a-f0-9]{6}$/i).test(color);
};

Config.prototype.setFrom = function(obj) {
  if(obj.authkey !== undefined) this.authkey = obj.authkey;
  if(obj.color !== undefined) this.color = obj.color;
  if(obj.username !== undefined) this.username = obj.username;
};

/**
 * Read a configuration JSON file.
 * @param path Filepath to open
 * @param callback Callback
 */
Config.prototype.read = function(path, callback) {
  var config = this;
  fs.readFile(path, function(err, data) {
    if(err) {
      if(callback) {
        callback(err);
      }
      return;
    }

    var obj = JSON.parse(data);
    config.setFrom(obj);

    if(callback) {
      callback();
    }
  });
};

module.exports = { Config: Config };
