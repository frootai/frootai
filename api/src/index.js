/**
 * FrootAI Public REST API
 * =======================
 * Cloudflare Worker serving the FrootAI ecosystem data.
 * Powered by fai-catalog.json — the single source of truth.
 *
 * Endpoints:
 *   GET /health                    → Health check
 *   GET /v1/stats                  → Ecosystem statistics
 *   GET /v1/plays                  → List solution plays
 *   GET /v1/plays/:id              → Play detail
 *   GET /v1/primitives             → List all primitives (paginated)
 *   GET /v1/primitives/:type       → List by type (agents/skills/etc.)
 *   GET /v1/primitives/:type/:id   → Get specific primitive
 *   GET /v1/modules                → FROOT learning modules
 *   GET /v1/modules/:id            → Module detail
 *   GET /v1/glossary               → AI glossary terms
 *   GET /v1/glossary/:term         → Single term
 *   GET /v1/search?q=keyword       → Universal search
 *
 * @module api/src/index
 */

// Embedded catalog data — synced from .factory/fai-catalog.json at build time
// In production, this would be stored in Cloudflare KV or R2
let catalogData = null;

async function loadCatalog() {
  if (catalogData) return catalogData;
  // Load from embedded knowledge.json (bundled at deploy time)
  // For now, we use a minimal embedded dataset that can be expanded
  try {
    const resp = await fetch('https://raw.githubusercontent.com/frootai/frootai/main/.factory/fai-catalog.json');
    if (resp.ok) {
      catalogData = await resp.json();
      return catalogData;
    }
  } catch (e) {
    // Fallback to minimal data
  }
  return null;
}

// ─── CORS ─────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function corsResponse(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'X-Powered-By': 'FrootAI',
      ...CORS_HEADERS,
    },
  });
}

function errorResponse(message, status = 404) {
  return corsResponse({ error: message, status }, status);
}

// ─── Route Handlers ───────────────────────────────────

