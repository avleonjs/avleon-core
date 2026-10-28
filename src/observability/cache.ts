import type { Redis } from "ioredis";

import { CacheOptions } from "../core/interfaces";
import { loadPackageFromClient } from "../common/utils/common-utils";

type Provider = "memory" | "redis";

type MemoryEntry = {
  value: unknown;
  /** Epoch ms after which the entry is gone; `Infinity` for no expiry. */
  expiresAt: number;
};

export type CacheManagerOptions = Partial<CacheOptions> & {
  /** An existing ioredis client to use instead of creating one. */
  redis?: Redis;
  /** How often the in-memory store sweeps expired entries, in ms. Default 60s. */
  sweepIntervalMs?: number;
};

const DEFAULT_SWEEP_MS = 60_000;

/**
 * Key/value cache with tag invalidation, backed by memory or Redis.
 *
 * `CacheManager.configure()` sets the defaults (provider, Redis client) that
 * new instances pick up; each instance owns its own in-memory store.
 *
 * TTLs are in seconds. A TTL of `0` or less stores the value without expiry.
 * Expired in-memory entries are dropped lazily on read and by a periodic,
 * `unref`'d sweep, so the store does not grow without bound.
 */
export class CacheManager {
  private static defaults: CacheManagerOptions = { provider: "memory" };
  private static sharedRedis: Redis | null = null;
  private static ownsSharedRedis = false;
  /** Instances holding a sweep timer or a Redis client they created. */
  private static readonly instances = new Set<CacheManager>();

  private readonly provider: Provider;
  private readonly redis: Redis | null;
  private readonly sweepIntervalMs: number;
  private readonly store = new Map<string, MemoryEntry>();
  private readonly tagsMap = new Map<string, Set<string>>();
  private sweepTimer: ReturnType<typeof setInterval> | null = null;
  private ownsRedis = false;

  /** Set the defaults for instances created afterwards. */
  static configure(options?: CacheManagerOptions) {
    CacheManager.defaults = {
      ...options,
      provider: options?.provider ?? "memory",
    };

    if (CacheManager.defaults.provider === "redis") {
      if (options?.redis) {
        CacheManager.sharedRedis = options.redis;
        CacheManager.ownsSharedRedis = false;
      } else {
        CacheManager.sharedRedis = createRedis(options?.redisOptions);
        CacheManager.ownsSharedRedis = true;
      }
    } else {
      CacheManager.sharedRedis = null;
      CacheManager.ownsSharedRedis = false;
    }
  }

  /**
   * Stop every instance's sweep timer, clear their stores, and quit the Redis
   * client created by `configure()`. A client passed in via `{ redis }` is
   * left open for its owner to close.
   */
  static async close(): Promise<void> {
    await Promise.all(
      [...CacheManager.instances].map((instance) => instance.close()),
    );
    CacheManager.instances.clear();

    const redis = CacheManager.sharedRedis;
    const owned = CacheManager.ownsSharedRedis;
    CacheManager.sharedRedis = null;
    CacheManager.ownsSharedRedis = false;
    CacheManager.defaults = { provider: "memory" };

    if (redis && owned) await quitRedis(redis);
  }

  constructor(options?: CacheManagerOptions) {
    const opts = options ?? CacheManager.defaults;
    this.provider = opts.provider ?? "memory";
    this.sweepIntervalMs =
      opts.sweepIntervalMs ??
      CacheManager.defaults.sweepIntervalMs ??
      DEFAULT_SWEEP_MS;

    if (this.provider !== "redis") {
      this.redis = null;
    } else if (opts.redis) {
      this.redis = opts.redis;
    } else if (!options && CacheManager.sharedRedis) {
      this.redis = CacheManager.sharedRedis;
    } else {
      this.redis = createRedis(opts.redisOptions);
      this.ownsRedis = true;
      CacheManager.instances.add(this);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.redis) {
      const val = await this.redis.get(key);
      return val == null ? null : (JSON.parse(val) as T);
    }

    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.removeKey(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(
    key: string,
    value: T,
    ttl = 3600,
    tags: string[] = [],
  ): Promise<void> {
    const ttlSeconds = Number.isFinite(ttl) && ttl > 0 ? Math.ceil(ttl) : 0;

    if (this.redis) {
      await this.setRedis(this.redis, key, value, ttlSeconds, tags);
      return;
    }

    this.store.set(key, {
      value,
      expiresAt: ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : Infinity,
    });

    for (const tag of tags) {
      let keys = this.tagsMap.get(tag);
      if (!keys) {
        keys = new Set();
        this.tagsMap.set(tag, keys);
      }
      keys.add(key);
    }

    if (ttlSeconds > 0) this.startSweep();
  }

  async delete(key: string): Promise<void> {
    if (this.redis) {
      await this.redis.del(key);
      return;
    }
    this.removeKey(key);
  }

  async invalidateTags(tags: string | string[]): Promise<void> {
    const list = Array.isArray(tags) ? tags : [tags];

    if (this.redis) {
      const pipeline = this.redis.pipeline();
      for (const tag of list) {
        const tagKey = `tag:${tag}`;
        const keys = await this.redis.smembers(tagKey);
        if (keys.length) pipeline.del(keys);
        pipeline.del(tagKey);
      }
      await pipeline.exec();
      return;
    }

    for (const tag of list) {
      const keys = this.tagsMap.get(tag);
      if (!keys) continue;
      for (const key of keys) this.store.delete(key);
      this.tagsMap.delete(tag);
    }
  }

  /** Remove expired in-memory entries now. Returns how many were removed. */
  sweep(): number {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= now) {
        this.removeKey(key);
        removed++;
      }
    }
    if (!this.hasExpiringEntries()) this.stopSweep();
    return removed;
  }

