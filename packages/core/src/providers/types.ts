import type { Tier } from '../register/types';
import type { CompiledPrompt } from '../prompt/compile';

export type TransportId = 'anthropic' | 'openai-compatible';

export interface ModelDescriptor {
  id: string;
  name: string;
  tier: Tier;
}

export interface ResolvedModel {
  providerId: string;
  modelId: string;
  tier: Tier;
  transport: TransportId;
  baseURL?: string;
  headers?: Record<string, string>;
  apiKey?: string;
}

export interface StreamRequest {
  prompt: CompiledPrompt;
  model: ResolvedModel;
  signal?: AbortSignal;
}

export interface TransformTransport {
  readonly id: TransportId;
  stream(request: StreamRequest): AsyncIterable<string>;
}
