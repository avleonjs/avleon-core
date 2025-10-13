import { CacheManager } from "./cache";

describe("CacheManager (in-memory)", () => {
    let cache: CacheManager;

    beforeEach(() => {
        cache = new CacheManager();
    });

    it("should set and get a value", async () => {
        await cache.set("foo", "bar");
        const result = await cache.get("foo");
        expect(result).toBe("bar");
    });

    it("should return null for missing key", async () => {
        const result = await cache.get("missing");
        expect(result).toBeNull();
    });

    it("should delete a key", async () => {
        await cache.set("foo", "bar");
        await cache.delete("foo");
        const result = await cache.get("foo");
        expect(result).toBeNull();
    });

    it("should associate keys with tags and invalidate by tag", async () => {
        await cache.set("a", 1, ["tag1"]);
        await cache.set("b", 2, ["tag1", "tag2"]);
        await cache.set("c", 3, ["tag2"]);
        await cache.invalidateTag("tag1");
        expect(await cache.get("a")).toBeNull();
        expect(await cache.get("b")).toBeNull();
        expect(await cache.get("c")).toBe(3);
    });

    it("should not fail when invalidating a non-existent tag", async () => {
        await expect(cache.invalidateTag("nope")).resolves.not.toThrow();
    });


});