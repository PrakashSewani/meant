export interface DiffPart {
  text: string;
  kind: 'same' | 'added' | 'removed';
}

/**
 * Word-level diff, for showing what a transform changed rather than making the user compare two
 * paragraphs by eye. Whitespace is kept as part of the tokens so the result reads normally.
 */
export function diffWords(before: string, after: string): DiffPart[] {
  const left = tokens(before);
  const right = tokens(after);
  const table = lcsTable(left, right);

  const parts: DiffPart[] = [];
  let i = 0;
  let j = 0;

  while (i < left.length && j < right.length) {
    const token = left[i] ?? '';
    const candidate = right[j] ?? '';

    if (token === candidate) {
      push(parts, 'same', token);
      i += 1;
      j += 1;
      continue;
    }

    if ((table[i + 1]?.[j] ?? 0) >= (table[i]?.[j + 1] ?? 0)) {
      push(parts, 'removed', token);
      i += 1;
    } else {
      push(parts, 'added', candidate);
      j += 1;
    }
  }

  for (; i < left.length; i += 1) push(parts, 'removed', left[i] ?? '');
  for (; j < right.length; j += 1) push(parts, 'added', right[j] ?? '');

  return merge(parts);
}

/** How much of the text survived, 0 to 1. A rewrite is low; a light edit is high. */
export function similarity(before: string, after: string): number {
  const parts = diffWords(before, after);
  const kept = parts
    .filter((part) => part.kind === 'same')
    .reduce((sum, part) => sum + weight(part.text), 0);
  const total = parts.reduce((sum, part) => sum + weight(part.text), 0);

  return total === 0 ? 1 : kept / total;
}

/** Above this, showing the changes is more useful than showing the result. */
export const DIFF_WORTH_SHOWING = 0.5;

function tokens(text: string): string[] {
  return text.split(/(\s+)/).filter((token) => token.length > 0);
}

function weight(text: string): number {
  return text.trim().length;
}

function push(parts: DiffPart[], kind: DiffPart['kind'], text: string): void {
  parts.push({ kind, text });
}

/** Adjacent parts of the same kind read better as one. */
function merge(parts: readonly DiffPart[]): DiffPart[] {
  const merged: DiffPart[] = [];

  for (const part of parts) {
    const last = merged.at(-1);
    if (last && last.kind === part.kind) last.text += part.text;
    else merged.push({ ...part });
  }

  return merged;
}

function lcsTable(left: readonly string[], right: readonly string[]): number[][] {
  const table: number[][] = Array.from({ length: left.length + 1 }, () =>
    Array.from({ length: right.length + 1 }, () => 0),
  );

  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      table[i]![j] =
        left[i] === right[j]
          ? (table[i + 1]![j + 1] ?? 0) + 1
          : Math.max(table[i + 1]![j] ?? 0, table[i]![j + 1] ?? 0);
    }
  }

  return table;
}
