// ============================================================
// Avleon Event System
// ============================================================

import { Container } from "typedi";
import { SocketIoServer } from "../realtime/websocket";
import { internalLogger } from "../observability/internal-logger";

const logger = internalLogger("events");

// ─── Broadcast & Options ────────────────────────────────────

export interface Broadcast {
  to: string;
  private?: boolean;
  payload: any;
}

/**
 * Emit the event over Socket.IO as `{ name, payload }` on `channel`, to
 * `room` when given (otherwise to everyone). Requires `app.useSocketIo()`.
 */
export type SocketBroadcastOption = {
  type: "socket";
  channel: string;
  room?: string;
};

/**
 * Only Socket.IO broadcasting ships in 1.0. Kafka and RabbitMQ transports are
 * not implemented; passing `{ type: "kafka" }` or `{ type: "rabbitmq" }` throws.
 */
export type BroadcastOption = SocketBroadcastOption | false;

type DelayInput = string | number;

export type DispatchOption =
  | {
      broadcast?: BroadcastOption;
      queue: true;
      /** Wait before running listeners: ms, or "500ms", "5s", "2m", "1h", "1d". */
      delay?: DelayInput;
      /** Extra attempts per listener after the first. */
      retry?: number;
      retryDelay?: number; // milliseconds
    }
  | {
      broadcast?: BroadcastOption;
      queue?: false;
      delay?: DelayInput;
      retry?: never;
      retryDelay?: never;
    };

const defaultDispatchOption: DispatchOption = {
  broadcast: false,
  queue: false,
  delay: 0,
};

// ─── Helpers ────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Parse a delay given as ms or as "500ms", "5s", "2m", "1h", "1d"/"day"/"days". */
export function parseDelay(input: DelayInput | undefined): number {
  if (input == null) return 0;
  if (typeof input === "number") {
    if (!Number.isFinite(input) || input < 0)
      throw new Error(`Invalid delay: ${input}`);
    return input;
  }

  const match = input.trim().match(/^(\d+)(ms|s|m|h|d|day|days)$/);
  if (!match) throw new Error(`Invalid delay format: "${input}"`);

  const value = Number(match[1]);
  switch (match[2]) {
    case "ms":
      return value;
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    default:
      return value * 24 * 60 * 60 * 1000;
  }
}

// ─── Core Interfaces ────────────────────────────────────────

export interface AvleonEventInterface {
  name: string;
  timestamp: number;
}

export interface AvleonEventListenerInterface<
  TEvent extends AvleonEventInterface = any,
> {
  handler(event: TEvent): void | Promise<void>;
}

// ─── Base Event ─────────────────────────────────────────────

export abstract class AvleonEvent<
  TPayload = any,
> implements AvleonEventInterface {
  public readonly name: string;
  public readonly timestamp: number;

  constructor(public payload: TPayload) {
    this.name = this.constructor.name;
    this.timestamp = Date.now();
  }
}

// ─── Base Listener ──────────────────────────────────────────

export abstract class AvleonEventListener<
  TEvent extends AvleonEvent = AvleonEvent,
> implements AvleonEventListenerInterface<TEvent> {
  abstract handler(event: TEvent): void | Promise<void>;
}

// ─── Event Registry ─────────────────────────────────────────

type EventClass<TEvent extends AvleonEvent = AvleonEvent> = abstract new (
  ...args: any[]
) => TEvent;

type ListenerEntry = {
  listener: AvleonEventListenerInterface;
  once: boolean;
};

/**
 * Listeners keyed by event class identity, so two event classes that share a
 * name never receive each other's events.
 */
export class EventRegistry {
  private static instance: EventRegistry;
  private readonly registry = new Map<Function, ListenerEntry[]>();

  static getInstance(): EventRegistry {
    if (!EventRegistry.instance) {
      EventRegistry.instance = new EventRegistry();
    }
    return EventRegistry.instance;
  }

  /** Register a persistent listener for an event class. */
  register<TEvent extends AvleonEvent>(
    eventClass: EventClass<TEvent>,
    listener: AvleonEventListenerInterface<TEvent>,
  ): void {
    this._add(eventClass, listener, false);
  }

  /** Register a listener that fires exactly once, on the next occurrence. */
  once<TEvent extends AvleonEvent>(
    eventClass: EventClass<TEvent>,
    listener: AvleonEventListenerInterface<TEvent>,
  ): void {
    this._add(eventClass, listener, true);
  }

