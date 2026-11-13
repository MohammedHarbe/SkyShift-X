/**
 * Reference backend: serves the mock API over real HTTP so that
 *   - the frontend's LIVE mode can be exercised end to end without the Python service, and
 *   - the backend team can compare their responses with known-good ones.
 *
 *   pnpm mock:server                      # http://localhost:8000
 *   VITE_API_MODE=live VITE_API_BASE_URL=http://localhost:8000 pnpm dev
 *
 * Responses still say `meta.dataOrigin: "mock"` and `simulated: true`, and the UI labels them so.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMockFetch } from '../src/mocks/router';

const PORT = Number(process.env.PORT ?? 8000);
const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const mock = createMockFetch();

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
};

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS).end();
    return;
  }
  if (url.pathname.startsWith('/api/')) {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = chunks.length ? Buffer.concat(chunks).toString('utf8') : undefined;
    const response = await mock(url.href, { method: req.method, headers: { 'Content-Type': 'application/json' }, body: req.method === 'POST' ? body : undefined });
    res.writeHead(response.status, { ...CORS, 'Content-Type': 'application/json' }).end(await response.text());
    console.log(`${req.method} ${url.pathname}${url.search} -> ${response.status}`);
    return;
  }
  // Preview images referenced by relative URLs in API responses.
  const file = normalize(join(PUBLIC, decodeURIComponent(url.pathname)));
  if (file.startsWith(PUBLIC) && existsSync(file) && statSync(file).isFile()) {
    res.writeHead(200, { ...CORS, 'Content-Type': file.endsWith('.png') ? 'image/png' : 'application/octet-stream' });
    createReadStream(file).pipe(res);
    return;
  }
  res.writeHead(404, { ...CORS, 'Content-Type': 'application/json' }).end(JSON.stringify({ apiVersion: '1.0', error: { code: 'not_found', message: 'Not found' } }));
}).listen(PORT, () => console.log(`SkyShift X reference (mock) backend on http://localhost:${PORT}`));
