/** Where the theme choice lives. Read by every surface, written only by the switch. */
export const THEME_KEY = 'meant.theme';

export type Theme = 'system' | 'light' | 'dark';

export const THEMES: readonly Theme[] = ['system', 'light', 'dark'];

const THEME_LABELS: Record<Theme, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

export function themeLabel(theme: Theme): string {
  return THEME_LABELS[theme];
}

export function readTheme(raw: unknown): Theme {
  return raw === 'light' || raw === 'dark' ? raw : 'system';
}

/** `system` is whatever the OS says right now; the other two are settled. */
export function isDark(theme: Theme, systemPrefersDark: boolean): boolean {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;

  return systemPrefersDark;
}

/**
 * Puts the theme on an element, which is how `dark:` utilities find it. The bar calls this on the
 * element inside its shadow root: a class on the host would not cross the boundary.
 */
export function applyTheme(element: Element | null, dark: boolean): void {
  element?.classList.toggle('dark', dark);
}

/** The OS preference, and a subscription to it, for the `system` setting. */
export function systemPrefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

export function watchSystemTheme(onChange: (prefersDark: boolean) => void): () => void {
  if (typeof matchMedia !== 'function') return () => undefined;

  const query = matchMedia('(prefers-color-scheme: dark)');
  const listener = (event: MediaQueryListEvent) => onChange(event.matches);
  query.addEventListener('change', listener);

  return () => query.removeEventListener('change', listener);
}
