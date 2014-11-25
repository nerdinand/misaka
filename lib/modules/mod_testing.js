function TestingModule() {
  this.info = {
    name: 'Testing',
    commands: [
      { name: 'testqueue', callback: TestingModule.prototype.onTestQueue.bind(this) }
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

module.exports = TestingModule;
