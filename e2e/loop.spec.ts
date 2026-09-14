import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, expect, test, type BrowserContext, type Worker } from '@playwright/test';

const EXTENSION_PATH = join(process.cwd(), 'apps', 'extension', '.output', 'chrome-mv3');
const FIXTURE = 'http://localhost:3123/fixture.html';

/** Mirrors PIECES in e2e/serve-fixture.mjs: an answer can only have come from that endpoint. */
const PROVIDER_REPLY = 'Deploy slipped a day. We are on it, fix by EOD.';

let context: BrowserContext;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'meant-e2e-')), {
    // The headless shell cannot load extensions; the full Chromium build can.
    channel: 'chromium',
    viewport: { width: 900, height: 700 },
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
  });
});

test.afterAll(async () => {
  await context.close();
});

test('polish, accept, and one native undo puts the original text back', async () => {
  const worker = await serviceWorker();
  await configureFixtureProvider(worker);

  const page = await context.newPage();
  await page.goto(FIXTURE);

  const field = page.locator('#plain');
  const original = await field.inputValue();
  await field.selectText();

  await invokeBar();

  const bar = page.locator('meant-bar');
  await expect(bar).toHaveAttribute('data-state', 'idle');

  // Keyboard only, and nothing is called until the user asks: ⏎ transforms, then ⏎ accepts.
  await page.keyboard.press('Enter');
  await expect(bar).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });
  await page.keyboard.press('Enter');

  // Assert the answer, not just "something changed": a stray keystroke would satisfy that.
  await expect(field).toHaveValue(PROVIDER_REPLY);

  // The whole point of the write helper: Chromium recorded the edit, so ⌘Z gives the words back.
  await page.evaluate(() => document.execCommand('undo'));

  await expect(field).toHaveValue(original);
});

test('the command path reaches one frame, not every frame', async () => {
  const page = await context.newPage();
  await page.goto(FIXTURE);

  await page.locator('#plain').selectText();
  await invokeBar();

  await expect(page.locator('meant-bar')).toHaveCount(1);
});

test('the bar’s stylesheet is where the bar script looks for it', async () => {
  const worker = await serviceWorker();

  // A silently unstyled bar is exactly the kind of thing unit tests cannot see.
  const status = await worker.evaluate(async () => {
    const response = await fetch(chrome.runtime.getURL('assets/bar-styles.css'));
    return response.status;
  });

  expect(status).toBe(200);
});

test('a configured endpoint is called for real, through the same pipeline', async () => {
  const worker = await serviceWorker();

  // What the custom-provider form writes: an OpenAI-compatible endpoint on this machine.
  await configureFixtureProvider(worker);

  try {
    const page = await context.newPage();
    await page.goto(FIXTURE);

    const field = page.locator('#plain');
    await field.selectText();
    await invokeBar();

    const bar = page.locator('meant-bar');
    await expect(bar).toHaveAttribute('data-state', 'idle');
    await page.keyboard.press('Enter');
    await expect(bar).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });
    await page.keyboard.press('Enter');

    // Proof the answer came from the endpoint rather than from anything inside the extension.
    await expect(field).toHaveValue(PROVIDER_REPLY, { timeout: 10_000 });
  } finally {
    await worker.evaluate(() => chrome.storage.local.clear());
  }
});

