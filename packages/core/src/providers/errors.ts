export type ErrorKind = 'auth' | 'cors' | 'rate_limit' | 'quota' | 'model_missing' | 'network';

export interface ErrorSignals {
  status?: number;
  code?: string;
  message?: string;
  hostPermissionGranted?: boolean;
}

export interface ClassifiedError {
  kind: ErrorKind;
  retryable: boolean;
}

const RETRYABLE: ReadonlySet<ErrorKind> = new Set<ErrorKind>(['rate_limit', 'network']);

const NETWORK_MESSAGE =
  /failed to fetch|networkerror|load failed|fetch failed|econnrefused|etimedout|enotfound/i;
const MODEL_MESSAGE = /model/i;

export function classifyError(signals: ErrorSignals): ClassifiedError {
  const kind = kindOf(signals);
  return { kind, retryable: RETRYABLE.has(kind) };
}

function kindOf({ status, code, message, hostPermissionGranted }: ErrorSignals): ErrorKind {
  const text = message ?? '';

  if (status === 429) return 'rate_limit';
  if (status === 402) return 'quota';
  if (status === 401) return 'auth';
  if (status === 403) return hostPermissionGranted === false ? 'cors' : 'auth';
  if (status === 404 && MODEL_MESSAGE.test(text)) return 'model_missing';
  if (status === 400 && MODEL_MESSAGE.test(text)) return 'model_missing';

  if (NETWORK_MESSAGE.test(text) || (code !== undefined && NETWORK_MESSAGE.test(code))) {
    return hostPermissionGranted === false ? 'cors' : 'network';
  }

  return 'network';
}

export function errorCopy(kind: ErrorKind, providerName: string): string {
  switch (kind) {
    case 'auth':
      return `Couldn’t reach ${providerName}. Check your key in Settings.`;
    case 'cors':
      return `${providerName} blocked the request. Check the provider settings, or try another model.`;
    case 'rate_limit':
      return 'Rate limited. Try Quick effort or another model.';
    case 'quota':
      return 'This key is out of quota. Check your provider account.';
    case 'model_missing':
      return 'That model is not available on this key. Pick another in Settings.';
    case 'network':
      return `Couldn’t reach ${providerName}. Check your connection and try again.`;
  }
}
