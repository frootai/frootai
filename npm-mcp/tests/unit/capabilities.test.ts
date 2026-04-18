import { describe, it, expect, vi } from 'vitest';
import { askUser, type ElicitationField } from '../../src/capabilities/elicitation.js';
import { requestSampling, type SamplingRequest } from '../../src/capabilities/sampling.js';

describe('capabilities/elicitation — askUser', () => {
  it('returns null when server.elicitInput throws', async () => {
    const mockServer = {
      server: {
        elicitInput: vi.fn().mockRejectedValue(new Error('not supported')),
      },
    };
    const fields: ElicitationField[] = [
      { name: 'model', type: 'string', title: 'Model' },
    ];
    const result = await askUser(mockServer as any, 'Pick a model', fields);
    expect(result).toBeNull();
  });

  it('returns null when user cancels (action != accept)', async () => {
    const mockServer = {
      server: {
        elicitInput: vi.fn().mockResolvedValue({ action: 'cancel', content: null }),
      },
    };
    const fields: ElicitationField[] = [
      { name: 'region', type: 'string', title: 'Region', required: true },
    ];
    const result = await askUser(mockServer as any, 'Select region', fields);
    expect(result).toBeNull();
  });

  it('returns content when user accepts', async () => {
    const mockServer = {
      server: {
        elicitInput: vi.fn().mockResolvedValue({
          action: 'accept',
          content: { model: 'gpt-4o', temperature: 0.3 },
        }),
      },
    };
    const fields: ElicitationField[] = [
      { name: 'model', type: 'string', title: 'Model', default: 'gpt-4o' },
      { name: 'temperature', type: 'number', title: 'Temperature' },
    ];
    const result = await askUser(mockServer as any, 'Configure', fields);
    expect(result).toEqual({ model: 'gpt-4o', temperature: 0.3 });
  });

  it('builds schema with enum and description', async () => {
    const mockServer = {
      server: {
        elicitInput: vi.fn().mockResolvedValue({ action: 'accept', content: { region: 'eastus2' } }),
      },
    };
    const fields: ElicitationField[] = [
      {
        name: 'region', type: 'string', title: 'Region',
        description: 'Azure region', enum: ['eastus2', 'westus2'],
        enumNames: ['East US 2', 'West US 2'], required: true,
      },
    ];
    await askUser(mockServer as any, 'Region', fields);
    const call = mockServer.server.elicitInput.mock.calls[0][0];
    expect(call.requestedSchema.properties.region.enum).toEqual(['eastus2', 'westus2']);
    expect(call.requestedSchema.required).toContain('region');
  });
});

describe('capabilities/sampling — requestSampling', () => {
  it('returns null when server.createMessage throws', async () => {
    const mockServer = {
      server: {
        createMessage: vi.fn().mockRejectedValue(new Error('not supported')),
      },
    };
    const request: SamplingRequest = { prompt: 'test' };
    const result = await requestSampling(mockServer as any, request);
    expect(result).toBeNull();
  });

  it('returns text result on success', async () => {
    const mockServer = {
      server: {
        createMessage: vi.fn().mockResolvedValue({
          content: { type: 'text', text: 'Generated content' },
          model: 'gpt-4o',
          stopReason: 'end_turn',
        }),
      },
    };
    const result = await requestSampling(mockServer as any, { prompt: 'generate' });
    expect(result).not.toBeNull();
    expect(result!.text).toBe('Generated content');
    expect(result!.model).toBe('gpt-4o');
    expect(result!.stopReason).toBe('end_turn');
  });

  it('returns null for non-text content', async () => {
    const mockServer = {
      server: {
        createMessage: vi.fn().mockResolvedValue({
          content: { type: 'image', data: 'base64...' },
          model: 'dall-e-3',
          stopReason: 'end_turn',
        }),
      },
    };
    const result = await requestSampling(mockServer as any, { prompt: 'draw' });
    expect(result).toBeNull();
  });

  it('passes priority preferences to createMessage', async () => {
    const mockServer = {
      server: {
        createMessage: vi.fn().mockResolvedValue({
          content: { type: 'text', text: 'ok' }, model: 'gpt-4o', stopReason: 'end',
        }),
      },
    };
    await requestSampling(mockServer as any, {
      prompt: 'test', priority: 'cost', maxTokens: 200, systemPrompt: 'Be helpful',
    });
    const call = mockServer.server.createMessage.mock.calls[0][0];
    expect(call.maxTokens).toBe(200);
    expect(call.systemPrompt).toBe('Be helpful');
    expect(call.modelPreferences.costPriority).toBe(0.9);
  });

  it('uses defaults for optional fields', async () => {
    const mockServer = {
      server: {
        createMessage: vi.fn().mockResolvedValue({
          content: { type: 'text', text: 'ok' }, model: 'gpt-4o',
        }),
      },
    };
    const result = await requestSampling(mockServer as any, { prompt: 'hello' });
    expect(result).not.toBeNull();
    expect(result!.stopReason).toBe('unknown'); // fallback
  });
});
