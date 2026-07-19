import http from 'node:http';

function send(response, status, body) {
  const content = JSON.stringify(body);
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(content) });
  response.end(content);
}

async function readJson(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 1024 * 1024) throw Object.assign(new Error('Request body exceeds 1 MB'), { code: 'payload_too_large', status: 413 });
    chunks.push(chunk);
  }
  try {
    return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
  } catch {
    throw Object.assign(new Error('Request body must be valid JSON'), { code: 'invalid_json', status: 400 });
  }
}

export function createScenarioServer(kernel, { policyEvaluator = null, policy = null } = {}) {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    try {
      if (request.method === 'GET' && url.pathname === '/health/live') return send(response, 200, { status: 'live' });
      if (request.method === 'GET' && url.pathname === '/health/ready') {
        const readiness = kernel.ready();
        return send(response, readiness.status === 'ready' ? 200 : 503, readiness);
      }
      if (request.method === 'GET' && url.pathname === '/v1/scenarios') return send(response, 200, { scenarios: kernel.catalog() });
      if (request.method === 'POST' && url.pathname === '/v1/policy/check') {
        if (!policyEvaluator || !policy) return send(response, 503, { error: { code: 'policy_unavailable' } });
        const input = await readJson(request);
        const result = policyEvaluator(policy, input);
        return send(response, result.allowed ? 200 : 403, result);
      }
      const schemaMatch = url.pathname.match(/^\/v1\/scenarios\/([^/]+)\/schema$/);
      if (request.method === 'GET' && schemaMatch) {
        const scenario = kernel.scenarios.get(decodeURIComponent(schemaMatch[1]));
        if (!scenario) return send(response, 404, { error: { code: 'scenario_not_found' } });
        return send(response, 200, { input: scenario.inputSchema, output: scenario.outputSchema });
      }
      const runMatch = url.pathname.match(/^\/v1\/scenarios\/([^/]+)\/runs$/);
      if (request.method === 'POST' && runMatch) {
        const input = await readJson(request);
        const run = await kernel.execute(decodeURIComponent(runMatch[1]), input, { correlationId: request.headers['x-correlation-id'] });
        return send(response, 200, run);
      }
      const statusMatch = url.pathname.match(/^\/v1\/runs\/([^/]+)$/);
      if (request.method === 'GET' && statusMatch) {
        const run = kernel.getRun(statusMatch[1]);
        return run ? send(response, 200, run) : send(response, 404, { error: { code: 'run_not_found' } });
      }
      return send(response, 404, { error: { code: 'route_not_found' } });
    } catch (error) {
      return send(response, error.status || 500, { error: { code: error.code || 'internal_error', message: error.status && error.status < 500 ? error.message : 'Request failed' } });
    }
  });
}

export async function listen(server, port = 0) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}
