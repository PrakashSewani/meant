import { useEffect, useRef, useState } from 'react';
import type { Effort, Length, Register } from '@meant/core';
import {
  FORMAT_SUGGESTIONS,
  TONE_SUGGESTIONS,
  formatTones,
  parseTones,
  parseWho,
} from './register-input';

const EFFORTS: readonly Effort[] = ['quick', 'balanced', 'deep'];
const LENGTHS: readonly Length[] = ['short', 'medium', 'long'];

export interface RecipeChoice {
  id: string;
  label: string;
}

export interface BarProps {
  inferredLine: string;
  register: Register;
  effort: Effort;
  recipes: readonly RecipeChoice[];
  recipeId: string;
  result?: string;
  errorMessage?: string;
  onRegisterChange?: (register: Register) => void;
  onEffortChange?: (effort: Effort) => void;
  onRecipeChange?: (id: string) => void;
  onAccept?: () => void;
  onDismiss?: () => void;
}

export function Bar({
  inferredLine,
  register,
  effort,
  recipes,
  recipeId,
  result,
  errorMessage,
  onRegisterChange,
  onEffortChange,
  onRecipeChange,
  onAccept,
  onDismiss,
}: BarProps) {
  const [expanded, setExpanded] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);

  function change(patch: Partial<Register>) {
    onRegisterChange?.({ ...register, ...patch });
  }

  useEffect(() => {
    // Listening on the shadow root rather than the document is what keeps the page's own keys out:
    // nothing below it is the page's, and nothing above it is ours.
    const root = dialog.current?.getRootNode();
    if (!(root instanceof ShadowRoot)) return;

    function onKeyDown(event: Event) {
      const { key } = event as KeyboardEvent;
      if (key === 'Enter' && result) {
        event.preventDefault();
        onAccept?.();
      }
      if (key === 'Escape') {
        event.preventDefault();
        onDismiss?.();
      }
    }

    root.addEventListener('keydown', onKeyDown);

    return () => root.removeEventListener('keydown', onKeyDown);
  }, [result, onAccept, onDismiss]);

  return (
    <div
      ref={dialog}
      role="dialog"
      aria-label="Meant"
      tabIndex={-1}
      className="meant-bar pointer-events-auto fixed right-6 bottom-6 z-[2147483647] w-[26rem] rounded-xl border border-neutral-200 bg-white font-sans text-sm text-neutral-900 shadow-xl"
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <span aria-hidden className="text-neutral-400">
          ✦
        </span>
        <select
          value={recipeId}
          aria-label="Transform"
          onChange={(event) => onRecipeChange?.(event.target.value)}
          className="max-w-[10rem] cursor-pointer truncate bg-transparent font-medium text-neutral-900"
        >
          {recipes.map((recipe) => (
            <option key={recipe.id} value={recipe.id}>
              {recipe.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="ml-auto rounded-md border border-neutral-200 px-2 py-1 text-xs capitalize text-neutral-600"
        >
          {effort}
        </button>
        <button
          type="button"
          onClick={onAccept}
          disabled={!result}
          className="rounded-md bg-neutral-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
        >
          Accept
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md px-2 py-1 text-xs text-neutral-500"
        >
          Dismiss
        </button>
      </div>

      {expanded ? (
        <div className="grid grid-cols-2 gap-2 border-t border-neutral-100 px-3 py-2">
          <ChipInput
            label="Who"
            value={register.who ?? ''}
            placeholder="Who?"
            onCommit={(value) => change({ who: parseWho(value) })}
          />
          <ChipInput
            label="Tone"
            value={formatTones(register.tone)}
            placeholder="direct, warm"
            list={TONE_SUGGESTIONS}
            onCommit={(value) => change({ tone: parseTones(value) })}
          />
          <ChipInput
            label="As"
            value={register.format ?? ''}
            placeholder="reply"
            list={FORMAT_SUGGESTIONS}
            onCommit={(value) => change({ format: parseWho(value) })}
          />
          <div className="flex items-center gap-1">
            <span className="text-xs text-neutral-500">Length</span>
            {LENGTHS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={value === register.length}
                onClick={() => change({ length: value === register.length ? undefined : value })}
                className={`rounded-md px-2 py-1 text-xs capitalize ${
                  value === register.length ? 'bg-neutral-900 text-white' : 'text-neutral-600'
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {expanded ? (
        <div className="flex items-center gap-1 border-t border-neutral-100 px-3 py-2">
          <span className="text-xs text-neutral-500">Effort</span>
          {EFFORTS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onEffortChange?.(value)}
              aria-pressed={value === effort}
              className={`rounded-md px-2 py-1 text-xs capitalize ${
                value === effort ? 'bg-neutral-900 text-white' : 'text-neutral-600'
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      ) : null}

      {result ? (
        <p className="border-t border-neutral-100 px-3 py-2 whitespace-pre-wrap">{result}</p>
      ) : null}

      {errorMessage ? (
        <p className="border-t border-neutral-100 px-3 py-2 text-red-700">{errorMessage}</p>
      ) : null}

      <p className="border-t border-neutral-100 px-3 py-2 text-xs text-neutral-500">
        {inferredLine}
      </p>
    </div>
  );
}

interface ChipInputProps {
  label: string;
  value: string;
  placeholder: string;
  list?: readonly string[];
  onCommit: (value: string) => void;
}

/**
 * Text chips commit on blur or Enter rather than on every keystroke: a commit re-runs the
 * transform, and a transform per character is not a product.
 */
function ChipInput({ label, value, placeholder, list, onCommit }: ChipInputProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  function commit() {
    if (draft !== value) onCommit(draft);
  }

  const listId = list ? `meant-${label.toLowerCase()}-options` : undefined;

  return (
    <label className="flex items-center gap-2">
      <span className="text-xs text-neutral-500">{label}</span>
      <input
        value={draft}
        list={listId}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
          if (event.key === 'Escape') setDraft(value);
        }}
        className="w-full rounded-md border border-neutral-200 px-2 py-1 text-xs"
      />
      {listId ? (
        <datalist id={listId}>
          {list?.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      ) : null}
    </label>
  );
}
