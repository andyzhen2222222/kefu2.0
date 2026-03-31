import { createClient } from 'redis';

type RedisConn = ReturnType<typeof createClient>;

let shared: RedisConn | null = null;

export async function getRedisClient(): Promise<RedisConn | null> {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;
  if (!shared) {
    const c = createClient({ url });
    c.on('error', () => {});
    try {
      await c.connect();
      shared = c;
    } catch {
      shared = null;
      return null;
    }
  }
  if (!shared || !shared.isOpen) return null;
  return shared;
}

/** 内存回退：与原先 ai 路由行为一致 */
const memBuckets = new Map<string, { n: number; reset: number }>();

export async function rateLimitDistributed(
  key: string,
  max: number,
  windowMs: number
): Promise<boolean> {
  const redis = await getRedisClient();
  if (redis) {
    try {
      const ttlSec = Math.max(1, Math.ceil(windowMs / 1000));
      const rkey = `intellidesk:rl:${key}`;
      const n = await redis.incr(rkey);
      if (n === 1) await redis.expire(rkey, ttlSec);
      return n <= max;
    } catch {
      /* fall through */
    }
  }
  const now = Date.now();
  let b = memBuckets.get(key);
  if (!b || now > b.reset) {
    b = { n: 0, reset: now + windowMs };
    memBuckets.set(key, b);
  }
  b.n += 1;
  return b.n <= max;
}
