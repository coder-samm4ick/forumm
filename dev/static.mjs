import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.join(process.cwd(), 'web');
const fix = (n) => path.join(process.cwd(), 'dev', `_fix_${n}.json`);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
http.createServer((req, res) => {
  const url = String(req.url).split('?')[0];
  const apiMatch = /^\/functions\/v1\/app\/api\/(\w+)/.exec(url);
  if (apiMatch) {
    const file = fix(apiMatch[1]);
    if (fs.existsSync(file)) { res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' }); fs.createReadStream(file).pipe(res); return; }
    res.writeHead(404).end('{"error":"not_found"}'); return;
  }
  const file = path.join(root, url === '/' ? 'index.html' : decodeURIComponent(url));
  if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404).end('nope'); return; }
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(8099, () => console.log('static+fixtures on 8099'));
