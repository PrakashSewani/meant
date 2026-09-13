import type { Register, RegisterHints } from '@meant/core';

export type BarState = 'streaming' | 'ready' | 'error';

export interface BarHostRequest {
  shadow: ShadowRoot;
  styles: string;
  hints: RegisterHints;
  register: Register;
  intentText: string;
  onState: (state: BarState) => void;
  onAccept: (text: string) => void;
  onDismiss: () => void;
}

export type BarMount = (request: BarHostRequest) => (() => void) | Promise<() => void>;

const MOUNT_KEY = '__meantMountBar';

/** Emitted by `entrypoints/bar.ts`, as the extension sees it. */
export const BAR_SCRIPT_PATH = '/bar.js';

/** Emitted from `entrypoints/bar-styles.css`, read by the worker and handed to the bar. */
export const BAR_STYLES_PATH = '/assets/bar-styles.css';

/**
 * The budgeted content script stays small by keeping the bar out of it: the bar ships as its own
 * file, injected on first invoke, and publishes its mount function here. Both scripts run in the
 * same isolated world, so a global is the whole bridge.
 */
export function setBarMount(mount: BarMount): void {
  (globalThis as Record<string, unknown>)[MOUNT_KEY] = mount;
}

export function barMount(): BarMount | undefined {
  const mount = (globalThis as Record<string, unknown>)[MOUNT_KEY];
  return typeof mount === 'function' ? (mount as BarMount) : undefined;
}
