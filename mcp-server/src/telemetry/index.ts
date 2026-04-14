/**
 * FAI MCP Server — OpenTelemetry Instrumentation
 *
 * Provides tracing + metrics for all MCP tool calls.
 * Opt-in: only activates when OTEL_EXPORTER_OTLP_ENDPOINT or FAI_TELEMETRY_ENABLED is set.
 *
 * Usage:
 *   OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 npx frootai-mcp http
 */

import { trace, metrics, SpanStatusCode, type Tracer, type Meter } from '@opentelemetry/api';

let _initialized = false;
let _tracer: Tracer;
let _meter: Meter;

/** Initialize OpenTelemetry SDK (no-op if env vars not set) */
export async function initTelemetry(serviceName: string, serviceVersion: string): Promise<boolean> {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint && !process.env.FAI_TELEMETRY_ENABLED) {
    _tracer = trace.getTracer(serviceName);
    _meter = metrics.getMeter(serviceName);
    return false;
  }

  try {
    const { NodeSDK } = await import('@opentelemetry/sdk-node');
    const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
    const { OTLPMetricExporter } = await import('@opentelemetry/exporter-metrics-otlp-http');
    const { PeriodicExportingMetricReader } = await import('@opentelemetry/sdk-metrics');
    const resourcesMod: any = await import('@opentelemetry/resources');
    const Resource = resourcesMod.Resource || resourcesMod.default?.Resource;
    const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = await import('@opentelemetry/semantic-conventions');

    const resource = new Resource({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: serviceVersion,
    });

    const sdk = new NodeSDK({
      resource,
      traceExporter: new OTLPTraceExporter({
        url: endpoint ? `${endpoint}/v1/traces` : undefined,
      }),
      metricReader: new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({
          url: endpoint ? `${endpoint}/v1/metrics` : undefined,
        }),
        exportIntervalMillis: 30_000,
      }),
    });

    sdk.start();
    _initialized = true;
    _tracer = trace.getTracer(serviceName);
    _meter = metrics.getMeter(serviceName);
    return true;
  } catch {
    _tracer = trace.getTracer(serviceName);
    _meter = metrics.getMeter(serviceName);
    return false;
  }
}

export function getTracer(): Tracer { return _tracer || trace.getTracer('frootai-mcp'); }
export function getMeter(): Meter { return _meter || metrics.getMeter('frootai-mcp'); }
export function isEnabled(): boolean { return _initialized; }

// ── FAI Custom Metrics (T40) ────────────────────────────────────

let _toolCalls: ReturnType<Meter['createCounter']>;
let _toolDuration: ReturnType<Meter['createHistogram']>;
let _toolErrors: ReturnType<Meter['createCounter']>;
let _playsWired: ReturnType<Meter['createCounter']>;
let _qualityEvals: ReturnType<Meter['createCounter']>;

function ensureMetrics() {
  if (_toolCalls) return;
  const m = getMeter();
  _toolCalls = m.createCounter('fai.tool.calls', { description: 'MCP tool call count' });
  _toolDuration = m.createHistogram('fai.tool.duration_ms', { description: 'Tool call duration', unit: 'ms' });
  _toolErrors = m.createCounter('fai.tool.errors', { description: 'Tool call errors' });
  _playsWired = m.createCounter('fai.engine.plays_wired', { description: 'Solution plays wired' });
  _qualityEvals = m.createCounter('fai.engine.quality_evaluations', { description: 'Quality evaluations run' });
}

/** Record a tool call metric */
export function recordToolCall(toolName: string, durationMs: number, error?: boolean) {
  ensureMetrics();
  _toolCalls.add(1, { tool: toolName });
  _toolDuration.record(durationMs, { tool: toolName });
  if (error) _toolErrors.add(1, { tool: toolName });
}

/** Record a play wiring */
export function recordPlayWired(playId: string) {
  ensureMetrics();
  _playsWired.add(1, { play: playId });
}

/** Record a quality evaluation */
export function recordQualityEval(passed: boolean) {
  ensureMetrics();
  _qualityEvals.add(1, { passed: String(passed) });
}

/**
 * Wrap a tool handler with tracing + metrics.
 * Use this to instrument any tool handler function.
 */
export function instrumentTool<T>(
  toolName: string,
  handler: (params: T) => Promise<any>,
): (params: T) => Promise<any> {
  return async (params) => {
    const tracer = getTracer();
    const span = tracer.startSpan(`tool.${toolName}`);
    span.setAttribute('fai.tool.name', toolName);

    const start = Date.now();
    try {
      const result = await handler(params);
      span.setStatus({ code: SpanStatusCode.OK });
      recordToolCall(toolName, Date.now() - start);
      return result;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
      recordToolCall(toolName, Date.now() - start, true);
      throw err;
    } finally {
      span.end();
    }
  };
}
