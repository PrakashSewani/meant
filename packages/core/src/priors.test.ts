import { describe, expect, it } from 'vitest';
import { derivePriors, learnedRegister, priorKey, readPriors, withoutPrior } from './priors';
import type { TransformEvent } from './events';

const NOW = 1_800_000_000_000;

function event(overrides: Partial<TransformEvent> = {}): TransformEvent {
  return {
    at: NOW - 1000,
    surface: 'slack',
    fieldRole: 'message',
    effort: 'quick',
    inferred: { tone: ['casual', 'direct'] },
    sent: { tone: ['casual', 'direct'] },
    accepted: true,
    corrections: [],
    ...overrides,
  };
}

describe('derivePriors', () => {
  it('learns nothing from transforms that needed no correcting', () => {
    expect(derivePriors([event(), event()], NOW)).toEqual({});
  });

  it('ignores a one-off correction', () => {
    const priors = derivePriors(
      [event({ corrections: ['tone'], sent: { tone: ['direct'] } })],
      NOW,
    );

    expect(priors).toEqual({});
  });

  it('learns a correction the user keeps making in the same place', () => {
    const repeated = event({ corrections: ['tone'], sent: { tone: ['direct', 'warm'] } });
    const priors = derivePriors([repeated, { ...repeated, at: NOW - 500 }], NOW);

    expect(priors['slack:message']?.tone).toMatchObject({
      value: ['direct', 'warm'],
      count: 2,
    });
  });

  it('prefers the correction made most often', () => {
    const direct = event({ corrections: ['tone'], sent: { tone: ['direct'] } });
    const warm = event({ corrections: ['tone'], sent: { tone: ['warm'] } });

    const priors = derivePriors([direct, direct, warm, warm, warm], NOW);

    expect(priors['slack:message']?.tone?.value).toEqual(['warm']);
  });

  it('keeps surfaces apart', () => {
    const slack = event({ corrections: ['length'], sent: { length: 'short' } });
    const gmail = event({ surface: 'gmail', corrections: ['length'], sent: { length: 'long' } });

    const priors = derivePriors([slack, slack, gmail, gmail], NOW);

    expect(priors['slack:message']?.length?.value).toBe('short');
    expect(priors['gmail:message']?.length?.value).toBe('long');
  });

  it('lets old evidence fade rather than outranking this week', () => {
    const stale = event({
      at: NOW - 1000 * 60 * 60 * 24 * 200,
      corrections: ['tone'],
      sent: { tone: ['formal'] },
    });

    expect(derivePriors([stale, stale], NOW)).toEqual({});
  });

  it('builds a key without a field role', () => {
    expect(priorKey('page')).toBe('page');
    expect(priorKey('slack', 'message')).toBe('slack:message');
  });
});

describe('readPriors', () => {
  it('reads back what it wrote', () => {
    const priors = derivePriors(
      [
        event({ corrections: ['length'], sent: { length: 'short' } }),
        event({ corrections: ['length'], sent: { length: 'short' } }),
      ],
      NOW,
    );

    expect(readPriors(priors)).toEqual(priors);
  });

  it('treats nonsense in storage as nothing learned', () => {
    expect(readPriors(undefined)).toEqual({});
    expect(readPriors('nope')).toEqual({});
    expect(readPriors({ 'slack:message': { tone: { value: 3 } } })).toEqual({});
  });
});

describe('learnedRegister', () => {
  it('reports what it learned and applies it', () => {
    const priors = derivePriors(
      [
        event({ corrections: ['tone'], sent: { tone: ['direct', 'warm'] } }),
        event({ corrections: ['tone'], sent: { tone: ['direct', 'warm'] } }),
      ],
      NOW,
    );

    const learned = learnedRegister(priors, 'slack:message');

    expect(learned.learned).toEqual(['tone']);
    expect(learned.register).toEqual({ tone: ['direct', 'warm'] });
  });

  it('is empty for a place it has never seen', () => {
    expect(learnedRegister({}, 'gmail:reply')).toEqual({ register: {}, learned: [] });
  });

  it('can forget one chip without losing the rest', () => {
    const priors = derivePriors(
      [
        event({ corrections: ['tone', 'length'], sent: { tone: ['direct'], length: 'short' } }),
        event({ corrections: ['tone', 'length'], sent: { tone: ['direct'], length: 'short' } }),
      ],
      NOW,
    );

    const next = withoutPrior(priors, 'slack:message', 'tone');

    expect(next['slack:message']?.tone).toBeUndefined();
    expect(next['slack:message']?.length?.value).toBe('short');
  });
});
