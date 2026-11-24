import { beforeEach, describe, expect, it } from "vitest";
import { ensureRedisConnected, redis } from "../src/db/redis.js";
import { cached, invalidateCache } from "../src/lib/cache.js";

beforeEach(async () => {
  await ensureRedisConnected();
  await redis.flushdb();
});

describe("read-through cache", () => {
  it("loads once and serves subsequent reads from Redis", async () => {
    let loads = 0;
    const load = async () => ({ value: ++loads });

    const first = await cached("test:once", 60, load);
    const second = await cached("test:once", 60, load);

    expect(first).toEqual({ value: 1 });
    expect(second).toEqual({ value: 1 });
    expect(loads).toBe(1);
  });

  it("reloads after invalidation", async () => {
    let loads = 0;
    const load = async () => ({ value: ++loads });

    await cached("test:invalidate", 60, load);
    await invalidateCache("test:invalidate");
    const after = await cached("test:invalidate", 60, load);

    expect(after.value).toBe(2);
  });

  it("does not leak between differently named keys", async () => {
    await cached("test:a", 60, async () => "a");
    const b = await cached("test:b", 60, async () => "b");

    expect(b).toBe("b");
  });
});
