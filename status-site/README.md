# FrootAI Status Page

> Configuration for status.frootai.dev — powered by [Upptime](https://upptime.js.org).

## Setup

1. Create repo `frootai/status` from [Upptime template](https://github.com/upptime/upptime/generate)
2. Copy `.upptimerc.yml` to the new repo
3. Enable GitHub Pages (Settings → Pages → gh-pages branch)
4. Add CNAME `status.frootai.dev` in Cloudflare DNS → `frootai.github.io`
5. Upptime GitHub Actions will auto-check every 5 minutes

## Configuration

See [`.upptimerc.yml`](./.upptimerc.yml) for monitored services.

## Foundry observability (M8.25)

The Foundry hosted agent emits `foundry_session_started` / `foundry_session_completed` JSONL events to its stdout (forwarded to Application Insights). See [`foundry-observability.md`](./foundry-observability.md) for the event schema and dashboard KQL recipes.
