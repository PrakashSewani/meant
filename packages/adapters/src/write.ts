import type { Editable, SelectionInfo } from './types';

export function readEditable(el: Editable): string {
  if (el.kind === 'contenteditable') return el.element.innerText;
  return (el.element as HTMLTextAreaElement | HTMLInputElement).value;
}

export function insertIntoEditable(el: Editable, text: string): boolean {
  if (el.kind === 'contenteditable') {
    const selection = globalThis.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    return writeThroughRange(el.element, selection.getRangeAt(0), text);
  }

  const field = el.element as HTMLTextAreaElement | HTMLInputElement;
  const start = field.selectionStart ?? field.value.length;
  const end = field.selectionEnd ?? start;

  return writeToFormField(field, text, start, end);
}

export function replaceSelection(el: Editable, selection: SelectionInfo, text: string): boolean {
  if (el.kind === 'contenteditable') {
    return selection.range ? writeThroughRange(el.element, selection.range, text) : false;
  }

  const field = el.element as HTMLTextAreaElement | HTMLInputElement;
  const start = selection.start ?? field.selectionStart ?? field.value.length;
  const end = selection.end ?? field.selectionEnd ?? start;

  return writeToFormField(field, text, start, end);
}

/**
 * Chromium keeps exactly one programmatic edit in a field's undo stack: `insertText` against a
 * live selection. Assigning `value`, calling `setRangeText`, or mutating the DOM all drop the
 * user's history, so those are fallbacks for engines where the command is missing or refuses
 * (test runs included) — never the primary path.
 */
function writeToFormField(
  field: HTMLTextAreaElement | HTMLInputElement,
  text: string,
  start: number,
  end: number,
): boolean {
  field.focus();
  field.setSelectionRange(start, end);

  const expected = `${field.value.slice(0, start)}${text}${field.value.slice(end)}`;
  if (execInsertText(field.ownerDocument, text) && field.value === expected) return true;

  field.setSelectionRange(start, end);
  if (!announceBeforeInput(field, text)) return false;

  field.setRangeText(text, start, end, 'end');
  field.dispatchEvent(inputEvent(text));

  return true;
}

function writeThroughRange(element: HTMLElement, range: Range, text: string): boolean {
  const selection = element.ownerDocument.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);

  if (execInsertText(element.ownerDocument, text)) return true;
  if (!announceBeforeInput(element, text)) return false;

  const node = element.ownerDocument.createTextNode(text);
  range.deleteContents();
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);

  selection?.removeAllRanges();
  selection?.addRange(range);

  element.dispatchEvent(inputEvent(text));

  return true;
}

function execInsertText(doc: Document, text: string): boolean {
  if (typeof doc.execCommand !== 'function') return false;

  try {
    return doc.execCommand('insertText', false, text);
  } catch {
    return false;
  }
}

function announceBeforeInput(target: HTMLElement, text: string): boolean {
  return target.dispatchEvent(beforeInputEvent(text));
}

function beforeInputEvent(text: string): Event {
  return new InputEvent('beforeinput', {
    bubbles: true,
    cancelable: true,
    composed: true,
    inputType: 'insertText',
    data: text,
  });
}

function inputEvent(text: string): Event {
  return new InputEvent('input', {
    bubbles: true,
    composed: true,
    inputType: 'insertText',
    data: text,
  });
}
