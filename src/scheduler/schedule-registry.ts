/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */

// ─── Metadata keys ───────────────────────────────────────────────────────────

export const SCHEDULED_TASK_META_KEY = Symbol("avleon:scheduled_task");
export const CRON_META_KEY = Symbol("avleon:cron");
export const INTERVAL_META_KEY = Symbol("avleon:interval");
export const TIMEOUT_META_KEY = Symbol("avleon:timeout");

// ─── Job descriptor shapes ────────────────────────────────────────────────────

export interface CronJobMeta {
  type: "cron";
  expression: string;
  methodName: string;
  options?: CronOptions;
}

export interface IntervalJobMeta {
  type: "interval";
  ms: number;
  methodName: string;
  options?: BaseJobOptions;
}

export interface TimeoutJobMeta {
  type: "timeout";
  ms: number;
  methodName: string;
  options?: BaseJobOptions;
}

export type JobMeta = CronJobMeta | IntervalJobMeta | TimeoutJobMeta;

// ─── Decorator option types ────────────────────────────────────────────────────

export interface BaseJobOptions {
  /** Human-readable name shown in logs. Defaults to ClassName#methodName. */
  name?: string;
  /** Register the job but do not start it. Useful for feature-flag-driven jobs. */
  disabled?: boolean;
}

export interface CronOptions extends BaseJobOptions {
  /** IANA timezone string, e.g. "Asia/Dhaka". Forwarded to node-cron. */
  timezone?: string;
  /** Fire the job immediately at startup in addition to the cron schedule. */
  runOnInit?: boolean;
}

// ─── Task registry ─────────────────────────────────────────────────────────────

const taskRegistry: Function[] = [];

export function registerTask(target: Function): void {
  if (!taskRegistry.includes(target)) {
    taskRegistry.push(target);
  }
}

export function getRegisteredTasks(): Function[] {
  return [...taskRegistry];
}

export function isScheduledTask(target: Function): boolean {
  return Reflect.getMetadata(SCHEDULED_TASK_META_KEY, target) === true;
}
/**
 * Job metadata of `key` for `target`, merged from the class and its ancestors.
 * A subclass declaration for the same method and job type replaces the
 * inherited one.
 */
export function collectJobMeta<T extends JobMeta>(
  key: symbol,
  target: Function,
): T[] {
  const chain: Function[] = [];
  let current: any = target;
  while (current && current !== Function.prototype && current !== Object) {
    chain.unshift(current);
    current = Object.getPrototypeOf(current);
  }

  const merged = new Map<string, T[]>();
  for (const cls of chain) {
    const own: T[] = Reflect.getOwnMetadata(key, cls) ?? [];
    const byMethod = new Map<string, T[]>();
    for (const meta of own) {
      const list = byMethod.get(meta.methodName) ?? [];
      list.push(meta);
      byMethod.set(meta.methodName, list);
    }
    for (const [method, list] of byMethod) merged.set(method, list);
  }
  return [...merged.values()].flat();
}
