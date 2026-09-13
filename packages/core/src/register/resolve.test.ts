import { describe, expect, it } from 'vitest';
import { registerFromHints, resolveRegister } from './resolve';
import type { RegisterHints } from './types';

const SLACK_DM: RegisterHints = {
  siteId: 'slack',
  fieldRole: 'message',
  formalityPrior: 'casual',
  formatHint: 'chat message',
  recipient: { name: 'Sarah', kind: 'person' },
  confidence: 0.8,
};

describe('registerFromHints', () => {
  it('turns hints into a register', () => {
    expect(registerFromHints(SLACK_DM)).toEqual({
      tone: ['casual', 'direct'],
      format: 'message',
      length: 'short',
      who: 'Sarah',
    });
  });

  it('prefers the field role over the site format hint', () => {
    expect(registerFromHints(SLACK_DM).format).toBe('message');
  });

  it('falls back to the site format when the role has none', () => {
    const hints: RegisterHints = { fieldRole: 'unknown', formatHint: 'email', confidence: 0.5 };
    expect(registerFromHints(hints)).toEqual({
      format: 'email',
      length: undefined,
      tone: undefined,
    });
  });
});

describe('resolveRegister', () => {
  it('lets recipe defaults override inference', () => {
    const register = resolveRegister({
      hints: SLACK_DM,
      defaults: { tone: ['clear'], length: 'medium' },
    });

    expect(register).toEqual({
      who: 'Sarah',
      format: 'message',
      length: 'medium',
      tone: ['clear'],
    });
  });

  it('lets user overrides beat everything', () => {
    const register = resolveRegister({
      hints: SLACK_DM,
      defaults: { tone: ['clear'], length: 'medium' },
      overrides: { who: 'Priya', tone: ['direct', 'warm'] },
    });

    expect(register).toEqual({
      who: 'Priya',
      format: 'message',
      length: 'medium',
      tone: ['direct', 'warm'],
    });
  });

  it('ignores undefined overrides instead of clearing inferred values', () => {
    const register = resolveRegister({ hints: SLACK_DM, overrides: { who: undefined } });

    expect(register.who).toBe('Sarah');
  });

  it('returns an empty register when there is nothing to go on', () => {
    expect(resolveRegister({})).toEqual({});
  });
});
