/**
 * The border, radius, focus, and surface language, in one place. The bar and the settings pages are
 * the same product on different surfaces, and a control that looks editable in one must look
 * editable in the other. Plain strings rather than a helper: there is nothing to compose yet.
 *
 * Light values come first and stay untouched — `dark:` only ever adds to them — so the light theme
 * cannot drift while the dark one is being built.
 */

/** A bordered card. Every block that holds content is one of these. */
export const CARD =
  'rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900';

/** A text input. Bordered, so it does not read as a label, with the focus ring below. */
export const FIELD =
  'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 placeholder:text-neutral-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500';

/** Keyboard focus, visible. Controls that remove the browser default must use this instead. */
export const RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1 dark:focus-visible:ring-neutral-100 dark:focus-visible:ring-offset-neutral-900';

/** A secondary control: bordered and backgrounded, so it is not mistaken for decoration. */
export const GHOST =
  'inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] text-neutral-600 transition-colors hover:border-neutral-300 hover:text-neutral-900 disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:text-neutral-100';

/** The primary action. One per surface. */
export const PRIMARY =
  'inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300';

/** A quiet heading for a settings section. */
export const HEADING =
  'text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400';

/** Body text that is not the point of the screen. */
export const MUTED = 'text-neutral-500 dark:text-neutral-400';

/** The page behind the cards. */
export const PAGE =
  'min-h-screen bg-neutral-100 text-neutral-800 dark:bg-neutral-950 dark:text-neutral-100';
