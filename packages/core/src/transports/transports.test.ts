import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { classifyError, signalsFromError } from '../providers/errors';
import type { CompiledPrompt } from '../prompt/compile';
import type { ResolvedModel } from '../providers/types';
import { anthropicTransport } from './anthropic';
import { openAICompatibleTransport } from './openai-compatible';

const PROMPT: CompiledPrompt = {
  system: 'You rewrite text for the situation it is sent into.',
  user: '<intent>\nhello there\n</intent>',
};

function openAIChunk(content: string, finishReason: string | null = null): string {
  const payload = {
    id: 'chatcmpl-test',
    object: 'chat.completion.chunk',
    created: 0,
    model: 'test-model',
    choices: [
      {
        index: 0,
        delta: content ? { content } : {},
        finish_reason: finishReason,
      },
    ],
  };

  return `data: ${JSON.stringify(payload)}\n\n`;
}

function anthropicEvent(type: string, data: unknown): string {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

function anthropicStream(): string {
  return [
    anthropicEvent('message_start', {
      type: 'message_start',
      message: {
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model: 'claude-sonnet-5',
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      },
    }),
    anthropicEvent('content_block_start', {
      type: 'content_block_start',
      index: 0,
      content_block: { type: 'text', text: '' },
    }),
    anthropicEvent('content_block_delta', {
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text: 'Hello' },
    }),
    anthropicEvent('content_block_delta', {
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text: ' there' },
    }),
    anthropicEvent('content_block_stop', { type: 'content_block_stop', index: 0 }),
    anthropicEvent('message_delta', {
      type: 'message_delta',
      delta: { stop_reason: 'end_turn', stop_sequence: null },
      usage: { output_tokens: 2 },
    }),
    anthropicEvent('message_stop', { type: 'message_stop' }),
  ].join('');
}

let server: Server;
let baseURL: string;
let unauthorizedURL: string;
let anthropicRequestHeaders: Record<string, string | string[] | undefined> = {};

beforeAll(async () => {
  server = createServer((request, response) => {
    const url = request.url ?? '';

    if (url.includes('unauthorized')) {
      response.writeHead(401, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({ error: { message: 'invalid x-api-key', type: 'authentication_error' } }),
      );
      return;
    }

    if (url.endsWith('/chat/completions')) {
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      response.end(
        `${openAIChunk('Hello')}${openAIChunk(' there')}${openAIChunk('', 'stop')}data: [DONE]\n\n`,
      );
      return;
    }

    if (url.endsWith('/messages')) {
      anthropicRequestHeaders = request.headers;
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      response.end(anthropicStream());
      return;
    }

    response.writeHead(404);
    response.end();
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  baseURL = `http://127.0.0.1:${port}/v1`;
  unauthorizedURL = `http://127.0.0.1:${port}/v1/unauthorized`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function modelFor(overrides: Partial<ResolvedModel>): ResolvedModel {
  return {
    providerId: 'test',
    modelId: 'test-model',
    tier: 'main',
    transport: 'openai-compatible',
    baseURL,
    apiKey: 'sk-test',
    ...overrides,
  };
}

async function collect(chunks: AsyncIterable<string>): Promise<string> {
  let text = '';
  for await (const chunk of chunks) text += chunk;
  return text;
}

async function failureFrom(model: ResolvedModel): Promise<unknown> {
  try {
    await collect(openAICompatibleTransport().stream({ prompt: PROMPT, model }));
  } catch (error) {
    return error;
  }

  throw new Error('expected the transport to fail');
}

describe('openai-compatible transport', () => {
  it('streams a completion and joins the deltas in order', async () => {
    const text = await collect(
      openAICompatibleTransport().stream({ prompt: PROMPT, model: modelFor({}) }),
    );

    expect(text).toBe('Hello there');
  });

  it('reports a rejected key as an auth failure, not a raw provider error', async () => {
    const signals = signalsFromError(await failureFrom(modelFor({ baseURL: unauthorizedURL })));

    expect(signals.status).toBe(401);
    expect(classifyError(signals).kind).toBe('auth');
  });

  it('refuses to call a provider that has no endpoint', async () => {
    const model = modelFor({});
    delete model.baseURL;

    await expect(
      collect(openAICompatibleTransport().stream({ prompt: PROMPT, model })),
    ).rejects.toThrow(/no base URL/);
  });

  it('reports an unreachable host as a network failure', async () => {
    const signals = signalsFromError(
      await failureFrom(modelFor({ baseURL: 'http://127.0.0.1:1/v1' })),
    );

    expect(classifyError(signals).kind).toBe('network');
  });
});

describe('anthropic transport', () => {
  it('streams a message and asks for browser origin access', async () => {
    const text = await collect(
      anthropicTransport().stream({
        prompt: PROMPT,
        model: modelFor({
          providerId: 'anthropic',
          transport: 'anthropic',
          modelId: 'claude-sonnet-5',
        }),
      }),
    );

    expect(text).toBe('Hello there');
    expect(anthropicRequestHeaders['anthropic-dangerous-direct-browser-access']).toBe('true');
  });

  it('lets a caller’s own header win over the default', async () => {
    await collect(
      anthropicTransport().stream({
        prompt: PROMPT,
        model: modelFor({
          providerId: 'anthropic',
          transport: 'anthropic',
          headers: { 'anthropic-dangerous-direct-browser-access': 'false' },
        }),
      }),
    );

    expect(anthropicRequestHeaders['anthropic-dangerous-direct-browser-access']).toBe('false');
  });
});
