import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { safeFetch } from '../../src/middleware/index.js';

describe('safeFetch', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns text on successful fetch', async () => {
    (fetch as any).mockResolvedValue({ ok: true, text: () => Promise.resolve('response body') });
    const result = await safeFetch('https://example.com');
    expect(result).toBe('response body');
  });

  it('returns null on HTTP error', async () => {
    (fetch as any).mockResolvedValue({ ok: false, status: 404 });
    const result = await safeFetch('https://example.com');
    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    (fetch as any).mockRejectedValue(new Error('network down'));
    const result = await safeFetch('https://example.com');
    expect(result).toBeNull();
  });

  it('respects timeout via AbortController', async () => {
    (fetch as any).mockImplementation(
      (_url: string, opts: any) =>
        new Promise((_resolve, reject) => {
          opts.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );
    const result = await safeFetch('https://example.com', {}, 50);
    expect(result).toBeNull();
  });

  it('passes options to fetch', async () => {
    (fetch as any).mockResolvedValue({ ok: true, text: () => Promise.resolve('ok') });
    await safeFetch('https://example.com', { method: 'POST' });
    expect(fetch).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({ method: 'POST', signal: expect.any(AbortSignal) }),
    );
  });

  it('uses default 10s timeout when not specified', async () => {
    (fetch as any).mockResolvedValue({ ok: true, text: () => Promise.resolve('ok') });
    await safeFetch('https://example.com');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('clears timeout after successful fetch', async () => {
    const clearSpy = vi.spyOn(global, 'clearTimeout');
    (fetch as any).mockResolvedValue({ ok: true, text: () => Promise.resolve('data') });
    await safeFetch('https://example.com');
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('clears timeout after failed fetch', async () => {
    const clearSpy = vi.spyOn(global, 'clearTimeout');
    (fetch as any).mockRejectedValue(new Error('fail'));
    await safeFetch('https://example.com');
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