async function handleHealth() {
  return corsResponse({
    status: 'healthy',
    service: 'frootai-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
}

async function handleStats() {
  const catalog = await loadCatalog();
  if (!catalog) return errorResponse('Catalog unavailable', 503);

  return corsResponse({
    version: catalog.version,
    generated: catalog.generated,
    stats: catalog.stats,
    ecosystem: {
      website: 'https://frootai.dev',
      docs: 'https://docs.frootai.dev',
      github: 'https://github.com/frootai/frootai',
      npm_mcp: 'https://www.npmjs.com/package/frootai-mcp',
      npm_sdk: 'https://www.npmjs.com/package/frootai',
      pypi: 'https://pypi.org/project/frootai/',
      vscode: 'https://marketplace.visualstudio.com/items?itemName=frootai.frootai',
    },
  });
}

async function handlePlays(params) {
  const catalog = await loadCatalog();
  if (!catalog) return errorResponse('Catalog unavailable', 503);

  const plays = catalog.plays || [];

  if (params.id) {
    const play = plays.find(p => p.id === params.id || p.id === `play-${params.id}` || p.number === params.id);
    if (!play) return errorResponse(`Play '${params.id}' not found`);
    return corsResponse(play);
  }

  // Pagination
  const page = parseInt(params.page) || 1;
  const limit = Math.min(parseInt(params.limit) || 20, 100);
  const offset = (page - 1) * limit;

  // Search filter
  let filtered = plays;
  if (params.q) {
    const q = params.q.toLowerCase();
    filtered = plays.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      (p.id || '').toLowerCase().includes(q)
    );
  }

  return corsResponse({
    total: filtered.length,
    page,
    limit,
    data: filtered.slice(offset, offset + limit),
  });
}

async function handlePrimitives(params) {
  const catalog = await loadCatalog();
  if (!catalog) return errorResponse('Catalog unavailable', 503);

  const validTypes = ['agents', 'skills', 'instructions', 'hooks', 'plugins', 'workflows'];

  if (!params.type) {
    // Return summary of all types
    const summary = {};
    for (const type of validTypes) {
      summary[type] = (catalog[type] || []).length;
    }
    return corsResponse({ types: summary, total: Object.values(summary).reduce((a, b) => a + b, 0) });
  }

  if (!validTypes.includes(params.type)) {
    return errorResponse(`Invalid type '${params.type}'. Valid: ${validTypes.join(', ')}`);
  }

  const items = catalog[params.type] || [];

  if (params.id) {
    const item = items.find(i => i.id === params.id || i.name === params.id);
    if (!item) return errorResponse(`${params.type}/${params.id} not found`);
    return corsResponse(item);
  }

  // Pagination
  const page = parseInt(params.page) || 1;
  const limit = Math.min(parseInt(params.limit) || 20, 100);
  const offset = (page - 1) * limit;

  // Search filter
  let filtered = items;
  if (params.q) {
    const q = params.q.toLowerCase();
    filtered = items.filter(i =>
      (i.name || '').toLowerCase().includes(q) ||
      (i.description || '').toLowerCase().includes(q) ||
      (i.id || '').toLowerCase().includes(q)
    );
  }

  return corsResponse({
    type: params.type,
    total: filtered.length,
    page,
    limit,
    data: filtered.slice(offset, offset + limit),
  });
}

async function handleModules(params) {
  const catalog = await loadCatalog();
  if (!catalog) return errorResponse('Catalog unavailable', 503);

  const modules = catalog.modules || catalog.frootModules || [];

  if (params.id) {
    const mod = modules.find(m => m.id === params.id || m.id === params.id.toUpperCase());
    if (!mod) return errorResponse(`Module '${params.id}' not found`);
    return corsResponse(mod);
  }

  return corsResponse({ total: modules.length, data: modules });
}

async function handleGlossary(params) {
  const catalog = await loadCatalog();
  if (!catalog) return errorResponse('Catalog unavailable', 503);

  const glossary = catalog.glossary || [];

  if (params.term) {
    const term = glossary.find(g =>
      (g.term || g.id || '').toLowerCase() === params.term.toLowerCase()
    );
    if (!term) return errorResponse(`Term '${params.term}' not found`);
    return corsResponse(term);
  }

  // Search filter
  let filtered = glossary;
  if (params.q) {
    const q = params.q.toLowerCase();
    filtered = glossary.filter(g =>
      (g.term || g.id || '').toLowerCase().includes(q) ||
      (g.definition || '').toLowerCase().includes(q)
    );
  }

  return corsResponse({ total: filtered.length, data: filtered });
}

async function handleSearch(params) {
  const catalog = await loadCatalog();
  if (!catalog) return errorResponse('Catalog unavailable', 503);

  if (!params.q) return errorResponse('Missing query parameter: ?q=keyword', 400);

  const q = params.q.toLowerCase();
  const results = [];
  const maxResults = Math.min(parseInt(params.limit) || 20, 50);

  // Search across all types
  const searchTypes = ['agents', 'skills', 'instructions', 'hooks', 'plugins', 'workflows', 'plays'];

  for (const type of searchTypes) {
    const items = catalog[type] || [];
    for (const item of items) {
      const name = (item.name || item.id || '').toLowerCase();
      const desc = (item.description || '').toLowerCase();

      if (name.includes(q) || desc.includes(q)) {
        results.push({
          type,
          id: item.id,
          name: item.name || item.id,
          description: (item.description || '').substring(0, 200),
          relevance: name.includes(q) ? 2 : 1,
        });
      }

      if (results.length >= maxResults * 2) break;
    }
  }

  // Sort by relevance (name matches first)
  results.sort((a, b) => b.relevance - a.relevance);

  return corsResponse({
    query: params.q,
    total: results.length,
    data: results.slice(0, maxResults),
  });
}

// ─── Router ───────────────────────────────────────────

function parseUrl(url) {
  const u = new URL(url);
  const parts = u.pathname.split('/').filter(Boolean);
  const params = Object.fromEntries(u.searchParams);
  return { parts, params };
}

async function router(request) {
  const { parts, params } = parseUrl(request.url);

  // OPTIONS (CORS preflight)
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Only GET allowed
  if (request.method !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  // Route matching
  const [v, resource, sub, detail] = parts;

  // /health
  if (parts[0] === 'health') return handleHealth();

  // /v1/...
  if (v !== 'v1') {
    return corsResponse({
      name: 'FrootAI API',
      version: '1.0.0',
      description: 'The uniFAIng glue for the GenAI ecosystem — Public REST API',
      endpoints: {
        health: '/health',
        stats: '/v1/stats',
        plays: '/v1/plays',
        primitives: '/v1/primitives',
        modules: '/v1/modules',
        glossary: '/v1/glossary',
        search: '/v1/search?q=keyword',
      },
      docs: 'https://docs.frootai.dev/api-reference/mcp-tools',
      website: 'https://frootai.dev',
    });
  }

  switch (resource) {
    case 'stats':
      return handleStats();
    case 'plays':
      return handlePlays({ ...params, id: sub });
    case 'primitives':
      return handlePrimitives({ ...params, type: sub, id: detail });
    case 'modules':
      return handleModules({ ...params, id: sub });
    case 'glossary':
      return handleGlossary({ ...params, term: sub });
    case 'search':
      return handleSearch(params);
    default:
      return errorResponse(`Unknown endpoint: /v1/${resource}`, 404);
  }
}

// ─── Worker Entry ─────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    try {
      return await router(request);
    } catch (error) {
      return errorResponse(`Internal server error: ${error.message}`, 500);
    }
  },
};
