import { describe, expect, it } from 'vitest';
import { CURATED_HOSTS, curatedMatchPatterns, isCuratedHost } from './sites';
import { inferRegister } from './inference';

describe('curated hosts', () => {
  it('matches the sites the register engine knows about', () => {
    for (const url of [
      'https://mail.google.com/mail/u/0/',
      'https://app.slack.com/client/T1/D1',
      'https://acme.atlassian.net/browse/ENG-1',
    ]) {
      const hints = inferRegister({ url });
      expect(hints.siteId).toBeDefined();
      expect(isCuratedHost(new URL(url).hostname)).toBe(true);
    }
  });

  it('does not match a site merely because it mentions a curated one', () => {
    expect(isCuratedHost('mail.google.com.evil.example')).toBe(false);
    expect(isCuratedHost('notatlassian.net')).toBe(false);
  });

  it('matches subdomains of a wildcard entry', () => {
    expect(isCuratedHost('acme.atlassian.net')).toBe(true);
    expect(isCuratedHost('jira.atlassian.net')).toBe(true);
  });

  it('keeps the fixture hosts available for development', () => {
    expect(isCuratedHost('localhost')).toBe(true);
    expect(isCuratedHost('127.0.0.1')).toBe(true);
  });

  it('turns hosts into manifest patterns', () => {
    const patterns = curatedMatchPatterns();

    expect(patterns).toContain('https://mail.google.com/*');
    expect(patterns).toContain('https://*.atlassian.net/*');
    expect(patterns).toContain('http://localhost/*');
    expect(patterns).toHaveLength(CURATED_HOSTS.length + 2);
  });
});
