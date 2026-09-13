import { describe, expect, it } from 'vitest';
import { getRecipe, RECIPES } from './index';
import { GUARDRAIL_LIBRARY } from '../prompt/sections';
import type { RecipeFamily } from './types';

const FAMILIES: readonly RecipeFamily[] = [
  'work-chat',
  'email',
  'engineering',
  'customer',
  'docs',
  'public',
  'universal',
];

describe('shipped recipes', () => {
  it('ships the three universal recipes of v0.1', () => {
    expect(RECIPES.map((recipe) => recipe.id)).toEqual([
      'say-it-better',
      'make-it-shorter',
      'fix-the-tone',
    ]);
  });

  it('uses kebab-case ids that are unique', () => {
    const ids = RECIPES.map((recipe) => recipe.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('declares a known family and a real effort tier', () => {
    for (const recipe of RECIPES) {
      expect(FAMILIES).toContain(recipe.family);
      expect(['quick', 'balanced', 'deep']).toContain(recipe.effort);
    }
  });

  it('only references guardrails the compiler can render', () => {
    for (const recipe of RECIPES) {
      for (const guardrail of recipe.guardrails ?? []) {
        expect(Object.keys(GUARDRAIL_LIBRARY)).toContain(guardrail);
      }
    }
  });

  it('never hardcodes an audience', () => {
    for (const recipe of RECIPES) expect(recipe.register.who).toBeUndefined();
  });

  it('finds recipes by id', () => {
    expect(getRecipe('fix-the-tone')?.label).toBe('Fix the tone');
    expect(getRecipe('nope')).toBeUndefined();
  });
});
