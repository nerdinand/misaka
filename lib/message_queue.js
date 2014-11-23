function MessageQueue(opts) {
  if(!(opts instanceof Object)) {
    opts = {};
  }

  this.send = opts['send'] || undefined;
  this.wait = opts['wait'] || 1000;
  this.list = [];
  this.interval = undefined;
  this.lastSend = 0;
  this.started = false;
}

/**
 * Get the time to wait before starting the next interval.
 * This basically checks lastSend against the current time,
 * and compares with wait.
 * @return amount of time to wait, 0 if none
 */
MessageQueue.prototype.getTimeToWait = function() {
  var now = (new Date()).getTime();
  var diff = now - this.lastSend;

  if(diff >= this.wait) {
    return 0;
  } else {
    return (this.wait - diff);
  }
};

/**
 * Whether or not this queue has messages waiting to
 * be sent.
 * @return true if messages waiting, false if empty
 */
MessageQueue.prototype.hasMessages = function() {
  return (this.list.length > 0);
};

/**
 * Push a message to the end of the queue, and start
 * the queue if not already started.
 * @param message Message to enqueue
 */
MessageQueue.prototype.push = function(message) {
  this.list.push(message);
  this.start();
};

/**
 * Send the next message in the queue and remove it
 * from the waiting list.
 * If this.send isn't defined or isn't a Function,
 * the next message will just be removed.
 */
MessageQueue.prototype.sendNext = function() {
  var message = this.list.shift();
  if(this.send instanceof Function) {
    this.send(message);
  }
};

/**
 * Start the queue interval (if not already started).
 */
MessageQueue.prototype.start = function() {
  // Already in the process of sending everything
  // in the queue
  if(this.started) {
    return;
  }
  this.started = true;

  var queue = this;
  setTimeout(function() {
    queue.interval = setInterval(function() {
      // If we have messages waiting, send one
      if(queue.hasMessages()) {
        queue.updateSendTime();
        queue.sendNext();
      }

      // If we are (now) empty, stop
      if(!queue.hasMessages()) {
        queue.stop();
      }
    }, queue.wait);
  }, this.getTimeToWait());
};

/**
 * Stop the queue interval.
 */
MessageQueue.prototype.stop = function() {
  clearInterval(this.interval);
  this.interval = undefined;
  this.started = false;
};

/**
 * Update the lastSend field.
 */
MessageQueue.prototype.updateSendTime = function() {
  this.lastSend = (new Date()).getTime();
};

module.exports = MessageQueue;
