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
  var param = data.parsed.tail,
      module = data.parent.getModuleManager().get('Reminder'),
      nowStr = '30 minute challenge reminder is now',
      alreadyStr = '30 minute challenge reminder is already';

  if(module && /^on$/i.test(param)) {
    if(!module.base().isEnabled()) {
      module.base().setEnabled(true);
      return nowStr + ' enabled';
    } else {
      return alreadyStr + ' enabled';
    }
  } else if(module && /^off$/i.test(param)) {
    if(module.base().isEnabled()) {
      module.base().setEnabled(false);
      return nowStr + ' disabled';
    } else {
      return alreadyStr + ' disabled';
    }
  } else {
    return 'Link to 30 minute challenge: http://30minchallenge.tumblr.com';
  }
};

LuminekoModule.prototype.onDonate = function(data) {
  var patreon = 'http://www.patreon.com/lumineko',
      streamtip = 'https://streamtip.com/t/lumineko';
  var hyphens = '----------------------------------------------------'; // Exactly one line in chat
  return 'Donation links: ' + hyphens + ' ' + patreon + ' ' + hyphens + ' ' + streamtip;
};

module.exports = LuminekoModule;
