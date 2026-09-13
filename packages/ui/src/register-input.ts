export const TONE_SUGGESTIONS = [
  'direct',
  'warm',
  'clear',
  'casual',
  'formal',
  'concise',
  'friendly',
  'firm',
  'apologetic',
  'enthusiastic',
] as const;

export const FORMAT_SUGGESTIONS = [
  'reply',
  'message',
  'comment',
  'email',
  'issue',
  'commit',
  'subject',
  'answer',
  'public post',
] as const;

/** The chips take a comma-separated list, because a tone is a few words, not a taxonomy. */
export function parseTones(input: string): string[] | undefined {
  const tones = input
    .split(',')
    .map((tone) => tone.trim().toLowerCase())
    .filter((tone) => tone.length > 0);

  return tones.length > 0 ? [...new Set(tones)] : undefined;
}

export function formatTones(tone: readonly string[] | undefined): string {
  return tone?.join(', ') ?? '';
}

export function parseWho(input: string): string | undefined {
  const who = input.trim();
  return who.length > 0 ? who : undefined;
}
