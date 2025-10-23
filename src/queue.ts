import Bull, { Queue as BullQueue, Job, JobOptions } from 'bull';
import { Container, Service } from 'typedi';
export interface QueueConfig {
  name: string;
  adapter?: any;
  handler?: (job: Job) => Promise<any>;
  options?: Bull.QueueOptions;
}


export class AvleonQueue<T = any> {
  protected queue: BullQueue<T>;
  protected handlerFn?: (job: Job<T>) => Promise<any>;

  constructor(
    protected name?: string,
    protected adapter?: any,
    handler?: (job: Job<T>) => Promise<any>
  ) {
    // Initialize queue with adapter or default Redis connection
    this.queue = new Bull(name || 'default', adapter);
    this.handlerFn = handler;

    // Check if the instance has a handler method defined
    // This allows subclasses to define handler as a method
    if (typeof (this as any).handler === 'function' && !this.handlerFn) {
      this.handlerFn = (job: Job<T>) => (this as any).handler(job);
    }

    // If handler is provided (from decorator or class method), set up processing
    if (this.handlerFn) {
      this.queue.process(this.handlerFn);
    }
  }

  // Optional handler method that subclasses can override
  handler?(job: Job<T>): Promise<any> | any;

  // Add job to queue
  add(data: T, options?: JobOptions): Promise<Bull.Job<T>> {
    return this.queue.add(data, options);
  }

  // Add job with delay
  delay(data: T, delayMs: number, options?: JobOptions): Promise<Bull.Job<T>> {
    return this.queue.add(data, { ...options, delay: delayMs });
  }

  // Process jobs (can be called manually if not using handler)
  process(handler: (job: Job<T>) => Promise<any>): void {
    this.handlerFn = handler;
    this.queue.process(handler);
  }

  // Process with concurrency
  processConcurrent(concurrency: number, handler: (job: Job<T>) => Promise<any>): void {
    this.handlerFn = handler;
    this.queue.process(concurrency, handler);
  }

  // Get the underlying Bull queue
  getQueue(): BullQueue<T> {
    return this.queue;
  }


  async clean(grace: number, status?: 'completed' | 'wait' | 'active' | 'delayed' | 'failed'): Promise<Job[]> {
    return this.queue.clean(grace, status);
  }


  async close(): Promise<void> {
    await this.queue.close();
  }


  async pause(): Promise<void> {
    await this.queue.pause();
  }

 
  async resume(): Promise<void> {
    await this.queue.resume();
  }


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
}


export function Queue(config: QueueConfig) {
  return function <T extends { new (...args: any[]): AvleonQueue }>(target: T) {
    // Create a new class that extends the target
    const DecoratedClass = class extends target {
      constructor(...args: any[]) {
        super(config.name, config.adapter, config.handler);
      }
    };


    Object.defineProperty(DecoratedClass, 'name', {
      value: target.name,
      writable: false
    });

    Service()(DecoratedClass);

    return DecoratedClass as T;
  };
}