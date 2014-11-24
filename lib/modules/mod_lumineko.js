/**
 * Provides commands specific to lumineko's picarto room.
 */
function LuminekoModule() {
  this.info = {
    name: 'Lumineko',
    commands: [
      { name: 'challenge', callback: LuminekoModule.prototype.onChallenge.bind(this) },
      { name: 'donate', callback: LuminekoModule.prototype.onDonate.bind(this) }
    ],
    description: 'Provides commands specific to lumineko\'s picarto room'
  };
}

LuminekoModule.prototype.onChallenge = function(data) {
  return 'Link to 30 minute challenge: http://30minchallenge.tumblr.com';
};

LuminekoModule.prototype.onDonate = function(data) {
  var patreon = 'http://www.patreon.com/lumineko',
      streamtip = 'https://streamtip.com/t/lumineko';
  var hyphens = '----------------------------------------------------'; // Exactly one line in chat
  return 'Donation links: ' + hyphens + ' ' + patreon + ' ' + hyphens + ' ' + streamtip;
};

module.exports = LuminekoModule;
