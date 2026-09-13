import type { Recipe } from './types';

export const sayItBetter: Recipe = {
  id: 'say-it-better',
  family: 'universal',
  label: 'Say it better',
  register: { tone: ['clear', 'natural'] },
  effort: 'quick',
  instructions: [
    'Rewrite it as if the author had written it well the first time. Keep every fact and the intent; let the phrasing change as much as it needs to.',
    'Rewrite whole sentences rather than swapping words into the original word order — a half-rewrite reads worse than the draft did.',
  ],
};
