import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initTelemetry,
  getTracer,
  getMeter,
  isEnabled,
  recordToolCall,
  recordPlayWired,
  recordQualityEval,
  instrumentTool,
} from '../../src/telemetry/index.js';

describe('telemetry — initialization', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    delete process.env.FAI_TELEMETRY_ENABLED;
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it('returns false when no env vars are set (no-op mode)', async () => {
    const result = await initTelemetry('test-service', '1.0.0');
    expect(result).toBe(false);
  });

  it('isEnabled returns false after no-op init', async () => {
    await initTelemetry('test', '1.0.0');
    expect(isEnabled()).toBe(false);
  });

  it('getTracer returns a valid tracer after init', async () => {
    await initTelemetry('test', '1.0.0');
    const tracer = getTracer();
    expect(tracer).toBeDefined();
    expect(typeof tracer.startSpan).toBe('function');
  });

  it('getMeter returns a valid meter after init', async () => {
    await initTelemetry('test', '1.0.0');
    const meter = getMeter();
    expect(meter).toBeDefined();
    expect(typeof meter.createCounter).toBe('function');
  });
});

describe('telemetry — metrics recording', () => {
  beforeEach(async () => {
    await initTelemetry('test-metrics', '1.0.0');
  });

  it('recordToolCall does not throw', () => {
    expect(() => recordToolCall('test_tool', 42)).not.toThrow();
  });

  it('recordToolCall with error flag does not throw', () => {
    expect(() => recordToolCall('test_tool', 100, true)).not.toThrow();
  });

  it('recordPlayWired does not throw', () => {
    expect(() => recordPlayWired('01')).not.toThrow();
  });

  it('recordQualityEval does not throw', () => {
    expect(() => recordQualityEval(true)).not.toThrow();
    expect(() => recordQualityEval(false)).not.toThrow();
  });
});

describe('telemetry — instrumentTool', () => {
  beforeEach(async () => {
    await initTelemetry('test-instrument', '1.0.0');
  });

  it('wraps a handler and returns the same result', async () => {
    const handler = async (params: { x: number }) => ({ result: params.x * 2 });
    const wrapped = instrumentTool('double', handler);
    const result = await wrapped({ x: 5 });
    expect(result).toEqual({ result: 10 });
  });

  it('preserves error propagation', async () => {
    const handler = async () => { throw new Error('boom'); };
    const wrapped = instrumentTool('failing', handler);
    await expect(wrapped({})).rejects.toThrow('boom');
  });

  it('returns a function', () => {
    const wrapped = instrumentTool('noop', async () => 'ok');
    expect(typeof wrapped).toBe('function');
  });

  it('measures duration (basic smoke test)', async () => {
    const handler = async () => {
      await new Promise(r => setTimeout(r, 10));
      return 'done';
    };
    const wrapped = instrumentTool('slow', handler);
    const result = await wrapped({});
    expect(result).toBe('done');
  });
});
