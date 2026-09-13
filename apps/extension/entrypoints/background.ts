import type { Browser } from 'wxt/browser';
import {
  BRAND,
  BarScriptRequestSchema,
  BarStylesRequestSchema,
  DoctorRequestSchema,
  PortRequestSchema,
  RecordEventMessageSchema,
  appendEvent,
  classifyError,
  compilePrompt,
  createMockTransport,
  errorCopy,
  getRecipe,
  planDoctorChecks,
  readEvents,
  resolveModel,
  resolveRegister,
  runDoctorReport,
  signalsFromError,
  type DoctorReport,
  type Effort,
  type ResolvedModel,
  type StreamEvent,
  type TransformEvent,
} from '@sayable/core';
import { BAR_SCRIPT_PATH, BAR_STYLES_PATH } from '../lib/bar-bridge';
import { selectTransport } from '@sayable/core/transports';
import { validateConfig, type SayableConfig } from '@sayable/config';

const PORT_NAME = 'sayable-transform';
const CONFIG_KEY = 'sayable.config';
const SECRETS_KEY = 'sayable.secrets';
const EVENTS_KEY = 'sayable.events';
const CONTEXT_MENU_ID = 'sayable-invoke';

const MOCK_MODEL: ResolvedModel = {
  providerId: 'mock',
  modelId: 'mock',
  tier: 'main',
  transport: 'openai-compatible',
};

export default defineBackground(() => {
  // The fallback path: a shortcut can be taken, or unassigned by Chrome, and the product must
  // still be reachable (invariant 4 — grip, shortcut, or context menu).
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: `${BRAND.name}…`,
      contexts: ['editable'],
    });
  });

  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== CONTEXT_MENU_ID || tab?.id === undefined) return;

    await invokeIn(tab.id);
  });

  browser.commands.onCommand.addListener(async (command) => {
    if (command !== 'invoke-register-bar') return;

    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) return;

    await invokeIn(tab.id);
  });

  browser.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    if (DoctorRequestSchema.safeParse(message).success) {
      void runDoctorHere().then(sendResponse);
      return true;
    }

    if (BarScriptRequestSchema.safeParse(message).success) {
      void injectBarScript(sender).then(() => sendResponse({ ok: true }));
      return true;
    }

    if (BarStylesRequestSchema.safeParse(message).success) {
      void readBarStyles().then((css) => sendResponse({ css }));
      return true;
    }

    const recorded = RecordEventMessageSchema.safeParse(message);
    if (recorded.success) void recordEvent(recorded.data.event);

    return undefined;
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

/** Every frame hears the invoke; only the focused one opens a bar (see the content script). */
async function invokeIn(tabId: number): Promise<void> {
  await browser.tabs.sendMessage(tabId, { type: 'invoke-bar' }).catch(() => undefined);
}

async function injectBarScript(sender: Browser.runtime.MessageSender): Promise<void> {
  if (sender.tab?.id === undefined) return;

  await browser.scripting
    .executeScript({
      target: {
        tabId: sender.tab.id,
        ...(sender.frameId === undefined ? {} : { frameIds: [sender.frameId] }),
      },
      files: [BAR_SCRIPT_PATH],
    })
    .catch(() => undefined);
}

async function readBarStyles(): Promise<string> {
  try {
    const stylesUrl = new URL(BAR_STYLES_PATH, browser.runtime.getURL(BAR_SCRIPT_PATH));
    const response = await fetch(stylesUrl);
    return response.ok ? await response.text() : '';
  } catch {
    return '';
  }
}

async function recordEvent(event: TransformEvent): Promise<void> {
  const stored = await browser.storage.local.get(EVENTS_KEY);
  const events = appendEvent(readEvents(stored[EVENTS_KEY]), event);

  await browser.storage.local.set({ [EVENTS_KEY]: events });
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
