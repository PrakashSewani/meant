/**
 * The border, radius, and focus language, in one place. The bar and the settings page are the same
 * product on different surfaces, and a control that looks editable in one must look editable in the
 * other. Plain strings rather than a helper: there is nothing to compose yet.
 */

/** A bordered card. Every block that holds content is one of these. */
export const CARD = 'rounded-lg border border-neutral-200 bg-white';

/** A text input. Bordered, so it does not read as a label, with the focus ring below. */
export const FIELD =
  'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs placeholder:text-neutral-400';

/** Keyboard focus, visible. Controls that remove the browser default must use this instead. */
export const RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1';

/** A secondary control: bordered and backgrounded, so it is not mistaken for decoration. */
export const GHOST =
  'inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] text-neutral-600 transition-colors hover:border-neutral-300 hover:text-neutral-900';

/** The primary action. One per surface. */
export const PRIMARY =
  'inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-40';
