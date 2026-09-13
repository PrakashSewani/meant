import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
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

const LENGTH_LABELS: Record<Length, string> = {
  short: 'Short',
  medium: 'Medium',
  long: 'Long',
};

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
  const [placement, setPlacement] = useState<{ left: number; top: number }>();
  const dialog = useRef<HTMLDivElement>(null);
  const tookFocus = useRef(false);

  const working = status === 'streaming';
  const primaryLabel =
    status === 'ready' ? 'Accept' : status === 'error' ? 'Try again' : 'Transform';

  function change(patch: Partial<Register>) {
    onRegisterChange?.({ ...register, ...patch });
  }

  // Placed under the selection, flipped above it when there is no room, clamped to the viewport.
  // It measures itself, so streaming more text keeps it in view.
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
  }, [anchor, result, errorMessage, status]);

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
      // that needs it: an open select menu, or a chip mid-edit.
      const target = event.target as HTMLElement | null;
      const typing = target?.matches('select, input, textarea') ?? false;

      if (key === 'Enter' && !typing && !working) {
        event.preventDefault();
        onPrimary?.();
      }
    }

    root.addEventListener('keydown', onKeyDown);

    return () => root.removeEventListener('keydown', onKeyDown);
  }, [working, onPrimary, onDismiss]);

  return (
    <div
      ref={dialog}
      role="dialog"
      aria-label="Meant"
      tabIndex={-1}
      style={{ left: placement?.left, top: placement?.top }}
      className="meant-bar fixed z-[2147483647] w-max min-w-[22rem] max-w-[27rem] overflow-hidden rounded-xl border border-neutral-200 bg-white font-sans text-[13px] text-neutral-900 shadow-2xl ring-1 ring-black/5 outline-none"
    >
      <div className="flex items-center gap-2 bg-neutral-50 px-3 pt-2.5 pb-2">
        <span aria-hidden className="text-neutral-300">
          ✦
        </span>
        <select
          value={recipeId}
          aria-label="Transform"
          onChange={(event) => onRecipeChange?.(event.target.value)}
          className="max-w-[12rem] cursor-pointer truncate bg-transparent font-medium text-neutral-900 focus:outline-none"
        >
          {recipes.map((recipe) => (
            <option key={recipe.id} value={recipe.id}>
              {recipe.label}
            </option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={onPrimary}
            disabled={working}
            className="flex items-center gap-1.5 rounded-md bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-70"
          >
            {working ? <Spinner /> : null}
            {working ? 'Working' : primaryLabel}
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

      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2.5">
        <Chip label="Who" value={register.who} fallback="nobody">
          <TextEditor
            value={register.who ?? ''}
            placeholder="who is reading this"
            onCommit={(value) => change({ who: parseWho(value) })}
          />
        </Chip>

        <Chip label="Tone" value={formatTones(register.tone)} fallback="unspecified">
          <TextEditor
            value={formatTones(register.tone)}
            placeholder="direct, warm"
            list={TONE_SUGGESTIONS}
            onCommit={(value) => change({ tone: parseTones(value) })}
          />
        </Chip>

        <Chip label="As" value={register.format} fallback="text">
          <TextEditor
            value={register.format ?? ''}
            placeholder="a reply, a post, a ticket"
            list={FORMAT_SUGGESTIONS}
            onCommit={(value) => change({ format: parseWho(value) })}
          />
        </Chip>

        <Chip
          label="Length"
          value={register.length && LENGTH_LABELS[register.length]}
          fallback="any"
        >
          <Segments
            options={LENGTHS}
            labels={LENGTH_LABELS}
            selected={register.length}
            onSelect={(value) => change({ length: value === register.length ? undefined : value })}
          />
        </Chip>

        <Chip label="Effort" value={effort} fallback="quick">
          <Segments
            options={EFFORTS}
            selected={effort}
            onSelect={(value) => onEffortChange?.(value)}
          />
        </Chip>
      </div>

      {working && !result ? (
        <div className="space-y-1.5 border-t border-neutral-100 px-3 py-2.5">
          <SkeletonLine width="88%" />
          <SkeletonLine width="72%" />
          <SkeletonLine width="54%" />
        </div>
      ) : null}

      {result ? (
        <p className="max-h-52 overflow-auto border-t border-neutral-100 px-3 py-2.5 leading-relaxed whitespace-pre-wrap">
          {result}
          {working ? (
            <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse rounded-sm bg-neutral-400" />
          ) : null}
        </p>
      ) : null}

      {errorMessage ? (
        <p className="border-t border-neutral-100 px-3 py-2.5 text-red-700">{errorMessage}</p>
      ) : null}

      <p className="border-t border-neutral-100 bg-neutral-50 px-3 py-1.5 text-[11px] text-neutral-500">
        {inferredLine}
      </p>
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-white/30 border-t-white"
    />
  );
}

function SkeletonLine({ width }: { width: string }) {
  return <div className="h-2.5 animate-pulse rounded bg-neutral-100" style={{ width }} />;
}

/**
 * A chip shows its value and nothing else until it is needed. Clicking it swaps the pill for an
 * editor in place, so the options are always visible without being a form.
 */
function Chip({
  label,
  value,
  fallback,
  children,
}: {
  label: string;
  value?: string;
  fallback: string;
  children: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const wrapper = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!editing) return;

    function onPointerDown(event: MouseEvent) {
      if (!wrapper.current?.contains(event.target as Node)) setEditing(false);
    }

    document.addEventListener('mousedown', onPointerDown);

    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [editing]);

  if (editing) {
    return (
      <span ref={wrapper} className="inline-flex">
        {children}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`inline-flex items-baseline gap-1 rounded-full border px-2 py-0.5 transition-colors ${
        value
          ? 'border-transparent bg-neutral-100 text-neutral-900 hover:bg-neutral-200'
          : 'border-dashed border-neutral-300 bg-white text-neutral-400 hover:border-neutral-500'
      }`}
    >
      <span className="text-[11px] text-neutral-400">{label}</span>
      <span className="max-w-[11rem] truncate">{value ?? fallback}</span>
    </button>
  );
}

function TextEditor({
  value,
  placeholder,
  list,
  onCommit,
}: {
  value: string;
  placeholder: string;
  list?: readonly string[];
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const listId = list ? `meant-${placeholder.slice(0, 6).replace(/\W/g, '')}-options` : undefined;

  return (
    <>
      <input
        autoFocus
        value={draft}
        list={listId}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => onCommit(draft)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          }
          if (event.key === 'Escape') setDraft(value);
        }}
        className="w-44 rounded-full border border-neutral-400 bg-white px-2 py-0.5 text-xs placeholder:text-neutral-400 focus:outline-none"
      />
      {listId ? (
        <datalist id={listId}>
          {list?.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      ) : null}
    </>
  );
}

function Segments<T extends string>({
  options,
  labels,
  selected,
  onSelect,
}: {
  options: readonly T[];
  labels?: Record<T, string>;
  selected?: T;
  onSelect: (value: T) => void;
}) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full border border-neutral-400 bg-white p-0.5">
      {options.map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={value === selected}
          onClick={() => onSelect(value)}
          className={`rounded-full px-2 py-0.5 text-xs capitalize transition-colors ${
            value === selected
              ? 'bg-neutral-900 text-white'
              : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          {labels?.[value] ?? value}
        </button>
      ))}
    </span>
  );
}
