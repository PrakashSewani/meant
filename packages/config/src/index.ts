export {
  ModelConfigSchema,
  OPENCODE_IGNORED_KEYS,
  ProviderConfigSchema,
  ProviderOptionsSchema,
  SayableConfigSchema,
  TierSchema,
  lintConfig,
  validateConfig,
} from './schema.ts';
export type { ConfigWarning, SayableConfig, Tier, ValidateResult } from './schema.ts';

export {
  PRESETS,
  PROVIDER_ORIGINS,
  defaultConfigFor,
  presetFor,
  presetOrigin,
  providerBlockFor,
  tierRefsFor,
} from './presets.ts';
export type { PresetModel, ProviderPreset, TransportId } from './presets.ts';
