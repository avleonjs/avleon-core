// ============================================================
// Avleon Distributed Event + Job System (Single File)
// ============================================================

import "reflect-metadata";
import { Container } from "typedi";
import { Queue, Worker, JobsOptions } from "bullmq";
import IORedis from "ioredis";
import { Kafka } from "kafkajs";

// ============================================================
// Types
// ============================================================

type DelayInput = string | number;

export type BroadcastOption =
  | { type: "socket"; channel: string; room?: string }
  | { type: "rabbitmq"; queue: string }
  | { type: "kafka"; topic: string }
  | false;

export type DispatchOption = {
  delay?: DelayInput;
  queue?: string | boolean;
  retry?: number;
  broadcast?: BroadcastOption;
};

// ============================================================
// Utils
// ============================================================

function parseDelay(input?: DelayInput): number {
  if (!input) return 0;
  if (typeof input === "number") return input;

  const match = input.match(/^(\d+)(ms|s|m|h)$/);
  if (!match) throw new Error("Invalid delay");

  const v = Number(match[1]);
  const u = match[2];

  return {
    ms: v,
    s: v * 1000,
    m: v * 60000,
    h: v * 3600000,
  }[u]!;
}

// ============================================================
// Core Event
// ============================================================

export abstract class AvleonEvent<T = any> {
  name = this.constructor.name;
  timestamp = Date.now();
  constructor(public payload: T) {}
}

// ============================================================
// Registry
// ============================================================

class EventRegistry {
  private map = new Map<string, Function[]>();

  register(event: any, handler: Function) {
    const key = event.name;
    const list = this.map.get(key) || [];
    list.push(handler);
    this.map.set(key, list);
  }

  get(eventName: string) {
    return this.map.get(eventName) || [];
  }
}

const registry = new EventRegistry();

// ============================================================
// Queue Job
// ============================================================

type QueueJob = {
  eventName: string;
  payload: any;
  options: DispatchOption;
};

// ============================================================
// Queue Adapter Interface
// ============================================================

interface QueueAdapter {
  enqueue(job: QueueJob): Promise<void>;
  startWorker(): Promise<void>;
}

// ============================================================
// BullMQ Adapter
// ============================================================

class BullMQAdapter implements QueueAdapter {
  private queue: Queue;
  private worker: Worker;

  constructor(name = "avleon") {
    const conn = new IORedis();
    this.queue = new Queue(name, { connection: conn });

    this.worker = new Worker(
      name,
      async (job) => {
        const dispatcher = Container.get(EventDispatcher);
        await dispatcher._handleJob(job.data);
      },
      { connection: conn }
    );
  }

  async enqueue(job: QueueJob) {
    const opts: JobsOptions = {
      delay: parseDelay(job.options.delay),
      attempts: job.options.retry || 0,
    };

    await this.queue.add(job.eventName, job, opts);
  }

  async startWorker() {
    console.log("✅ BullMQ Worker running");
  }
}

// ============================================================
// Kafka Adapter
// ============================================================

class KafkaAdapter implements QueueAdapter {
  private kafka = new Kafka({ brokers: ["localhost:9092"] });
  private producer = this.kafka.producer();
  private consumer = this.kafka.consumer({ groupId: "avleon" });

  async enqueue(job: QueueJob) {
    await this.producer.connect();
    await this.producer.send({
      topic: String(job.options.queue || "default"),
      messages: [{ value: JSON.stringify(job) }],
    });
  }

  async startWorker() {
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: "default" });

    await this.consumer.run({
      eachMessage: async ({ message }) => {
        const job: QueueJob = JSON.parse(message.value!.toString());
        const dispatcher = Container.get(EventDispatcher);
        await dispatcher._handleJob(job);
      },
    });

    console.log("✅ Kafka Worker running");
  }
}

// ============================================================
// Broadcast (stub)
// ============================================================

