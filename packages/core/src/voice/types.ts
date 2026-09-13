export interface VoiceProfile {
  sentenceLength?: 'short' | 'medium' | 'long';
  formality?: 'casual' | 'neutral' | 'formal';
  hedging?: 'low' | 'medium' | 'high';
  emoji?: 'avoid' | 'sparing' | 'frequent';
  signOff?: string;
  lexicon?: readonly string[];
  bannedPhrases?: readonly string[];
}
