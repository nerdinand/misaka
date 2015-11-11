export interface MessageQueueOptions {
  send?: Function;
  wait?: number;
}

export class MessageQueue {
  private send: Function;
  private wait: number;
  private list: any;
  private interval: any;
  private lastSend: number;
  private started: boolean;
  private connected: boolean;

  constructor(opts?: MessageQueueOptions) {
    if (!opts) opts=  {};
    this.send = opts['send'] || undefined;
    this.wait = opts['wait'] || 1000;
    this.list = [];
    this.interval = undefined;
    this.lastSend = 0;
    this.started = false;
    this.connected = true;
  }

  setConnected(c: boolean) {
    if(c !== this.connected) {
      this.connected = c;
    }

    // Setting connected
    if(c) {
      if(this.hasMessages()) {
        this.start();
      }
    } else { // Setting disconnected
      if(this.started) {
        this.stop();
      }
    }
  }

  /**
   * Whether or not this queue is connected.
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get the time to wait before starting the next interval.
   * This basically checks lastSend against the current time,
   * and compares with wait.
   * @return amount of time to wait, 0 if none
   */
  getTimeToWait(): number {
    var now = (new Date()).getTime();
    var diff = now - this.lastSend;

    if(diff >= this.wait) {
      return 0;
    } else {
      return (this.wait - diff);
    }
  }

  /**
   * Whether or not this queue has messages waiting to
   * be sent.
   * @return true if messages waiting, false if empty
   */
  hasMessages(): boolean {
    return (this.list.length > 0);
  }

  /**
   * Push a message to the end of the queue, and start
   * the queue if not already started.
   * @param message Message to enqueue
   */
  push(message: any) {
    this.list.push(message);
    if(this.isConnected()) {
      this.start();
    }
  }

  /**
   * Send the next message in the queue and remove it
   * from the waiting list.
   * If this.send isn't defined or isn't a Function,
   * the next message will just be removed.
   */
  sendNext() {
    var message = this.list.shift();
    if(this.send != null) {
      this.send(message);
    }
  }

  /**
   * Start the queue interval (if not already started).
   */
  start() {
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
  }

  /**
   * Stop the queue interval.
   */
  stop() {
    clearInterval(this.interval);
    this.interval = undefined;
    this.started = false;
  }

  /**
   * Update the lastSend field.
   */
  updateSendTime() {
    this.lastSend = (new Date()).getTime();
  }
}

export default MessageQueue;
