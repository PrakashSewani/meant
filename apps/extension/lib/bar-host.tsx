import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Bar, type BarStatus } from '@meant/ui';
import {
  RECIPES,
  StreamEventSchema,
  correctionsBetween,
  type Effort,
  type Register,
  type RegisterHints,
  type TransformEvent,
  type TransformRequest,
} from '@meant/core';
import { setBarMount, type BarHostRequest, type BarMount } from './bar-bridge';

const PORT_NAME = 'meant-transform';
const DEFAULT_RECIPE_ID = 'say-it-better';
const RECIPE_CHOICES = RECIPES.map(({ id, label }) => ({ id, label }));

export const mountBar: BarMount = ({ shadow, styles, ...request }) => {
  // The styles live inside the shadow root rather than on the page, so nothing leaks into the host.
  const style = document.createElement('style');
  style.textContent = styles;
  shadow.append(style);

  const container = document.createElement('div');
  shadow.append(container);

  const root = createRoot(container);
  root.render(<BarHost {...request} />);

  return () => root.unmount();
};

export default function registerBar(): void {
  setBarMount(mountBar);
}

/**
 * Opening the bar spends nothing: it shows what inference decided and waits. Transform is the one
 * action that calls a provider, and editing a chip goes back to asking rather than firing again.
 */
function BarHost({
  hints,
  register: inferred,
  intentText,
  anchor,
  onState,
  onAccept,
  onDismiss,
}: Omit<BarHostRequest, 'shadow' | 'styles'>) {
  const [register, setRegister] = useState(inferred);
  const [effort, setEffort] = useState<Effort>('quick');
  const [recipeId, setRecipeId] = useState(DEFAULT_RECIPE_ID);
  const [status, setStatus] = useState<BarStatus>('idle');
  const [result, setResult] = useState('');
  const [errorMessage, setErrorMessage] = useState<string>();

  const port = useRef<ReturnType<typeof browser.runtime.connect> | null>(null);

  useEffect(() => {
    onState(status);
  }, [status, onState]);

  useEffect(() => stop, []);

  function stop() {
    port.current?.disconnect();
    port.current = null;
  }

  function transform() {
    stop();

    const id = `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const connection = browser.runtime.connect({ name: PORT_NAME });

    port.current = connection;
    setResult('');
    setErrorMessage(undefined);
    setStatus('streaming');

    connection.onMessage.addListener((raw: unknown) => {
      const parsed = StreamEventSchema.safeParse(raw);
      if (!parsed.success || parsed.data.requestId !== id) return;

      const event = parsed.data;
      if (event.type === 'chunk') setResult((current) => current + event.text);
      if (event.type === 'done') setStatus('ready');
      if (event.type === 'error') {
        setErrorMessage(event.message);
        setStatus('error');
      }
    });

    connection.onDisconnect.addListener(() => {
      if (port.current === connection) port.current = null;
    });

    const request: TransformRequest = {
      requestId: id,
      intentText,
      mode: 'polish',
      register,
      effort,
      recipeId,
    };
    connection.postMessage({ type: 'transform', request });
  }

  function reset() {
    stop();
    setResult('');
    setErrorMessage(undefined);
    setStatus('idle');
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
      anchor={anchor}
      status={status}
      result={result || undefined}
      errorMessage={errorMessage}
      onRegisterChange={(next) => {
        setRegister(next);
        reset();
      }}
      onEffortChange={(value) => {
        setEffort(value);
        reset();
      }}
      onRecipeChange={(value) => {
        setRecipeId(value);
        reset();
      }}
      onPrimary={() => {
        if (status === 'ready') {
          onAccept(result);
          record(true);
          return;
        }

        transform();
      }}
      onDismiss={() => {
        // Dismissing before anything was shown is not a rejection of anything.
        record(false);
        stop();
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
