import type { Browser } from 'wxt/browser';
import {
  DoctorRequestSchema,
  PortRequestSchema,
  classifyError,
  compilePrompt,
  createMockTransport,
  errorCopy,
  getRecipe,
  planDoctorChecks,
  resolveModel,
  resolveRegister,
  runDoctorReport,
  signalsFromError,
  type DoctorReport,
  type Effort,
  type ResolvedModel,
  type StreamEvent,
} from '@sayable/core';
import { selectTransport } from '@sayable/core/transports';
import { validateConfig, type SayableConfig } from '@sayable/config';

const PORT_NAME = 'sayable-transform';
const CONFIG_KEY = 'sayable.config';
const SECRETS_KEY = 'sayable.secrets';

const MOCK_MODEL: ResolvedModel = {
  providerId: 'mock',
  modelId: 'mock',
  tier: 'main',
  transport: 'openai-compatible',
};

export default defineBackground(() => {
  browser.commands.onCommand.addListener(async (command) => {
    if (command !== 'invoke-register-bar') return;

    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) return;

    await browser.tabs.sendMessage(tab.id, { type: 'invoke-bar' }).catch(() => undefined);
  });

  browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!DoctorRequestSchema.safeParse(message).success) return undefined;

    void runDoctorHere().then(sendResponse);
    return true;
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
  const model = (await configuredModel(request.effort)) ?? MOCK_MODEL;

  // With nothing configured yet, the mock keeps the loop demo-able; the popup says so plainly.
  const transport = model.providerId === 'mock' ? createMockTransport() : selectTransport(model);

  try {
    for await (const chunk of transport.stream({ prompt, model, signal })) {
      post(port, { type: 'chunk', requestId: request.requestId, text: chunk });
    }
    post(port, { type: 'done', requestId: request.requestId });
  } catch (error) {
    const { kind } = classifyError(signalsFromError(error));
    post(port, {
      type: 'error',
      requestId: request.requestId,
      kind,
      message: errorCopy(kind, model.providerId),
    });
  }
}

async function runDoctorHere(): Promise<DoctorReport> {
  const stored = await browser.storage.local.get([CONFIG_KEY, SECRETS_KEY]);
  const parsed = validateConfig(stored[CONFIG_KEY]);
  if (!parsed.ok) return { ok: false, message: 'No provider is configured yet.', checks: [] };

  const checks = planDoctorChecks({
    refs: tierRefsOf(parsed.config),
    providers: parsed.config.provider,
    secrets: readSecrets(stored[SECRETS_KEY]),
    disabledProviders: parsed.config.disabled_providers,
  });

  return runDoctorReport(checks, selectTransport);
}

function post(port: Browser.runtime.Port, event: StreamEvent): void {
  port.postMessage(event);
}

async function configuredModel(effort: Effort): Promise<ResolvedModel | undefined> {
  const stored = await browser.storage.local.get([CONFIG_KEY, SECRETS_KEY]);
  const parsed = validateConfig(stored[CONFIG_KEY]);
  if (!parsed.ok) return undefined;

  return resolveModel({
    refs: tierRefsOf(parsed.config),
    providers: parsed.config.provider,
    secrets: readSecrets(stored[SECRETS_KEY]),
    disabledProviders: parsed.config.disabled_providers,
    effort,
  });
}

function tierRefsOf(config: SayableConfig): { fast?: string; main?: string; reasoning?: string } {
  return {
    fast: config.small_model,
    main: config.model,
    reasoning: config.reasoning_model,
  };
}

function readSecrets(raw: unknown): Record<string, string> {
  if (typeof raw !== 'object' || raw === null) return {};

  return Object.fromEntries(
    Object.entries(raw).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}
