import type { FieldRole, Formality, Length, Register, RegisterHints } from './types';

const TONE_BY_FORMALITY: Record<Formality, string[]> = {
  casual: ['casual', 'direct'],
  neutral: ['clear', 'friendly'],
  formal: ['polished', 'warm'],
};

const FORMAT_BY_ROLE: Partial<Record<FieldRole, string>> = {
  reply: 'reply',
  comment: 'comment',
  'issue-description': 'issue',
  'commit-message': 'commit',
  subject: 'subject',
  message: 'message',
  'form-field': 'answer',
};

const LENGTH_BY_ROLE: Partial<Record<FieldRole, Length>> = {
  reply: 'short',
  comment: 'short',
  message: 'short',
  subject: 'short',
  'commit-message': 'short',
  'compose-body': 'medium',
  'issue-description': 'medium',
};

export function registerFromHints(hints: RegisterHints): Register {
  const register: Register = {};

  if (hints.formalityPrior) register.tone = TONE_BY_FORMALITY[hints.formalityPrior];
  const roleFormat = hints.fieldRole ? FORMAT_BY_ROLE[hints.fieldRole] : undefined;
  const format = roleFormat ?? hints.formatHint;
  if (format) register.format = format;
  if (hints.fieldRole && LENGTH_BY_ROLE[hints.fieldRole]) {
    register.length = LENGTH_BY_ROLE[hints.fieldRole];
  }
  if (hints.recipient?.name) register.who = hints.recipient.name;

  return register;
}

export interface ResolveRegisterInput {
  hints?: RegisterHints;
  defaults?: Register;
  overrides?: Partial<Register>;
}

export function resolveRegister({ hints, defaults, overrides }: ResolveRegisterInput): Register {
  const inferred = hints ? registerFromHints(hints) : {};
  const merged: Register = { ...inferred, ...definedOnly(defaults), ...definedOnly(overrides) };

  return pruneUndefined(merged);
}

function definedOnly(register?: Register | Partial<Register>): Partial<Register> {
  if (!register) return {};
  const entries = Object.entries(register).filter(([, value]) => value !== undefined);
  return Object.fromEntries(entries) as Partial<Register>;
}

function pruneUndefined(register: Register): Register {
  return definedOnly(register) as Register;
}
