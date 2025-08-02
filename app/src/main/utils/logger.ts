/**
 * Simple logger implementation for Electron main process
 * Replaces pino-based Logger which requires worker threads
 */
export class Logger {
  private module: string;

  constructor(options: { module: string }) {
    this.module = options.module;
  }

  /**
   * Log info level message
   */
  info(message: string, ...args: any[]) {
    console.log(`[${this.module}] INFO:`, message, ...args);
  }

  /**
   * Log error level message
   */
  error(message: string, ...args: any[]) {
    console.error(`[${this.module}] ERROR:`, message, ...args);
  }

  /**
   * Log warn level message
   */
  warn(message: string, ...args: any[]) {
    console.warn(`[${this.module}] WARN:`, message, ...args);
  }

  /**
   * Log debug level message
   */
  debug(message: string, ...args: any[]) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${this.module}] DEBUG:`, message, ...args);
    }
  }
}