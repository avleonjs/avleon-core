/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */

import { Service } from "typedi";
import {
  SCHEDULED_TASK_META_KEY,
  CRON_META_KEY,
  INTERVAL_META_KEY,
  TIMEOUT_META_KEY,
  CronOptions,
  BaseJobOptions,
  CronJobMeta,
  IntervalJobMeta,
  TimeoutJobMeta,
  registerTask,
} from "./schedule-registry";

/**
 * Append job metadata to the class's *own* list. The list is copied, never
 * mutated, so a subclass never writes into its parent's jobs; the scheduler
 * merges the lists up the inheritance chain when it starts.
 */
function addJobMeta<T>(key: symbol, target: Function, meta: T): void {
  const own: T[] = Reflect.getOwnMetadata(key, target) ?? [];
  Reflect.defineMetadata(key, [...own, meta], target);
}

// ─── Class decorator ──────────────────────────────────────────────────────────

/**
 * Marks a class as a scheduled-task container.
 * All methods decorated with @Cron, @Interval, or @Timeout inside this class
 * will be automatically discovered and started when the application boots.
 *
 * The class is registered with typedi so constructor injection works normally.
 *
 * @example
 * @ScheduledTask()
 * export class ReportTask {
 *   constructor(private readonly reportService: ReportService) {}
 *
 *   @Cron("0 8 * * *", { timezone: "Asia/Dhaka" })
 *   async sendDailyReport() { ... }
 * }
 */
export function ScheduledTask(): ClassDecorator {
  return function (target: Function) {
    Reflect.defineMetadata(SCHEDULED_TASK_META_KEY, true, target);
    registerTask(target);
    Service()(target as any);
  };
}

// ─── Method decorators ────────────────────────────────────────────────────────

/**
 * Schedules the method on a cron expression.
 * Internally uses node-cron, so any expression valid there is valid here.
 *
 * @param expression  Standard 5- or 6-field cron string, e.g. "0 * * * *"
 * @param options     Optional timezone, runOnInit, name, disabled flags
 *
 * @example
 * @Cron("0 0 * * *")                          // midnight every day
 * @Cron("*\/5 * * * *", { name: "poll" })      // every 5 min, named
 * @Cron("0 8 * * 1-5", { timezone: "Asia/Dhaka", runOnInit: true })
 */
export function Cron(
  expression: string,
  options?: CronOptions,
): MethodDecorator {
  return function (target: Object, propertyKey: string | symbol) {
    addJobMeta<CronJobMeta>(CRON_META_KEY, target.constructor, {
      type: "cron",
      expression,
      methodName: propertyKey as string,
      options,
    });
  };
}

/**
 * Calls the method repeatedly on a fixed millisecond interval via setInterval.
 *
 * @param ms       Delay between calls in milliseconds
 * @param options  Optional name / disabled flag
 *
 * @example
 * @Interval(30_000)                // every 30 seconds
 * @Interval(5000, { name: "heartbeat" })
 */
export function Interval(
  ms: number,
  options?: BaseJobOptions,
): MethodDecorator {
  return function (target: Object, propertyKey: string | symbol) {
    addJobMeta<IntervalJobMeta>(INTERVAL_META_KEY, target.constructor, {
      type: "interval",
      ms,
      methodName: propertyKey as string,
      options,
    });
  };
}

/**
 * Calls the method once after a delay via setTimeout.
 * Good for warm-up jobs or deferred one-time tasks on startup.
 * The handle is still tracked so it can be cancelled on early shutdown.
 *
 * @param ms       Delay in milliseconds before the method is called
 * @param options  Optional name / disabled flag
 *
 * @example
 * @Timeout(5000)                   // fires once, 5 s after app starts
 * @Timeout(0, { name: "seed" })    // fires on next tick
 */
export function Timeout(ms: number, options?: BaseJobOptions): MethodDecorator {
  return function (target: Object, propertyKey: string | symbol) {
    addJobMeta<TimeoutJobMeta>(TIMEOUT_META_KEY, target.constructor, {
      type: "timeout",
      ms,
      methodName: propertyKey as string,
      options,
    });
  };
}
