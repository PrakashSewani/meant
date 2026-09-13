import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Bar, BAR_TAG } from '@sayable/ui';
import '@sayable/ui/styles.css';
import { adapterFor, type Editable, type SelectionInfo } from '@sayable/adapters';
import {
  InvokeMessageSchema,
  PingMessageSchema,
  RECIPES,
  StreamEventSchema,
  correctionsBetween,
  curatedMatchPatterns,
  resolveRegister,
  type Effort,
  type Register,
  type RegisterHints,
  type TransformEvent,
  type TransformRequest,
} from '@sayable/core';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';

const PORT_NAME = 'sayable-transform';
const DEFAULT_RECIPE_ID = 'say-it-better';
const RECIPE_CHOICES = RECIPES.map(({ id, label }) => ({ id, label }));

export default defineContentScript({
  matches: curatedMatchPatterns(),
  allFrames: true,
  runAt: 'document_idle',
  // The bar lives in a shadow root, so its stylesheet has to be injected there with it.
  cssInjectionMode: 'ui',
  main(ctx) {
    // A site enabled at runtime gets this file injected on demand as well as registered for
    // later navigations, so the frame may already be initialised.
    const frame = globalThis as { __sayableLoaded?: boolean };
    if (frame.__sayableLoaded) return;
    frame.__sayableLoaded = true;

    const adapter = adapterFor(new URL(location.href));

    browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
      if (PingMessageSchema.safeParse(message).success) {
        sendResponse({ alive: true });
        return undefined;
      }

      const parsed = InvokeMessageSchema.safeParse(message);
      if (!parsed.success) return undefined;

      void openBar(adapter, ctx);
      return undefined;
    });
  },
});

async function openBar(
  adapter: ReturnType<typeof adapterFor>,
  ctx: Parameters<typeof createShadowRootUi>[0],
): Promise<void> {
  // The command reaches every frame in the tab; only the one the user is typing in opens a bar.
  if (!document.hasFocus()) return;

  const element = activeEditable(adapter);
  if (!element) return;

  const editable = element;
  const selection = adapter.getSelection(editable);
  const intentText = (selection?.text ?? adapter.read(editable)).trim();
  if (!intentText) return;

  const hints = adapter.inferContext(editable);
  const register = resolveRegister({ hints });

  const ui = await createShadowRootUi(ctx, {
    name: BAR_TAG,
    position: 'overlay',
    // Appended to the document, never inside the editable: a textarea cannot render children, and
    // inside a rich editor our bar would become part of the message (ARCHITECTURE §7).
    anchor: () => document.documentElement,
    // Closed: the page cannot reach our markup, and page CSS cannot reach our styles (invariant:
    // the host page must not be able to tamper with the bar).
    mode: 'closed',
    onMount(container) {
      const root = createRoot(container);
      root.render(
        <BarHost
          hints={hints}
          register={register}
          intentText={intentText}
          selection={selection}
          onState={(state) => {
            ui.shadowHost.dataset.state = state;
          }}
          onAccept={(text) => {
            if (selection) adapter.replaceSelection(editable, selection, text);
            else adapter.write(editable, text);
            ui.remove();
          }}
          onDismiss={() => ui.remove()}
        />,
      );
      return root;
    },
    onRemove(root) {
      root?.unmount();
    },
  });

  ui.mount();

  // The dialog takes focus when it opens, so the whole loop is reachable by keyboard. The host
  // element itself is not focusable (the overlay wrapper has no box), so the container inside
  // the shadow root is the focus target.
  ui.uiContainer.tabIndex = -1;
  ui.uiContainer.focus();
}

function activeEditable(adapter: ReturnType<typeof adapterFor>): Editable | null {
  const element = document.activeElement;
  if (element) {
    const found = adapter.findEditable(element);
    if (found) return found;
  }

  const anchor = document.getSelection()?.anchorNode;
  const parent = anchor?.parentElement;
  if (parent) return adapter.findEditable(parent);

  return null;
}

interface BarHostProps {
  hints: RegisterHints;
  register: Register;
  intentText: string;
  selection: SelectionInfo | null;
  onState: (state: BarState) => void;
  onAccept: (text: string) => void;
  onDismiss: () => void;
}

type BarState = 'streaming' | 'ready' | 'error';

function BarHost({
  hints,
  register: inferred,
  intentText,
  onState,
  onAccept,
  onDismiss,
}: BarHostProps) {
  const [register, setRegister] = useState(inferred);
  const [effort, setEffort] = useState<Effort>('quick');
  const [recipeId, setRecipeId] = useState(DEFAULT_RECIPE_ID);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState('');
  const [errorMessage, setErrorMessage] = useState<string>();

  useEffect(() => {
    onState('streaming');
    const requestId = `r${Date.now().toString(36)}${attempt}`;
    const port = browser.runtime.connect({ name: PORT_NAME });

    port.onMessage.addListener((raw: unknown) => {
      const parsed = StreamEventSchema.safeParse(raw);
      if (!parsed.success || parsed.data.requestId !== requestId) return;

      const event = parsed.data;
      if (event.type === 'chunk') setResult((current) => current + event.text);
      if (event.type === 'done') onState('ready');
      if (event.type === 'error') {
        setErrorMessage(event.message);
        onState('error');
      }
    });

    const request: TransformRequest = {
      requestId,
      intentText,
      mode: 'polish',
      register,
      effort,
      recipeId,
    };
    port.postMessage({ type: 'transform', request });

    return () => {
      port.postMessage({ type: 'cancel', requestId });
      port.disconnect();
    };
  }, [attempt, effort, intentText, register, recipeId, onState]);

  function rerun() {
    setResult('');
    setErrorMessage(undefined);
    setAttempt((current) => current + 1);
  }

  function record(accepted: boolean) {
    if (!accepted && result.length === 0) return;

    const event: TransformEvent = {
      at: Date.now(),
      surface: hints.siteId ?? 'page',
      effort,
      inferred,
      sent: register,
      accepted,
      corrections: correctionsBetween(inferred, register),
    };

    if (hints.fieldRole) event.fieldRole = hints.fieldRole;
    event.recipeId = recipeId;

    void browser.runtime.sendMessage({ type: 'event', event }).catch(() => undefined);
  }

  return (
    <Bar
      inferredLine={inferredLine(hints, register)}
      register={register}
      effort={effort}
      recipes={RECIPE_CHOICES}
      recipeId={recipeId}
      result={result || undefined}
      errorMessage={errorMessage}
      onRegisterChange={(next) => {
        setRegister(next);
        rerun();
      }}
      onEffortChange={(value) => {
        setEffort(value);
        rerun();
      }}
      onRecipeChange={(value) => {
        setRecipeId(value);
        rerun();
      }}
      onAccept={() => {
        onAccept(result);
        record(true);
      }}
      onDismiss={() => {
        // Dismissing before anything was shown is not a rejection of anything.
        record(false);
        onDismiss();
      }}
    />
  );
}

function inferredLine(hints: RegisterHints, register: Register): string {
  const parts = [
    hints.siteId ?? 'this page',
    register.format ?? 'text',
    hints.formalityPrior ?? 'neutral',
  ];

  return `Inferred: ${parts.join(' · ')}`;
}
