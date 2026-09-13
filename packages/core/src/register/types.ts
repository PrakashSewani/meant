export type Length = 'short' | 'medium' | 'long';

export type Effort = 'quick' | 'balanced' | 'deep';

export type Tier = 'fast' | 'main' | 'reasoning';

export interface Register {
  who?: string;
  tone?: string[];
  format?: string;
  length?: Length;
}

export type FieldRole =
  | 'compose-body'
  | 'reply'
  | 'comment'
  | 'issue-description'
  | 'commit-message'
  | 'message'
  | 'subject'
  | 'form-field'
  | 'unknown';

export interface RecipientHint {
  name?: string;
  kind: 'person' | 'channel' | 'group';
}

export type Formality = 'casual' | 'neutral' | 'formal';

export interface RegisterHints {
  siteId?: string;
  fieldRole?: FieldRole;
  recipient?: RecipientHint;
  placeholder?: string;
  labels?: readonly string[];
  threadVisible?: boolean;
  formalityPrior?: Formality;
  formatHint?: string;
  confidence: number;
}

export interface PageContext {
  thread?: string;
  labels?: readonly string[];
  recipient?: string;
}
