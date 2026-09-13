import { z } from 'zod';

export const TierSchema = z.enum(['fast', 'main', 'reasoning']);
export type Tier = z.infer<typeof TierSchema>;

export const ModelConfigSchema = z.object({
  name: z.string().min(1),
  limit: z
    .object({
      context: z.number().int().positive(),
      output: z.number().int().positive(),
    })
    .partial()
    .optional(),
  reasoning: z.boolean().optional(),
});

export const ProviderOptionsSchema = z.object({
  baseURL: z.url().optional(),
  apiKey: z.string().min(1).optional(),
  headers: z.record(z.string(), z.string()).optional(),
});

export const ProviderConfigSchema = z.object({
  npm: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  options: ProviderOptionsSchema.optional(),
  models: z.record(z.string(), ModelConfigSchema).optional(),
});

export const MeantConfigSchema = z.object({
  $schema: z.string().optional(),
  model: z.string().min(1).optional(),
  small_model: z.string().min(1).optional(),
  reasoning_model: z.string().min(1).optional(),
  provider: z.record(z.string(), ProviderConfigSchema).optional(),
  disabled_providers: z.array(z.string().min(1)).optional(),
  enabled_providers: z.array(z.string().min(1)).optional(),
});

export type MeantConfig = z.infer<typeof MeantConfigSchema>;

export const OPENCODE_IGNORED_KEYS = [
  'agent',
  'mcp',
  'plugin',
  'formatter',
  'lsp',
  'tui',
  'server',
  'permission',
  'share',
] as const;

export interface ConfigWarning {
  code: 'key-in-config' | 'unknown-key';
  path: string;
  message: string;
}

export type ValidateResult =
  { ok: true; config: MeantConfig } | { ok: false; issues: readonly string[] };

export function validateConfig(input: unknown): ValidateResult {
  const parsed = MeantConfigSchema.safeParse(input);

  if (parsed.success) return { ok: true, config: parsed.data };

  return {
    ok: false,
    issues: parsed.error.issues.map(
      (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
    ),
  };
}

export function lintConfig(input: unknown): readonly ConfigWarning[] {
  if (typeof input !== 'object' || input === null) return [];

  const warnings: ConfigWarning[] = [];
  const record = input as Record<string, unknown>;

  for (const providerId of Object.keys(record)) {
    if (OPENCODE_IGNORED_KEYS.includes(providerId as (typeof OPENCODE_IGNORED_KEYS)[number])) {
      warnings.push({
        code: 'unknown-key',
        path: providerId,
        message: `“${providerId}” is an OpenCode key Meant ignores — nothing was imported from it.`,
      });
    }
  }

  const providers = record.provider;
  if (typeof providers !== 'object' || providers === null) return warnings;

  for (const [providerId, value] of Object.entries(providers as Record<string, unknown>)) {
    if (typeof value !== 'object' || value === null) continue;

    const options = (value as Record<string, unknown>).options;
    if (typeof options !== 'object' || options === null) continue;

    if (typeof (options as Record<string, unknown>).apiKey === 'string') {
      warnings.push({
        code: 'key-in-config',
        path: `provider.${providerId}.options.apiKey`,
        message:
          'A key in the shareable config is not encrypted and will sync with it. Move it to the vault.',
      });
    }
  }

  return warnings;
}
