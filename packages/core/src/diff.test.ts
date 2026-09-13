import { describe, expect, it } from 'vitest';
import { DIFF_WORTH_SHOWING, diffWords, similarity } from './diff';

describe('diffWords', () => {
  it('marks nothing when nothing changed', () => {
    expect(diffWords('the deploy slipped', 'the deploy slipped')).toEqual([
      { kind: 'same', text: 'the deploy slipped' },
    ]);
  });

  it('marks an inserted word, keeping the whitespace readable', () => {
    const parts = diffWords('the deploy slipped', 'the deploy slipped a day');

    expect(parts.map((part) => part.kind)).toEqual(['same', 'added']);
    expect(parts[0]?.text).toBe('the deploy slipped');
    // The shared space travels with the addition, which is what keeps the rendering readable.
    expect(parts[1]?.text).toBe(' a day');
  });

  it('marks a removed word', () => {
    const parts = diffWords('ugh the deploy slipped', 'the deploy slipped');

    expect(parts[0]).toEqual({ kind: 'removed', text: 'ugh ' });
    expect(parts[1]?.kind).toBe('same');
  });

  it('reads a rewrite as removals and additions', () => {
    const parts = diffWords('hey can you look at the build', 'Could you take a look at the build?');

    expect(parts.some((part) => part.kind === 'removed')).toBe(true);
    expect(parts.some((part) => part.kind === 'added')).toBe(true);
  });

  it('handles an empty side', () => {
    expect(diffWords('', 'anything')).toEqual([{ kind: 'added', text: 'anything' }]);
    expect(diffWords('anything', '')).toEqual([{ kind: 'removed', text: 'anything' }]);
  });
});

describe('similarity', () => {
  it('is 1 for identical text and 0 for unrelated text', () => {
    expect(similarity('same words here', 'same words here')).toBe(1);
    expect(similarity('alpha beta', 'gamma delta')).toBe(0);
  });

  it('lands between the two for a light edit', () => {
    const score = similarity(
      'hey the deploy slipped a day but we are on it',
      'the deploy slipped a day but we are on it',
    );

    expect(score).toBeGreaterThan(DIFF_WORTH_SHOWING);
  });

  it('is low for a full rewrite, which is when a diff stops helping', () => {
    const score = similarity(
      'ugh tell sarah the deploy slipped but we are on it',
      'Sarah — the release is a day late. We are on it and you will have it by tomorrow.',
    );

    expect(score).toBeLessThan(DIFF_WORTH_SHOWING);
  });

  it('treats empty text as unchanged rather than dividing by nothing', () => {
    expect(similarity('', '')).toBe(1);
  });
});
