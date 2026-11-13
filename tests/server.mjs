// テスト用の小さな静的サーバー（依存なし）。単体で動かすと、ブラウザで確認できる：node tests/server.mjs → http://localhost:8765/
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };

export function startServer(port = 0) {
  return new Promise(resolve => {
    const server = createServer(async (req, res) => {
      const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
      try {
        const body = await readFile(join(ROOT, path || 'index.html'));
        res.writeHead(200, { 'content-type': TYPES[extname(path || '.html')] || 'application/octet-stream' }); res.end(body);
      } catch { res.writeHead(404); res.end('not found'); }
    });
    server.listen(port, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/` }));
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { url } = await startServer(Number(process.env.PORT) || 8765);
  console.log(`serving ${ROOT} at ${url}`);
}
