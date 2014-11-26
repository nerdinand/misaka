function TestingModule() {
  this.info = {
    name: 'Testing',
    commands: [
      { name: 'testqueue', callback: TestingModule.prototype.onTestQueue.bind(this) },
      { name: 'testtime', callback: TestingModule.prototype.onTestTime.bind(this) }
    ],
    description: 'Commands for testing things',
    master: true
  };
}

TestingModule.prototype.onTestQueue = function(data) {
  for(var i = 0; i < 10; i++) {
    data.send('Testing queue, message #' + i);
  }
};

TestingModule.prototype.onTestTime = function(data) {
  if(data.parsed.tail) {
    var str = data.parsed.tailArray[0],
        result = data.helper.parseTimeString(str);

    if(result) {
      var timestr = data.helper.timeToString(result.total);
      data.send('Total time: ' + timestr + ' (' + result.total + ' milliseconds)');
    } else {
      data.send('Couldn\'t parse time string.');
    }
  }
};

module.exports = TestingModule;
