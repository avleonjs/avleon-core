import type { Redis } from "ioredis";

import { CacheOptions } from "../core/interfaces";
import { loadPackageFromClient } from "../common/utils/common-utils";

type Provider = "memory" | "redis";

export class CacheManager {
  private static provider: Provider = "memory";
  private static redis: Redis | null = null;

  private static store = new Map<string, any>();
  private static tagsMap = new Map<string, Set<string>>();

  static configure(options?: CacheOptions & { redis?: Redis }) {
    this.provider = options?.provider ?? "memory";

    if (this.provider === "redis") {
      if (options?.redis) {
        this.redis = options.redis;
      } else {
        // Loaded lazily so the package imports cleanly without ioredis installed.
        const mod = loadPackageFromClient<any>("ioredis");
        const IORedis = mod.default ?? mod;
        this.redis = new IORedis(options?.redisOptions ?? {});
      }
    }
  }

  private get redis() {
    return CacheManager.redis;
  }

  private get store() {
    return CacheManager.store;
  }

  private get tagsMap() {
    return CacheManager.tagsMap;
  }

  async invalidateTags(tags: string | string[]): Promise<void> {
    let ptags: string[] = [];
    if (Array.isArray(tags)) {
      ptags = tags;
    } else {
      ptags = [tags];
    }

    if (this.redis) {
      const pipeline = this.redis.pipeline();

      for (const tag of ptags) {
        const tagKey = `tag:${tag}`;
        const keys = await this.redis.smembers(tagKey);

        if (keys.length) {
          pipeline.del(keys);
        }

        pipeline.del(tagKey);
      }

      await pipeline.exec();
      return;
    }

    for (const tag of ptags) {
      const keys = this.tagsMap.get(tag);
      if (!keys) continue;

      for (const key of keys) {
        this.store.delete(key);
      }

      this.tagsMap.delete(tag);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.redis) {
      const val = await this.redis.get(key);
      return val ? JSON.parse(val) : null;
    }

    return this.store.get(key) ?? null;
  }

  async set<T>(key: string, value: T, ttl = 3600, tags: string[] = []) {
    if (this.redis) {
      const pipeline = this.redis.pipeline();
      pipeline.set(key, JSON.stringify(value), "EX", ttl);

      for (const tag of tags) {
        const tagKey = `tag:${tag}`;
        pipeline.sadd(tagKey, key);
      }

      await pipeline.exec();
      return;
    }

    this.store.set(key, value);

    for (const tag of tags) {
      if (!this.tagsMap.has(tag)) {
        this.tagsMap.set(tag, new Set());
      }
      this.tagsMap.get(tag)!.add(key);
    }
  }

  async delete(key: string) {
    if (this.redis) {
      await this.redis.del(key);
      return;
    }

    this.store.delete(key);
  }
}