  /** Remove a specific listener for an event class. */
  unregister<TEvent extends AvleonEvent>(
    eventClass: EventClass<TEvent>,
    listener: AvleonEventListenerInterface<TEvent>,
  ): void {
    const entries = this.registry.get(eventClass) ?? [];
    this._set(
      eventClass,
      entries.filter((e) => e.listener !== listener),
    );
  }

  /** Active listener entries for an event class or event instance. */
  getListeners(eventOrClass: AvleonEvent | EventClass): ListenerEntry[] {
    return [...(this.registry.get(keyOf(eventOrClass)) ?? [])];
  }

  /**
   * Listeners to invoke for one occurrence of the event. One-time listeners
   * are removed from the registry here, before they run, so concurrent
   * dispatches can never fire them twice.
   */
  claim(eventOrClass: AvleonEvent | EventClass): ListenerEntry[] {
    const key = keyOf(eventOrClass);
    const entries = this.registry.get(key) ?? [];
    if (entries.some((e) => e.once)) {
      this._set(
        key,
        entries.filter((e) => !e.once),
      );
    }
    return [...entries];
  }

  /** Remove every listener, or every listener of one event class. */
  clear(eventClass?: EventClass): void {
    if (eventClass) this.registry.delete(eventClass);
    else this.registry.clear();
  }

  private _add(
    key: Function,
    listener: AvleonEventListenerInterface,
    once: boolean,
  ): void {
    const entries = this.registry.get(key) ?? [];
    this._set(key, [...entries, { listener, once }]);
  }

  private _set(key: Function, entries: ListenerEntry[]) {
    if (entries.length === 0) this.registry.delete(key);
    else this.registry.set(key, entries);
  }
}

function keyOf(eventOrClass: AvleonEvent | EventClass): Function {
  return typeof eventOrClass === "function"
    ? eventOrClass
    : eventOrClass.constructor;
}

function listenerName(listener: AvleonEventListenerInterface): string {
  return listener?.constructor?.name ?? "listener";
}

// ─── Queue (In-Memory) ──────────────────────────────────────

type QueuedJob = {
  event: AvleonEvent;
  entries: ListenerEntry[];
  option: DispatchOption;
};

/** A listener that kept failing after its retries. */
export interface FailedEventJob {
  event: AvleonEvent;
  listener: AvleonEventListenerInterface;
  error: unknown;
  attempts: number;
  failedAt: number;
}

const MAX_FAILED = 1000;

export class EventQueue {
  private static instance: EventQueue;
  private readonly jobs: QueuedJob[] = [];
  private readonly failed: FailedEventJob[] = [];
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private processing = false;
  private idleWaiters: Array<() => void> = [];

  static getInstance(): EventQueue {
    if (!EventQueue.instance) {
      EventQueue.instance = new EventQueue();
    }
    return EventQueue.instance;
  }

