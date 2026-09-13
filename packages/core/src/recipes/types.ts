import type { Effort, Register } from '../register/types';

export type RecipeFamily =
  'work-chat' | 'email' | 'engineering' | 'customer' | 'docs' | 'public' | 'universal';

export interface Recipe {
  id: string;
  family: RecipeFamily;
  label: string;
  register: Register;
  effort: Effort;
  guardrails?: readonly string[];
  instructions?: readonly string[];
}
