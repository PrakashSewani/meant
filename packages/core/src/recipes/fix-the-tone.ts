import type { Recipe } from './types';

export const fixTheTone: Recipe = {
  id: 'fix-the-tone',
  family: 'universal',
  label: 'Fix the tone',
  register: { tone: ['neutral', 'professional'] },
  effort: 'balanced',
  guardrails: ['no-invented-commitments'],
  instructions: [
    'Remove blame, defensiveness, and sarcasm.',
    'Keep the request and the facts intact; add nothing that was not there.',
  ],
};
