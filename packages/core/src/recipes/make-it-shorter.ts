import type { Recipe } from './types';

export const makeItShorter: Recipe = {
  id: 'make-it-shorter',
  family: 'universal',
  label: 'Make it shorter',
  register: { tone: ['clear', 'direct'], length: 'short' },
  effort: 'quick',
  instructions: [
    'Cut filler, hedges, and repetition.',
    'Keep every fact, request, and commitment that was present.',
  ],
};
