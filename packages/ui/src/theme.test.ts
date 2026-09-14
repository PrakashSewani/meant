import { describe, expect, it } from 'vitest';
import { THEME_KEY, isDark, readTheme, themeLabel } from './theme';

describe('readTheme', () => {
  it('reads the two choices that are a choice', () => {
    expect(readTheme('light')).toBe('light');
    expect(readTheme('dark')).toBe('dark');
  });

  it('treats everything else as following the system', () => {
    // A key that was never written, a value from a newer version, a corrupted one.
    expect(readTheme(undefined)).toBe('system');
    expect(readTheme(null)).toBe('system');
    expect(readTheme('sepia')).toBe('system');
    expect(readTheme(42)).toBe('system');
  });

  it('has one key, spelled once', () => {
    expect(THEME_KEY).toBe('meant.theme');
  });
});

describe('isDark', () => {
  it('lets an explicit choice override the system either way', () => {
    expect(isDark('dark', false)).toBe(true);
    expect(isDark('light', true)).toBe(false);
  });

  it('follows the system when asked to', () => {
    expect(isDark('system', true)).toBe(true);
    expect(isDark('system', false)).toBe(false);
  });
});

describe('themeLabel', () => {
  it('names every option, because the switch shows them all', () => {
    expect(themeLabel('system')).toBe('System');
    expect(themeLabel('light')).toBe('Light');
    expect(themeLabel('dark')).toBe('Dark');
  });
});
