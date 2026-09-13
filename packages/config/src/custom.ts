import type { MeantConfig } from './schema.ts';

export interface CustomProviderInput {
  id: string;
  name: string;
  baseURL: string;
  models: {
    main: string;
    fast?: string;
    reasoning?: string;
  };
}

/** Provider ids end up as config keys and model refs, so they stay boring. */
export function isValidProviderId(id: string): boolean {
  return /^[a-z][a-z0-9-]{0,30}$/.test(id);
}

/** The pattern to request at runtime for any OpenAI-compatible endpoint. */
export function originPatternFor(baseURL: string): string {
  const url = new URL(baseURL);
  return `${url.protocol}//${url.hostname}/*`;
}

/**
 * A provider the user described themselves. It is the same shape as a preset — that is the point
 * of presets being data — so the transport, the tiers, and the doctor all work unchanged.
 */
export function customProviderConfig({
  id,
  name,
  baseURL,
  models,
}: CustomProviderInput): MeantConfig {
  const ref = (model: string) => `${id}/${model}`;

  const modelEntries: Record<string, { name: string }> = {};
  for (const model of [models.main, models.fast, models.reasoning]) {
    if (model) modelEntries[model] = { name: model };
  }

  const config: MeantConfig = {
    $schema: 'https://meant.app/config.json',
    model: ref(models.main),
    provider: {
      [id]: {
        npm: '@ai-sdk/openai-compatible',
        name,
        options: { baseURL },
        models: modelEntries,
      },
    },
  };

  if (models.fast) config.small_model = ref(models.fast);
  if (models.reasoning) config.reasoning_model = ref(models.reasoning);

  return config;
}
