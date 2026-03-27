"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheManager = void 0;
class CacheManager {
    store = new Map();
    tagsMap = new Map();
    redis = null;
    constructor(redisInstance) {
        this.redis = redisInstance || null;
    }
    redisTagKey(tag) {
        return `cache-tags:${tag}`;
    }
    async get(key) {
        if (this.redis) {
            const val = await this.redis.get(key);
            return val ? JSON.parse(val) : null;
        }
        const cached = this.store.get(key);
        return cached ? cached.data : null;
    }
    async set(key, value, tags = [], ttl = 3600) {
        const entry = {
            data: value,
            timestamp: Date.now(),
        };
        if (this.redis) {
            await this.redis.set(key, JSON.stringify(entry.data), "EX", ttl);
            for (const tag of tags) {
                await this.redis.sadd(this.redisTagKey(tag), key);
            }
        }
        else {
            this.store.set(key, entry);
            for (const tag of tags) {
                if (!this.tagsMap.has(tag))
                    this.tagsMap.set(tag, new Set());
                this.tagsMap.get(tag).add(key);
            }
        }
    }
    async delete(key) {
        if (this.redis) {
            await this.redis.del(key);
            // Also clean up from any tag sets
            const tagKeys = await this.redis.keys("cache-tags:*");
            for (const tagKey of tagKeys) {
                await this.redis.srem(tagKey, key);
            }
        }
        else {
            this.store.delete(key);
            for (const keys of this.tagsMap.values()) {
                keys.delete(key);
            }
        }
    }
    async invalidateTag(tag) {
        if (this.redis) {
            const tagKey = this.redisTagKey(tag);
            const keys = await this.redis.smembers(tagKey);
            if (keys.length) {
                await this.redis.del(...keys); // delete all cached keys
                await this.redis.del(tagKey); // delete the tag set
            }
        }
        else {
            const keys = this.tagsMap.get(tag);
            if (keys) {
                for (const key of keys) {
                    this.store.delete(key);
                }
                this.tagsMap.delete(tag);
            }
        }
    }
}
exports.CacheManager = CacheManager;
