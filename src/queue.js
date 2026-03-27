"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AvleonQueue = void 0;
exports.Queue = Queue;
const bull_1 = __importDefault(require("bull"));
const typedi_1 = require("typedi");
class AvleonQueue {
    name;
    adapter;
    queue;
    handlerFn;
    constructor(name, adapter, handler) {
        this.name = name;
        this.adapter = adapter;
        // Initialize queue with adapter or default Redis connection
        this.queue = new bull_1.default(name || 'default', adapter);
        this.handlerFn = handler;
        // Check if the instance has a handler method defined
        // This allows subclasses to define handler as a method
        if (typeof this.handler === 'function' && !this.handlerFn) {
            this.handlerFn = (job) => this.handler(job);
        }
        // If handler is provided (from decorator or class method), set up processing
        if (this.handlerFn) {
            this.queue.process(this.handlerFn);
        }
    }
    // Add job to queue
    add(data, options) {
        return this.queue.add(data, options);
    }
    // Add job with delay
    delay(data, delayMs, options) {
        return this.queue.add(data, { ...options, delay: delayMs });
    }
    // Process jobs (can be called manually if not using handler)
    process(handler) {
        this.handlerFn = handler;
        this.queue.process(handler);
    }
    // Process with concurrency
    processConcurrent(concurrency, handler) {
        this.handlerFn = handler;
        this.queue.process(concurrency, handler);
    }
    // Get the underlying Bull queue
    getQueue() {
        return this.queue;
    }
    async clean(grace, status) {
        return this.queue.clean(grace, status);
    }
    async close() {
        await this.queue.close();
    }
    async pause() {
        await this.queue.pause();
    }
    async resume() {
        await this.queue.resume();
    }
    async getJob(jobId) {
        return this.queue.getJob(jobId);
    }
    async getJobs(types, start, end) {
        return this.queue.getJobs(types, start, end);
    }
}
exports.AvleonQueue = AvleonQueue;
function Queue(config) {
    return function (target) {
        // Create a new class that extends the target
        const DecoratedClass = class extends target {
            constructor(...args) {
                super(config.name, config.adapter, config.handler);
            }
        };
        Object.defineProperty(DecoratedClass, 'name', {
            value: target.name,
            writable: false
        });
        (0, typedi_1.Service)()(DecoratedClass);
        return DecoratedClass;
    };
}
