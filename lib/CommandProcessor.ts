export class CommandProcessor {
  private prefix: string;

  constructor() {
    this.prefix = '!';
  }

  isCommand(user: string, message: string): boolean {
    var s: string[] = message.split(/\s+/);
    if(s.length === 0) return false;

    return (s[0].length >= this.prefix.length &&
      s[0].substring(0, this.prefix.length) === this.prefix)
  }

  getCommandName(message: string): string {
    var s: string[] = message.split(/\s+/);
    if(s.length === 0) return;

    return s[0].substring(this.prefix.length);
  }
}

export default CommandProcessor;
