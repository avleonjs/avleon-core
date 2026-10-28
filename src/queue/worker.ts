/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
import type {
  Job,
  Worker as BullWorker,
  WorkerOptions,
  ConnectionOptions,
} from "bullmq";
import Container, { Service } from "typedi";
import { loadPackageFromClient } from "../common/utils/common-utils";
import { internalLogger } from "../observability/internal-logger";
import { MemoryWorker, QueueDriver, resolveQueueDriver } from "./memory-driver";

const logger = internalLogger("worker");

export interface WorkerConfig {
  /** Name of the queue this worker consumes. */
  queue: string;
  /** Redis connection. Falls back to BullMQ's default when omitted. */
  connection?: ConnectionOptions;
  /** How many jobs this worker processes at once. */
  concurrency?: number;
  /** Any other BullMQ worker option. */
  options?: Omit<WorkerOptions, "connection" | "concurrency">;
  /**
   * Whether `startRegisteredWorkers()` (called by the application at boot)
   * starts this worker. Defaults to `true`. Set `false` to start it only
   * through `app.useWorker([...])` or an explicit `start()`.
   *
   * The worker never starts on import.
   */
  autoStart?: boolean;
  /** Backend. Defaults to `setQueueDriver()`, then `AVLEON_QUEUE_DRIVER`, then `"bullmq"`. */
  driver?: QueueDriver;
}

const WORKER_CONFIG = Symbol.for("avleon:worker:config");

const workerRegistry = new Set<Function>();

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

    const config: WorkerConfig | undefined = (this.constructor as any)[
      WORKER_CONFIG
    ];
    if (!config) {
      throw new Error(
        `[AvleonWorker] ${this.constructor.name} is missing its @AvleonWorker({ queue }) decorator.`,
      );
    }

    const driver = resolveQueueDriver(config.driver);
    const processor = async (job: Job<T>) => this.process(job);

    if (driver === "bullmq") {
      const { Worker } =
        loadPackageFromClient<typeof import("bullmq")>("bullmq");
      this.worker = new Worker<T>(config.queue, processor, {
        ...config.options,
        connection: config.connection,
        concurrency: config.concurrency,
      } as WorkerOptions);
    } else {
      this.worker = new MemoryWorker(config.queue, processor as any, {
        concurrency: config.concurrency,
      }) as unknown as BullWorker<T>;
    }

    const queue = config.queue;
    this.worker.on("completed", (job, result) => {
      if (this.onCompleted)
        this.safeCall(
          () => this.onCompleted!(job as Job<T>, result),
          "onCompleted",
        );
    });
    this.worker.on("failed", (job, err) => {
      logger.error(
        {
          err,
          queue,
          jobId: job?.id,
          jobName: job?.name,
          attempts: job?.attemptsMade,
        },
        `[Avleon Worker] Job "${job?.name ?? "?"}" on "${queue}" failed`,
      );
      if (this.onFailed)
        this.safeCall(
          () => this.onFailed!(job as Job<T> | undefined, err),
          "onFailed",
        );
    });
    this.worker.on("error", (err) => {
      if (this.onError) this.safeCall(() => this.onError!(err), "onError");
      else
        logger.error(
          { err, queue },
          `[Avleon Worker] Worker error on "${queue}"`,
        );
    });

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

  /** Run a lifecycle hook so neither a throw nor a rejection escapes. */
  private safeCall(fn: () => void | Promise<void>, hook: string) {
    try {
      const result = fn();
      if (result && typeof (result as Promise<void>).catch === "function") {
        (result as Promise<void>).catch((err) =>
          logger.error(
            { err },
            `[Avleon Worker] ${this.constructor.name}.${hook} threw`,
          ),
        );
      }
    } catch (err) {
      logger.error(
        { err },
        `[Avleon Worker] ${this.constructor.name}.${hook} threw`,
      );
    }
  }
}

/**
 * Register a worker class with the DI container and bind it to a queue.
 *
 * Decorating does not start the worker. It starts when the application boots
 * (`startRegisteredWorkers()`), when passed to `app.useWorker([...])`, or on an
 * explicit `start()`, so configuration and DI are ready first.
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
    workerRegistry.add(target);

    return target;
  } as ClassDecorator;
}

/** Every class decorated with `@AvleonWorker`, in declaration order. */
export function getRegisteredWorkers(): Function[] {
  return [...workerRegistry];
}

/**
 * Resolve and start every `@AvleonWorker` class whose `autoStart` is not
 * `false`. Workers already started are returned as they are. The application
 * calls this once at boot and closes the returned workers on shutdown.
 */
export function startRegisteredWorkers(): AvleonWorkerBase[] {
  const started: AvleonWorkerBase[] = [];
  for (const target of workerRegistry) {
    const config: WorkerConfig = (target as any)[WORKER_CONFIG];
    if (config?.autoStart === false) continue;
    const instance = Container.get(target as any) as AvleonWorkerBase;
    if (!instance.getWorker()) instance.start();
    started.push(instance);
  }
  return started;
}
