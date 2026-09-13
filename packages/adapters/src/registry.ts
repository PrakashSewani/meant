import { genericAdapter } from './generic';
import type { SurfaceAdapter } from './types';

/**
 * Order matters: site adapters add inference and register before `generic`, which matches
 * everything and must stay last.
 */
const ADAPTERS: readonly SurfaceAdapter[] = [genericAdapter];

export function adapterFor(url: URL): SurfaceAdapter {
  return ADAPTERS.find((adapter) => adapter.matches(url)) ?? genericAdapter;
}

export function allAdapters(): readonly SurfaceAdapter[] {
  return ADAPTERS;
}
