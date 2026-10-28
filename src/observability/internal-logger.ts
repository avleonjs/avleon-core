import type pino from "pino";
import { LoggerService } from "./logger";

/**
 * Framework-internal logger for a module. Not part of the public API.
 *
 * Each call resolves a child of the current shared pino instance, so
 * `LoggerService.configure()` takes effect for framework logs too.
 */
export function internalLogger(
  module: string,
): Pick<pino.Logger, "info" | "warn" | "error" | "debug"> {
  const get = () => LoggerService.child({ module });
  return {
    info: (...args: any[]) => (get().info as any)(...args),
    warn: (...args: any[]) => (get().warn as any)(...args),
    error: (...args: any[]) => (get().error as any)(...args),
    debug: (...args: any[]) => (get().debug as any)(...args),
  } as any;
}
