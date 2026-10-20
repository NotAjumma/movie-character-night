// Local stand-in for Vercel: serves public/ and routes /api/<name> to api/<name>.js.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { loadEnv } from './env.mjs';

loadEnv();
const PORT = Number(process.env.PORT) || 3005;
const ROOT = new URL('..', import.meta.url);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      const name = url.pathname.slice(5);
      if (!/^[\w-]+$/.test(name)) { res.writeHead(404).end(); return; }
      const mod = await import(new URL(`api/${name}.js`, ROOT)).catch(() => null);
      const handler = mod?.[req.method];
      if (!handler) { res.writeHead(mod ? 405 : 404).end(); return; }
      const hasBody = !['GET', 'HEAD'].includes(req.method);
      const request = new Request(url, { method: req.method, headers: req.headers, body: hasBody ? Readable.toWeb(req) : undefined, duplex: 'half' });
      const response = await handler(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    const path = url.pathname === '/' ? '/index.html' : url.pathname;
    if (path.includes('..')) { res.writeHead(400).end(); return; }
    const body = await readFile(new URL('public' + path, ROOT));
    res.writeHead(200, { 'Content-Type': TYPES[path.slice(path.lastIndexOf('.'))] || 'application/octet-stream' }).end(body);
  } catch (e) {
    if (e.code === 'ENOENT') { res.writeHead(404).end('Not found'); return; }
    console.error(e);
    res.writeHead(500).end('Dev server error');
  }
}).on('error', e => {
  if (e.code !== 'EADDRINUSE') throw e;
  console.error(`Port ${PORT} is already used by another app. Try: PORT=3006 npm run dev`);
  process.exit(1);
}).listen(PORT, () => console.log(`Dev server: http://localhost:${PORT}`));
