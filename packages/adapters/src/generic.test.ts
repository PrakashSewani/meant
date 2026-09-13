// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adapterFor } from './registry';
import { findEditable, genericAdapter } from './generic';
import { insertIntoEditable, readEditable } from './write';
import type { Editable } from './types';

function textarea(value = '', placeholder?: string): HTMLTextAreaElement {
  const element = document.createElement('textarea');
  element.value = value;
  if (placeholder) element.placeholder = placeholder;
  document.body.append(element);
  return element;
}

function editable(element: HTMLElement): Editable {
  const found = findEditable(element);
  if (!found) throw new Error('expected an editable');
  return found;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('findEditable', () => {
  it('accepts textareas, text-ish inputs, and rich editors', () => {
    expect(findEditable(textarea())?.kind).toBe('textarea');

    const input = document.createElement('input');
    input.type = 'email';
    document.body.append(input);
    expect(findEditable(input)?.kind).toBe('input');

    const rich = document.createElement('div');
    rich.setAttribute('contenteditable', 'true');
    document.body.append(rich);
    expect(findEditable(rich)?.kind).toBe('contenteditable');
  });

  it('refuses everything else', () => {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    document.body.append(checkbox);

    expect(findEditable(checkbox)).toBeNull();
    expect(findEditable(document.createElement('div'))).toBeNull();
  });
});

describe('read and write', () => {
  it('replaces only the selected range in a textarea', () => {
    const element = textarea('hello world');
    element.setSelectionRange(6, 11);

    expect(insertIntoEditable(editable(element), 'there')).toBe(true);
    expect(element.value).toBe('hello there');
  });

  it('announces the edit so the page can react', () => {
    const element = textarea('hello');
    const beforeInput = vi.fn();
    const input = vi.fn();
    element.addEventListener('beforeinput', beforeInput);
    element.addEventListener('input', input);

    insertIntoEditable(editable(element), 'hi');

    expect(beforeInput).toHaveBeenCalledOnce();
    expect(input).toHaveBeenCalledOnce();
  });

  it('stops when the page cancels beforeinput', () => {
    const element = textarea('hello');
    element.addEventListener('beforeinput', (event) => event.preventDefault());

    expect(insertIntoEditable(editable(element), 'hi')).toBe(false);
    expect(element.value).toBe('hello');
  });

  it('replaces a range inside a rich editor', () => {
    const element = document.createElement('div');
    element.setAttribute('contenteditable', 'true');
    element.textContent = 'hello world';
    document.body.append(element);

    const textNode = element.firstChild;
    if (!textNode) throw new Error('expected a text node');

    const range = document.createRange();
    range.setStart(textNode, 6);
    range.setEnd(textNode, 11);

    expect(
      genericAdapter.replaceSelection(editable(element), { text: 'world', range }, 'there'),
    ).toBe(true);
    expect(element.textContent).toBe('hello there');
  });

  it('reads the field back', () => {
    const element = textarea('draft text');
    expect(readEditable(editable(element))).toBe('draft text');
  });
});

describe('selection', () => {
  it('returns the selected text and its offsets', () => {
    const element = textarea('ugh tell sarah the deploy slipped');
    element.setSelectionRange(4, 8);

    const selection = genericAdapter.getSelection(editable(element));

    expect(selection?.text).toBe('tell');
    expect(selection?.start).toBe(4);
    expect(selection?.end).toBe(8);
  });

  it('replaces exactly the remembered offsets', () => {
    const element = textarea('ugh tell sarah the deploy slipped');
    element.setSelectionRange(4, 8);
    const selection = genericAdapter.getSelection(editable(element));
    if (!selection) throw new Error('expected a selection');

    genericAdapter.replaceSelection(editable(element), selection, 'ask');

    expect(element.value).toBe('ugh ask sarah the deploy slipped');
  });

  it('returns null for a collapsed caret', () => {
    const element = textarea('nothing selected');
    element.setSelectionRange(2, 2);

    expect(genericAdapter.getSelection(editable(element))).toBeNull();
  });
});

describe('inferContext', () => {
  it('reads the field role from the placeholder', () => {
    const hints = genericAdapter.inferContext(editable(textarea('', 'Write a comment…')));

    expect(hints.fieldRole).toBe('comment');
    expect(hints.confidence).toBeGreaterThan(0.2);
  });

  it('reads labels and aria attributes', () => {
    const element = textarea('');
    element.setAttribute('aria-label', 'Describe the bug');

    expect(genericAdapter.inferContext(editable(element)).fieldRole).toBe('issue-description');
  });
});

describe('registry', () => {
  it('falls back to the universal adapter', () => {
    expect(adapterFor(new URL('https://example.com'))).toBe(genericAdapter);
  });
});
