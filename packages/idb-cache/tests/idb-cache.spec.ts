import { test, expect } from "@playwright/test";
import { IDBCache } from "../src/index"; // Adjust the import path as necessary

test.describe("IDBCache .clear() Method", () => {
  let cache: IDBCache;

  test.beforeEach(async () => {
    cache = new IDBCache({
      cacheBuster: "testCacheBuster",
      cacheKey: "testCacheKey",
      debug: true,
      dbName: "test-idb-cache",
      gcTime: 1000 * 60 * 60 * 24, // 1 day
    });

    // Add some items to the cache
    await cache.setItem("key1", "value1");
    await cache.setItem("key2", "value2");
    await cache.setItem("key3", "value3");
  });

  test.afterEach(async () => {
    // Clean up
    cache.destroy();
  });

  test("should clear all items from the cache", async () => {
    // Ensure items are set
    expect(await cache.getItem("key1")).toBe("value1");
    expect(await cache.getItem("key2")).toBe("value2");
    expect(await cache.getItem("key3")).toBe("value3");

    // Clear the cache
    await cache.clear();

    // Verify all items are removed
    expect(await cache.getItem("key1")).toBeNull();
    expect(await cache.getItem("key2")).toBeNull();
    expect(await cache.getItem("key3")).toBeNull();
  });

  test("should handle clearing an already empty cache gracefully", async () => {
    // Clear the cache first
    await cache.clear();

    // Attempt to clear again
    await expect(cache.clear()).resolves.toBeUndefined();

    // Verify cache is still empty
    expect(await cache.getItem("key1")).toBeNull();
    expect(await cache.getItem("key2")).toBeNull();
    expect(await cache.getItem("key3")).toBeNull();
  });

  test("should throw DatabaseError when clearing fails", async () => {
    // Simulate a failure by destroying the database connection
    cache.dbReadyPromise = Promise.reject(new Error("Simulated DB failure"));

    // Attempt to clear the cache
    await expect(cache.clear()).rejects.toThrow("Failed to clear the cache.");
  });
});