test('editing a chip reaches the model, not just the pill', async () => {
  const worker = await serviceWorker();
  await configureFixtureProvider(worker);
  await worker.evaluate(() => chrome.storage.local.remove('meant.events'));

  const page = await context.newPage();
  await page.goto(FIXTURE);
  await page.locator('#plain').selectText();
  await invokeBar();

  const bar = page.locator('meant-bar');
  await expect(bar).toHaveAttribute('data-state', 'idle');

  // Tab order is ours: recipe, primary, close, then the chips. Five stops lands on Tone.
  for (let stop = 0; stop < 5; stop += 1) await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await page.keyboard.type('direct, warm');
  await page.keyboard.press('Tab');

  // Back to the primary action: Tone, Who, close, primary.
  for (let stop = 0; stop < 4; stop += 1) await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Enter');

  await expect(bar).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });
  await page.keyboard.press('Enter');

  const readEvents = () =>
    worker.evaluate(async () => {
      const stored = await chrome.storage.local.get('meant.events');
      return (stored['meant.events'] ?? []) as { sent: { tone?: string[] } }[];
    });

  // The worker writes the event after the accept, so give it a moment rather than racing it.
  await expect.poll(async () => (await readEvents()).length).toBeGreaterThan(0);
  expect((await readEvents()).at(-1)?.sent.tone).toEqual(['direct', 'warm']);
});

test('compose mode writes into an empty field', async () => {
  const worker = await serviceWorker();
  await configureFixtureProvider(worker);

  const page = await context.newPage();
  await page.goto(FIXTURE);

  const field = page.locator('#placeholder');
  await expect(field).toHaveValue('');
  await field.click();

  await invokeBar();

  const bar = page.locator('meant-bar');
  await expect(bar).toHaveAttribute('data-state', 'idle');

  // The intent box is inside the bar, so it takes the typing once the bar holds focus.
  await page.keyboard.type('tell sarah the deploy slipped a day');
  await page.keyboard.press('ControlOrMeta+Enter');

  await expect(bar).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });

  // In compose mode ⏎ is a newline in the intent box, so the primary action is ⌘⏎ throughout.
  await page.keyboard.press('ControlOrMeta+Enter');

  await expect(field).toHaveValue(PROVIDER_REPLY);
});

test('writes into a rich editor that has markup in the way', async () => {
  const worker = await serviceWorker();
  await configureFixtureProvider(worker);

  const page = await context.newPage();
  await page.goto('http://localhost:3123/fixture-rich.html');

  const editor = page.locator('#thread');
  const before = await editor.innerText();

  // Select the rough line inside its paragraph: the write has to land in the middle of markup.
  await editor.locator('p').first().selectText();

  await invokeBar();

  const bar = page.locator('meant-bar');
  await expect(bar).toHaveAttribute('data-state', 'idle');
  await page.keyboard.press('Enter');
  await expect(bar).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });
  await page.keyboard.press('Enter');

  // The rest of the thread survives, which is the invariant about transforming only the selection.
  await expect(editor).toContainText('Two tests fail');
  await expect(editor).toContainText(PROVIDER_REPLY);
  await expect(editor.innerText()).not.toBe(before);

  await page.evaluate(() => document.execCommand('undo'));
  expect(await editor.innerText()).toBe(before);
});

test('a provider with no model says so instead of answering', async () => {
  const worker = await serviceWorker();

  // What the local presets store: a provider block, and no model id filled in yet.
  await worker.evaluate(async () => {
    await chrome.storage.local.set({
      'meant.config': {
        provider: {
          lmstudio: {
            npm: '@ai-sdk/openai-compatible',
            name: 'LM Studio (local)',
            options: { baseURL: 'http://127.0.0.1:1234/v1' },
          },
        },
      },
    });
  });

  try {
    const page = await context.newPage();
    await page.goto(FIXTURE);

    const field = page.locator('#plain');
    const original = await field.inputValue();
    await field.selectText();
    await invokeBar();

    const bar = page.locator('meant-bar');
    await expect(bar).toHaveAttribute('data-state', 'idle');
    await page.keyboard.press('Enter');

    // A provider that is configured but has no model is not a first run, so an answer here would
    // be fabricated — and would hide what is actually missing.
    await expect(bar).toHaveAttribute('data-state', 'error');
    await expect(field).toHaveValue(original);
  } finally {
    await worker.evaluate(() => chrome.storage.local.clear());
  }
});

