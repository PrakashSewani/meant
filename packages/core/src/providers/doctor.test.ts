import { describe, expect, it } from 'vitest';
import { planDoctorChecks, runDoctor, runDoctorReport } from './doctor';
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

describe('planDoctorChecks', () => {
  const PROVIDERS = {
    anthropic: { options: { baseURL: 'https://api.anthropic.com/v1' } },
    groq: { options: { baseURL: 'https://api.groq.com/openai/v1' } },
  };

  it('probes each tier the config claims', () => {
    const checks = planDoctorChecks({
      refs: {
        fast: 'groq/llama-3.3-70b-versatile',
        main: 'anthropic/claude-sonnet-5',
        reasoning: 'anthropic/claude-opus-5',
      },
      providers: PROVIDERS,
      secrets: {},
    });

    expect(checks.map((check) => check.efforts)).toEqual([['quick'], ['balanced'], ['deep']]);
    expect(checks.map((check) => check.model.modelId)).toEqual([
      'llama-3.3-70b-versatile',
      'claude-sonnet-5',
      'claude-opus-5',
    ]);
  });

  it('reports a model that serves several tiers once, naming all of them', async () => {
    const checks = planDoctorChecks({
      refs: { main: 'anthropic/claude-sonnet-5' },
      providers: PROVIDERS,
      secrets: {},
    });

    expect(checks).toHaveLength(1);
    expect(checks[0]?.efforts).toEqual(['quick', 'balanced', 'deep']);

    const report = await runDoctorReport(checks, () => createMockTransport(() => 'ok'));
    expect(report.checks[0]?.label).toBe('All tiers · anthropic · claude-sonnet-5');
  });

  it('has nothing to probe when no tier is configured', () => {
    expect(planDoctorChecks({ refs: {}, providers: {}, secrets: {} })).toEqual([]);
  });
});

describe('runDoctorReport', () => {
  it('says so plainly when there is nothing configured', async () => {
    const report = await runDoctorReport([], () => createMockTransport());

    expect(report.ok).toBe(false);
    expect(report.checks).toEqual([]);
    expect(report.message).toContain('No provider');
  });

  it('reports every tier that answered', async () => {
    const checks = planDoctorChecks({
      refs: { fast: 'groq/fast-model', main: 'anthropic/claude-sonnet-5' },
      providers: {
        groq: { options: { baseURL: 'https://api.groq.com/openai/v1' } },
        anthropic: { options: { baseURL: 'https://api.anthropic.com/v1' } },
      },
      secrets: {},
    });

    const report = await runDoctorReport(checks, () => createMockTransport(() => 'ok'));

    expect(report.ok).toBe(true);
    expect(report.checks).toHaveLength(2);
    expect(report.checks[0]?.label).toContain('Quick');
    expect(report.checks[0]?.efforts).toEqual(['quick']);
    expect(report.message).toContain('2 models');
  });

  it('names the tier that failed instead of failing the whole report silently', async () => {
    const checks = planDoctorChecks({
      refs: { fast: 'groq/fast-model', main: 'anthropic/claude-sonnet-5' },
      providers: {
        groq: { options: { baseURL: 'https://api.groq.com/openai/v1' } },
        anthropic: { options: { baseURL: 'https://api.anthropic.com/v1' } },
      },
      secrets: {},
    });

    const report = await runDoctorReport(checks, (model) =>
      model.providerId === 'groq'
        ? failingTransport(Object.assign(new Error('Unauthorized'), { statusCode: 401 }))
        : createMockTransport(() => 'ok'),
    );

    expect(report.ok).toBe(false);
    expect(report.message).toContain('1 of 2');
    expect(report.checks.find((check) => check.efforts.includes('quick'))?.kind).toBe('auth');
    expect(report.checks.find((check) => check.efforts.includes('balanced'))?.ok).toBe(true);
  });
});
