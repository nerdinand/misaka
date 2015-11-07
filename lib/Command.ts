var _ = require('underscore');

import { Module } from './Module';

export class Command {
  private parent: Module;
  private info: any;
  private enabled: boolean;
  private users: any;
  private defaultCooldown: number;

  constructor(info: Object) {
    this.parent = undefined; // May or may not have a module
    this.info = info;
    this.enabled = true;

    this.users = {}; // Store users for cooldown tracking
    this.defaultCooldown = 10000;
  };

  name(): string {
    return this.info.name;
  }

  module(): Module {
    return this.parent;
  }

  /**
   * Get the cooldown for this command (per user) in milliseconds.
   * @return cooldown in milliseconds
   */
  cooldown(): number {
    var c = this.info.cooldown;

    // If false, use zero
    if(c === false) {
      return 0;
    }

    // If a positive number, use that
    if(_.isNumber(c) && c > 0) {
      return c;
    }

    // Otherwise use default
    return this.defaultCooldown;
  }

  /**
   * Whether or not this command is enabled.
   */
  isEnabled(): boolean {
    return this.enabled && (this.module() ? this.module().isEnabled() : true);
  }

  /**
   * Whether or not this command is master-only by default.
   * @return true if master-only, false otherwise
   */
  isMasterOnly(): boolean {
    return this.info.master === true || (this.module() ? this.module().isMasterOnly() : false);
  }

  /**
   * Gets the full command name. This factors in the module name
   * if this command was loaded from a module.
   * @return Full command name
   */
  getFullName(): string {
    if(this.module()) {
      return this.module().name() + '.' + this.name();
    }
    else {
      return this.name();
    }
  }

  /**
   * Create a command from command info presented by a module.
   * @param module Module in which cmdinfo was found
   * @param cmdinfo Command info
   * @return Command
   */
  static fromInfo(module: Module, cmdinfo: Object): Command {
    var command: Command = new Command(cmdinfo);
    command.parent = module;
    return command;
  }

  /**
   * @Deprecated?
   * Get an array of commands from a module, as a module may
   * provide any number of commands.
   * @param module Module to get commands from
   * @return Array of commands, or an empty array if none
   */
  static getAllFromModule(module: any): Command[] {
    var commands: Command[] = [];

    if(module === undefined || module.info === undefined) {
      return undefined;
    }

    var info = module.info;
    var infocmds = [];

    // May have 'command' for one command, or 'commands' for an array of commands
    if(info.command !== undefined) {
      infocmds.push(info.command);
    } else if(info.commands !== undefined && info.commands instanceof Array) {
      infocmds = info.commands;
    }

    infocmds.forEach(function(c) {
      var command = Command.fromInfo(module, c);
      if(command) {
        commands.push(command);
      }
    });

    return commands;
  }

  execute(data: any) {
    return this.info.callback(data);
  }

  /**
   * Mark that this command has just been used by a user,
   * and should be factored into cooldown.
   * @param username Username of user who just used the command
   */
  used(username: string) {
    this.users[username] = (new Date()).getTime();
  }

  /**
   * Whether or not a user can use this command.
   * @param user Username to check for
   * @return true if the command can be used, false if not
   */
  canBeUsed(username: string): boolean {
    // For now just check cooldown
    var timestamp = this.users[username],
        cooldown = this.cooldown(), now = (new Date()).getTime();
    if(timestamp === undefined || cooldown === 0) {
      return true;
    } else {
      return ((timestamp + cooldown) < now);
    }
  }
}
