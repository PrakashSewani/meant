import { describe, expect, it } from 'vitest';
import { inferRegister } from './index';
import type { SurfaceSignals } from './index';

interface Case {
  name: string;
  signals: SurfaceSignals;
  expected: Partial<ReturnType<typeof inferRegister>>;
}

const CASES: readonly Case[] = [
  {
    name: 'gmail subject line',
    signals: { url: 'https://mail.google.com/mail/u/0/#inbox', placeholder: 'Subject' },
    expected: {
      siteId: 'gmail',
      fieldRole: 'subject',
      formalityPrior: 'neutral',
      formatHint: 'email',
    },
  },
  {
    name: 'slack DM composer',
    signals: { url: 'https://app.slack.com/client/T1/D1', placeholder: 'Message Sarah' },
    expected: { siteId: 'slack', fieldRole: 'message', formalityPrior: 'casual' },
  },
  {
    name: 'jira bug description',
    signals: {
      url: 'https://acme.atlassian.net/browse/ENG-1',
      placeholder: 'Describe the bug',
    },
    expected: { siteId: 'jira', fieldRole: 'issue-description', formalityPrior: 'neutral' },
  },
  {
    name: 'github pull request body',
    signals: { url: 'https://github.com/acme/app/compare', placeholder: 'Describe your changes' },
    expected: { siteId: 'github', fieldRole: 'compose-body' },
  },
  {
    name: 'linkedin post composer',
    signals: { url: 'https://www.linkedin.com/feed/', placeholder: "What's on your mind?" },
    expected: { siteId: 'linkedin', fieldRole: 'compose-body' },
  },
  {
    name: 'comment box found by label, not placeholder',
    signals: { url: 'https://example.com/post', labels: ['Write a comment'] },
    expected: { fieldRole: 'comment' },
  },
  {
    name: 'casual draft shifts formality below the site prior',
    signals: { url: 'https://mail.google.com/mail/u/0/', value: 'hey, quick one about the deploy' },
    expected: { siteId: 'gmail', formalityPrior: 'casual' },
  },
  {
    name: 'formal draft shifts formality up',
    signals: { url: 'https://app.slack.com/client/T1/D1', value: 'Dear Sarah, following up' },
    expected: { siteId: 'slack', formalityPrior: 'formal' },
  },
  {
    name: 'unknown surface keeps the bare minimum',
    signals: { url: 'https://example.com/form' },
    expected: { fieldRole: 'unknown', formalityPrior: 'neutral', confidence: 0.2 },
  },
  {
    name: 'invalid url yields no inference at all',
    signals: { url: 'not a url' },
    expected: { confidence: 0, siteId: undefined, fieldRole: undefined },
  },
];

describe('inferRegister', () => {
  for (const testCase of CASES) {
    it(testCase.name, () => {
      const hints = inferRegister(testCase.signals);

      for (const [key, value] of Object.entries(testCase.expected)) {
        expect(hints[key as keyof typeof hints], `${key} of ${testCase.name}`).toEqual(value);
      }
    });
  }

  it('raises confidence when a site and a field role are both known', () => {
    const known = inferRegister({
      url: 'https://mail.google.com/mail/u/0/',
      placeholder: 'Describe the bug',
    });
    const unknown = inferRegister({ url: 'https://example.com/form' });

    expect(known.confidence).toBeGreaterThan(unknown.confidence);
    expect(known.confidence).toBeLessThanOrEqual(0.95);
  });

  it('prefers an explicit field role over the placeholder guess', () => {
    const hints = inferRegister({
      url: 'https://app.slack.com/client/T1/D1',
      fieldRole: 'reply',
      placeholder: "What's on your mind?",
    });

    expect(hints.fieldRole).toBe('reply');
  });
});
