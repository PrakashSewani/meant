import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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

/** Where the bar should appear: the selection's box, in viewport coordinates. */
export interface BarAnchor {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

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
  anchor: BarAnchor;
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
  anchor,
  result,
  errorMessage,
  onRegisterChange,
  onEffortChange,
  onRecipeChange,
  onAccept,
  onDismiss,
}: BarProps) {
  const [expanded, setExpanded] = useState(false);
  const [placement, setPlacement] = useState<{ left: number; top: number }>();
  const dialog = useRef<HTMLDivElement>(null);
  const tookFocus = useRef(false);

  function change(patch: Partial<Register>) {
    onRegisterChange?.({ ...register, ...patch });
  }

  // Placed under the selection, flipped above it when there is no room, clamped to the viewport.
  // It measures itself, so expanding or streaming more text keeps it in view.
  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;

    const measure = () => {
      const box = element.getBoundingClientRect();
      const margin = 8;
      const below = anchor.bottom + margin;
      const above = anchor.top - box.height - margin;
      const fitsBelow = below + box.height + margin <= window.innerHeight;

      setPlacement({
        left: Math.min(
          Math.max(margin, anchor.left),
          Math.max(margin, window.innerWidth - box.width - margin),
        ),
        top: fitsBelow ? below : Math.max(margin, above),
      });
    };

    measure();
    window.addEventListener('resize', measure);

    // Focus belongs here rather than in a passive effect: it has to happen before the first paint,
    // while the element is definitely on screen and focusable.
    if (!tookFocus.current) {
      tookFocus.current = true;
      element.focus();
    }

    return () => window.removeEventListener('resize', measure);
  }, [anchor, expanded, result, errorMessage]);

  useEffect(() => {
    // Listening on the shadow root rather than the document is what keeps the page's own keys out:
    // nothing below it is the page's, and nothing above it is ours.
    const root = dialog.current?.getRootNode();
    if (!(root instanceof ShadowRoot)) return;

    function onKeyDown(event: Event) {
      const { key, shiftKey } = event as KeyboardEvent;
      const dialogElement = dialog.current;
      if (!dialogElement) return;

      // Focus starts on the dialog itself, which is not in the sequential order, so the first Tab
      // has to be handed to the first control deliberately — otherwise it walks the page instead.
      if (key === 'Tab' && !shiftKey && event.target === dialogElement) {
        const first = dialogElement.querySelector<HTMLElement>(
          'select, button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
        );

        if (first) {
          event.preventDefault();
          first.focus();
          return;
        }
      }

      // ⏎ is the primary action, but never at the expense of a control that needs it: an open
      // select menu, or a chip input mid-edit.
      const target = event.target as HTMLElement | null;
      const typing = target?.matches('select, input, textarea') ?? false;

      if (key === 'Enter' && result && !typing) {
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
      style={{ left: placement?.left, top: placement?.top }}
      className="meant-bar fixed z-[2147483647] w-max min-w-[19rem] max-w-[26rem] rounded-xl border border-neutral-200 bg-white font-sans text-[13px] text-neutral-900 shadow-xl ring-1 ring-black/5 outline-none"
    >
      <div className="flex items-center gap-2 rounded-t-xl border-b border-neutral-200 bg-neutral-50 px-3 py-2">
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
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 px-3 py-2">
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
        <p className="max-h-56 overflow-auto border-t border-neutral-100 px-3 py-2 whitespace-pre-wrap">
          {result}
        </p>
      ) : null}

      {errorMessage ? (
        <p className="border-t border-neutral-100 px-3 py-2 text-red-700">{errorMessage}</p>
      ) : null}

      <p className="rounded-b-xl border-t border-neutral-100 bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
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
      <span className="w-12 shrink-0 text-xs text-neutral-500">{label}</span>
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
        className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs"
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
