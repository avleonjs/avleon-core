import { promises as fs } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { EventEmitter } from "events";
import { AppService } from "./decorators";

interface Job {
  id: string;
  data: any;
  runAt?: number;
  status?: "pending" | "running" | "failed" | "completed";
}

interface QueueAdapter {
  loadJobs(): Promise<Job[]>;
  saveJobs(jobs: Job[]): Promise<void>;
}

export class FileQueueAdapter implements QueueAdapter {
  private queueFile: string;

  constructor(queueName: string) {
    this.queueFile = join(__dirname, `${queueName}.json`);
  }

  async loadJobs(): Promise<Job[]> {
    try {
      const data = await fs.readFile(this.queueFile, "utf-8");
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  async saveJobs(jobs: Job[]) {
    await fs.writeFile(this.queueFile, JSON.stringify(jobs, null, 2), "utf-8");
  }
}

export class AvleonQueue extends EventEmitter {
  private name: string;
  private processing = false;
  private stopped = false;
  private jobHandler: (job: Job) => Promise<void>;
  private adapter: QueueAdapter;

  constructor(name: string, adapter?: QueueAdapter, jobHandler?: (job: Job) => Promise<void>) {
    super();
    this.name = name;
    this.adapter = adapter? adapter : new FileQueueAdapter(name);
    this.jobHandler = jobHandler || this.defaultHandler.bind(this);
    this.setMaxListeners(10);
  }

  private async defaultHandler(job: Job) {
    if (typeof job.data === "function") {
      await job.data();
    }
  }

  async addJob(data: any, options?: { delay?: number }) {
    const job: Job = {
      id: randomUUID(),
      data,
      runAt: Date.now() + (options?.delay || 0),
      status: "pending",
    };

    const jobs = await this.adapter.loadJobs();
    jobs.push(job);
    await this.adapter.saveJobs(jobs);

    if (!this.processing) this.processNext();
  }

  private async processNext() {
    if (this.processing || this.stopped) return;
    this.processing = true;

    while (!this.stopped) {
      const jobs = await this.adapter.loadJobs();
      const nextJob = jobs.find((j) => j.status === "pending");

      if (!nextJob) {
        this.processing = false;
        return;
      }

      const now = Date.now();
      if (nextJob.runAt && nextJob.runAt > now) {
        const delay = nextJob.runAt - now;
        await new Promise((res) => setTimeout(res, delay));
      }

      nextJob.status = "running";
      await this.adapter.saveJobs(jobs);
      this.emit("start", nextJob);

      try {
        await this.jobHandler(nextJob);
        nextJob.status = "completed";
        this.emit("done", nextJob);
      } catch (err) {
        nextJob.status = "failed";
        this.emit("failed", err, nextJob);
      }

      await this.adapter.saveJobs(jobs.filter((j) => j.id !== nextJob.id));
    }

    this.processing = false;
  }

  async onDone(cb: (job: Job) => void) {
     this.on("done", cb);
  }

  async onFailed(cb: (error: any, job: Job) => void) {
     this.on("failed", cb);
  }

  async getJobs(): Promise<Job[]> {
    return this.adapter.loadJobs();
  }

  async stop() {
    this.stopped = true;
  }
}

@AppService
export class QueueManager {
  async from(name: string, jobHandler?: (job: Job) => Promise<void>) {
    const q = new AvleonQueue(name, new FileQueueAdapter(name), jobHandler);
    return q;
  }
}