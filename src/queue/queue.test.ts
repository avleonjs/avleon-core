import "reflect-metadata";

// bullmq is an optional peer dependency, loaded lazily through
// loadPackageFromClient. Stub that loader so these tests exercise Avleon's
// own wiring without needing a Redis server.
const queueInstances: any[] = [];
const workerInstances: any[] = [];

class FakeQueue {
  name: string;
  opts: any;
  added: Array<{ name: string; data: any; options: any }> = [];
  closed = false;

  constructor(name: string, opts?: any) {
    this.name = name;
    this.opts = opts;
    queueInstances.push(this);
  }

  add(name: string, data: any, options?: any) {
    const job = { name, data, options };
    this.added.push(job);
    return Promise.resolve(job);
  }

  async pause() {}
  async resume() {}
  async close() {
    this.closed = true;
  }
  async getJob() {
    return undefined;
  }
  async getJobs() {
    return [];
  }
  async clean() {
    return [];
  }
}

class FakeWorker {
  name: string;
  processor: (job: any) => Promise<any>;
  opts: any;
  listeners: Record<string, Function[]> = {};
  closed = false;

  constructor(name: string, processor: (job: any) => Promise<any>, opts?: any) {
    this.name = name;
    this.processor = processor;
    this.opts = opts;
    workerInstances.push(this);
  }

  on(event: string, fn: Function) {
    (this.listeners[event] ??= []).push(fn);
    return this;
  }

  async close() {
    this.closed = true;
  }
}

jest.mock("../common/utils/common-utils", () => {
  const actual = jest.requireActual("../common/utils/common-utils");
  return {
    ...actual,
    loadPackageFromClient: jest.fn((name: string) => {
      if (name === "bullmq") return { Queue: FakeQueue, Worker: FakeWorker };
      return actual.loadPackageFromClient(name);
    }),
  };
});

import { AvleonQueue, JobHandler, Queue } from "./queue";

beforeEach(() => {
  queueInstances.length = 0;
  workerInstances.length = 0;
});

