// Simple in-memory limits. Good enough for one server or a demo.
// On serverless platforms each instance keeps its own counts, so pair this with
// a spend limit in your AI provider's console, and swap in a shared store
// (Redis, Upstash, etc.) if you run it at scale.

type Bucket = { count: number; resetAt: number };

export function createRateLimiter(limit: number, windowMs: number, now: () => number = Date.now) {
  const buckets = new Map<string, Bucket>();
  return {
    /** Returns true if this key may make another request. limit 0 = unlimited. */
    take(key: string): boolean {
      if (limit <= 0) return true;
      const t = now();
      let b = buckets.get(key);
      if (!b || t >= b.resetAt) {
        b = { count: 0, resetAt: t + windowMs };
        buckets.set(key, b);
      }
      if (buckets.size > 10_000) {
        for (const [k, v] of buckets) if (t >= v.resetAt) buckets.delete(k);
      }
      if (b.count >= limit) return false;
      b.count += 1;
      return true;
    },
  };
}

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

let perVisitor: ReturnType<typeof createRateLimiter> | null = null;
let daily: ReturnType<typeof createRateLimiter> | null = null;

export function visitorLimiter(perMinute: number) {
  perVisitor ??= createRateLimiter(perMinute, MINUTE);
  return perVisitor;
}

export function dailyModelLimiter(perDay: number) {
  daily ??= createRateLimiter(perDay, DAY);
  return daily;
}

/** Best-effort visitor id. Behind a proxy, the first x-forwarded-for entry is the client. */
export function clientKey(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return headers.get('x-real-ip') ?? 'local';
}
