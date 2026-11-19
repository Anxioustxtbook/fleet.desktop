const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const root = path.resolve(__dirname, 'dist-web');
const port = Number(process.env.PORT || 8081);
const mime = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function sendFile(request, response, file) {
  response.writeHead(200, {
    'Cache-Control': 'no-cache',
    'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Cross-Origin-Embedder-Policy': 'credentialless',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-Content-Type-Options': 'nosniff'
  });
  if (request.method === 'HEAD') return response.end();
  fs.createReadStream(file).on('error', () => {
    if (!response.headersSent) response.writeHead(500);
    response.end('Preview file could not be read.');
  }).pipe(response);
}

http.createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch (_) { response.writeHead(400).end('Invalid request path.'); return; }
  let file = path.resolve(root, `.${pathname}`);
  if (file !== root && !file.startsWith(root + path.sep)) {
    response.writeHead(403).end('Forbidden.');
    return;
  }
  try {
    if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.statSync(file).isFile()) throw new Error('not a file');
  } catch (_) {
    if (!String(request.headers.accept || '').includes('text/html')) {
      response.writeHead(404).end('Not found.');
      return;
    }
    file = path.join(root, 'index.html');
  }
  sendFile(request, response, file);
}).listen(port, '0.0.0.0', () => {
  process.stdout.write(`FleetPilot mobile preview: http://localhost:${port}/\n`);
});
