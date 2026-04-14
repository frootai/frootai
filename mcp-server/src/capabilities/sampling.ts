/**
 * MCP Sampling — Server requests LLM completions from the client.
 * No server-side API keys needed — the client's LLM handles it.
 *
 * Use cases:
 * - smart_scaffold: generate domain-specific copilot-instructions.md
 * - Intelligent evaluation: LLM-as-judge beyond numeric scores
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export interface SamplingRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  priority?: 'cost' | 'speed' | 'intelligence';
}

export interface SamplingResult {
  text: string;
  model: string;
  stopReason: string;
}

/**
 * Request LLM sampling from the connected client.
 * Returns null if client doesn't support sampling or request fails.
 */
export async function requestSampling(
  server: McpServer,
  request: SamplingRequest,
): Promise<SamplingResult | null> {
  try {
    const result = await server.server.createMessage({
      messages: [
        { role: 'user', content: { type: 'text', text: request.prompt } },
      ],
      systemPrompt: request.systemPrompt || 'You are a helpful AI architecture assistant.',
      maxTokens: request.maxTokens || 500,
      modelPreferences: {
        hints: [{ name: 'gpt-4o' }, { name: 'claude-3-sonnet' }],
        intelligencePriority: request.priority === 'intelligence' ? 0.9 : 0.5,
        speedPriority: request.priority === 'speed' ? 0.9 : 0.5,
        costPriority: request.priority === 'cost' ? 0.9 : 0.3,
      },
    });

    if (result.content.type === 'text') {
      return { text: result.content.text, model: result.model, stopReason: result.stopReason || 'unknown' };
    }
    return null;
  } catch {
    return null; // Client doesn't support sampling
  }
}
