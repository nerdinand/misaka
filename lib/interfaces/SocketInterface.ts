import events = require('events');
import fs = require('fs');
import net = require('net');
import path = require('path');

var osenv = require('osenv');
var _ = require('underscore');
_.str = require('underscore.string');

import Util from '../Util';
import logger from '../Logger';

export class SocketInterface {
  private _path: string;
  private _emitter: events.EventEmitter;
  private _sendServer: net.Server;

  constructor(socketsPath?: string) {
    socketsPath = (path.join(<string>osenv.home(), '.config', 'misaka', 'sockets'));
    this._path = socketsPath;
    this._emitter = new events.EventEmitter();

    if(this.createDirectorySync()) {
      this._initServer();
    }
  }

  /**
   * Close any open sockets, calling the callback
   * when complete.
   */
  close(callback: Function) {
    this._sendServer.close(callback);
  }

  /**
   * Try to create the socket directory.
   */
  createDirectorySync(): boolean {
    return Util.tryCreateDirectorySync(this._path);
  }

  /**
   * Get the path to the directory at which the UNIX sockets
   * are located.
   * @param {String} [filename] Specific file path relative
   *                            to the sockets directory
   * @return {String} Path to sockets directory
   */
  getPath(filename: string): string {
    var p = this._path;

    if(filename !== undefined) {
      p = path.join(p, filename);
    }

    return p;
  }

  /**
   * Get the path to the socket used for sending a message
   * to the chat.
   * @return {String} Path to send socket
   */
  getSendPath(): string {
    return this.getPath('send');
  }

  /**
   * Wrapper function for EventEmitter#on().
   */
  on(event: string, listener: Function) {
    this._emitter.on.apply(this._emitter, arguments);
  }

  /**
   * Initialize the sockets. Currently just the 'send' socket.
   */
  _initServer() {
    var emitter = this._emitter;

    // Initialize the send socket
    var sendServer = this._sendServer = net.createServer(function(c) {
      logger.log('debug', 'Server created for SocketInterface (send)');

      c.on('data', function(data) {
        var message = data.toString();
        message = _.str.trim(message);

        if(message !== '') {
          //logger.log('debug', 'Message read from SocketInterface (send)', { msg: message });
          emitter.emit('sendMsg', message);
        }
      });

      c.on('end', function() {
        logger.log('debug', 'Client disconnected from SocketInterface (send)');
      });
    });

    sendServer.listen(this.getSendPath());
  }

  /**
   * Clear (unlink) all sockets.
   */
  static clear() {
    var socketsPath = path.join(<string>osenv.home(), '.config', 'misaka', 'sockets'),
        sockets = [ 'send' ];
    sockets.forEach(function(socket) {
      var socketPath = path.join(socketsPath, socket);
      try { fs.unlinkSync(socketPath); }
      catch(err) { }
    });
  }
}

export default SocketInterface;
