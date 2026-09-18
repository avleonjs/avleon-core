/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
import type {
  Queue as BullQueue,
  Worker as BullWorker,
  Job,
  JobsOptions,
  QueueOptions,
  WorkerOptions,
  ConnectionOptions,
} from "bullmq";
import { Service } from "typedi";
import { loadPackageFromClient } from "../common/utils/common-utils";

export type { Job, JobsOptions };

/**
 * Metadata key for `@JobHandler`. Stored on the prototype that declares the
 * method, then collected across the whole prototype chain so that handlers
 * declared on a base class are inherited by subclasses.
 */
const JOBS_META = Symbol.for("avleon:jobs");

type JobMeta = {
  /** Named job this method processes. */
  name: string;
  /** Method on the queue class that handles it. */
  method: string;
};

/**
 * Mark a method as the processor for a named job.
 *
 * ```ts
 * @Queue({ name: "email" })
 * class EmailQueue extends AvleonQueue<EmailPayload> {
 *   @JobHandler("welcome")
 *   async sendWelcome(job: Job<EmailPayload>) { ... }
 * }
 * ```
 */
export function JobHandler(name: string): MethodDecorator {
  return function (target: any, key: string | symbol) {
    // Own-property check: without it, `jobs` would resolve through the
    // prototype chain and a subclass would append into its parent's array.
    if (!Object.prototype.hasOwnProperty.call(target, JOBS_META)) {
      Object.defineProperty(target, JOBS_META, {
        value: [] as JobMeta[],
        enumerable: false,
        configurable: true,
        writable: true,
      });
    }
    (target[JOBS_META] as JobMeta[]).push({ name, method: String(key) });
  };
}

/** Collect `@JobHandler` metadata across the full prototype chain. */
function collectJobMeta(instance: object): JobMeta[] {
  const seen = new Map<string, JobMeta>();
  let proto = Object.getPrototypeOf(instance);

  while (proto && proto !== Object.prototype) {
    if (Object.prototype.hasOwnProperty.call(proto, JOBS_META)) {
      for (const meta of proto[JOBS_META] as JobMeta[]) {
        // Nearest definition wins, so a subclass can override a base handler.
        if (!seen.has(meta.name)) seen.set(meta.name, meta);
      }
    }
    proto = Object.getPrototypeOf(proto);
  }

  return [...seen.values()];
}

export interface QueueConfig {
  /** Queue name, as it appears in Redis. */
  name: string;
  /** BullMQ queue options, including the Redis `connection`. */
  adapter?: QueueOptions;
  /** Options for the worker that processes this queue. */
  worker?: Omit<WorkerOptions, "connection">;
  /** Fallback processor used when the class defines no `handler`/`@JobHandler`. */
  handler?: (job: Job) => Promise<any>;
}

// ─── Base Class ──────────────────────────────────────────────────────────────

/**
 * Base class for a BullMQ-backed queue.
 *
 * A subclass both *produces* jobs (`add`, `dispatch`) and *consumes* them, via
 * either a single `handler` method or several `@JobHandler("name")` methods.
 * The worker starts lazily on `startWorker()`, which `@Queue` calls for you.
 *
 * bullmq is an optional peer dependency: it is required only when a queue is
 * actually constructed, so importing `@avleon/core` never pulls it in.
 */
export abstract class AvleonQueue<T = any> {
  protected queue: BullQueue<T, any, string>;
  protected worker?: BullWorker<T, any, string>;

  private readonly _name: string;
  private readonly _connection?: ConnectionOptions;
  private readonly _workerOptions: Omit<WorkerOptions, "connection">;
  private _fallbackHandler?: (job: Job<T>) => Promise<any>;

  constructor(
    name?: string,
    adapter?: QueueOptions,
    workerOptions?: Omit<WorkerOptions, "connection">,
  ) {
    // `name` is optional so that a @Queue-decorated subclass, whose name comes
    // from the decorator config, can be constructed with no arguments.
    if (!name) {
      throw new Error(
        "[AvleonQueue] A queue name is required. Pass one to super(), or decorate the class with @Queue({ name }).",
      );
    }

    const { Queue: BullMQQueue } =
      loadPackageFromClient<typeof import("bullmq")>("bullmq");

    this._name = name;
    this._connection = adapter?.connection;
    this._workerOptions = workerOptions ?? {};
    this.queue = new BullMQQueue<T, any, string>(name, adapter as QueueOptions);
  }

  /** Subclasses may override this to process every job on the queue. */
  handler?(job: Job<T>): Promise<any>;

  /** @internal Used by `@Queue` to supply a processor from the decorator config. */
  protected _setFallbackHandler(fn: (job: Job<T>) => Promise<any>) {
    this._fallbackHandler = fn;
  }

  // ── Worker ───────────────────────────────────────────────────────────────

