import { describe, expect, it } from 'vitest';
import { compilePrompt } from '../prompt/compile';
import { getRecipe } from '../recipes';
import { createMockTransport, MOCK_PREFIX } from './mock';
import type { ResolvedModel } from './types';

const MODEL: ResolvedModel = {
  providerId: 'mock',
  modelId: 'mock',
  tier: 'main',
  transport: 'openai-compatible',
};

async function collect(chunks: AsyncIterable<string>): Promise<string> {
  let text = '';
  for await (const chunk of chunks) text += chunk;
  return text;
}

function promptFor(intent: string) {
  return compilePrompt({ intent, register: {}, recipe: getRecipe('say-it-better') });
}

describe('mock transport', () => {
  it('streams the compiled intent back, whole and in order', async () => {
    const transport = createMockTransport();

    const text = await collect(
      transport.stream({
        prompt: promptFor('ugh tell sarah the deploy slipped a day'),
        model: MODEL,
      }),
    );

    expect(text).toBe(`${MOCK_PREFIX} ugh tell sarah the deploy slipped a day`);
  });

  it('yields more than one chunk so the streaming path is exercised', async () => {
    const transport = createMockTransport();
    const chunks: string[] = [];

    for await (const chunk of transport.stream({
      prompt: promptFor('a long enough intent to be split across chunks'),
      model: MODEL,
    })) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length > 0)).toBe(true);
  });

  it('only reads the intent out of the user message, never the delimiters', async () => {
    const transport = createMockTransport();

    const text = await collect(transport.stream({ prompt: promptFor('ship it'), model: MODEL }));

    expect(text).not.toContain('<intent>');
    expect(text).not.toContain('</intent>');
  });

  it('takes a custom responder for tests that need a fixed answer', async () => {
    const transport = createMockTransport(() => 'clean rewrite');

    expect(await collect(transport.stream({ prompt: promptFor('anything'), model: MODEL }))).toBe(
      'clean rewrite',
    );
  });
});
