import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';

const root = join(import.meta.dirname, '..', 'apps', 'extension', '.output', 'chrome-mv3');
const port = Number(process.env.PORT ?? 3123);

const PIECES = ['Deploy slipped ', 'a day. We are on it, ', 'fix by EOD.'];

/** What the provider says, so a test can tell a real call from the built-in mock. */
export const PROVIDER_REPLY = PIECES.join('');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
};

function chatChunk(content, finishReason = null) {
  return `data: ${JSON.stringify({
    id: 'chatcmpl-fixture',
    object: 'chat.completion.chunk',
    created: 0,
    model: 'fixture-model',
    choices: [{ index: 0, delta: content ? { content } : {}, finish_reason: finishReason }],
  })}\n\n`;
}

createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');

  // A stand-in OpenAI-compatible endpoint: the extension talks to it exactly as it would to a
  // real provider, which is the only way to exercise the transport end to end.
  if (request.method === 'POST' && url.pathname.endsWith('/chat/completions')) {
    response.writeHead(200, { 'content-type': 'text/event-stream' });
    response.end(
      PIECES.map((piece, index) =>
        chatChunk(piece, index === PIECES.length - 1 ? 'stop' : null),
      ).join('') + 'data: [DONE]\n\n',
    );
    return;
  }

  const path = normalize(join(root, decodeURIComponent(url.pathname)));

  if (!path.startsWith(root + sep) && path !== root) {
    response.writeHead(403);
    response.end();
    return;
  }

  try {
    const body = await readFile(path);
    response.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end();
  }
}).listen(port, () => {
  console.log(`fixture on http://localhost:${port}/fixture.html`);
});
