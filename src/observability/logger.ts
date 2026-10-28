import pino from "pino";
import { AppService } from "../common/decorators";

export interface LoggerConfig {
  /** Log level. Defaults to `LOG_LEVEL`, then `"info"`. */
  level?: string;
  /**
   * Pretty-print through pino-pretty. Defaults to `true` only when
   * `NODE_ENV === "development"` and pino-pretty is installed.
   */
  pretty?: boolean;
  /** Where to write JSON lines. Defaults to stdout. Ignored when `pretty`. */
  destination?: pino.DestinationStream;
}

function isPinoPrettyInstalled(): boolean {
  try {
    require.resolve("pino-pretty", { paths: [process.cwd(), __dirname] });
    return true;
  } catch {
    return false;
  }
}

/**
 * The pino options Avleon uses: structured JSON everywhere, except in
 * development (`NODE_ENV === "development"`) when pino-pretty is installed.
 */
export function buildLoggerOptions(
  config: Pick<LoggerConfig, "level" | "pretty"> = {},
  env: NodeJS.ProcessEnv = process.env,
): pino.LoggerOptions {
  const level = config.level ?? env.LOG_LEVEL ?? "info";
  const pretty =
    config.pretty ??
    (env.NODE_ENV === "development" && isPinoPrettyInstalled());

  if (!pretty) return { level };

  return {
    level,
    transport: {
      target: "pino-pretty",
      options: {
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
      },
    },
  };
}

/**
 * Application logger backed by a single shared pino instance.
 *
 * Pass the same instance to Fastify so request logs and application logs share
 * one stream and format:
 *
 * ```ts
 * Fastify({ loggerInstance: LoggerService.getPino() });
 * ```
 */
@AppService
export class LoggerService {
  private static root: pino.Logger | undefined;

  /** The shared pino instance, created on first use. */
  static getPino(): pino.Logger {
    if (!LoggerService.root) LoggerService.root = LoggerService.create();
    return LoggerService.root;
  }

  /** Replace the shared pino instance. Existing LoggerService instances keep the old one. */
  static configure(config: LoggerConfig = {}): pino.Logger {
    LoggerService.root = LoggerService.create(config);
    return LoggerService.root;
  }

  /** A child of the shared instance, e.g. `LoggerService.child({ module: "scheduler" })`. */
  static child(bindings: pino.Bindings): pino.Logger {
    return LoggerService.getPino().child(bindings);
  }

  private static create(config: LoggerConfig = {}): pino.Logger {
    const options = buildLoggerOptions(config);
    if (!options.transport && config.destination) {
      return pino(options, config.destination);
    }
    return pino(options);
  }

  private logger: pino.Logger;

  constructor() {
    this.logger = LoggerService.getPino();
  }

  getLogger(): pino.Logger {
    return this.logger;
  }

  info(message: string, obj?: any): void {
    this.write("info", message, obj);
  }

  error(message: string, obj?: any): void {
    this.write("error", message, obj);
  }

  warn(message: string, obj?: any): void {
    this.write("warn", message, obj);
  }

  debug(message: string, obj?: any): void {
    this.write("debug", message, obj);
  }

  fatal(message: string, obj?: any): void {
    this.write("fatal", message, obj);
  }

  trace(message: string, obj?: any): void {
    this.write("trace", message, obj);
  }

  private write(level: pino.Level, message: string, obj?: any) {
    if (obj === undefined || obj === null) {
      this.logger[level](message);
    } else if (obj instanceof Error) {
      this.logger[level]({ err: obj }, message);
    } else if (typeof obj === "object") {
      this.logger[level](obj, message);
    } else {
      this.logger[level]({ value: obj }, message);
    }
  }
}
