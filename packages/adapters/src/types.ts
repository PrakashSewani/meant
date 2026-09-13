import type { RegisterHints } from '@sayable/core';

export type EditableKind = 'textarea' | 'input' | 'contenteditable';

export interface Editable {
  kind: EditableKind;
  element: HTMLElement;
}

/**
 * Form fields have no DOM text node to anchor a Range to, so they carry offsets; rich
 * editors carry the live DOM range. Exactly one of the two shapes is present.
 */
export interface SelectionInfo {
  text: string;
  start?: number;
  end?: number;
  range?: Range;
}

export interface SurfaceAdapter {
  id: string;
  matches(url: URL): boolean;
  findEditable(el: Element): Editable | null;
  read(el: Editable): string;
  write(el: Editable, text: string): boolean;
  replaceSelection(el: Editable, selection: SelectionInfo, text: string): boolean;
  getSelection(el: Editable): SelectionInfo | null;
  inferContext(el: Editable): RegisterHints;
}
