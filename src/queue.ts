import { promises as fs } from "fs";
import { join } from "path";
import { uuid } from "./helpers";

interface Job {
  id: string;
  data: any;
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
    } catch (error) {
      return [];
    }
  }

  async saveJobs(jobs: Job[]) {
    await fs.writeFile(this.queueFile, JSON.stringify(jobs, null, 2), "utf-8");
  }
}

// class RedisQueueAdapter implements QueueAdapter {
//   private client = createClient();
//   private queueKey: string;
//
//   constructor(queueName: string) {
//     this.queueKey = `queue:${queueName}`;
//     this.client.connect();
//   }
//
//   async loadJobs(): Promise<Job[]> {
//     const jobs = await this.client.lRange(this.queueKey, 0, -1);
//     return jobs.map((job) => JSON.parse(job));
//   }
//
//   async saveJobs(jobs: Job[]) {
//     await this.client.del(this.queueKey);
//     if (jobs.length > 0) {
//       await this.client.rPush(this.queueKey, ...jobs.map(job => JSON.stringify(job)));
//     }
//   }
// }

class SimpleQueue {
  private processing: boolean = false;
  private jobHandler: (job: Job) => Promise<void>;
  private adapter: QueueAdapter;

  constructor(adapter: QueueAdapter, jobHandler: (job: Job) => Promise<void>) {
    this.adapter = adapter;
    this.jobHandler = jobHandler;
  }

  async addJob(data: any) {
    const job: Job = { id: uuid, data };
    const jobs = await this.adapter.loadJobs();
    jobs.push(job);
    await this.adapter.saveJobs(jobs);
    this.processNext();
  }

  private async processNext() {
    if (this.processing) return;
    this.processing = true;

    const jobs = await this.adapter.loadJobs();
    if (jobs.length === 0) {
      this.processing = false;
      return;
    }

    const job = jobs.shift();
    if (job) {
      try {
        await this.jobHandler(job);
      } catch (error) {
        console.error(`Error processing job ${job.id}:`, error);
        jobs.unshift(job);
      }
      await this.adapter.saveJobs(jobs);
      this.processing = false;
      this.processNext();
    }
  }
}

export class QueueManager {
  private static instance: QueueManager;
  private adapter: QueueAdapter;

  private constructor(adapter: QueueAdapter) {
    this.adapter = adapter;
  }

  static getInstance(adapter: QueueAdapter): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager(adapter);
    }
    return QueueManager.instance;
  }

  createQueue(jobHandler: (job: Job) => Promise<void>): SimpleQueue {
    return new SimpleQueue(this.adapter, jobHandler);
  }
}
