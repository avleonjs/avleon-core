/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
import type { Job, Worker as BullWorker, WorkerOptions, ConnectionOptions } from "bullmq";
import Container, { Service } from "typedi";
import { loadPackageFromClient } from "../common/utils/common-utils";

export interface WorkerConfig {
  /** Name of the queue this worker consumes. */
  queue: string;
  /** Redis connection. Falls back to BullMQ's default when omitted. */
  connection?: ConnectionOptions;
  /** How many jobs this worker processes at once. */
  concurrency?: number;
  /** Any other BullMQ worker option. */
  options?: Omit<WorkerOptions, "connection" | "concurrency">;
  /** Start the worker as soon as the class is resolved. Defaults to `true`. */
  autoStart?: boolean;
}

const WORKER_CONFIG = Symbol.for("avleon:worker:config");

/**
 * Base class for a standalone queue worker.
 *
 * Use this when the consumer lives apart from the producer — a separate worker
 * process, say. For a queue that produces and consumes in one place, prefer
 * `AvleonQueue` with `@JobHandler`.
 *
 * ```ts
 * @AvleonWorker({ queue: "email", concurrency: 5 })
 * class EmailWorker extends AvleonWorkerBase<EmailPayload> {
 *   async process(job: Job<EmailPayload>) {
 *     await sendMail(job.data);
 *   }
 * }
 * ```
 */
export abstract class AvleonWorkerBase<T = any> {
  protected worker?: BullWorker<T>;

  /** Process a single job. */
  abstract process(job: Job<T>): Promise<any>;

  /** Called when a job completes successfully. */
  onCompleted?(job: Job<T>, result: any): void | Promise<void>;

  /** Called when a job throws. `job` is undefined if the failure had no job. */
  onFailed?(job: Job<T> | undefined, error: Error): void | Promise<void>;

  /** Called on worker-level errors. */
  onError?(error: Error): void | Promise<void>;

  /**
   * Start consuming. Reads the config supplied by `@AvleonWorker`; calling this
   * twice is a no-op.
   */
  start(): this {
    if (this.worker) return this;

    const config: WorkerConfig | undefined = (this.constructor as any)[WORKER_CONFIG];
    if (!config) {
      throw new Error(
        `[AvleonWorker] ${this.constructor.name} is missing its @AvleonWorker({ queue }) decorator.`,
      );
    }

    const { Worker } = loadPackageFromClient<typeof import("bullmq")>("bullmq");

    this.worker = new Worker<T>(
      config.queue,
      async (job: Job<T>) => this.process(job),
      {
        ...config.options,
        connection: config.connection,
        concurrency: config.concurrency,
      } as WorkerOptions,
    );

    if (this.onCompleted) {
      this.worker.on("completed", (job, result) => this.onCompleted!(job as Job<T>, result));
    }
    if (this.onFailed) {
      this.worker.on("failed", (job, err) => this.onFailed!(job as Job<T> | undefined, err));
    }
    if (this.onError) {
      this.worker.on("error", (err) => this.onError!(err));
    }

    return this;
  }

  /** The underlying BullMQ worker, once started. */
  getWorker(): BullWorker<T> | undefined {
    return this.worker;
  }

  /** Stop consuming and release the Redis connection. */
  async close(): Promise<void> {
    await this.worker?.close();
    this.worker = undefined;
  }
}

/**
 * Register a worker class with the DI container and bind it to a queue.
 *
 * bullmq is an optional peer dependency and is loaded only when the worker
 * starts, so importing `@avleon/core` never requires it.
 */
export function AvleonWorker(config: WorkerConfig): ClassDecorator {
  return function (target: any) {
    if (!config?.queue) {
      throw new Error(
        "[AvleonWorker] A queue name is required, e.g. @AvleonWorker({ queue: \"email\" }).",
      );
    }

    Object.defineProperty(target, WORKER_CONFIG, {
      value: config,
      enumerable: false,
      configurable: true,
    });

    Service()(target);

    if (config.autoStart !== false) {
      const instance = Container.get(target) as AvleonWorkerBase;
      if (typeof instance.start === "function") instance.start();
    }

    return target;
  } as ClassDecorator;
}
