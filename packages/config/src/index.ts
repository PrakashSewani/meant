export {
  ModelConfigSchema,
  OPENCODE_IGNORED_KEYS,
  ProviderConfigSchema,
  ProviderOptionsSchema,
  MeantConfigSchema,
  TierSchema,
  lintConfig,
  validateConfig,
} from './schema.ts';
export type { ConfigWarning, MeantConfig, Tier, ValidateResult } from './schema.ts';

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

export { customProviderConfig, isValidProviderId, originPatternFor } from './custom.ts';
export type { CustomProviderInput } from './custom.ts';
