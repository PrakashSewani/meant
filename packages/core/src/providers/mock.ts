import type { CompiledPrompt } from '../prompt/compile';
import type { TransformTransport } from './types';

export const MOCK_PREFIX = '[mock]';

/**
 * Stands in for a real transport in dev and E2E runs, where no key may ever be present.
 * It reports a real transport id so call sites exercise the same code path.
 */
export function createMockTransport(
  respond: (prompt: CompiledPrompt) => string = defaultRespond,
): TransformTransport {
  return {
    id: 'openai-compatible',
    async *stream({ prompt }) {
      const text = respond(prompt);
      const chunkSize = Math.max(1, Math.ceil(text.length / 3));

      for (let index = 0; index < text.length; index += chunkSize) {
        yield text.slice(index, index + chunkSize);
      }
    },
  };
}

function defaultRespond(prompt: CompiledPrompt): string {
  const match = /<intent>\n([\s\S]*?)\n<\/intent>/.exec(prompt.user);
  const firstLine = match?.[1]?.trim().split('\n')[0] ?? '';

  return `${MOCK_PREFIX} ${firstLine}`.trim();
}
