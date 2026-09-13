import { describe, expect, it } from 'vitest';
import { runDoctor } from './doctor';
import { createMockTransport } from './mock';
import type { ResolvedModel, TransformTransport } from './types';

const MODEL: ResolvedModel = {
  providerId: 'anthropic',
  modelId: 'claude-sonnet-5',
  tier: 'main',
  transport: 'anthropic',
  apiKey: 'sk-ant-test',
};

function failingTransport(error: unknown): TransformTransport {
  return {
    id: 'anthropic',
    // eslint-disable-next-line require-yield
    async *stream() {
      throw error;
    },
  };
}

describe('runDoctor', () => {
  it('reports success and what came back', async () => {
    const result = await runDoctor(
      createMockTransport(() => 'ok'),
      MODEL,
    );

    expect(result.ok).toBe(true);
    expect(result.message).toContain('anthropic');
    expect(result.text).toBe('ok');
  });

  it('calls an empty answer what it is', async () => {
    const result = await runDoctor(
      createMockTransport(() => '   '),
      MODEL,
    );

    expect(result.ok).toBe(false);
    expect(result.kind).toBe('model_missing');
    expect(result.message).toContain('model id');
  });

  it('classifies a rejected key instead of passing the provider error through', async () => {
    const error = Object.assign(new Error('Unauthorized'), {
      statusCode: 401,
      responseBody: '{"error":{"message":"invalid x-api-key"}}',
    });

    const result = await runDoctor(failingTransport(error), MODEL);

    expect(result.ok).toBe(false);
    expect(result.kind).toBe('auth');
    expect(result.message).not.toContain('invalid x-api-key');
    expect(result.message).toContain('Check your key');
  });

  it('classifies a missing model', async () => {
    const error = Object.assign(new Error('Not Found'), {
      statusCode: 404,
      responseBody: '{"error":{"message":"model claude-nope not found"}}',
    });

    const result = await runDoctor(failingTransport(error), MODEL);

    expect(result.kind).toBe('model_missing');
  });

  it('classifies a network failure', async () => {
    const result = await runDoctor(failingTransport(new TypeError('Failed to fetch')), MODEL);

    expect(result.kind).toBe('network');
    expect(result.message).toContain('connection');
  });
});
