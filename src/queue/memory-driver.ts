/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
import { EventEmitter } from "node:events";
import { internalLogger } from "../observability/internal-logger";

const logger = internalLogger("queue");

/**
 * Which backend queues and workers use.
 *
 * - `"bullmq"`: Redis through BullMQ (the default).
 * - `"memory"`: in-process; jobs run asynchronously on a later tick and
 *   `delay` is honoured. For tests and local development.
 * - `"sync"`: in-process; `add()` runs the job before it resolves and
 *   ignores `delay`. For tests.
 */
export type QueueDriver = "bullmq" | "memory" | "sync";

const DRIVERS: QueueDriver[] = ["bullmq", "memory", "sync"];

let globalDriver: QueueDriver | undefined;

/**
 * Set the driver for queues and workers created afterwards, overriding the
 * `AVLEON_QUEUE_DRIVER` environment variable. Pass `undefined` to reset.
 */
export function setQueueDriver(driver: QueueDriver | undefined): void {
  if (driver !== undefined && !DRIVERS.includes(driver)) {
    throw new Error(
      `[Avleon] Unknown queue driver "${driver}". Use one of: ${DRIVERS.join(", ")}.`,
    );
  }
  globalDriver = driver;
}

/** Resolve the driver: explicit option, then `setQueueDriver`, then `AVLEON_QUEUE_DRIVER`, then `"bullmq"`. */
export function resolveQueueDriver(explicit?: QueueDriver): QueueDriver {
  const fromEnv = process.env.AVLEON_QUEUE_DRIVER as QueueDriver | undefined;
  const driver = explicit ?? globalDriver ?? (fromEnv || undefined) ?? "bullmq";
  if (!DRIVERS.includes(driver)) {
    throw new Error(
      `[Avleon] Unknown queue driver "${driver}" (from AVLEON_QUEUE_DRIVER). Use one of: ${DRIVERS.join(", ")}.`,
    );
  }
  return driver;
}

// ─── In-memory job ───────────────────────────────────────────────────────────

export type MemoryJobState =
  | "waiting"
  | "delayed"
  | "active"
  | "completed"
  | "failed";

/** A job in the in-memory driver. Mirrors the parts of BullMQ's `Job` handlers use. */
export class MemoryJob<T = any> {
  id: string;
  name: string;
  data: T;
  opts: Record<string, any>;
  queueName: string;
  timestamp = Date.now();
  attemptsMade = 0;
  progress: unknown = 0;
  returnvalue: unknown;
  failedReason?: string;
  stacktrace: string[] = [];
  finishedOn?: number;
  state: MemoryJobState = "waiting";
  readonly logs: string[] = [];

  constructor(
    id: string,
    queueName: string,
    name: string,
    data: T,
    opts: Record<string, any> = {},
  ) {
    this.id = id;
    this.queueName = queueName;
    this.name = name;
    this.data = data;
    this.opts = opts;
  }

  async updateProgress(progress: unknown): Promise<void> {
    this.progress = progress;
  }

  async log(line: string): Promise<number> {
    this.logs.push(line);
    return this.logs.length;
  }

  async getState(): Promise<MemoryJobState> {
    return this.state;
  }
}

type Processor = (job: MemoryJob) => Promise<any>;

const MAX_FINISHED = 1000;

/** One named in-memory queue: holds jobs and runs them through its processor. */
class MemoryQueueState {
  readonly jobs = new Map<string, MemoryJob>();
  readonly waiting: MemoryJob[] = [];
  readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  readonly worker = new EventEmitter();
  processor?: Processor;
  concurrency = 1;
  paused = false;
  active = 0;
  private idleWaiters: Array<() => void> = [];

  constructor(readonly name: string) {
    // Without a listener, an "error" event would throw.
    this.worker.on("error", () => undefined);
  }

  isIdle(): boolean {
    return (
      this.active === 0 &&
      this.timers.size === 0 &&
      (this.waiting.length === 0 || !this.processor || this.paused)
    );
  }

  whenIdle(): Promise<void> {
    if (this.isIdle()) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }

  notifyIfIdle() {
    if (!this.isIdle()) return;
    const waiters = this.idleWaiters;
    this.idleWaiters = [];
    waiters.forEach((w) => w());
  }

  trimFinished() {
    const finished = [...this.jobs.values()].filter(
      (j) => j.state === "completed" || j.state === "failed",
    );
    for (const job of finished.slice(
      0,
      Math.max(0, finished.length - MAX_FINISHED),
    )) {
      this.jobs.delete(job.id);
    }
  }
}

let nextId = 1;
const queues = new Map<string, MemoryQueueState>();

function stateFor(name: string): MemoryQueueState {
  let state = queues.get(name);
  if (!state) {
    state = new MemoryQueueState(name);
    queues.set(name, state);
  }
  return state;
}

function safeEmit(state: MemoryQueueState, event: string, ...args: any[]) {
  try {
    state.worker.emit(event, ...args);
  } catch (err) {
    logger.error(
      { err, queue: state.name },
      `[Avleon Queue] "${event}" listener threw`,
    );
  }
}