  /**
   * Queue `event` for its listeners. Listeners are bound now, so a `once`
   * listener is consumed by this dispatch even if the job runs later.
   * `option.delay` postpones the job.
   */
  enqueue(
    event: AvleonEvent,
    option: DispatchOption,
    entries?: ListenerEntry[],
  ): void {
    const job: QueuedJob = {
      event,
      option,
      entries: entries ?? EventRegistry.getInstance().claim(event),
    };
    const wait = parseDelay(option.delay);

    if (wait > 0) {
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        this.push(job);
      }, wait);
      this.timers.add(timer);
      return;
    }
    this.push(job);
  }

  /** Listeners that failed after all retries, oldest first (capped at 1000). */
  getFailedJobs(): FailedEventJob[] {
    return [...this.failed];
  }

  /** Forget recorded failures. */
  clearFailed(): void {
    this.failed.length = 0;
  }

  /** Resolve once no job is queued, delayed or running. */
  whenIdle(): Promise<void> {
    if (this.isIdle()) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }

  /** Cancel delayed jobs and drop queued ones. For shutdown and tests. */
  clear(): void {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    this.jobs.length = 0;
    this.notifyIfIdle();
  }

  private isIdle() {
    return !this.processing && this.jobs.length === 0 && this.timers.size === 0;
  }

  private notifyIfIdle() {
    if (!this.isIdle()) return;
    const waiters = this.idleWaiters;
    this.idleWaiters = [];
    waiters.forEach((w) => w());
  }

  private push(job: QueuedJob) {
    this.jobs.push(job);
    if (!this.processing) {
      this.processing = true;
      // Defer to a later tick so the dispatching call stack clears first.
      setImmediate(() => void this.process());
    }
  }

  private async process(): Promise<void> {
    try {
      while (this.jobs.length > 0) {
        const job = this.jobs.shift()!;
        await this.run(job);
      }
    } finally {
      this.processing = false;
      this.notifyIfIdle();
    }
  }

  private async run(job: QueuedJob): Promise<void> {
    const maxRetries = Math.max(0, Number((job.option as any).retry) || 0);
    const retryDelay = (job.option as any).retryDelay ?? 1000;

    for (const entry of job.entries) {
      let lastError: unknown;
      let attempts = 0;
      let success = false;

      while (attempts <= maxRetries) {
        attempts++;
        try {
          await entry.listener.handler(job.event);
          success = true;
          break;
        } catch (err) {
          lastError = err;
          if (attempts <= maxRetries) await sleep(retryDelay);
        }
      }

      if (!success) {
        logger.error(
          {
            err: lastError,
            event: job.event.name,
            listener: listenerName(entry.listener),
            attempts,
          },
          `[EventQueue] Listener for "${job.event.name}" failed after ${attempts} attempt(s)`,
        );
        this.failed.push({
          event: job.event,
          listener: entry.listener,
          error: lastError,
          attempts,
          failedAt: Date.now(),
        });
        if (this.failed.length > MAX_FAILED) this.failed.shift();
      }
    }
  }
}

// ─── Broadcast ──────────────────────────────────────────────

async function broadcastSocket(
  event: AvleonEvent,
  option: SocketBroadcastOption,
): Promise<void> {
  if (!Container.has(SocketIoServer)) {
    throw new Error(
      "[EventDispatcher] Socket broadcast requires Socket.IO. Call app.useSocketIo() first.",
    );
  }
  const io = Container.get(SocketIoServer);
  const target = option.room ? io.to(option.room) : io;
  target.emit(option.channel, { name: event.name, payload: event.payload });
}

async function handleBroadcast(
  event: AvleonEvent,
  broadcastOption: BroadcastOption,
): Promise<void> {
  if (!broadcastOption) return;

  const type = (broadcastOption as { type?: string }).type;
  if (type === "socket") {
    await broadcastSocket(event, broadcastOption);
    return;
  }
  throw new Error(
    `[EventDispatcher] Broadcast transport "${type}" is not implemented in Avleon 1.0. ` +
      "Only { type: \"socket\" } is supported.",
  );
}

// ─── Event Dispatcher ───────────────────────────────────────

export class EventDispatcher {
  private readonly registry = EventRegistry.getInstance();
  private readonly queue = EventQueue.getInstance();

  /**
   * Dispatch an event.
   *
   * - `queue: true`: listeners run on a later tick through the in-memory
   *   queue, after `delay`, with `retry` / `retryDelay`. Listeners that
   *   still fail are logged and kept (`EventQueue.getInstance().getFailedJobs()`).
   * - otherwise listeners run now (or after `delay`), each isolated so one
   *   failure does not stop the rest.
   * - `broadcast: { type: "socket", channel, room? }` also emits over Socket.IO.
   *
   * `once` listeners fire exactly once: they are claimed by the first
   * dispatch, before any listener runs.
   */
  async dispatch(event: AvleonEvent, option?: DispatchOption): Promise<void> {
    const finalOption: DispatchOption = option ?? defaultDispatchOption;
    const wait = parseDelay(finalOption.delay);

    if (finalOption.broadcast) {
      await handleBroadcast(event, finalOption.broadcast);
    }

    const entries = this.registry.claim(event);

    if (finalOption.queue) {
      this.queue.enqueue(event, finalOption, entries);
      return;
    }

    if (wait > 0) {
      setTimeout(() => void this.invokeListeners(event, entries), wait);
      return;
    }
    await this.invokeListeners(event, entries);
  }

  private async invokeListeners(
    event: AvleonEvent,
    entries: ListenerEntry[],
  ): Promise<void> {
    for (const entry of entries) {
      try {
        await entry.listener.handler(event);
      } catch (err) {
        logger.error(
          { err, event: event.name, listener: listenerName(entry.listener) },
          `[EventDispatcher] Listener for "${event.name}" threw`,
        );
      }
    }
  }
}
