// avleon.ts
import Bull, { Queue as BullQueue, Job, JobOptions } from 'bull';
import { Container, Service } from 'typedi';
import { Token } from 'typedi';


const JOBS_META = Symbol("avleon:jobs");
type JobHandler<T> = (job: Job<T>) => Promise<any>;
type JobMeta = {
  name: string;
  method: keyof any;
};

export function JobHandler(name: string) {
  return function (
    target: any,
    key: string,
    descriptor: PropertyDescriptor
  ) {
    if (!target[JOBS_META]) {
      target[JOBS_META] = [] as JobMeta[];
    }

    target[JOBS_META].push({
      name,
      method: key
    });
  };
}
export interface QueueConfig {
  name: string;
  adapter?: Bull.QueueOptions;
  handler?: (job: Job) => Promise<any>;
}

// ─── Base Class ──────────────────────────────────────────────────────────────

export abstract class AvleonQueue<T = any> {
  protected queue: BullQueue<T>;
  private _processorRegistered = false;

  constructor(name: string, adapter?: Bull.QueueOptions) {
    this.queue = new Bull<T>(name, adapter ?? {});
    // Defer handler binding so subclass is fully initialized
    setImmediate(() => {
      this._bindHandler();
      this._bindDecoratedJobs();
    });
  }

  private _bindDecoratedJobs() {
    const proto = Object.getPrototypeOf(this);
    const jobs = proto[JOBS_META] as JobMeta[] ?? [];

    for (const j of jobs) {
      const fn = (this as unknown as Record<string, JobHandler<any>>)[
        j.method as string
      ].bind(this);

      this.queue.process(j.name, fn);
    }
  }
  // ── Subclasses override this ─────────────────────────────────────────────

  handler?(job: Job<T>): Promise<any>;

  // ── Internal wiring ──────────────────────────────────────────────────────

  private _bindHandler(externalHandler?: (job: Job<T>) => Promise<any>) {
    if (this._processorRegistered) return;

    const fn = externalHandler
      ?? (typeof this.handler === 'function' ? this.handler.bind(this) : null);

    if (fn) {
      this.queue.process(fn);
      this._processorRegistered = true;
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────

  add(data: T, options?: JobOptions): Promise<Job<T>> {
    return this.queue.add(data, options);
  }

  delay(data: T, delayMs: number, options?: JobOptions): Promise<Job<T>> {
    return this.queue.add(data, { ...options, delay: delayMs });
  }

  /**
   * Manually register a processor. Throws if one is already registered.
   */
  // process(handler: (job: Job<T>) => Promise<any>, concurrency = 1): void {
  //   if (this._processorRegistered) {
  //     throw new Error(`[AvleonQueue] A processor is already registered on "${this.queue.name}"`);
  //   }
  //   this._bindHandler(handler);
  // }

  process(
    name: string,
    handler: (job: Job<T>) => Promise<any>,
    concurrency?: number
  ): void;

  process(
    name: string,
    data: T,
    delayMs?: number,
    options?: JobOptions
  ): Promise<Job<T>>;

  process(
    arg1: any,
    arg2: any,
    arg3?: any,
    arg4?: any
  ): any {

    // register named handler
    if (typeof arg2 === "function") {
      const name = arg1;
      const handler = arg2;
      const concurrency = arg3 ?? 1;

      console.log(`[AvleonQueue] start processing [${name}]`);

      this.queue.process(name, concurrency, handler.bind(this));
      return;
    }

    // dispatch named job
    const name = arg1;
    const data = arg2;
    const delayMs = arg3 ?? 0;
    const options = arg4;
    console.log(`\x1b[93;1;4m[AvleonQueue]\x1b[0m  start processing "${this.queue.name.toUpperCase()}":"${name}"`);
    if (delayMs > 0) {
      return this.queue.add(name, data, { ...options, delay: delayMs });
    }

    return this.queue.add(name, data, options);
  }

  getQueue(): BullQueue<T> {
    return this.queue;
  }

  on(event: string, listener: (...args: any[]) => void): this {
    this.queue.on(event as any, listener);
    return this;
  }

  async pause(): Promise<void> { await this.queue.pause(); }
  async resume(): Promise<void> { await this.queue.resume(); }
  async close(): Promise<void> { await this.queue.close(); }

  async getJob(jobId: string): Promise<Job<T> | null> {
    return this.queue.getJob(jobId);
  }

  async getJobs(
    types: Array<'completed' | 'waiting' | 'active' | 'delayed' | 'failed' | 'paused'>,
    start?: number,
    end?: number
  ): Promise<Job<T>[]> {
    return this.queue.getJobs(types, start, end);
  }

  async clean(
    grace: number,
    status?: 'completed' | 'wait' | 'active' | 'delayed' | 'failed'
  ): Promise<Job[]> {
    return this.queue.clean(grace, status);
  }

  dispatch<K extends string>(name: K, data: T, delay?: number) {
    return this.process(name, data, delay);
  }
}

// ─── Decorator ───────────────────────────────────────────────────────────────

export function Queue(config: QueueConfig) {
  return function <T extends new (...args: any[]) => AvleonQueue>(Base: T): T {

    // Apply @Service BEFORE we create the wrapper, so typedi sees the
    // correct class and can manage its lifecycle.
    @Service()
    class QueueClass extends Base {
      constructor(..._args: any[]) {
        // Always use decorator config — ignore any args passed directly
        super(config.name, config.adapter);

        // If the decorator itself carries a handler, wire it up
        // only if the subclass didn't define its own handler() method
        if (config.handler && typeof (this as any).handler !== 'function') {
          // Access private via cast — acceptable within the library itself
          (this as any)._bindHandler(config.handler);
        }
      }
    }

    // Preserve the original class name for debugging and typedi token lookup
    Object.defineProperty(QueueClass, 'name', {
      value: Base.name,
      writable: false,
    });

    return QueueClass as unknown as T;
  };
}