  /**
   * Stop this instance's sweep timer, drop its in-memory entries, and quit its
   * Redis client if the instance created it.
   */
  async close(): Promise<void> {
    this.stopSweep();
    this.store.clear();
    this.tagsMap.clear();
    CacheManager.instances.delete(this);
    if (this.redis && this.ownsRedis) {
      this.ownsRedis = false;
      await quitRedis(this.redis);
    }
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private async setRedis(
    redis: Redis,
    key: string,
    value: unknown,
    ttlSeconds: number,
    tags: string[],
  ) {
    const pipeline = redis.pipeline();
    if (ttlSeconds > 0)
      pipeline.set(key, JSON.stringify(value), "EX", ttlSeconds);
    else pipeline.set(key, JSON.stringify(value));

    const tagKeys = tags.map((t) => `tag:${t}`);
    for (const tagKey of tagKeys) {
      pipeline.exists(tagKey);
      pipeline.sadd(tagKey, key);
      pipeline.ttl(tagKey);
    }
    const results = (await pipeline.exec()) ?? [];

    // A tag set lives at least as long as its longest-lived member, so it
    // never outlives its keys forever: extend its TTL, never shorten it. A
    // member with no expiry makes the tag set persistent.
    const expire = redis.pipeline();
    let pending = 0;
    tagKeys.forEach((tagKey, i) => {
      const base = 1 + i * 3;
      const existed = Number(results[base]?.[1]) > 0;
      const currentTtl = Number(results[base + 2]?.[1]);

      if (ttlSeconds <= 0) {
        if (currentTtl !== -1) {
          expire.persist(tagKey);
          pending++;
        }
        return;
      }
      // Existing persistent set: some member never expires, keep it.
      if (existed && currentTtl === -1) return;
      if (currentTtl < ttlSeconds) {
        expire.expire(tagKey, ttlSeconds);
        pending++;
      }
    });
    if (pending > 0) await expire.exec();
  }

  private removeKey(key: string) {
    this.store.delete(key);
    for (const [tag, keys] of this.tagsMap) {
      if (keys.delete(key) && keys.size === 0) this.tagsMap.delete(tag);
    }
  }

  private hasExpiringEntries(): boolean {
    for (const entry of this.store.values()) {
      if (entry.expiresAt !== Infinity) return true;
    }
    return false;
  }

  private startSweep() {
    if (this.sweepTimer || this.sweepIntervalMs <= 0) return;
    this.sweepTimer = setInterval(() => this.sweep(), this.sweepIntervalMs);
    this.sweepTimer.unref?.();
    // Tracked only while it holds a resource, so CacheManager.close() can
    // release it without the registry keeping idle instances alive.
    CacheManager.instances.add(this);
  }

  private stopSweep() {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
    if (!this.ownsRedis) CacheManager.instances.delete(this);
  }
}

async function quitRedis(redis: Redis) {
  try {
    await redis.quit();
  } catch {
    redis.disconnect();
  }
}

function createRedis(options?: CacheOptions["redisOptions"]): Redis {
  // Loaded lazily so the package imports cleanly without ioredis installed.
  const mod = loadPackageFromClient<any>("ioredis");
  const IORedis = mod.default ?? mod;
  return new IORedis(options ?? {});
}
