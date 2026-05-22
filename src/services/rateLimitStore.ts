interface RateLimitEntry {
  count: number;
  expiresAt: number;
}

const store = new Map<string, RateLimitEntry>();

/**
 * Simple in-memory rate limit check.
 * This avoids Redis dependency and works for a single process.
 */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.expiresAt <= now) {
    store.set(key, {
      count: 1,
      expiresAt: now + windowSec * 1000,
    });
    return true;
  }

  entry.count += 1;
  store.set(key, entry);
  return entry.count <= limit;
}