import {createServer} from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {extname, join, normalize, resolve, sep} from 'node:path';

const root = resolve('dist');
const host = '127.0.0.1';
const port = Number(process.env.PORT || 5184);
const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.xml', 'application/xml; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.glb', 'model/gltf-binary'],
]);

async function existingFile(pathname) {
  const decoded = decodeURIComponent(pathname);
  const relative = normalize(decoded).replace(/^[/\\]+/, '');
  const candidate = join(root, relative || 'index.html');
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) return null;
  try {
    const info = await stat(candidate);
    if (info.isDirectory()) {
      const index = join(candidate, 'index.html');
      return (await stat(index)).isFile() ? index : null;
    }
    return info.isFile() ? candidate : null;
  } catch {
    return null;
  }
}

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url || '/', `http://${host}`).pathname;
  try {
    const file = await existingFile(pathname);
    const body = await readFile(file || join(root, '404.html'));
    const code = file ? 200 : 404;
    response.writeHead(code, {
      'Content-Type': contentTypes.get(extname(file || '404.html')) || 'application/octet-stream',
      'Content-Length': body.byteLength,
      'Cache-Control': file && pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    if (request.method === 'HEAD') response.end();
    else response.end(body);
    if (!file) console.warn('[preview] 404', {pathname});
  } catch (error) {
    console.error('[preview] request failed', {pathname, error});
    response.writeHead(500, {'Content-Type': 'text/plain; charset=utf-8'}).end('Internal Server Error');
  }
});

server.listen(port, host, () => console.info(`[preview] production files: http://${host}:${port}/en/`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
