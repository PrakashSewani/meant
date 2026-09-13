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

export type BarStatus = 'idle' | 'streaming' | 'ready' | 'error';

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
  status: BarStatus;
  result?: string;
  errorMessage?: string;
  onRegisterChange?: (register: Register) => void;
  onEffortChange?: (effort: Effort) => void;
  onRecipeChange?: (id: string) => void;
  /** Transform when there is nothing yet, accept once there is, retry after a failure. */
  onPrimary?: () => void;
  onDismiss?: () => void;
}

export function Bar({
  inferredLine,
  register,
  effort,
  recipes,
  recipeId,
  anchor,
  status,
  result,
  errorMessage,
  onRegisterChange,
  onEffortChange,
  onRecipeChange,
  onPrimary,
  onDismiss,
}: BarProps) {
  const [expanded, setExpanded] = useState(false);
  const [placement, setPlacement] = useState<{ left: number; top: number }>();
  const dialog = useRef<HTMLDivElement>(null);
  const tookFocus = useRef(false);

  const primaryLabel =
    status === 'ready' ? 'Accept' : status === 'error' ? 'Try again' : 'Transform';

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
  }, [anchor, expanded, result, errorMessage, status]);

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

      if (key === 'Escape') {
        event.preventDefault();
        onDismiss?.();
        return;
      }

      // ⏎ is the primary action — transform, then accept — but never at the expense of a control
      // that needs it: an open select menu, or a chip input mid-edit.
      const target = event.target as HTMLElement | null;
      const typing = target?.matches('select, input, textarea') ?? false;

      if (key === 'Enter' && !typing && status !== 'streaming') {
        event.preventDefault();
        onPrimary?.();
      }
    }

    root.addEventListener('keydown', onKeyDown);

    return () => root.removeEventListener('keydown', onKeyDown);
  }, [status, onPrimary, onDismiss]);

  return (
    <div
      ref={dialog}
      role="dialog"
      aria-label="Meant"
      tabIndex={-1}
      style={{ left: placement?.left, top: placement?.top }}
      className="meant-bar fixed z-[2147483647] w-max min-w-[21rem] max-w-[26rem] rounded-xl border border-neutral-200 bg-white font-sans text-[13px] text-neutral-900 shadow-xl ring-1 ring-black/5 outline-none"
    >
      <div className="flex items-center gap-1.5 rounded-t-xl border-b border-neutral-200 bg-neutral-50 px-3 py-2">
        <span aria-hidden className="mr-0.5 text-neutral-400">
          ✦
        </span>
        <select
          value={recipeId}
          aria-label="Transform"
          onChange={(event) => onRecipeChange?.(event.target.value)}
          className="max-w-[11rem] cursor-pointer truncate bg-transparent font-medium text-neutral-900"
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
          aria-label={expanded ? 'Fewer options' : 'More options'}
          onClick={() => setExpanded((value) => !value)}
          className={`rounded-md px-1.5 py-0.5 text-xs text-neutral-500 transition-transform hover:text-neutral-800 ${
            expanded ? 'rotate-180' : ''
          }`}
        >
          ▾
        </button>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={onPrimary}
            disabled={status === 'streaming'}
            className="rounded-md bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-40"
          >
            {primaryLabel}
          </button>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={onDismiss}
            className="rounded-md px-1 text-neutral-400 transition-colors hover:text-neutral-800"
          >
            ✕
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="space-y-2 border-b border-neutral-100 px-3 py-2.5">
          <ChipInput
            label="Who"
            value={register.who ?? ''}
            placeholder="nobody in particular"
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
            placeholder="a reply"
            list={FORMAT_SUGGESTIONS}
            onCommit={(value) => change({ format: parseWho(value) })}
          />

          <div className="flex items-center gap-2">
            <span className="w-12 shrink-0 text-xs text-neutral-500">Length</span>
            <Segments
              options={LENGTHS}
              selected={register.length}
              onSelect={(value) =>
                change({ length: value === register.length ? undefined : value })
              }
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="w-12 shrink-0 text-xs text-neutral-500">Effort</span>
            <Segments
              options={EFFORTS}
              selected={effort}
              onSelect={(value) => onEffortChange?.(value)}
            />
          </div>
        </div>
      ) : null}

      {result ? (
        <p className="max-h-52 overflow-auto px-3 py-2.5 leading-relaxed whitespace-pre-wrap">
          {result}
        </p>
      ) : null}

      {errorMessage ? <p className="px-3 py-2.5 text-red-700">{errorMessage}</p> : null}

      <p className="rounded-b-xl border-t border-neutral-100 bg-neutral-50 px-3 py-1.5 text-[11px] text-neutral-500">
        {inferredLine}
      </p>
    </div>
  );
}

function Segments<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: readonly T[];
  selected?: T;
  onSelect: (value: T) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {options.map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={value === selected}
          onClick={() => onSelect(value)}
          className={`rounded-md px-2 py-0.5 text-xs capitalize transition-colors ${
            value === selected
              ? 'bg-neutral-900 text-white'
              : 'text-neutral-500 hover:text-neutral-800'
          }`}
        >
          {value}
        </button>
      ))}
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
 * Text chips commit on blur or Enter rather than on every keystroke: a commit changes what the
 * next transform will ask for, and a transform per character is not a product.
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
        className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none"
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
