import { useState } from 'react';
import type { Effort, Register } from '@sayable/core';

const EFFORTS: readonly Effort[] = ['quick', 'balanced', 'deep'];

export interface BarProps {
  inferredLine: string;
  register: Register;
  effort: Effort;
  result?: string;
  errorMessage?: string;
  onEffortChange?: (effort: Effort) => void;
  onAccept?: () => void;
  onDismiss?: () => void;
}

export function Bar({
  inferredLine,
  register,
  effort,
  result,
  errorMessage,
  onEffortChange,
  onAccept,
  onDismiss,
}: BarProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      role="dialog"
      aria-label="Sayable"
      className="sayable-bar pointer-events-auto fixed right-6 bottom-6 z-[2147483647] w-[26rem] rounded-xl border border-neutral-200 bg-white font-sans text-sm text-neutral-900 shadow-xl"
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <span aria-hidden className="text-neutral-400">
          ✦
        </span>
        <span className="font-medium">Say it better</span>
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
          Keep
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md px-2 py-1 text-xs text-neutral-500"
        >
          Undo
        </button>
      </div>

      {expanded ? (
        <div className="flex flex-wrap gap-2 border-t border-neutral-100 px-3 py-2">
          <Chip label="Who" value={register.who} />
          <Chip label="Tone" value={register.tone?.join(', ')} />
          <Chip label="As" value={register.format} />
          <Chip label="Length" value={register.length} />
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

function Chip({ label, value }: { label: string; value?: string }) {
  return (
    <span className="rounded-md border border-neutral-200 px-2 py-1 text-xs">
      <span className="text-neutral-500">{label}</span> <span>{value ?? 'guessing'}</span>
    </span>
  );
}
