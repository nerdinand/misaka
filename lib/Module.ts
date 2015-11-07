import events = require('events');
var _ = require('underscore');

import { Command } from './Command';

/**
 * Construct a module from whatever was exported by a module
 * file in module.exports.
 */
export class Module {
  private manager: any;
  private export: any;
  private enabled: boolean;
  private emitter: events.EventEmitter;

  constructor(manager: any, M: any) {
    this.manager = manager;
    this.export = new M();
    this.enabled = true;
    this.initEvents();
  }

  /**
   * Initialize the event emitter using the callbacks in the module's info.callbacks.
   */
  initEvents() {
    this.emitter = new events.EventEmitter();

    var callbacks = this.export.info.callbacks;
    for(var name in callbacks) {
      var callback = callbacks[name];
      this.on(name, callback);
    }
  }

  info(): any {
    return this.export.info;
  }

  /**
   * Get the base module instance.
   * @return {Object} instance of exported module
   */
  base(): any {
    return this.export;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get all the command names provided by this module.
   * @return array of names, or empty array if none
   */
  getCommandNames(): string[] {
    var list: string[] = [], commands = this.commands();
    commands.forEach(function(info) {
      if(info && info.name !== undefined) {
        list.push(<string>info.name);
      }
    });
    return list;
  }

  /**
   * Get the parent module manager.
   * @return {ModuleManager} parent module manager
   */
  getModuleManager(): any {
    return this.manager;
  }

  /**
   * Get the array of command metadata this module provides via info.
   * This will always return an array, even if the module provides
   * no commands.
   * @return array of command metadata, an empty array if no commands
   */
  commands(): any[] {
    var cmds: any[] = [], info = this.export.info;

    if(info.command) {
      cmds.push(info.command);
    }

    if(info.commands && info.commands instanceof Array) {
      info.commands.forEach(function(cmd) {
        cmds.push(cmd);
      });
    }

    return cmds;
  }

  /**
   * Get this module's description.
   * @return module description
   */
  description(): string {
    return this.export.info.description;
  }

  /**
   * Get this module's name.
   * @return module name
   */
  name(): string {
    return this.export.info.name;
  }

  /**
   * A module isn't considered master-only unless specifically set
   * to true in info.
   * @return true if master-only, false if not
   */
  isMasterOnly(): boolean {
    return this.export.info.master === true;
  }

  /**
   * A module isn't considered unloadable unless specifically declared.
   * This will probably be reserved for the 'Module' module.
   * @return true if unloadable, false if not unloadable
   */
  isUnloadable(): boolean {
    return this.export.info.unloadable !== false;
  }

  getCallback(name: string): Function {
    if(this.export.info.callbacks) {
      return <Function>this.export.info.callbacks[name];
    } else {
      return null;
    }
  }

  /**
   * Get the chat versions this module supports.
   * @return chat version numbers in an array
   */
  getSupportedVersions(): number[] {
    var versions = this.export.info.chatVersions;
    if(_.isNumber(versions)) {
      return [<number>versions];
    } else if(_.isArray(versions)) {
      // Assume Number array for now
      return <number[]>versions;
    } else {
      // If nothing specified, assume 6 and 7
      return [ 6, 7 ];
    }
  }

  /**
   * Check if a specific chat version is supported by this module.
   * @param version Version number to check
   * @return true if supported, false if not supported
   */
  isVersionSupported(version: number): boolean {
    return this.getSupportedVersions().indexOf(version) >= 0;
  }

  /**
   * Wrapper method for this.emitter.on.
   */
  on(event: string, listener: Function): Module {
    this.emitter.on(event, listener);
    return this;
  }

  /**
   * Wrapper method for this.emitter.emit.
   */
  emit(event: string, ...args: any[]): boolean {
    return this.emitter.emit(event, args);
  }
}
