import { describe, expect, it } from 'vitest';
import { classifyError, errorCopy, type ErrorKind } from './errors';

describe('classifyError', () => {
  const cases: readonly [
    { status?: number; code?: string; message?: string; hostPermissionGranted?: boolean },
    ErrorKind,
  ][] = [
    [{ status: 401 }, 'auth'],
    [{ status: 403 }, 'auth'],
    [{ status: 403, hostPermissionGranted: false }, 'cors'],
    [{ status: 429 }, 'rate_limit'],
    [{ status: 402 }, 'quota'],
    [{ status: 404, message: 'model not found' }, 'model_missing'],
    [{ status: 400, message: 'unknown model: gpt-9' }, 'model_missing'],
    [{ message: 'TypeError: Failed to fetch' }, 'network'],
    [{ message: 'TypeError: Failed to fetch', hostPermissionGranted: false }, 'cors'],
    [{ code: 'ECONNREFUSED' }, 'network'],
    [{}, 'network'],
  ];

  for (const [signals, kind] of cases) {
    it(`${JSON.stringify(signals)} → ${kind}`, () => {
      expect(classifyError(signals).kind).toBe(kind);
    });
  }

  it('marks only transient failures as retryable', () => {
    expect(classifyError({ status: 429 }).retryable).toBe(true);
    expect(classifyError({ message: 'Failed to fetch' }).retryable).toBe(true);
    expect(classifyError({ status: 401 }).retryable).toBe(false);
    expect(classifyError({ status: 402 }).retryable).toBe(false);
  });
});

describe('errorCopy', () => {
  const kinds: readonly ErrorKind[] = [
    'auth',
    'cors',
    'rate_limit',
    'quota',
    'model_missing',
    'network',
  ];

  it('names the provider where it matters and stays plain everywhere', () => {
    for (const kind of kinds) {
      const copy = errorCopy(kind, 'Anthropic');

      expect(copy.length).toBeGreaterThan(0);
      expect(copy).not.toContain('!');
    }

    expect(errorCopy('auth', 'Anthropic')).toContain('Anthropic');
    expect(errorCopy('rate_limit', 'Anthropic')).toContain('Quick effort');
  });
});
