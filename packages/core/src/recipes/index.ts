import type { Recipe } from './types';
import { sayItBetter } from './say-it-better';
import { makeItShorter } from './make-it-shorter';
import { fixTheTone } from './fix-the-tone';

export { sayItBetter } from './say-it-better';
export { makeItShorter } from './make-it-shorter';
export { fixTheTone } from './fix-the-tone';
export type { Recipe, RecipeFamily } from './types';

export const RECIPES: readonly Recipe[] = [sayItBetter, makeItShorter, fixTheTone];

export function getRecipe(id: string): Recipe | undefined {
  return RECIPES.find((recipe) => recipe.id === id);
}
