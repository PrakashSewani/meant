import { describe, expect, it } from 'vitest';
import { formatTones, parseTones, parseWho } from './register-input';

describe('parseTones', () => {
  it('splits, trims, and lowercases', () => {
    expect(parseTones(' Direct , Warm ')).toEqual(['direct', 'warm']);
  });

  it('drops blanks and duplicates', () => {
    expect(parseTones('warm, , warm, direct')).toEqual(['warm', 'direct']);
  });

  it('reads an empty chip as no tone rather than an empty list', () => {
    expect(parseTones('')).toBeUndefined();
    expect(parseTones('   ')).toBeUndefined();
  });
});

describe('formatTones', () => {
  it('round-trips through parseTones', () => {
    const tone = ['direct', 'warm'];

    expect(parseTones(formatTones(tone))).toEqual(tone);
  });

  it('renders nothing for no tone', () => {
    expect(formatTones(undefined)).toBe('');
    expect(formatTones([])).toBe('');
  });
});

describe('parseWho', () => {
  it('treats a cleared chip as unspecified, so inference can win again', () => {
    expect(parseWho('   ')).toBeUndefined();
    expect(parseWho(' Sarah ')).toBe('Sarah');
  });
});
