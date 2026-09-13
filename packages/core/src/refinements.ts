export interface Refinement {
  id: string;
  label: string;
  instruction: string;
}

/**
 * The refinement chips are the "conversation" — each one is a one-shot edit on the current result,
 * not a message in a thread. They are instructions to the compiler, never shown to the user as
 * prompts.
 */
export const REFINEMENTS: readonly Refinement[] = [
  {
    id: 'shorter',
    label: 'Shorter',
    instruction: 'Make it shorter: the same meaning in fewer words, without losing a fact.',
  },
  {
    id: 'softer',
    label: 'Softer',
    instruction: 'Soften it: keep the substance and lose any edge or impatience.',
  },
  {
    id: 'plainer',
    label: 'Plainer',
    instruction: 'Say it in plainer words: shorter sentences, no jargon, nothing dressed up.',
  },
  {
    id: 'more-formal',
    label: 'More formal',
    instruction: 'Raise the formality a notch, without becoming stiff or ceremonious.',
  },
  {
    id: 'next-step',
    label: 'Add a next step',
    instruction:
      'End with one concrete next step, and only one the text already implies — invent no commitment.',
  },
];

export function refinementById(id: string): Refinement | undefined {
  return REFINEMENTS.find((refinement) => refinement.id === id);
}

export function refinementsByIds(ids: readonly string[]): Refinement[] {
  return ids
    .map(refinementById)
    .filter((refinement): refinement is Refinement => Boolean(refinement));
}