  /**
   * Start the worker that consumes this queue.
   *
   * Dispatches by job name to `@JobHandler` methods, falling back to `handler`
   * (or the decorator's handler) for unnamed or unmatched jobs. Calling this
   * more than once is a no-op.
   */
  startWorker(): this {
    if (this.worker) return this;

    const jobs = collectJobMeta(this);
    const named = new Map<string, (job: Job<T>) => Promise<any>>();

    for (const meta of jobs) {
      const fn = (this as any)[meta.method];
      if (typeof fn !== "function") {
        throw new Error(
          `[AvleonQueue] @JobHandler("${meta.name}") refers to "${meta.method}", which is not a method on ${this.constructor.name}.`,
        );
      }
      named.set(meta.name, fn.bind(this));
    }

    const fallback =
      (typeof this.handler === "function" ? this.handler.bind(this) : undefined) ??
      this._fallbackHandler;

    // Nothing to process — stay a producer-only queue rather than spawning an
    // idle worker that would hold a Redis connection open.
    if (named.size === 0 && !fallback) return this;

    const { Worker } = loadPackageFromClient<typeof import("bullmq")>("bullmq");

    this.worker = new Worker<T, any, string>(
      this._name,
      async (job: Job<T>) => {
        const handler = named.get(job.name) ?? fallback;
        if (!handler) {
          throw new Error(
            `[AvleonQueue] No handler registered for job "${job.name}" on queue "${this._name}".`,
          );
        }
        return handler(job);
      },
      { ...this._workerOptions, connection: this._connection } as WorkerOptions,
    );

    return this;
  }

  // ── Producing jobs ───────────────────────────────────────────────────────

  /** Add a job to the queue. */
  add(data: T, options?: JobsOptions): Promise<Job<T>>;
  /** Add a named job, routed to the matching `@JobHandler`. */
  add(name: string, data: T, options?: JobsOptions): Promise<Job<T>>;
  add(arg1: any, arg2?: any, arg3?: any): Promise<Job<T>> {
    // BullMQ resolves its data/name types through conditional helpers that do
    // not simplify against an unresolved generic, so the call is cast here.
    const q = this.queue as any;
    if (typeof arg1 === "string") {
      return q.add(arg1, arg2, arg3);
    }
    return q.add(this._name, arg1, arg2);
  }

  /** Add a job to run after `delayMs` milliseconds. */
  delay(data: T, delayMs: number, options?: JobsOptions): Promise<Job<T>>;
  delay(name: string, data: T, delayMs: number, options?: JobsOptions): Promise<Job<T>>;
  delay(arg1: any, arg2: any, arg3?: any, arg4?: any): Promise<Job<T>> {
    const q = this.queue as any;
    if (typeof arg1 === "string") {
      return q.add(arg1, arg2, { ...(arg4 as JobsOptions), delay: arg3 as number });
    }
    return q.add(this._name, arg1, { ...(arg3 as JobsOptions), delay: arg2 as number });
  }

  /**
   * Dispatch a named job.
   *
   * ```ts
   * emailQueue.dispatch("welcome", { userId: 1 });
   * emailQueue.dispatch("welcome", { userId: 1 }, 5000); // in 5s
   * ```
   */
  dispatch(name: string, data: T, delayMs?: number, options?: JobsOptions): Promise<Job<T>> {
    const q = this.queue as any;
    return delayMs && delayMs > 0
      ? q.add(name, data, { ...options, delay: delayMs })
      : q.add(name, data, options);
  }

  // ── Introspection and lifecycle ──────────────────────────────────────────

  /** The underlying BullMQ queue. */
  getQueue(): BullQueue<T, any, string> {
    return this.queue;
  }

  /** The worker, once `startWorker()` has run. */
  getWorker(): BullWorker<T, any, string> | undefined {
    return this.worker;
  }

  /** Subscribe to worker events (`completed`, `failed`, `error`, …). */
  on(event: string, listener: (...args: any[]) => void): this {
    if (!this.worker) {
      throw new Error(
        `[AvleonQueue] Cannot listen for "${event}" before the worker has started. Call startWorker() first.`,
      );
    }
    this.worker.on(event as any, listener as any);
    return this;
  }

  async getJob(jobId: string): Promise<Job<T> | undefined> {
    return this.queue.getJob(jobId);
  }

  async getJobs(
    types: Array<"completed" | "waiting" | "active" | "delayed" | "failed" | "paused">,
    start?: number,
    end?: number,
  ): Promise<Job<T>[]> {
    return this.queue.getJobs(types, start, end);
  }

  async clean(
    grace: number,
    limit = 1000,
    status: "completed" | "wait" | "active" | "delayed" | "failed" | "paused" = "completed",
  ): Promise<string[]> {
    return this.queue.clean(grace, limit, status as any);
  }

  async pause(): Promise<void> {
    await this.queue.pause();
  }

  async resume(): Promise<void> {
    await this.queue.resume();
  }

  /** Close the worker and the queue, releasing their Redis connections. */
  async close(): Promise<void> {
    await this.worker?.close();
    await this.queue.close();
  }
}

// ─── Decorator ───────────────────────────────────────────────────────────────

/**
 * Register a queue class with the DI container and start its worker.
 *
 * ```ts
 * @Queue({ name: "email", adapter: { connection: { host: "localhost" } } })
 * class EmailQueue extends AvleonQueue<EmailPayload> {
 *   @JobHandler("welcome")
 *   async welcome(job: Job<EmailPayload>) { ... }
 * }
 * ```
 */
export function Queue(config: QueueConfig) {
  return function <T extends new (...args: any[]) => AvleonQueue>(Base: T): T {
    @Service()
    class QueueClass extends Base {
      constructor(..._args: any[]) {
        super(config.name, config.adapter, config.worker);

        if (config.handler) {
          (this as any)._setFallbackHandler(config.handler);
        }

        (this as any).startWorker();
      }
    }

    // Preserve the original class name for debugging and typedi token lookup.
    Object.defineProperty(QueueClass, "name", {
      value: Base.name,
      writable: false,
    });

    return QueueClass as unknown as T;
  };
}
