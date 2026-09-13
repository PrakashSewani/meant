import { describe, expect, it } from 'vitest';
import { runDoctor } from '../providers/doctor';
import type { ResolvedModel } from '../providers/types';
import { anthropicTransport } from './anthropic';
import { openAICompatibleTransport } from './openai-compatible';

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

const TIMEOUT = 30_000;

describe.skipIf(!ANTHROPIC_KEY)('anthropic contract (live)', () => {
  it(
    'answers a doctor ping',
    async () => {
      const model: ResolvedModel = {
        providerId: 'anthropic',
        modelId: 'claude-haiku-4-5',
        tier: 'fast',
        transport: 'anthropic',
        apiKey: ANTHROPIC_KEY,
      };

      const result = await runDoctor(anthropicTransport(), model);

      expect(result.ok, result.message).toBe(true);
    },
    TIMEOUT,
  );
});

describe.skipIf(!OPENAI_KEY)('openai-compatible contract (live)', () => {
  it(
    'answers a doctor ping',
    async () => {
      const model: ResolvedModel = {
        providerId: 'openai',
        modelId: 'gpt-5-mini',
        tier: 'fast',
        transport: 'openai-compatible',
        baseURL: 'https://api.openai.com/v1',
        apiKey: OPENAI_KEY,
      };

      const result = await runDoctor(openAICompatibleTransport(), model);

      expect(result.ok, result.message).toBe(true);
    },
    TIMEOUT,
  );
});

describe.skipIf(ANTHROPIC_KEY)('without keys', () => {
  it('skips the live contract instead of failing', () => {
    expect(ANTHROPIC_KEY).toBeUndefined();
  });
});
