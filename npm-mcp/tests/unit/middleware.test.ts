import { describe, it, expect, beforeEach } from 'vitest';
import { LRUCache, RateLimiter, mcpError, mcpNotFound, safeFetch } from '../../src/middleware/index.js';

describe('LRUCache', () => {
  let cache: LRUCache<string>;

  beforeEach(() => {
    cache = new LRUCache<string>(3, 1000); // max 3 items, 1s TTL
  });

  it('stores and retrieves values', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('returns undefined for missing keys', () => {
    expect(cache.get('missing')).toBeUndefined();
  });

  it('evicts oldest entry when full', () => {
    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('c', '3');
    cache.set('d', '4'); // should evict 'a'
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('d')).toBe('4');
  });

  it('expires entries after TTL', async () => {
    cache = new LRUCache<string>(10, 50); // 50ms TTL
    cache.set('fast', 'value');
    expect(cache.get('fast')).toBe('value');
    await new Promise(r => setTimeout(r, 60));
    expect(cache.get('fast')).toBeUndefined();
  });

  it('tracks hit/miss stats', () => {
    cache.set('hit', 'yes');
    cache.get('hit');  // hit
    cache.get('miss'); // miss
    const stats = cache.stats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBe('50.0%');
  });

  it('clears all entries', () => {
    cache.set('a', '1');
    cache.set('b', '2');
    cache.clear();
    expect(cache.stats().size).toBe(0);
    expect(cache.get('a')).toBeUndefined();
  });

  it('moves accessed items to end (LRU order)', () => {
    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('c', '3');
    cache.get('a'); // access 'a', moves to end
    cache.set('d', '4'); // should evict 'b' (oldest untouched)
    expect(cache.get('a')).toBe('1'); // still alive
    expect(cache.get('b')).toBeUndefined(); // evicted
  });
});

describe('RateLimiter', () => {
  it('allows requests within burst limit', () => {
    const limiter = new RateLimiter(3, 1);
    expect(limiter.allow('api')).toBe(true);
    expect(limiter.allow('api')).toBe(true);
    expect(limiter.allow('api')).toBe(true);
  });

  it('blocks requests exceeding burst', () => {
    const limiter = new RateLimiter(2, 0.001); // very slow refill
    expect(limiter.allow('api')).toBe(true);
    expect(limiter.allow('api')).toBe(true);
    expect(limiter.allow('api')).toBe(false);
  });

  it('tracks separate buckets per key', () => {
    const limiter = new RateLimiter(1, 0.001);
    expect(limiter.allow('key1')).toBe(true);
    expect(limiter.allow('key2')).toBe(true); // different key
    expect(limiter.allow('key1')).toBe(false); // same key exhausted
  });

  it('refills tokens over time', async () => {
    const limiter = new RateLimiter(1, 100); // 100 tokens/sec refill
    expect(limiter.allow('api')).toBe(true);
    expect(limiter.allow('api')).toBe(false);
    await new Promise(r => setTimeout(r, 50));
    expect(limiter.allow('api')).toBe(true); // refilled
  });
});

describe('mcpError', () => {
  it('returns isError: true', () => {
    const result = mcpError('Something failed');
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Something failed');
  });

  it('includes details when provided', () => {
    const result = mcpError('Failed', 'Details here');
    expect(result.content[0].text).toContain('Details here');
  });
});

describe('mcpNotFound', () => {
  it('returns formatted not-found message', () => {
    const result = mcpNotFound('Play', '999');
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Play');
    expect(result.content[0].text).toContain('999');
  });
});