describe("AvleonQueue", () => {
  class PlainQueue extends AvleonQueue<{ id: number }> {}

  it("creates the underlying queue with the given name and options", () => {
    const opts = { connection: { host: "localhost" } } as any;
    const q = new PlainQueue("emails", opts);

    expect(q.getQueue()).toBeInstanceOf(FakeQueue);
    expect((q.getQueue() as any).name).toBe("emails");
    expect((q.getQueue() as any).opts).toBe(opts);
  });

  it("does not start a worker when there is nothing to process", () => {
    new PlainQueue("emails").startWorker();
    expect(workerInstances).toHaveLength(0);
  });

  describe("producing jobs", () => {
    it("adds an unnamed job under the queue name", async () => {
      const q = new PlainQueue("emails");
      await q.add({ id: 1 });

      const [job] = (q.getQueue() as any).added;
      expect(job.name).toBe("emails");
      expect(job.data).toEqual({ id: 1 });
    });

    it("adds a named job", async () => {
      const q = new PlainQueue("emails");
      await q.add("welcome", { id: 1 });

      const [job] = (q.getQueue() as any).added;
      expect(job.name).toBe("welcome");
      expect(job.data).toEqual({ id: 1 });
    });

    it("applies a delay", async () => {
      const q = new PlainQueue("emails");
      await q.delay({ id: 1 }, 500);

      expect((q.getQueue() as any).added[0].options.delay).toBe(500);
    });

    it("applies a delay to a named job", async () => {
      const q = new PlainQueue("emails");
      await q.delay("welcome", { id: 1 }, 500);

      const [job] = (q.getQueue() as any).added;
      expect(job.name).toBe("welcome");
      expect(job.options.delay).toBe(500);
    });

    it("dispatches a named job, with and without delay", async () => {
      const q = new PlainQueue("emails");
      await q.dispatch("welcome", { id: 1 });
      await q.dispatch("reminder", { id: 2 }, 1000);

      const added = (q.getQueue() as any).added;
      expect(added[0].name).toBe("welcome");
      expect(added[0].options?.delay).toBeUndefined();
      expect(added[1].options.delay).toBe(1000);
    });
  });

  describe("@JobHandler", () => {
    it("routes each named job to its handler", async () => {
      const seen: string[] = [];

      class NamedQueue extends AvleonQueue<any> {
        @JobHandler("welcome")
        async welcome() {
          seen.push("welcome");
          return "welcomed";
        }

        @JobHandler("reminder")
        async reminder() {
          seen.push("reminder");
        }
      }

      const q = new NamedQueue("emails").startWorker();
      const worker = workerInstances[0];

      await expect(worker.processor({ name: "welcome", data: {} })).resolves.toBe("welcomed");
      await worker.processor({ name: "reminder", data: {} });

      expect(seen).toEqual(["welcome", "reminder"]);
      expect(q.getWorker()).toBe(worker);
    });

    // Regression: metadata was written to the declaring prototype but read from
    // Object.getPrototypeOf(this), so handlers on a base class were dropped.
    it("inherits handlers declared on a base class", async () => {
      const seen: string[] = [];

      class BaseQueue extends AvleonQueue<any> {
        @JobHandler("base-job")
        async baseJob() {
          seen.push("base");
        }
      }

      class ChildQueue extends BaseQueue {
        @JobHandler("child-job")
        async childJob() {
          seen.push("child");
        }
      }

      new ChildQueue("emails").startWorker();
      const worker = workerInstances[0];

      await worker.processor({ name: "base-job", data: {} });
      await worker.processor({ name: "child-job", data: {} });

      expect(seen).toEqual(["base", "child"]);
    });

    it("lets a subclass override a base handler of the same name", async () => {
      const seen: string[] = [];

      class BaseQueue extends AvleonQueue<any> {
        @JobHandler("run")
        async run() {
          seen.push("base");
        }
      }

      class ChildQueue extends BaseQueue {
        @JobHandler("run")
        async runOverride() {
          seen.push("child");
        }
      }

      new ChildQueue("jobs").startWorker();
      await workerInstances[0].processor({ name: "run", data: {} });

      expect(seen).toEqual(["child"]);
    });

    it("does not leak handlers between sibling classes", async () => {
      class QueueA extends AvleonQueue<any> {
        @JobHandler("a-job")
        async a() {}
      }
      class QueueB extends AvleonQueue<any> {
        @JobHandler("b-job")
        async b() {}
      }

      new QueueA("a").startWorker();
      new QueueB("b").startWorker();

      await expect(
        workerInstances[1].processor({ name: "a-job", data: {} }),
      ).rejects.toThrow(/No handler registered for job "a-job"/);
    });
  });

  describe("fallback handler", () => {
    it("uses handler() for jobs with no named match", async () => {
      const seen: string[] = [];

      class FallbackQueue extends AvleonQueue<any> {
        async handler(job: any) {
          seen.push(job.name);
          return "handled";
        }
      }

      new FallbackQueue("emails").startWorker();
      await expect(
        workerInstances[0].processor({ name: "anything", data: {} }),
      ).resolves.toBe("handled");
      expect(seen).toEqual(["anything"]);
    });

    it("prefers a named handler over the fallback", async () => {
      const seen: string[] = [];

      class MixedQueue extends AvleonQueue<any> {
        @JobHandler("named")
        async named() {
          seen.push("named");
        }
        async handler() {
          seen.push("fallback");
        }
      }

      new MixedQueue("emails").startWorker();
      const worker = workerInstances[0];

      await worker.processor({ name: "named", data: {} });
      await worker.processor({ name: "other", data: {} });

      expect(seen).toEqual(["named", "fallback"]);
    });

    it("throws for an unmatched job when there is no fallback", async () => {
      class NamedOnly extends AvleonQueue<any> {
        @JobHandler("known")
        async known() {}
      }

      new NamedOnly("emails").startWorker();

      await expect(
        workerInstances[0].processor({ name: "unknown", data: {} }),
      ).rejects.toThrow(/No handler registered for job "unknown"/);
    });
  });

  describe("lifecycle", () => {
    it("starts the worker at most once", () => {
      class Q extends AvleonQueue<any> {
        async handler() {}
      }

      const q = new Q("emails");
      q.startWorker();
      q.startWorker();

      expect(workerInstances).toHaveLength(1);
    });

    it("refuses event listeners before the worker starts", () => {
      const q = new PlainQueue("emails");
      expect(() => q.on("completed", () => {})).toThrow(/before the worker has started/);
    });

    it("registers listeners once started", () => {
      class Q extends AvleonQueue<any> {
        async handler() {}
      }

      const q = new Q("emails").startWorker();
      q.on("completed", () => {});

      expect(workerInstances[0].listeners.completed).toHaveLength(1);
    });

    it("closes both the worker and the queue", async () => {
      class Q extends AvleonQueue<any> {
        async handler() {}
      }

      const q = new Q("emails").startWorker();
      await q.close();

      expect(workerInstances[0].closed).toBe(true);
      expect((q.getQueue() as any).closed).toBe(true);
    });
  });

  describe("@Queue", () => {
    it("configures the queue and starts its worker", () => {
      @Queue({ name: "decorated" })
      class DecoratedQueue extends AvleonQueue<any> {
        @JobHandler("go")
        async go() {}
      }

      const q = new DecoratedQueue();

      expect((q.getQueue() as any).name).toBe("decorated");
      expect(q.getWorker()).toBeDefined();
    });

    it("keeps the original class name", () => {
      @Queue({ name: "named" })
      class MyQueue extends AvleonQueue<any> {}

      expect(MyQueue.name).toBe("MyQueue");
    });

    it("uses the decorator's handler when the class defines none", async () => {
      const handler = jest.fn().mockResolvedValue("from-config");

      @Queue({ name: "cfg", handler })
      class ConfigQueue extends AvleonQueue<any> {}

      new ConfigQueue();
      await expect(
        workerInstances[0].processor({ name: "any", data: {} }),
      ).resolves.toBe("from-config");
      expect(handler).toHaveBeenCalled();
    });
  });
});
