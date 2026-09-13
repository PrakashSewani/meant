import { describe, expect, it } from 'vitest';
import {
  EVENTS_LIMIT,
  appendEvent,
  correctionsBetween,
  summarizeEvents,
  type TransformEvent,
} from './events';

function event(overrides: Partial<TransformEvent> = {}): TransformEvent {
  return {
    at: 1_000,
    surface: 'slack',
    effort: 'quick',
    inferred: { who: 'Sarah', tone: ['casual'] },
    sent: { who: 'Sarah', tone: ['casual'] },
    accepted: true,
    corrections: [],
    ...overrides,
  };
}

describe('correctionsBetween', () => {
  it('sees nothing when the user sent what inference proposed', () => {
    expect(correctionsBetween({ who: 'Sarah' }, { who: 'Sarah' })).toEqual([]);
  });

  it('names the chip the user actually changed', () => {
    const corrections = correctionsBetween(
      { who: 'Sarah', tone: ['casual'], length: 'short' },
      { who: 'Priya', tone: ['casual'], length: 'short' },
    );

    expect(corrections).toEqual(['who']);
  });

  it('treats tone order and case as noise, not a correction', () => {
    expect(correctionsBetween({ tone: ['warm', 'direct'] }, { tone: ['Direct', 'warm'] })).toEqual(
      [],
    );
  });

  it('counts clearing a chip as a correction', () => {
    expect(correctionsBetween({ length: 'short' }, {})).toEqual(['length']);
  });

  it('reports every chip that changed', () => {
    const corrections = correctionsBetween(
      { who: 'Sarah', tone: ['casual'], length: 'short' },
      { who: 'Priya', tone: ['formal'], length: 'short' },
    );

    expect(corrections).toEqual(['who', 'tone']);
  });
});

describe('appendEvent', () => {
  it('keeps the newest events when the log is full', () => {
    const events = Array.from({ length: EVENTS_LIMIT }, (_, index) => event({ at: index }));
    const next = appendEvent(events, event({ at: 9_999 }));

    expect(next).toHaveLength(EVENTS_LIMIT);
    expect(next.at(-1)?.at).toBe(9_999);
    expect(next[0]?.at).toBe(1);
  });
});

describe('summarizeEvents', () => {
  it('reports no rate when nothing was shown', () => {
    const summary = summarizeEvents([]);

    expect(summary.shown).toBe(0);
    expect(summary.acceptRate).toBeUndefined();
  });

  it('counts accepts and dismissals', () => {
    const summary = summarizeEvents([
      event({ accepted: true }),
      event({ accepted: true }),
      event({ accepted: true }),
      event({ accepted: false }),
    ]);

    expect(summary.shown).toBe(4);
    expect(summary.accepted).toBe(3);
    expect(summary.acceptRate).toBe(0.75);
  });

  it('counts which chips get corrected', () => {
    const summary = summarizeEvents([
      event({ corrections: ['tone'] }),
      event({ corrections: ['tone', 'length'] }),
    ]);

    expect(summary.corrections).toEqual({ tone: 2, length: 1 });
  });

  it('can report a window instead of everything', () => {
    const summary = summarizeEvents([event({ at: 100 }), event({ at: 500 })], 200);

    expect(summary.shown).toBe(1);
  });
});