test('nothing configured is an error, not a made-up answer', async () => {
  const worker = await serviceWorker();
  await worker.evaluate(() => chrome.storage.local.clear());

  const page = await context.newPage();
  await page.goto(FIXTURE);

  const field = page.locator('#plain');
  const original = await field.inputValue();
  await field.selectText();
  await invokeBar();

  const bar = page.locator('meant-bar');
  await expect(bar).toHaveAttribute('data-state', 'idle');
  await page.keyboard.press('Enter');

  // There is nothing to demo with: with no provider the bar has to say so.
  await expect(bar).toHaveAttribute('data-state', 'error');
  await expect(field).toHaveValue(original);
});

test('the config that is active is the one that runs', async () => {
  const worker = await serviceWorker();

  // Two saved configs and no old-style config, so the only way to reach a model is the active id.
  await worker.evaluate(async () => {
    await chrome.storage.local.set({
      'meant.configs': {
        good: {
          name: 'Fixture',
          config: {
            model: 'fixture/fixture-model',
            provider: {
              fixture: {
                npm: '@ai-sdk/openai-compatible',
                name: 'Fixture',
                options: { baseURL: 'http://localhost:3123/v1' },
                models: { 'fixture-model': { name: 'fixture-model' } },
              },
            },
          },
        },
        half: {
          name: 'Half set up',
          config: {
            provider: {
              lmstudio: {
                name: 'LM Studio (local)',
                options: { baseURL: 'http://127.0.0.1:1234/v1' },
              },
            },
          },
        },
      },
      'meant.activeConfig': 'good',
      'meant.secrets': { fixture: 'sk-fixture' },
    });
  });

  try {
    const page = await context.newPage();
    await page.goto(FIXTURE);

    const field = page.locator('#plain');
    await field.selectText();
    await invokeBar();

    const bar = page.locator('meant-bar');
    await expect(bar).toHaveAttribute('data-state', 'idle');
    await page.keyboard.press('Enter');
    await expect(bar).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });
    await page.keyboard.press('Enter');
    await expect(field).toHaveValue(PROVIDER_REPLY);

    // Switch the selection to the config with no model, and ask again.
    await worker.evaluate(() => chrome.storage.local.set({ 'meant.activeConfig': 'half' }));

    const second = await context.newPage();
    await second.goto(FIXTURE);
    await second.locator('#plain').selectText();
    await invokeBar();

    const secondBar = second.locator('meant-bar');
    await expect(secondBar).toHaveAttribute('data-state', 'idle');
    await second.keyboard.press('Enter');

    // Nothing to call: the active config is the half-finished one, and it says so instead of
    // quietly falling back to the config that would have worked.
    await expect(secondBar).toHaveAttribute('data-state', 'error');
  } finally {
    await worker.evaluate(() => chrome.storage.local.clear());
  }
});

/**
 * Drives the same path the browser command does: the worker tells the tab to open the bar. The
 * command itself is a browser-level shortcut, which is not ours to test.
 */
async function invokeBar(): Promise<void> {
  const worker = await serviceWorker();

  const tabId = await worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab?.id;
  });

  if (tabId === undefined) throw new Error('no active tab to invoke');

  await worker.evaluate((id) => chrome.tabs.sendMessage(id, { type: 'invoke-bar' }), tabId);
}

async function serviceWorker(): Promise<Worker> {
  const [existing] = context.serviceWorkers();

  return existing ?? (await context.waitForEvent('serviceworker'));
}

/** The fixture endpoint, shaped exactly like a provider the user configured. Never a real key. */
async function configureFixtureProvider(worker: Worker): Promise<void> {
  await worker.evaluate(async () => {
    await chrome.storage.local.set({
      'meant.config': {
        model: 'fixture/fixture-model',
        provider: {
          fixture: {
            npm: '@ai-sdk/openai-compatible',
            name: 'Fixture',
            options: { baseURL: 'http://localhost:3123/v1' },
            models: { 'fixture-model': { name: 'fixture-model' } },
          },
        },
      },
      'meant.secrets': { fixture: 'sk-fixture' },
    });
  });
}
