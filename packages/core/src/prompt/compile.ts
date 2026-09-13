import type { PageContext, Register } from '../register/types';
import type { Recipe } from '../recipes/types';
import type { VoiceProfile } from '../voice/types';
import {
  AI_TELL_BAN_LIST,
  GUARDRAILS,
  GUARDRAIL_LIBRARY,
  OUTPUT_CONTRACT,
  UNTRUSTED_DATA_RULES,
} from './sections';

export interface CompileInput {
  intent: string;
  register: Register;
  recipe?: Recipe;
  voice?: VoiceProfile;
  context?: PageContext;
}

export interface CompiledPrompt {
  system: string;
  user: string;
}

export function compilePrompt({
  intent,
  register,
  recipe,
  voice,
  context,
}: CompileInput): CompiledPrompt {
  const system = [
    'You rewrite text so it fits the situation it is being sent into.',
    'You are not a chat assistant and you do not converse.',
    '',
    '## Register',
    ...renderRegister(register).map((line) => `- ${line}`),
    ...renderRecipe(recipe),
    ...renderVoice(voice),
    '',
    '## Rules',
    ...GUARDRAILS.map((rule) => `- ${rule}`),
    ...renderGuardrails(recipe),
    '',
    '## Page content',
    ...UNTRUSTED_DATA_RULES.map((rule) => `- ${rule}`),
    '',
    '## Output',
    ...OUTPUT_CONTRACT.map((rule) => `- ${rule}`),
  ].join('\n');

  return { system, user: renderUserMessage(intent, context) };
}

function renderRegister(register: Register): string[] {
  return [
    renderAudience(register.who),
    `Tone: ${register.tone?.length ? register.tone.join(', ') : 'clear and natural'}`,
    `Format: ${
      register.format ??
      'whatever fits the situation — and add no structure the original did not have'
    }`,
    `Length: ${
      register.length ?? 'about the length of the original: shorter is fine, padded is not'
    }`,
  ];
}

/**
 * A named audience is an instruction to write *to* that person, not a label. Without this the
 * model reads the name as context and produces text addressed to nobody in particular.
 */
function renderAudience(who?: string): string {
  if (!who) {
    return 'Audience: whoever the original text was written for — write to them, not to a general reader';
  }

  return [
    `Audience: ${who}`,
    `  Address them by name where this format would — a greeting in an email, a direct address in`,
    `  a message — and use the name exactly as given. Never invent a surname, title, or other name.`,
  ].join('\n');
}

function renderRecipe(recipe?: Recipe): string[] {
  if (!recipe) return [];
  const lines = ['', '## Recipe', `- ${recipe.label}`];
  for (const instruction of recipe.instructions ?? []) lines.push(`- ${instruction}`);
  return lines;
}

function renderVoice(voice?: VoiceProfile): string[] {
  const lines = ['', '## Voice'];
  const descriptor = describeVoice(voice);

  if (descriptor.length === 0) {
    lines.push('- No voice profile yet — keep the user’s own wording wherever it works.');
  } else {
    for (const line of descriptor) lines.push(`- ${line}`);
  }

  const banned = [...new Set([...(voice?.bannedPhrases ?? []), ...AI_TELL_BAN_LIST])];
  lines.push('', 'Never use these phrases:');
  for (const phrase of banned) lines.push(`- ${phrase}`);

  return lines;
}

function describeVoice(voice?: VoiceProfile): string[] {
  if (!voice) return [];
  const lines: string[] = [];

  if (voice.sentenceLength) lines.push(`Sentence length: ${voice.sentenceLength}`);
  if (voice.formality) lines.push(`Formality: ${voice.formality}`);
  if (voice.hedging) lines.push(`Hedging: ${voice.hedging}`);
  if (voice.emoji) lines.push(`Emoji: ${voice.emoji}`);
  if (voice.signOff) lines.push(`Sign-off: ${voice.signOff}`);
  if (voice.lexicon?.length)
    lines.push(`Words the user actually uses: ${voice.lexicon.join(', ')}`);

  return lines;
}

function renderGuardrails(recipe?: Recipe): string[] {
  return (recipe?.guardrails ?? [])
    .map((id) => GUARDRAIL_LIBRARY[id])
    .filter((text): text is string => Boolean(text))
    .map((text) => `- ${text}`);
}

function renderUserMessage(intent: string, context?: PageContext): string {
  const blocks: string[] = [];

  if (context?.thread) {
    blocks.push(`<page_context>\n${context.thread}\n</page_context>`);
  }
  blocks.push(`<intent>\n${intent}\n</intent>`);

  return blocks.join('\n\n');
}
