/**
 * Production server for the Angular build (no nginx).
 * - serves the compiled app from ./browser
 * - forwards /api/* to the backend container over the Docker network
 * - falls back to index.html so deep links like /user/dashboard work
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 8080);
const API_URL = new URL(process.env.API_URL || 'http://backend:5000');
const ROOT = path.join(__dirname, 'browser');
const INDEX = path.join(ROOT, 'index.html');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function proxy(req, res) {
  const upstream = http.request(
    {
      hostname: API_URL.hostname,
      port: API_URL.port || 80,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: API_URL.host,
        'x-forwarded-for': req.socket.remoteAddress || '',
        'x-forwarded-proto': 'http',
      },
    },
    (up) => {
      res.writeHead(up.statusCode || 502, up.headers);
      up.pipe(res);
    }
  );
  upstream.on('error', (err) => {
    console.error(`[proxy] ${req.method} ${req.url}: ${err.message}`);
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'The API is not reachable. Please try again shortly.' }));
  });
  req.pipe(upstream); // streams request bodies, including receipt uploads
}

function sendFile(res, file, cacheForever) {
  res.writeHead(200, {
    'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
    // Angular file names are content-hashed, so they can be cached; index.html must not be
    'Cache-Control': cacheForever ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('ok');
  }
  if (req.url.startsWith('/api/') || req.url === '/api') return proxy(req, res);
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405);
    return res.end();
  }

  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch {
    res.writeHead(400);
    return res.end();
  }
  const file = path.normalize(path.join(ROOT, urlPath));
  // never serve anything outside the build folder
  if (!file.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end();
  }
  fs.stat(file, (err, stat) => {
    if (!err && stat.isFile()) return sendFile(res, file, file !== INDEX);
    if (path.extname(urlPath)) {
      res.writeHead(404);
      return res.end('Not found');
    }
    sendFile(res, INDEX, false); // client-side route
  });
});

server.listen(PORT, '0.0.0.0', () => console.log(`Frontend on :${PORT}, proxying /api to ${API_URL.origin}`));

for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => server.close(() => process.exit(0)));
