import type { FieldRole, Formality, RegisterHints } from '../register/types';

export interface SurfaceSignals {
  url: string;
  fieldRole?: FieldRole;
  placeholder?: string;
  labels?: readonly string[];
  value?: string;
}

interface SiteRule {
  id: string;
  matches: (url: URL) => boolean;
  format: string;
  formality: Formality;
}

const SITE_RULES: readonly SiteRule[] = [
  {
    id: 'gmail',
    matches: (url) => url.hostname === 'mail.google.com',
    format: 'email',
    formality: 'neutral',
  },
  {
    id: 'slack',
    matches: (url) => url.hostname === 'app.slack.com' || url.hostname.endsWith('.slack.com'),
    format: 'chat message',
    formality: 'casual',
  },
  {
    id: 'linkedin',
    matches: (url) => url.hostname.endsWith('linkedin.com'),
    format: 'public post',
    formality: 'neutral',
  },
  {
    id: 'jira',
    matches: (url) => url.hostname.endsWith('.atlassian.net'),
    format: 'jira issue',
    formality: 'neutral',
  },
  {
    id: 'github',
    matches: (url) => url.hostname === 'github.com',
    format: 'markdown',
    formality: 'neutral',
  },
];

const ROLE_RULES: readonly { pattern: RegExp; role: FieldRole }[] = [
  { pattern: /write a comment|add a comment|leave a comment|add a note/i, role: 'comment' },
  { pattern: /describe (the )?(bug|issue|problem)/i, role: 'issue-description' },
  { pattern: /add a description|what needs to be done/i, role: 'issue-description' },
  { pattern: /commit message/i, role: 'commit-message' },
  { pattern: /describe your change/i, role: 'compose-body' },
  { pattern: /^subject\b/i, role: 'subject' },
  { pattern: /what'?s on your mind|start a post|share your thoughts/i, role: 'compose-body' },
  { pattern: /\breply\b/i, role: 'reply' },
  { pattern: /\bmessage\b|\bwrite to\b/i, role: 'message' },
];

const CASUAL_VALUE = /\b(hey|hi|yo|thanks!|cheers)\b|:\)|:D/i;
const FORMAL_VALUE = /\b(dear|sincerely|kind regards|regards)\b/i;

export function inferRegister(signals: SurfaceSignals): RegisterHints {
  let url: URL;
  try {
    url = new URL(signals.url);
  } catch {
    return { confidence: 0 };
  }

  const site = SITE_RULES.find((rule) => rule.matches(url));
  const text = [signals.placeholder, ...(signals.labels ?? [])].filter(Boolean).join(' ');
  const role = signals.fieldRole ?? inferRole(text);
  const valueFormality = inferFormality(signals.value);
  const formality = valueFormality ?? site?.formality ?? 'neutral';

  let confidence = 0.2;
  if (site) confidence += 0.3;
  if (role && role !== 'unknown') confidence += 0.3;
  if (text) confidence += 0.1;
  if (valueFormality) confidence += 0.1;

  const hints: RegisterHints = {
    fieldRole: role ?? 'unknown',
    formalityPrior: formality,
    confidence: Math.min(0.95, Math.round(confidence * 100) / 100),
  };

  if (site) {
    hints.siteId = site.id;
    hints.formatHint = site.format;
  }
  if (signals.placeholder) hints.placeholder = signals.placeholder;
  if (signals.labels?.length) hints.labels = signals.labels;

  return hints;
}

function inferRole(text: string): FieldRole | undefined {
  if (!text) return undefined;
  return ROLE_RULES.find((rule) => rule.pattern.test(text))?.role;
}

function inferFormality(value?: string): Formality | undefined {
  if (!value?.trim()) return undefined;
  if (FORMAL_VALUE.test(value)) return 'formal';
  if (CASUAL_VALUE.test(value)) return 'casual';
  return undefined;
}