async function handleBroadcast(event: AvleonEvent, opt: BroadcastOption) {
  if (!opt) return;
  console.log("[Broadcast]", opt, event.payload);
}

// ============================================================
// Dispatcher
// ============================================================

class EventDispatcher {
  constructor(private adapter: QueueAdapter) {}

  dispatch(event: AvleonEvent) {
    return new DispatchBuilder(this, event);
  }

  async _handleJob(job: QueueJob) {
    const EventClass = (globalThis as any)[job.eventName];
    const event = new EventClass(job.payload);

    await this._invoke(event);

    if (job.options.broadcast) {
      await handleBroadcast(event, job.options.broadcast);
    }
  }

  async push(event: AvleonEvent, opt: DispatchOption) {
    await this.adapter.enqueue({
      eventName: event.name,
      payload: event.payload,
      options: opt,
    });
  }

  async _dispatchInternal(event: AvleonEvent, opt: DispatchOption) {
    await this._invoke(event);

    if (opt.broadcast) {
      await handleBroadcast(event, opt.broadcast);
    }
  }

  private async _invoke(event: AvleonEvent) {
    const handlers = registry.get(event.name);

    for (const h of handlers) {
      await h(event);
    }
  }
}

// ============================================================
// Fluent Builder
// ============================================================

class DispatchBuilder {
  private opt: DispatchOption = {};

  constructor(
    private dispatcher: EventDispatcher,
    private event: AvleonEvent
  ) {}

  after(delay: DelayInput) {
    this.opt.delay = delay;
    return this;
  }

  queue(name?: string) {
    this.opt.queue = name || true;
    return this;
  }

  retry(n: number) {
    this.opt.retry = n;
    return this;
  }

  broadcast(opt: BroadcastOption) {
    this.opt.broadcast = opt;
    return this;
  }

  async dispatch() {
    if (this.opt.queue) {
      await this.dispatcher.push(this.event, this.opt);
    } else {
      await this.dispatcher._dispatchInternal(this.event, this.opt);
    }
  }
}

// ============================================================
// Decorators
// ============================================================

const META = "avleon:sub";

export function Subscribe(event: any) {
  return function (target: any, key: string) {
    Reflect.defineMetadata(META, event, target, key);
  };
}

export function Dispatch(opt?: DispatchOption) {
  return function (_: any, __: string, desc: PropertyDescriptor) {
    const orig = desc.value;

    desc.value = async function (...args: any[]) {
      const res = await orig.apply(this, args);

      const dispatcher = Container.get(EventDispatcher);

      await dispatcher
        .dispatch(res)
        .broadcast(opt?.broadcast || false)
        .dispatch();
    };
  };
}

// ============================================================
// Auto Register
// ============================================================

function registerListeners(services: any[]) {
  for (const S of services) {
    const instance = Container.get(S)as any;

    for (const key of Object.getOwnPropertyNames(S.prototype)) {
      const event = Reflect.getMetadata(META, S.prototype, key);

      if (event) {
        registry.register(event, instance[key].bind(instance));
      }
    }
  }
}

// ============================================================
// Example
// ============================================================

class UserCreated extends AvleonEvent<{ name: string }> {}

class UserListener {
  @Subscribe(UserCreated)
  async handle(event: UserCreated) {
    console.log("User created:", event.payload.name);
  }
}

// ============================================================
// Bootstrap
// ============================================================

async function bootstrap() {
  const adapter = new BullMQAdapter(); // or KafkaAdapter
  const dispatcher = new EventDispatcher(adapter);

  Container.set(EventDispatcher, dispatcher);

  registerListeners([UserListener]);

  await adapter.startWorker();

  // usage
  await dispatcher
    .dispatch(new UserCreated({ name: "Tareq" }))
    .queue("emails")
    .after("5s")
    .retry(3)
    .broadcast({ type: "kafka", topic: "user.created" })
    .dispatch();
}

bootstrap();