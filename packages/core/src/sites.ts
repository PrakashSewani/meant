/**
 * Where the content script runs without the user enabling anything, and the only hosts Meant
 * ships with access to. Everything else is granted per origin at runtime (D-004).
 *
 * `localhost` is the dev fixture host: the page the browser suite and manual dogfooding drive.
 */
export const CURATED_HOSTS = ['mail.google.com', 'app.slack.com', '*.atlassian.net'] as const;

export const LOCAL_HOSTS = ['localhost', '127.0.0.1'] as const;

export function curatedMatchPatterns(): string[] {
  return [
    ...CURATED_HOSTS.map((host) => `https://${host}/*`),
    ...LOCAL_HOSTS.map((host) => `http://${host}/*`),
  ];
}

export function isCuratedHost(hostname: string): boolean {
  if (LOCAL_HOSTS.includes(hostname as (typeof LOCAL_HOSTS)[number])) return true;

  return CURATED_HOSTS.some((pattern) =>
    pattern.startsWith('*.') ? hostname.endsWith(pattern.slice(1)) : hostname === pattern,
  );
}
