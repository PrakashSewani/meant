import type { MeantConfig } from './schema.ts';

export type TransportId = 'anthropic' | 'openai-compatible';

export interface PresetModel {
  id: string;
  name: string;
  tier: 'fast' | 'main' | 'reasoning';
}

export interface ProviderPreset {
  id: string;
  name: string;
  transport: TransportId;
  baseURL: string;
  auth: 'apiKey' | 'none';
  local: boolean;
  models: readonly PresetModel[];
  notes: string;
}

const NPM_FOR_TRANSPORT: Record<TransportId, string> = {
  anthropic: '@ai-sdk/anthropic',
  'openai-compatible': '@ai-sdk/openai-compatible',
};

export const PRESETS: readonly ProviderPreset[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    transport: 'anthropic',
    baseURL: 'https://api.anthropic.com/v1',
    auth: 'apiKey',
    local: false,
    models: [
      { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', tier: 'fast' },
      { id: 'claude-sonnet-5', name: 'Claude Sonnet 5', tier: 'main' },
      { id: 'claude-opus-5', name: 'Claude Opus 5', tier: 'reasoning' },
    ],
    notes: 'Auto-adds the browser-access header, so calls work from the worker.',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    transport: 'openai-compatible',
    baseURL: 'https://api.openai.com/v1',
    auth: 'apiKey',
    local: false,
    models: [
      { id: 'gpt-5-mini', name: 'GPT-5 mini', tier: 'fast' },
      { id: 'gpt-5.2', name: 'GPT-5.2', tier: 'main' },
      { id: 'gpt-5.5', name: 'GPT-5.5', tier: 'reasoning' },
    ],
    notes: 'Blocked from web pages by design; works from the extension worker.',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    transport: 'openai-compatible',
    baseURL: 'https://openrouter.ai/api/v1',
    auth: 'apiKey',
    local: false,
    models: [
      { id: 'google/gemini-3.8-flash', name: 'Gemini 3.8 Flash', tier: 'fast' },
      { id: 'anthropic/claude-sonnet-5', name: 'Claude Sonnet 5', tier: 'main' },
    ],
    notes: 'One key, hundreds of models. The easiest first setup.',
  },
  {
    id: 'groq',
    name: 'Groq',
    transport: 'openai-compatible',
    baseURL: 'https://api.groq.com/openai/v1',
    auth: 'apiKey',
    local: false,
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', tier: 'fast' },
      { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B', tier: 'main' },
    ],
    notes: 'Very fast Quick tier.',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    transport: 'openai-compatible',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    auth: 'apiKey',
    local: false,
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', tier: 'fast' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', tier: 'main' },
    ],
    notes: 'No separate reasoning tier yet — Deep falls back to Pro.',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    transport: 'openai-compatible',
    baseURL: 'https://api.deepseek.com/v1',
    auth: 'apiKey',
    local: false,
    models: [
      { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', tier: 'fast' },
      { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', tier: 'main' },
    ],
    notes: 'Cheap, long context.',
  },
  {
    id: 'ollama',
    name: 'Ollama (local)',
    transport: 'openai-compatible',
    baseURL: 'http://localhost:11434/v1',
    auth: 'none',
    local: true,
    models: [{ id: 'qwen3-coder', name: 'Qwen3 Coder (local)', tier: 'main' }],
    notes: 'Fully local. Model ids are whatever you have pulled — edit them freely.',
  },
  {
    id: 'lmstudio',
    name: 'LM Studio (local)',
    transport: 'openai-compatible',
    baseURL: 'http://127.0.0.1:1234/v1',
    auth: 'none',
    local: true,
    models: [],
    notes:
      'Fully local. Add the model id your server exposes — it is usually the file name you loaded.',
  },
  {
    id: 'llamacpp',
    name: 'llama.cpp (local)',
    transport: 'openai-compatible',
    baseURL: 'http://127.0.0.1:8080/v1',
    auth: 'none',
    local: true,
    models: [],
    notes: 'Fully local. Add the model id your server exposes.',
  },
];

export function presetFor(id: string): ProviderPreset | undefined {
  return PRESETS.find((preset) => preset.id === id);
}
export function presetOrigin(preset: ProviderPreset): string {
  const url = new URL(preset.baseURL);
  return `${url.protocol}//${url.hostname}/*`;
}

export const PROVIDER_ORIGINS: readonly string[] = [...new Set(PRESETS.map(presetOrigin))];

export function tierRefsFor(preset: ProviderPreset): {
  fast?: string;
  main?: string;
  reasoning?: string;
} {
  const refs: { fast?: string; main?: string; reasoning?: string } = {};
  for (const model of preset.models) refs[model.tier] = `${preset.id}/${model.id}`;
  return refs;
}

export function providerBlockFor(preset: ProviderPreset): Record<string, unknown> {
  return {
    npm: NPM_FOR_TRANSPORT[preset.transport],
    name: preset.name,
    options: { baseURL: preset.baseURL },
    models: Object.fromEntries(preset.models.map((model) => [model.id, { name: model.name }])),
  };
}

export function defaultConfigFor(preset: ProviderPreset): MeantConfig {
  const refs = tierRefsFor(preset);
  const config: MeantConfig = {
    $schema: 'https://meant.app/config.json',
    provider: { [preset.id]: providerBlockFor(preset) },
  };

  if (refs.main) config.model = refs.main;
  if (refs.fast) config.small_model = refs.fast;
  if (refs.reasoning) config.reasoning_model = refs.reasoning;

  return config;
}
