import type { TextStreamPart, ToolSet } from 'ai';

/**
 * The SDK's error parts are yielded rather than thrown, so a transport that iterates the raw text
 * stream would report a rejected key as an empty answer. Surface them as exceptions so the error
 * classifier — and the user — see the failure.
 */
export async function* textDeltas(
  parts: AsyncIterable<TextStreamPart<ToolSet>>,
): AsyncIterable<string> {
  for await (const part of parts) {
    if (part.type === 'text-delta') {
      yield part.text;
    } else if (part.type === 'error') {
      throw part.error;
    }
  }
}
