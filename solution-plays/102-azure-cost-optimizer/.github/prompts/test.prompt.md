---
name: "Test ACO Solution"
description: "Run the public solution validation and focused runtime checks without Azure writes or model calls by default."
agent: "ACO Builder"
---
Run `npm run validate`. Summarize sanitization, contract parity, backend, frontend, Playwright, and Bicep results. If a runtime URL is provided, run read-only smoke checks. Do not refresh evidence or invoke a model unless I approve that exact action.
