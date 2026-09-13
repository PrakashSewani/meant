import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Bar } from '@sayable/ui';
import '@sayable/ui/styles.css';
import { adapterFor, type Editable, type SelectionInfo } from '@sayable/adapters';
import {
  InvokeMessageSchema,
  PingMessageSchema,
  StreamEventSchema,
  curatedMatchPatterns,
  resolveRegister,
  type Effort,
  type Register,
  type RegisterHints,
  type TransformRequest,
} from '@sayable/core';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';

const PORT_NAME = 'sayable-transform';
const RECIPE_ID = 'say-it-better';

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
  const element = activeEditable(adapter);
  if (!element) return;

  const editable = element;
  const selection = adapter.getSelection(editable);
  const intentText = (selection?.text ?? adapter.read(editable)).trim();
  if (!intentText) return;

  const hints = adapter.inferContext(editable);
  const register = resolveRegister({ hints });

  const ui = await createShadowRootUi(ctx, {
    name: 'sayable-bar',
    position: 'overlay',
    anchor: () => editable.element,
    onMount(container) {
      const root = createRoot(container);
      root.render(
        <BarHost
          hints={hints}
          register={register}
          intentText={intentText}
          selection={selection}
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
  onAccept: (text: string) => void;
  onDismiss: () => void;
}

function BarHost({ hints, register: inferred, intentText, onAccept, onDismiss }: BarHostProps) {
  const [register, setRegister] = useState(inferred);
  const [effort, setEffort] = useState<Effort>('quick');
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState('');
  const [errorMessage, setErrorMessage] = useState<string>();

  useEffect(() => {
    const requestId = `r${Date.now().toString(36)}${attempt}`;
    const port = browser.runtime.connect({ name: PORT_NAME });

    port.onMessage.addListener((raw: unknown) => {
      const parsed = StreamEventSchema.safeParse(raw);
      if (!parsed.success || parsed.data.requestId !== requestId) return;

      const event = parsed.data;
      if (event.type === 'chunk') setResult((current) => current + event.text);
      if (event.type === 'error') setErrorMessage(event.message);
    });

    const request: TransformRequest = {
      requestId,
      intentText,
      mode: 'polish',
      register,
      effort,
      recipeId: RECIPE_ID,
    };
    port.postMessage({ type: 'transform', request });

    return () => {
      port.postMessage({ type: 'cancel', requestId });
      port.disconnect();
    };
  }, [attempt, effort, intentText, register]);

  function rerun() {
    setResult('');
    setErrorMessage(undefined);
    setAttempt((current) => current + 1);
  }

  return (
    <Bar
      inferredLine={inferredLine(hints, register)}
      register={register}
      effort={effort}
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
      onAccept={() => onAccept(result)}
      onDismiss={onDismiss}
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
