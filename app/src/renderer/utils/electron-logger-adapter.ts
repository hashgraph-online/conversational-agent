import type { ILogger, LogLevel, LoggerOptions } from '@hashgraphonline/standards-sdk';

// Use console fallback if electron-log is not available
let electronLog: any;
try {
  electronLog = require('electron-log/renderer');
} catch (e) {
  electronLog = console;
}

/**
 * Adapter to use electron-log in the renderer process with the standards-sdk Logger interface
 */
export class ElectronRendererLoggerAdapter implements ILogger {
  private logger: any;
  private moduleContext: string;
  private level: LogLevel;

  constructor(options: LoggerOptions = {}) {
    this.moduleContext = options.module || 'renderer';
    this.level = options.level || 'info';
    
    this.logger = electronLog;
    
    // Configure log level if electronLog has transports
    if (this.logger.transports && this.logger.transports.console) {
      this.logger.transports.console.level = this.level;
    }
    
    // Disable in test environment
    if (process.env.NODE_ENV === 'test' || options.silent) {
      this.setSilent(true);
    }
  }

  private formatMessage(args: any[]): string {
    const parts: string[] = [`[${this.moduleContext}]`];
    
    args.forEach(arg => {
      if (typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean') {
        parts.push(String(arg));
      } else if (arg instanceof Error) {
        parts.push(arg.message);
        if (arg.stack) {
          parts.push('\n' + arg.stack);
        }
      } else {
        try {
          parts.push(JSON.stringify(arg, null, 2));
        } catch {
          parts.push(String(arg));
        }
      }
    });
    
    return parts.join(' ');
  }

  debug(...args: any[]): void {
    this.logger.debug(this.formatMessage(args));
  }

  info(...args: any[]): void {
    this.logger.info(this.formatMessage(args));
  }

  warn(...args: any[]): void {
    this.logger.warn(this.formatMessage(args));
  }

  error(...args: any[]): void {
    this.logger.error(this.formatMessage(args));
  }

  trace(...args: any[]): void {
    // electron-log doesn't have trace, use debug instead
    this.logger.debug('[TRACE]', this.formatMessage(args));
  }

  setLogLevel(level: LogLevel): void {
    this.level = level;
    if (this.logger.transports && this.logger.transports.console) {
      this.logger.transports.console.level = level as any;
    }
  }

  getLevel(): LogLevel {
    return this.level;
  }

  setSilent(silent: boolean): void {
    if (this.logger.transports && this.logger.transports.console) {
      if (silent) {
        this.logger.transports.console.level = false;
      } else {
        this.logger.transports.console.level = this.level;
      }
    }
  }

  setModule(module: string): void {
    this.moduleContext = module;
  }
}

/**
 * Factory function for creating ElectronRendererLoggerAdapter instances
 */
export function createElectronRendererLogger(options: LoggerOptions): ILogger {
  return new ElectronRendererLoggerAdapter(options);
}