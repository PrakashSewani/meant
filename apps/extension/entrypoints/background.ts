import type { Browser } from 'wxt/browser';
import {
  PortRequestSchema,
  classifyError,
  compilePrompt,
  createMockTransport,
  errorCopy,
  getRecipe,
  parseModelRef,
  resolveRegister,
  resolveTierRef,
  type Effort,
  type ResolvedModel,
  type StreamEvent,
} from '@sayable/core';
import { validateConfig, type SayableConfig } from '@sayable/config';

const PORT_NAME = 'sayable-transform';
const CONFIG_KEY = 'sayable.config';

export default defineBackground(() => {
  browser.commands.onCommand.addListener(async (command) => {
    if (command !== 'invoke-register-bar') return;

    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) return;

    await browser.tabs.sendMessage(tab.id, { type: 'invoke-bar' }).catch(() => undefined);
  });

  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== PORT_NAME) return;

    const controller = new AbortController();
    port.onDisconnect.addListener(() => controller.abort());
    port.onMessage.addListener((raw: unknown) => {
      void handlePortMessage(port, raw, controller.signal);
    });
  });
});

async function handlePortMessage(
  port: Browser.runtime.Port,
  raw: unknown,
  signal: AbortSignal,
): Promise<void> {
  const parsed = PortRequestSchema.safeParse(raw);
  if (!parsed.success) return;
  if (parsed.data.type === 'cancel') return;

  const { request } = parsed.data;
  const recipe = request.recipeId ? getRecipe(request.recipeId) : undefined;
  const register = resolveRegister({ defaults: recipe?.register, overrides: request.register });
  const prompt = compilePrompt({ intent: request.intentText, register, recipe });
  const model = await resolveModel(request.effort);

  // Real transports land with the provider slice; the pipeline around them is the real thing.
  const transport = createMockTransport();

  try {
    for await (const chunk of transport.stream({ prompt, model, signal })) {
      post(port, { type: 'chunk', requestId: request.requestId, text: chunk });
    }
    post(port, { type: 'done', requestId: request.requestId });
  } catch (error) {
    const classified = classifyError({
      message: error instanceof Error ? error.message : undefined,
    });
    post(port, {
      type: 'error',
      requestId: request.requestId,
      kind: classified.kind,
      message: errorCopy(classified.kind, model.providerId),
    });
  }
}

function post(port: Browser.runtime.Port, event: StreamEvent): void {
  port.postMessage(event);
}

async function resolveModel(effort: Effort): Promise<ResolvedModel> {
  const stored = await browser.storage.local.get(CONFIG_KEY);
  const parsed = validateConfig(stored[CONFIG_KEY]);

  if (parsed.ok) {
    const ref = resolveTierRef(effort, tierRefsOf(parsed.config));
    const parts = ref ? parseModelRef(ref) : undefined;

    if (parts) {
      return {
        providerId: parts.providerId,
        modelId: parts.modelId,
        tier: effort === 'quick' ? 'fast' : effort === 'deep' ? 'reasoning' : 'main',
        transport: parts.providerId === 'anthropic' ? 'anthropic' : 'openai-compatible',
      };
    }
  }

  return {
    providerId: 'mock',
    modelId: 'mock',
    tier: 'main',
    transport: 'openai-compatible',
  };
}

function tierRefsOf(config: SayableConfig): { fast?: string; main?: string; reasoning?: string } {
  return {
    fast: config.small_model,
    main: config.model,
    reasoning: config.reasoning_model,
  };
}
