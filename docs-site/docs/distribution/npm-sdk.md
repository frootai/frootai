---
sidebar_position: 3
title: npm SDK
description: The FrootAI npm SDK provides programmatic access to FROOT modules, solution plays, model comparison, and cost estimation from Node.js applications.
---

# npm SDK

The FrootAI npm SDK (`frootai`) gives you programmatic access to the entire FrootAI knowledge base from any Node.js application — search modules, browse plays, compare models, and estimate costs.

## Installation

```bash
npm install frootai
```

## Quick Start

```typescript
import { FrootAIClient } from 'frootai';

const client = new FrootAIClient();

// Search FROOT knowledge base
const results = await client.searchKnowledge('RAG chunking strategies');
console.log(results);

// Get a specific module
const module = await client.getModule('R2');
console.log(module.title); // "RAG Architecture"

// List all solution plays
const plays = await client.listPlays();
console.log(`${plays.length} plays available`);
```

## API Reference

### Knowledge & Modules

```typescript
// Search across all 17 FROOT modules
const results = await client.searchKnowledge(query: string, maxResults?: number);

// Get full content of a specific module
const module = await client.getModule(moduleId: string);
// moduleId: F1, F2, F3, R1, R2, R3, O1-O6, T1-T3

// List all modules organized by FROOT layer
const modules = await client.listModules();

// Look up an AI/ML term
const definition = await client.lookupTerm(term: string);
```

### Solution Plays

```typescript
// List all solution plays
const plays = await client.listPlays(filter?: string);

// Get detailed play information
const play = await client.getPlayDetail(playNumber: string);

// Semantic search for plays
const matches = await client.searchPlays(query: string, topK?: number);

// Compare plays side-by-side
const comparison = await client.comparePlays(plays: string[]);
```

### Models & Cost

```typescript
// Compare AI models for a use case
const comparison = await client.compareModels(useCase: string, priority?: string);

// Get model catalog
const catalog = await client.getModelCatalog(category?: string);

// Estimate monthly Azure costs
const estimate = await client.estimateCost(play: string, scale?: 'dev' | 'prod');
```

### Architecture

```typescript
// Get architecture guidance
const pattern = await client.getArchitecturePattern(scenario: string);

// Generate Mermaid.js diagram
const diagram = await client.generateDiagram(play: string);
```

## Usage Example: Play Cost Analysis

```typescript
import { FrootAIClient } from 'frootai';

const client = new FrootAIClient();

async function analyzePlay(playNumber: string) {
  const play = await client.getPlayDetail(playNumber);
  console.log(`Play: ${play.title}`);
  console.log(`Complexity: ${play.complexity}`);

  const devCost = await client.estimateCost(playNumber, 'dev');
  const prodCost = await client.estimateCost(playNumber, 'prod');
  console.log(`Dev cost: $${devCost.total}/mo`);
  console.log(`Prod cost: $${prodCost.total}/mo`);
}

analyzePlay('01');
```

## Version

Current version: **v4.0.0**, synced with 100 plays and all primitives.

## See Also

- [Python SDK](/distribution/python-sdk) — Python equivalent
- [MCP Server](/distribution/mcp-server) — MCP protocol access
- [CLI](/distribution/cli) — command-line interface
