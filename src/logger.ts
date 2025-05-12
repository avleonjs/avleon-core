import pino from 'pino';
import { AppService } from './decorators';

@AppService
export class LoggerService {
  private logger: pino.Logger;

  constructor() {
    this.logger = pino({
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    });
  }

  getLogger(): pino.Logger {
    return this.logger;
  }

  info(message: string, obj?: any): void {
    if (obj) {
      this.logger.info(obj, message);
    } else {
      this.logger.info(message);
    }
  }

  error(message: string, obj?: any): void {
    if (obj) {
      this.logger.error(obj, message);
    } else {
      this.logger.error(message);
    }
  }

  warn(message: string, obj?: any): void {
    if (obj) {
      this.logger.warn(obj, message);
    } else {
      this.logger.warn(message);
    }
  }

  debug(message: string, obj?: any): void {
    if (obj) {
      this.logger.debug(obj, message);
    } else {
      this.logger.debug(message);
    }
  }

  fatal(message: string, obj?: any): void {
    if (obj) {
      this.logger.fatal(obj, message);
    } else {
      this.logger.fatal(message);
    }
  }

  trace(message: string, obj?: any): void {
    if (obj) {
      this.logger.trace(obj, message);
    } else {
      this.logger.trace(message);
    }
  }
}
