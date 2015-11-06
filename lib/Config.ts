import fs = require('fs');
import path = require('path');

var osenv = require('osenv'); // No .d.ts for osenv?
var logger = require(path.join(__dirname, 'logger'));

var DEFAULT_COLOR: string = '#000000';

export class Config {
  private obj: any;

  constructor() {
    this.obj = {};
  }

  /**
   * Check that a color matches a specific pattern.
   * @param color Color string to check
   * @return true if the color matches and is valid, false if not
   */
  checkColor(color: string): boolean {
    return (/^#[a-f0-9]{6}$/i).test(color);
  }

  /**
   * Attempt to create the default config directory, relative
   * to user's home path.
   */
  createDirectorySync() {
    var dir: string = path.join(osenv.home(), '.config', 'misaka');

    try {
      var res: fs.Stats = fs.statSync(dir);
      if(res.isDirectory()) {
        logger.log('debug', 'Config directory already exists', { path: dir });
      } else {
        logger.error('Unable to create config directory, exists but isn\'t a directory', { path: dir });
      }
    } catch(err) {
      // Nothing exists, try to create
      try {
        fs.mkdirSync(dir);
        logger.log('debug', 'Config directory created', { path: dir });
      } catch(err) {
        logger.error(err, { msg: 'Attempt to create config directory failed', path: dir });
      }
    }
  }

  /**
   * Set this config instance from a loaded JSON object.
   * @param obj Loaded JSON object
   */
  setFrom(obj: Object) {
    this.obj = obj;
    /*
    if(obj.authkey !== undefined) this.authkey = obj.authkey;
    if(obj.color !== undefined) this.color = obj.color;
    if(obj.username !== undefined) this.username = obj.username;
    if(obj.password !== undefined) this.password = obj.password;
    if(obj.room !== undefined) this.room = obj.room;
    if(obj.master !== undefined) this.master = obj.master;
    if(obj.logging !== undefined) this.logging = obj.logging;
    if(obj.modules !== undefined) this.modules = obj.modules;
    */
  }

  getUsername(): string {
    return this.getIfString(this.obj.username);
  }

  getPassword(): string {
    return this.getIfString(this.obj.password);
  }

  getAuthkey(): string {
    return this.getIfString(this.obj.authkey);
  }

  /**
   * Get the sqlite3 database file path.
   * @return {String} Database file path, or undefined if none
   */
  getDbPath(): string {
    return this.getIfString(this.obj.dbPath);
  }

  /**
   * Get the database config object.
   * @return {Object} Database configuration object
   */
  getDb(): Object {
    return this.obj.database || {};
  }

  /**
   * Get the auth token (same as authkey, but used for V7 chat).
   * @return auth token
   */
  getAuthToken(): string {
    return this.getIfString(this.obj.authToken);
  }

  getMaster(): string {
    return this.getIfString(this.obj.master);
  }

  getDescription(): string {
    return this.getIfString(this.obj.description);
  }

  /**
   * Get the main channel (room) name.
   * @return {String} Channel name, or undefined if none found
   */
  getChannel(): string {
    var channels: string[] = this.getRooms();
    if(channels.length > 0) {
      return channels[0];
    }
  }

  /**
   * Get the rooms to join as specified. Currently only gets
   * one room ("room").
   * @return array of rooms to join, or an empty array if none
   */
  getRooms(): string[] {
    var room: string = this.getIfString(this.obj.room);
    if(room !== undefined) {
      return [room];
    } else {
      return [];
    }
  }

  /**
   * Get the color.
   * @return color as a string, or DEFAULT_COLOR if bad color
   *         format or none found.
   */
  getColor(): string {
    var color: string = this.getIfString(this.obj.color);
    // Return default color if bad format
    if(!color || !this.checkColor(color)) {
      return DEFAULT_COLOR;
    }
    return color;
  }

  /**
   * Get the config object for a specific module.
   * @param name Name of module
   * @return config object for specified module, or undefined if none
   */
  getModuleConfig(name: string): Object {
    if(this.obj.modules && this.obj.modules[name]
    && (this.obj.modules[name] instanceof Object)) {
      return this.obj.modules[name];
    }
  }

  /**
   * Set the room.
   * @param room Room name
   */
  setRoom(room: string) {
    if(room != null) {
      this.obj.room = room;
    }
  }

  /**
   * Return parameter if it is a string.
   * @param o What to return if a string
   * @return o if o is a string, otherwise undefined
   */
  getIfString(o: any): string {
    if(o instanceof String) return <string>o;
  }

  /**
   * Read a configuration JSON file.
   * @param path Filepath to open
   * @param callback Callback
   */
  read(path: string, callback: Function) {
    var config: Config = this;
    fs.readFile(path, 'utf-8', function(err, data) {
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
  }

  /**
   * Read a configuration JSON file synchronously.
   * @param path Filepath to open
   * @return true if successful, false if error reading file
   */
  readSync(path: string): boolean {
    var data = fs.readFileSync(path, 'utf-8');
    if(!data) {
      return false;
    }

    var obj: Object = JSON.parse(data);
    this.setFrom(obj);
    return true;
  }

  static getUserHome(): string {
    var result: any = null,
        results: any[] = [process.env.HOME, process.env.HOMEPATH, process.env.USERPROFILE];
    results.some(function(element, i) {
      if (element != null) result = element;
      return element != null;
    });
    return <string>result;
  }

  /**
   * Get the default path to the config directory for a specific user.
   * @return path to default directory
   */
  static getDefaultDirectory(): string {
    return path.join(Config.getUserHome(), '.config', 'misaka');
  }

  /**
   * Get the default path of a config file.
   * @param name Filename ('.json' will be appended if not already)
   * @return path to config file
   */
  static getDefaultPath(name: string): string {
    var dirpath: string = Config.getDefaultDirectory();
    // if(!_(name).endsWith('.json')) name = (name + '.json');
    if(name.indexOf('.json') === -1) name = (name + '.json');
    return path.join(dirpath, name);
  }
}
