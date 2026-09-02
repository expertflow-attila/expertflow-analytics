import { env } from "@/env";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * Fixed-window rate limiting.
 *
 * Without Redis this falls back to an in-process counter, which is correct for
 * single-instance self-hosting and for development, but does NOT hold across
 * serverless instances. The limiter is a guard rail against runaway clients,
 * not a billing boundary — see docs/architecture.md.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export async function checkRateLimit(
  key: string,
  opts: { limit: number; windowSeconds: number },
): Promise<RateLimitResult> {
  if (env.REDIS_URL) {
    const redisResult = await checkWithRedis(key, opts);
    if (redisResult) return redisResult;
  }

  const now = Date.now();
  const windowMs = opts.windowSeconds * 1000;
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      remaining: opts.limit - 1,
      retryAfterSeconds: 0,
    };
  }

  existing.count += 1;
  const allowed = existing.count <= opts.limit;

  return {
    allowed,
    remaining: Math.max(0, opts.limit - existing.count),
    retryAfterSeconds: allowed
      ? 0
      : Math.ceil((existing.resetAt - now) / 1000),
  };
}

/**
 * Redis-backed counter. Returns null when Redis is unreachable so a Redis
 * outage degrades to local limiting rather than dropping all traffic.
 */
async function checkWithRedis(
  key: string,
  opts: { limit: number; windowSeconds: number },
): Promise<RateLimitResult | null> {
  try {
    // `redis` is an optional peer dependency — the module specifier is held in
    // a variable so bundlers treat it as external rather than a hard import.
    const moduleName = "redis";
    const mod = (await import(/* webpackIgnore: true */ moduleName).catch(
      () => null,
    )) as { createClient?: unknown } | null;

    const createClient = mod?.createClient as
      | Parameters<typeof getRedisClient>[0]
      | undefined;
    if (!createClient) return null;

    const client = await getRedisClient(createClient);
    if (!client) return null;

    const redisKey = `ratelimit:${key}`;
    const count = await client.incr(redisKey);
    if (count === 1) await client.expire(redisKey, opts.windowSeconds);

    const ttl = await client.ttl(redisKey);
    const allowed = count <= opts.limit;

    return {
      allowed,
      remaining: Math.max(0, opts.limit - count),
      retryAfterSeconds: allowed ? 0 : Math.max(1, ttl),
    };
  } catch {
    return null;
  }
}

type RedisClient = {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  ttl(key: string): Promise<number>;
};

let redisClient: RedisClient | null = null;

async function getRedisClient(
  createClient: (opts: { url: string }) => {
    connect(): Promise<unknown>;
    on(event: string, cb: (err: unknown) => void): void;
  } & RedisClient,
): Promise<RedisClient | null> {
  if (redisClient) return redisClient;
  if (!env.REDIS_URL) return null;

  const client = createClient({ url: env.REDIS_URL });
  client.on("error", () => {
    redisClient = null;
  });
  await client.connect();
  redisClient = client;
  return client;
}
