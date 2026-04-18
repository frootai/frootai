import { describe, it, expect } from 'vitest';
import { prompts, type PromptDefinition } from '../../src/prompts/index.js';

describe('Prompt Definitions', () => {
  it('exports an array of prompt definitions', () => {
    expect(Array.isArray(prompts)).toBe(true);
    expect(prompts.length).toBeGreaterThanOrEqual(4);
  });

  it('every prompt has required fields', () => {
    for (const p of prompts) {
      expect(p.name, `prompt missing name`).toBeTruthy();
      expect(p.description, `${p.name} missing description`).toBeTruthy();
      expect(Array.isArray(p.arguments), `${p.name} arguments not array`).toBe(true);
      expect(typeof p.generate, `${p.name} generate not function`).toBe('function');
    }
  });

  it('prompt names are unique', () => {
    const names = prompts.map(p => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('includes core workflow prompts: build, review, tune', () => {
    const names = prompts.map(p => p.name);
    expect(names).toContain('build');
    expect(names).toContain('review');
    expect(names).toContain('tune');
  });

  it('includes wire and design prompts', () => {
    const names = prompts.map(p => p.name);
    expect(names).toContain('wire');
    expect(names).toContain('design');
  });
});

describe('Prompt — build', () => {
  const buildPrompt = prompts.find(p => p.name === 'build')!;

  it('requires a task argument', () => {
    const taskArg = buildPrompt.arguments.find(a => a.name === 'task');
    expect(taskArg).toBeDefined();
    expect(taskArg!.required).toBe(true);
  });

  it('generates user message containing the task', () => {
    const msg = buildPrompt.generate({ task: 'RAG pipeline' });
    expect(msg.role).toBe('user');
    expect(msg.content).toContain('RAG pipeline');
    expect(msg.content).toContain('agent_build');
  });
});

describe('Prompt — review', () => {
  const reviewPrompt = prompts.find(p => p.name === 'review')!;

  it('context argument is optional', () => {
    const ctxArg = reviewPrompt.arguments.find(a => a.name === 'context');
    expect(ctxArg).toBeDefined();
    expect(ctxArg!.required).toBe(false);
  });

  it('generates message with context when provided', () => {
    const msg = reviewPrompt.generate({ context: 'my RAG API' });
    expect(msg.content).toContain('my RAG API');
  });

  it('generates message with default when context omitted', () => {
    const msg = reviewPrompt.generate({});
    expect(msg.content).toContain('my implementation');
  });
});

describe('Prompt — tune', () => {
  const tunePrompt = prompts.find(p => p.name === 'tune')!;

  it('generates message mentioning agent_tune tool', () => {
    const msg = tunePrompt.generate({});
    expect(msg.content).toContain('agent_tune');
  });
});

describe('Prompt — wire', () => {
  const wirePrompt = prompts.find(p => p.name === 'wire')!;

  it('requires playId argument', () => {
    const arg = wirePrompt.arguments.find(a => a.name === 'playId');
    expect(arg).toBeDefined();
    expect(arg!.required).toBe(true);
  });

  it('generates message with play ID', () => {
    const msg = wirePrompt.generate({ playId: '01' });
    expect(msg.content).toContain('01');
    expect(msg.content).toContain('wire_play');
  });
});

describe('Prompt — design', () => {
  const designPrompt = prompts.find(p => p.name === 'design')!;

  it('requires requirements argument', () => {
    const arg = designPrompt.arguments.find(a => a.name === 'requirements');
    expect(arg).toBeDefined();
    expect(arg!.required).toBe(true);
  });

  it('uses default scale when not provided', () => {
    const msg = designPrompt.generate({ requirements: 'chatbot' });
    expect(msg.content).toContain('dev');
  });

  it('uses provided scale', () => {
    const msg = designPrompt.generate({ requirements: 'chatbot', scale: 'prod' });
    expect(msg.content).toContain('prod');
  });

  it('mentions multiple tools', () => {
    const msg = designPrompt.generate({ requirements: 'test' });
    expect(msg.content).toContain('semantic_search_plays');
    expect(msg.content).toContain('estimate_cost');
  });
});

describe('Prompt — cost', () => {
  const costPrompt = prompts.find(p => p.name === 'cost')!;

  it('requires play argument', () => {
    const arg = costPrompt.arguments.find(a => a.name === 'play');
    expect(arg).toBeDefined();
    expect(arg!.required).toBe(true);
  });

  it('generates message with play and scale', () => {
    const msg = costPrompt.generate({ play: '01', scale: 'prod' });
    expect(msg.content).toContain('01');
    expect(msg.content).toContain('prod');
  });

  it('defaults to dev scale', () => {
    const msg = costPrompt.generate({ play: '01' });
    expect(msg.content).toContain('dev');
  });
});
