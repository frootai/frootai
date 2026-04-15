/** LRU Cache with TTL */
export class LRUCache<T> {
  private cache = new Map<string, { value: T; expiresAt: number }>();
  private hits = 0;
  private misses = 0;

  constructor(
    private readonly maxSize: number = 100,
    private readonly defaultTTL: number = 300_000,
  ) {}

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) { this.misses++; return undefined; }
    if (Date.now() > entry.expiresAt) { this.cache.delete(key); this.misses++; return undefined; }
    this.cache.delete(key);
    this.cache.set(key, entry);
    this.hits++;
    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(key, { value, expiresAt: Date.now() + (ttlMs ?? this.defaultTTL) });
  }

  stats() {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size, hits: this.hits, misses: this.misses,
      hitRate: total > 0 ? `${((this.hits / total) * 100).toFixed(1)}%` : '0%',
    };
  }

  clear(): void { this.cache.clear(); this.hits = 0; this.misses = 0; }
}

/** Token bucket rate limiter */
export class RateLimiter {
  private buckets = new Map<string, { tokens: number; lastRefill: number }>();

  constructor(
    private readonly maxTokens: number = 10,
    private readonly refillPerSec: number = 1,
  ) {}

  allow(key: string): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(key);
    if (!bucket) { bucket = { tokens: this.maxTokens, lastRefill: now }; this.buckets.set(key, bucket); }
    const elapsed = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(this.maxTokens, bucket.tokens + elapsed * this.refillPerSec);
    bucket.lastRefill = now;
    if (bucket.tokens >= 1) { bucket.tokens -= 1; return true; }
    return false;
  }
}

/** Standardized MCP error response */
export function mcpError(message: string, details?: string) {
  return {
    content: [{ type: 'text' as const, text: details ? `❌ ${message}\n\n${details}` : `❌ ${message}` }],
    isError: true,
  };
}

export function mcpNotFound(entity: string, id: string) {
  return {
    content: [{ type: 'text' as const, text: `❌ ${entity} "${id}" not found.` }],
    isError: true,
  };
}

/** Safe HTTP fetch with timeout and graceful degradation */
export async function safeFetch(url: string, options: RequestInit = {}, timeoutMs = 10000): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch {
    clearTimeout(timeout);
    return null;
  }
}