async function runJob(state: MemoryQueueState, job: MemoryJob): Promise<void> {
  const processor = state.processor!;
  const attempts = Math.max(1, Number(job.opts.attempts) || 1);
  state.active++;
  job.state = "active";
  safeEmit(state, "active", job);

  try {
    while (job.attemptsMade < attempts) {
      job.attemptsMade++;
      let error: any;
      let ok = false;
      try {
        job.returnvalue = await processor(job);
        ok = true;
      } catch (err) {
        error = err;
      }

      if (ok) {
        job.state = "completed";
        job.finishedOn = Date.now();
        safeEmit(state, "completed", job, job.returnvalue);
        return;
      }

      job.failedReason = error?.message ?? String(error);
      if (error?.stack) job.stacktrace.push(error.stack);
      if (job.attemptsMade >= attempts) {
        // Failed jobs are kept (see getJobs(["failed"])) and logged.
        job.state = "failed";
        job.finishedOn = Date.now();
        logger.error(
          {
            err: error,
            queue: state.name,
            jobId: job.id,
            jobName: job.name,
            attempts: job.attemptsMade,
          },
          `[Avleon Queue] Job "${job.name}" on "${state.name}" failed`,
        );
        safeEmit(state, "failed", job, error);
      }
    }
  } finally {
    state.active--;
    state.trimFinished();
  }
}

function pump(state: MemoryQueueState): void {
  while (
    state.processor &&
    !state.paused &&
    state.waiting.length > 0 &&
    state.active < state.concurrency
  ) {
    const job = state.waiting.shift()!;
    void runJob(state, job).finally(() => pump(state));
  }
  state.notifyIfIdle();
}

function schedule(
  state: MemoryQueueState,
  job: MemoryJob,
  delayMs: number,
): void {
  if (delayMs > 0) {
    job.state = "delayed";
    const timer = setTimeout(() => {
      state.timers.delete(job.id);
      job.state = "waiting";
      state.waiting.push(job);
      pump(state);
    }, delayMs);
    state.timers.set(job.id, timer);
    return;
  }
  state.waiting.push(job);
  setImmediate(() => pump(state));
}

// ─── Queue / worker facades ──────────────────────────────────────────────────

/** In-memory stand-in for a BullMQ `Queue`, used by the `memory` and `sync` drivers. */
export class MemoryQueue<T = any> {
  constructor(
    readonly name: string,
    private readonly mode: "memory" | "sync" = "memory",
  ) {
    stateFor(name);
  }

  private get state() {
    return stateFor(this.name);
  }

  async add(
    name: string,
    data: T,
    opts: Record<string, any> = {},
  ): Promise<MemoryJob<T>> {
    const id = opts.jobId != null ? String(opts.jobId) : String(nextId++);
    const job = new MemoryJob<T>(id, this.name, name, data, opts);
    this.state.jobs.set(id, job);

    if (this.mode === "sync") {
      if (this.state.processor && !this.state.paused) {
        await runJob(this.state, job);
        this.state.notifyIfIdle();
      } else {
        this.state.waiting.push(job);
      }
      return job;
    }

    schedule(this.state, job, Number(opts.delay) || 0);
    return job;
  }

  async getJob(id: string): Promise<MemoryJob<T> | undefined> {
    return this.state.jobs.get(id) as MemoryJob<T> | undefined;
  }

  async getJobs(
    types: string[] = [],
    start = 0,
    end = -1,
  ): Promise<MemoryJob<T>[]> {
    const wanted = new Set(types.map((t) => (t === "wait" ? "waiting" : t)));
    const all = [...this.state.jobs.values()].filter(
      (j) => wanted.size === 0 || wanted.has(j.state),
    );
    return all.slice(start, end < 0 ? undefined : end + 1) as MemoryJob<T>[];
  }

  async clean(
    grace: number,
    limit = 1000,
    status = "completed",
  ): Promise<string[]> {
    const wanted = status === "wait" ? "waiting" : status;
    const cutoff = Date.now() - grace;
    const removed: string[] = [];
    for (const job of this.state.jobs.values()) {
      if (removed.length >= limit) break;
      if (job.state === wanted && (job.finishedOn ?? job.timestamp) <= cutoff) {
        this.state.jobs.delete(job.id);
        removed.push(job.id);
      }
    }
    return removed;
  }

  async pause(): Promise<void> {
    this.state.paused = true;
  }

  async resume(): Promise<void> {
    this.state.paused = false;
    pump(this.state);
  }

  /** Resolve once no job is waiting (with a processor), delayed or running. */
  whenIdle(): Promise<void> {
    return this.state.whenIdle();
  }

  async close(): Promise<void> {
    // Jobs stay in the shared in-memory state, like Redis would keep them.
  }
}

/** In-memory stand-in for a BullMQ `Worker`. */
export class MemoryWorker {
  private closed = false;
  private readonly listeners: Array<[string, (...args: any[]) => void]> = [];

  constructor(
    readonly name: string,
    processor: (job: any) => Promise<any>,
    options: { concurrency?: number } = {},
  ) {
    const state = stateFor(name);
    if (state.processor) {
      throw new Error(
        `[Avleon] Queue "${name}" already has an in-memory worker.`,
      );
    }
    state.processor = processor;
    state.concurrency = Math.max(1, Number(options.concurrency) || 1);
    setImmediate(() => pump(state));
  }

  on(event: string, listener: (...args: any[]) => void): this {
    stateFor(this.name).worker.on(event, listener);
    this.listeners.push([event, listener]);
    return this;
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    const state = stateFor(this.name);
    state.processor = undefined;
    state.notifyIfIdle();
    for (const [event, listener] of this.listeners)
      state.worker.off(event, listener);
  }
}

/** Resolve when every in-memory queue is idle. Handy in tests: `await waitForMemoryQueues()`. */
export async function waitForMemoryQueues(): Promise<void> {
  while ([...queues.values()].some((q) => !q.isIdle())) {
    await Promise.all([...queues.values()].map((q) => q.whenIdle()));
  }
}

/** Drop every in-memory queue, job and pending delayed timer. For test teardown. */
export function resetMemoryQueues(): void {
  for (const state of queues.values()) {
    for (const timer of state.timers.values()) clearTimeout(timer);
    state.timers.clear();
    state.worker.removeAllListeners();
    state.notifyIfIdle();
  }
  queues.clear();
}
