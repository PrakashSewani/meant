import type { Editable, SelectionInfo } from './types';

/**
 * Writes mutate the selection in place and announce themselves with beforeinput/input.
 * Assigning `value` or `innerHTML` wholesale would drop the field's own undo history, which is
 * the one thing this layer must not break. Undo survival is asserted in the browser suite.
 */
export function readEditable(el: Editable): string {
  if (el.kind === 'contenteditable') return el.element.innerText;
  return (el.element as HTMLTextAreaElement | HTMLInputElement).value;
}

export function insertIntoEditable(el: Editable, text: string): boolean {
  if (el.kind === 'contenteditable') {
    const selection = globalThis.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    return replaceContentEditableRange(el.element, selection.getRangeAt(0), text);
  }

  const field = el.element as HTMLTextAreaElement | HTMLInputElement;
  const start = field.selectionStart ?? field.value.length;
  const end = field.selectionEnd ?? start;

  return applyToFormField(field, text, start, end);
}

export function replaceSelection(el: Editable, selection: SelectionInfo, text: string): boolean {
  if (el.kind === 'contenteditable') {
    return selection.range ? replaceContentEditableRange(el.element, selection.range, text) : false;
  }

  const field = el.element as HTMLTextAreaElement | HTMLInputElement;
  const start = selection.start ?? field.selectionStart ?? field.value.length;
  const end = selection.end ?? field.selectionEnd ?? start;

  return applyToFormField(field, text, start, end);
}

function applyToFormField(
  field: HTMLTextAreaElement | HTMLInputElement,
  text: string,
  start: number,
  end: number,
): boolean {
  if (!announceBeforeInput(field, text)) return false;

  field.focus();
  field.setRangeText(text, start, end, 'end');
  field.dispatchEvent(inputEvent(text));

  return true;
}

function replaceContentEditableRange(element: HTMLElement, range: Range, text: string): boolean {
  if (!announceBeforeInput(element, text)) return false;

  const node = element.ownerDocument.createTextNode(text);
  range.deleteContents();
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);

  const selection = element.ownerDocument.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);

  element.dispatchEvent(inputEvent(text));

  return true;
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
