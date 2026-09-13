import type { Recipe } from './types';

export const sayItBetter: Recipe = {
  id: 'say-it-better',
  family: 'universal',
  label: 'Say it better',
  register: { tone: ['clear', 'natural'] },
  effort: 'quick',
  instructions: [
    'Keep the original length and every concrete fact.',
    'Fix register only: phrasing, structure, and word choice.',
  ],
};
