import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Bar } from '@meant/ui';
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
      anchor={anchor}
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
