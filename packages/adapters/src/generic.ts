import { inferRegister } from '@meant/core';
import type { RegisterHints } from '@meant/core';
import type { Editable, EditableKind, SelectionInfo, SurfaceAdapter } from './types';
import { insertIntoEditable, readEditable, replaceSelection } from './write';

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel']);

export const genericAdapter: SurfaceAdapter = {
  id: 'generic',
  matches: () => true,
  findEditable,
  read: readEditable,
  write: insertIntoEditable,
  replaceSelection,
  getSelection: readSelection,
  inferContext,
};

export function findEditable(el: Element): Editable | null {
  const kind = kindOf(el);
  if (!kind) return null;

  return { kind, element: el as HTMLElement };
}

function kindOf(el: Element): EditableKind | null {
  const tag = el.tagName.toLowerCase();

  if (tag === 'textarea') return 'textarea';

  if (tag === 'input') {
    const type = (el.getAttribute('type') ?? 'text').toLowerCase();
    return TEXT_INPUT_TYPES.has(type) ? 'input' : null;
  }

  if (
    el instanceof HTMLElement &&
    (el.isContentEditable || el.getAttribute('contenteditable') === 'true')
  ) {
    return 'contenteditable';
  }

  return null;
}

function readSelection(el: Editable): SelectionInfo | null {
  if (el.kind === 'contenteditable') {
    const selection = el.element.ownerDocument.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

    const range = selection.getRangeAt(0);
    if (!el.element.contains(range.commonAncestorContainer)) return null;

    return { text: selection.toString(), range };
  }

  const field = el.element as HTMLTextAreaElement | HTMLInputElement;
  const start = field.selectionStart ?? 0;
  const end = field.selectionEnd ?? 0;
  if (start === end) return null;

  return { text: field.value.slice(start, end), start, end };
}

function inferContext(el: Editable): RegisterHints {
  return inferRegister({
    url: globalThis.location?.href ?? 'https://unknown.invalid/',
    placeholder: el.element.getAttribute('placeholder') ?? undefined,
    labels: labelsFor(el.element),
    value: readEditable(el).slice(0, 120),
  });
}

function labelsFor(element: HTMLElement): readonly string[] {
  const labels: string[] = [];

  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) labels.push(ariaLabel);

  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    for (const id of labelledBy.split(/\s+/)) {
      const text = element.ownerDocument.getElementById(id)?.textContent?.trim();
      if (text) labels.push(text);
    }
  }

  const wrappingLabel = element.closest('label')?.textContent?.trim();
  if (wrappingLabel) labels.push(wrappingLabel);

  const name = element.getAttribute('name');
  if (name) labels.push(name);

  return labels;
}
