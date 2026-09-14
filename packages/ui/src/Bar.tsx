import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  DIFF_WORTH_SHOWING,
  REFINEMENTS,
  diffWords,
  similarity,
  type Effort,
  type Length,
  type Register,
} from '@meant/core';
import {
  FORMAT_SUGGESTIONS,
  TONE_SUGGESTIONS,
  formatTones,
  parseTones,
  parseWho,
} from './register-input';
import { GHOST, PRIMARY, RING } from './styles';

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
  /** Compose mode opens an intent box instead of transforming a selection. */
  mode?: 'polish' | 'compose';
  intent?: string;
  onIntentChange?: (text: string) => void;
  result?: string;
  /** What went in, so the result can be shown as the change it is. */
  original?: string;
  refinements?: readonly string[];
  /** Chips whose value came from what the user keeps correcting here. */
  learned?: readonly string[];
  onRefine?: (id: string) => void;
  onRetry?: () => void;
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
  mode = 'polish',
  intent,
  onIntentChange,
  result,
  original,
  refinements,
  learned,
  onRefine,
  onRetry,
  errorMessage,
  onRegisterChange,
  onEffortChange,
  onRecipeChange,
  onPrimary,
  onDismiss,
}: BarProps) {
  const [placement, setPlacement] = useState<{ left: number; top: number }>();
  const [plainResult, setPlainResult] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const tookFocus = useRef(false);

  const working = status === 'streaming';
  const primaryLabel =
    status === 'ready' ? 'Accept' : status === 'error' ? 'Try again' : 'Transform';
  const nothingToTransform = mode === 'compose' && (intent ?? '').trim().length === 0;
  // A light edit is easier to judge as a diff; a full rewrite is easier to read as text.
  const changesAreWorthShowing =
    Boolean(result && original) && similarity(original ?? '', result ?? '') >= DIFF_WORTH_SHOWING;
  const showingChanges = Boolean(result) && changesAreWorthShowing && !plainResult;

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
    // while the element is definitely on screen and focusable. Unless something inside already has
    // it — the compose box autofocuses, and taking focus back would swallow what the user types.
    if (!tookFocus.current) {
      tookFocus.current = true;

      const root = element.getRootNode();
      const alreadyFocused = root instanceof ShadowRoot && root.activeElement !== null;
      if (!alreadyFocused) element.focus();
    }

    return () => window.removeEventListener('resize', measure);
  }, [anchor, result, errorMessage, status]);

  useEffect(() => {
    // Working disables the primary button, and a disabled button cannot hold focus, so the page
    // takes it back. Without this, the ⏎ that transformed would go nowhere once the result lands.
    if (working) return;

    const root = dialog.current?.getRootNode();
    if (!(root instanceof ShadowRoot) || root.activeElement !== null) return;

    // Only when focus is nowhere in particular — never when the user has gone back to the page.
    if (document.activeElement !== null && document.activeElement !== document.body) return;

    dialog.current?.focus();
  }, [working]);

  useEffect(() => {
    // Listening on the shadow root rather than the document is what keeps the page's own keys out:
    // nothing below it is the page's, and nothing above it is ours.
    const root = dialog.current?.getRootNode();
    if (!(root instanceof ShadowRoot)) return;

    function onKeyDown(event: Event) {
      const { key, shiftKey, metaKey, ctrlKey } = event as KeyboardEvent;
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

      if (key === 'Enter' && (metaKey || ctrlKey) && !working) {
        event.preventDefault();
        onPrimary?.();
        return;
      }

      // ⏎ is the primary action — transform, then accept — but only when nothing else wants it.
      // On a control it belongs to that control: a pill opens its editor, a select its menu.
      const target = event.target as HTMLElement | null;
      const onControl = target?.matches('button, select, input, textarea') ?? false;

      if (key === 'Enter' && !onControl && !working) {
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
        {/* A dropdown has to look like one: the native arrow is transparent in too many themes. */}
        <span className="relative inline-flex items-center">
          <select
            value={recipeId}
            aria-label="Transform"
            onChange={(event) => onRecipeChange?.(event.target.value)}
            className={`max-w-[12rem] cursor-pointer appearance-none truncate rounded-md border border-neutral-200 bg-white py-1 pl-2 pr-6 font-medium text-neutral-900 transition-colors hover:border-neutral-300 ${RING}`}
          >
            {recipes.map((recipe) => (
              <option key={recipe.id} value={recipe.id}>
                {recipe.label}
              </option>
            ))}
          </select>
          <span
            aria-hidden
            className="pointer-events-none absolute right-2 text-[9px] text-neutral-500"
          >
            ▾
          </span>
        </span>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={onPrimary}
            disabled={working || nothingToTransform}
            className={PRIMARY}
          >
            {working ? <Spinner /> : null}
            {working ? 'Working' : primaryLabel}
          </button>
          <button
            type="button"
            aria-label="Dismiss"
            title="Dismiss"
            onClick={onDismiss}
            className={`rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-neutral-500 transition-colors hover:border-neutral-300 hover:text-neutral-900 ${RING}`}
          >
            ✕
          </button>
        </div>
      </div>

      {mode === 'compose' ? (
        <div className="px-3 pt-2.5">
          <textarea
            autoFocus
            rows={3}
            value={intent ?? ''}
            placeholder="Write it messy — what do you want to say?"
            onChange={(event) => onIntentChange?.(event.target.value)}
            className={`resize-none rounded-md border border-neutral-300 bg-white px-2.5 py-2 text-[13px] leading-relaxed placeholder:text-neutral-400 ${RING}`}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2.5">
        <Chip label="Who" value={register.who} fallback="nobody" learned={learned?.includes('who')}>
          <TextEditor
            value={register.who ?? ''}
            placeholder="who is reading this"
            onCommit={(value) => change({ who: parseWho(value) })}
          />
        </Chip>

        <Chip
          label="Tone"
          value={formatTones(register.tone)}
          fallback="unspecified"
          learned={learned?.includes('tone')}
        >
          <TextEditor
            value={formatTones(register.tone)}
            placeholder="direct, warm"
            list={TONE_SUGGESTIONS}
            onCommit={(value) => change({ tone: parseTones(value) })}
          />
        </Chip>

        <Chip
          label="As"
          value={register.format}
          fallback="text"
          learned={learned?.includes('format')}
        >
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
        <div className="px-3 pt-2.5">
          <div className="space-y-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-2">
            <SkeletonLine width="88%" />
            <SkeletonLine width="72%" />
            <SkeletonLine width="54%" />
          </div>
        </div>
      ) : null}

      {result ? (
        <div className="px-3 pt-2.5">
          <div className="max-h-52 overflow-auto rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-2 leading-relaxed">
            {showingChanges ? (
              <p className="whitespace-pre-wrap">
                {diffWords(original ?? '', result).map((part, index) => (
                  <span
                    key={index}
                    className={
                      part.kind === 'removed'
                        ? 'text-neutral-400 line-through'
                        : part.kind === 'added'
                          ? 'underline decoration-neutral-400 decoration-1 underline-offset-2'
                          : undefined
                    }
                  >
                    {part.text}
                  </span>
                ))}
                {working ? <Caret /> : null}
              </p>
            ) : (
              <p className="whitespace-pre-wrap">
                {result}
                {working ? <Caret /> : null}
              </p>
            )}
          </div>
        </div>
      ) : null}

      {result && original ? (
        <div className="px-3 pt-1.5">
          <button
            type="button"
            aria-pressed={showingChanges}
            onClick={() => setPlainResult(showingChanges)}
            className={`${GHOST} ${RING}`}
          >
            {showingChanges ? 'Show result' : 'Show changes'}
          </button>
        </div>
      ) : null}

      {status === 'ready' || status === 'error' ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-1 border-t border-neutral-100 bg-neutral-50 px-3 py-1.5">
          {/* Refinements act on a result. After a failure there is nothing to refine, only to retry. */}
          {result
            ? REFINEMENTS.map((refinement) => (
                <button
                  key={refinement.id}
                  type="button"
                  aria-pressed={refinements?.includes(refinement.id) ?? false}
                  onClick={() => onRefine?.(refinement.id)}
                  className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${RING} ${
                    refinements?.includes(refinement.id)
                      ? 'border-neutral-900 bg-neutral-900 text-white'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-neutral-900'
                  }`}
                >
                  {refinement.label}
                </button>
              ))
            : null}
          <button
            type="button"
            aria-label="Try again"
            title="Try again"
            onClick={onRetry}
            className={`ml-auto rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-[11px] text-neutral-500 transition-colors hover:border-neutral-300 hover:text-neutral-900 ${RING}`}
          >
            ↻
          </button>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="px-3 pt-2.5">
          <p className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-red-800">
            {errorMessage}
          </p>
        </div>
      ) : null}

      <p className="border-t border-neutral-100 bg-neutral-50 px-3 py-1.5 text-[11px] text-neutral-500">
        {inferredLine}
      </p>
    </div>
  );
}

function Caret() {
  return (
    <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 rounded-sm bg-neutral-400 motion-safe:animate-pulse" />
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="h-3 w-3 rounded-full border-[1.5px] border-white/30 border-t-white motion-safe:animate-spin"
    />
  );
}

function SkeletonLine({ width }: { width: string }) {
  return (
    <div className="h-2.5 rounded bg-neutral-100 motion-safe:animate-pulse" style={{ width }} />
  );
}

/**
 * A chip shows its value and nothing else until it is needed. Clicking it swaps the pill for an
 * editor in place, so the options are always visible without being a form.
 */
function Chip({
  label,
  value,
  fallback,
  learned,
  children,
}: {
  label: string;
  value?: string;
  fallback: string;
  learned?: boolean;
  children: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const wrapper = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!editing) return;

    // On the shadow root, not the document: from outside a closed root every target is retargeted
    // to the host, so a document listener sees a click *inside* the editor as a click outside it.
    const root = wrapper.current?.getRootNode();
    if (!root) return;

    function onPointerDown(event: Event) {
      const path = event.composedPath();
      if (!wrapper.current || !path.includes(wrapper.current)) setEditing(false);
    }

    root.addEventListener('mousedown', onPointerDown);

    return () => root.removeEventListener('mousedown', onPointerDown);
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
      aria-label={`${label}: ${value ?? fallback}. Change it`}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 transition-colors ${RING} ${
        value
          ? 'border-neutral-300 bg-white text-neutral-900 hover:border-neutral-500 hover:bg-neutral-50'
          : 'border-dashed border-neutral-300 bg-white text-neutral-500 hover:border-neutral-500 hover:text-neutral-900'
      }`}
    >
      <span className="text-[11px] text-neutral-400">{label}</span>
      {learned ? (
        <span
          aria-label="learned here"
          title="Learned from corrections you keep making here"
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-500"
        />
      ) : null}
      <span className="max-w-[11rem] truncate">{value ?? fallback}</span>
      <span aria-hidden className="text-[9px] text-neutral-400">
        ▾
      </span>
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
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => onCommit(draft)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          }
          if (event.key === 'Escape') setDraft(value);
        }}
        className={`w-44 rounded-full border border-neutral-400 bg-white px-2 py-0.5 text-xs placeholder:text-neutral-400 ${RING}`}
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
    <span className="inline-flex items-center gap-0.5 rounded-full border border-neutral-300 bg-white p-0.5">
      {options.map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={value === selected}
          onClick={() => onSelect(value)}
          className={`rounded-full px-2 py-0.5 text-xs capitalize transition-colors ${RING} ${
            value === selected
              ? 'bg-neutral-900 text-white'
              : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
          }`}
        >
          {labels?.[value] ?? value}
        </button>
      ))}
    </span>
  );
}
