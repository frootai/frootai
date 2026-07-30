<!-- [X2.28] MCP attach-spec changelog — audit trail for every Tier-1 spec change. Doctrine #8 (NEVER FORGET PROVENANCE). CC0-1.0. -->
# MCP Attach Spec Changelog

Every change to a Tier-1 attach spec under
[`mcp-specs/`](mcp-specs/) is recorded here as a `(date, slug, change-summary,
reviewer)` row, so the spec library has an audit-ready provenance trail. Rows are
appended in reverse-chronological order (newest at the top of the table).

Helpers that diff spec bundles into rows live in
`frootai-core/scripts/marketplace/crawler/lib/spec-changelog.js`.

| Date | Slug | Change summary | Reviewer |
|---|---|---|---|
| 2026-07-30 | `markitdown` | corrected tested version to published wheel 0.0.1a4 | frootai-maintainer |
| 2026-06-25 | `openai` | spec added (hosted) — verified-publisher (Tier-2, X4.18; openai evidence backfilled). Official OpenAI Developer Docs MCP (developers.openai.com/mcp); http-sse, read-only search/fetch. OpenAI ships no general API MCP server | frootai-maintainer |
| 2026-06-25 | `pinecone` | spec added (tested 0.2.1) — verified-publisher (Tier-2, X4.17; pinecone-io elevated). Re-targeted from the lancedb slot (no official LanceDB server); npx stdio, index mgmt + records upsert/search/rerank | frootai-maintainer |
| 2026-06-25 | `chromadb` | spec added (tested 0.2.6) — verified-publisher (Tier-2; chroma-core promoted community→verified, X4.16); uvx stdio, collections + semantic search; 2 destructive delete tools | frootai-maintainer |
| 2026-06-25 | `qdrant` | spec added (tested 0.8.1) — verified-publisher (Tier-2 candidate, X4.15; trust elevated); uvx stdio, vector store/find | frootai-maintainer |
| 2026-06-25 | `firecrawl` | spec added (tested 3.22.0) — verified-publisher (Tier-2 candidate, X4.14); npx stdio, scrape/search/crawl/extract | frootai-maintainer |
| 2026-06-25 | `hashicorp-terraform` | spec added (tested 1.0.0) — verified-publisher (Tier-2 candidate, X4.13); Docker stdio, Terraform Registry + HCP/TFE tools | frootai-maintainer |
| 2026-06-25 | `vercel` | spec added (tested hosted 2026-06-25) — verified-publisher (Tier-2, X4.12); hosted http-sse OAuth, projects + deployments + logs (completes the 12 verified-publisher core) | frootai-maintainer |
| 2026-06-25 | `atlassian` | spec added (tested hosted 2026-06-25) — verified-publisher (Tier-2, X4.11); hosted http-sse OAuth, Jira + Confluence tools | frootai-maintainer |
| 2026-06-25 | `sonarsource` | spec added (tested 1.21.0.2975) — verified-publisher (Tier-2, X4.10); Docker stdio transport, code-quality + security tools | frootai-maintainer |
| 2026-06-25 | `sonatype` | spec added (tested hosted 2026-06-25) — verified-publisher (Tier-2, X4.9); hosted http-sse, dependency-intelligence tools | frootai-maintainer |
| 2026-06-25 | `pgedge` | spec added (tested 1.0.0) — verified-publisher (Tier-2, X4.8); Docker stdio transport, read-only Postgres query surface | frootai-maintainer |
| 2026-06-25 | `elastic` | spec added (tested 0.4.6) — verified-publisher (Tier-2, X4.7); Docker stdio transport, read-only query surface | frootai-maintainer |
| 2026-06-25 | `supabase` | spec added (tested 0.8.2) — verified-publisher (Tier-2, X4.6); SQL + project mgmt, destructive branch-delete audited | frootai-maintainer |
| 2026-06-25 | `mongodb` | spec added (tested 1.13.0) — verified-publisher (Tier-2, X4.5); DB + Atlas tools, destructive drop/delete audited | frootai-maintainer |
| 2026-06-25 | `tavily-ai` | spec added (tested 0.2.20) — verified-publisher (Tier-2, X4.4); search/extract/map/crawl | frootai-maintainer |
| 2026-06-25 | `stripe` | spec added (tested 0.3.3) — verified-publisher (Tier-2, X4.3); restricted-API-key auth | frootai-maintainer |
| 2026-06-25 | `notion` | spec added (tested 2.1.0) — verified-publisher (Tier-2, X4.2); data-source model | frootai-maintainer |
| 2026-06-25 | `ms-learn` | spec added (tested 2026-06-25) — http-sse hosted endpoint | frootai-maintainer |
| 2026-06-25 | `context7` | spec added (tested 1.0.0) — verified-publisher | frootai-maintainer |
| 2026-06-25 | `markitdown` | spec added (tested 0.0.1) — uvx transport | frootai-maintainer |
| 2026-06-25 | `github` | spec added (tested 0.1.0) | frootai-maintainer |
| 2026-06-25 | `playwright` | spec added (tested 0.0.20) | frootai-maintainer |
| 2026-06-25 | `azure` | spec added (tested 0.5.0) | frootai-maintainer |

## Genesis

The 6 Tier-1 specs (`azure`, `playwright`, `github`, `markitdown`, `context7`,
`ms-learn`) were authored in Phase X2 ([X2.2]–[X2.7]) against the
[`mcp-spec-v1` schema](../../schemas/mcp-spec-v1.schema.json), each validated by
the Ajv + jsonschema validators ([X2.9]) and seeded with a `tools/list` snapshot
([X2.10]). Subsequent rows record re-pins, transport changes, and tool-surface
updates as they happen. A snapshot refresh driven by upstream drift (the X2.25
auto-update PR) should add a `re-pinned …` row when merged.
