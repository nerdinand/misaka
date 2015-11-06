import path = require('path');
import winston = require('winston');

class Logger {
  private enabled: any;

  private console: winston.LoggerInstance;
  private errors: winston.LoggerInstance;
  private detection: any;

  constructor() {
    this.initWinston();

    this.enabled = {
      detection: false
    };
  }

  /**
   * Get the default name for a logfile path.
   * @param name Name of log file
   * @return file path
   */
  logPath(name: string): string {
    return path.join(__dirname, '..', 'logs', name + '.log');
  }

  /**
   * Initialize our winston loggers.
   */
  initWinston() {
    // Default console logger
    this.console = new winston.Logger({
      transports: [
        new (winston.transports.Console)({
          colorize: true,
          label: 'misaka',
          timestamp: true
        })
      ]
    });

    // Error logger
    this.errors = new winston.Logger({
      transports: [
        new (winston.transports.File)({
          filename: this.logPath('error')
        })
      ]
    });

    // Loggers for detection module
    this.detection = {
      // Logger for html gotten from mod_detection.
      html: new winston.Logger({
        transports: [
          new (winston.transports.File)({
            filename: this.logPath('detection_html'),
            json: false,
            timestamp: true
          })
        ]
      }),

      // Log every state check
      state: new winston.Logger({
        transports: [
          new (winston.transports.File)({
            filename: this.logPath('detection_state')
          })
        ]
      })
    };
  }

  logError(err: Error) {
    this.errors.error(err.toString());
  }

  /**
   * Set whether or not to log detection stuff.
   * @param en true if enable, false if disable
   */
  enableDetection(en: boolean) {
    this.enabled.detection = en;
  }

  logDetectionState(isInitial: boolean, channel: string, state: any) {
    if(this.enabled.detection) {
      this.detection.state.info('fetched state', { isInitial: isInitial, channel: channel, state: state });
    }
  }

  logDetectionStateChange(state: any, diffString: any) {
    if(this.enabled.detection) {
      this.detection.state.info('state change detected', { diff: diffString, state: state });
    }
  }

  logDetectionHtml(page: string, html: string) {
    if(this.enabled.detection) {
      this.detection.html.info(html, { page: page });
    }
  }

  log(...args: any[]) {
    this.console.log.apply(this.console, args);
  }

  info(...args: any[]) {
    this.console.info.apply(this.console, args);
  }

  warn(...args: any[]) {
    this.console.warn.apply(this.console, args);
  }

  error(...args: any[]) {
    this.console.error.apply(this.console, args);
  }

  /**
   * Set the logging level of the console logger.
   * @param lvl Logging level
   */
  setLevel(lvl: string) {
    // Todo: Fix this for typescript?
    //this.console.transports.console.level = lvl;
  }
}

var singleton: Logger = new Logger();
export default singleton;
