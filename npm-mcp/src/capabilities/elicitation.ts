/**
 * MCP Elicitation — Server asks user for structured input.
 * Client renders a form/dialog, user fills it in, server processes.
 *
 * Use cases:
 * - Play configuration: model choice, WAF pillars, Azure region
 * - Evaluation thresholds: confirm/adjust quality gates
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export interface ElicitationField {
  name: string;
  type: 'string' | 'number' | 'boolean';
  title: string;
  description?: string;
  default?: string | number | boolean;
  enum?: string[];
  enumNames?: string[];
  required?: boolean;
}

/**
 * Ask the user for structured input via MCP elicitation.
 * Returns null if client doesn't support it or user cancels.
 */
export async function askUser(
  server: McpServer,
  message: string,
  fields: ElicitationField[],
): Promise<Record<string, unknown> | null> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const field of fields) {
    const prop: Record<string, unknown> = { type: field.type, title: field.title };
    if (field.description) prop.description = field.description;
    if (field.default !== undefined) prop.default = field.default;
    if (field.enum) { prop.enum = field.enum; prop.enumNames = field.enumNames; }
    properties[field.name] = prop;
    if (field.required) required.push(field.name);
  }

  try {
    const result = await server.server.elicitInput({
      message,
      requestedSchema: { type: 'object' as const, properties: properties as any, required },
    });

    if (result.action === 'accept' && result.content) {
      return result.content as Record<string, unknown>;
    }
    return null;
  } catch {
    return null; // Client doesn't support elicitation
  }
}
