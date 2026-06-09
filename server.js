const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const fallbackRates = {
  USD: 1, SEK: 10.55, THB: 36.72, EUR: 0.92, GBP: 0.78, CAD: 1.37, MXN: 18.15,
  GTQ: 7.80, HNL: 24.75, NIO: 36.80, CRC: 520.00, COP: 3900.00, BRL: 5.25,
  JPY: 157.00, CNY: 7.24, KRW: 1375.00, INR: 83.50, AUD: 1.51, CHF: 0.89
};

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function fetchRates() {
  return new Promise((resolve, reject) => {
    const request = https.get('https://open.er-api.com/v6/latest/USD', response => {
      let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (!data.rates) return reject(new Error('Rates not found'));
          resolve(data.rates);
        } catch (error) {
          reject(error);
        }
      });
    });
    request.setTimeout(8000, () => {
      request.destroy(new Error('Rate request timed out'));
    });
    request.on('error', reject);
  });
}

function serveFile(req, res) {
  const cleanUrl = decodeURIComponent(req.url.split('?')[0]);
  const requestedPath = cleanUrl === '/' ? '/index.html' : cleanUrl;
  const filePath = path.normalize(path.join(ROOT, requestedPath));

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/rates')) {
    try {
      const rates = await fetchRates();
      sendJson(res, 200, { base: 'USD', source: 'open.er-api.com', rates: { ...fallbackRates, ...rates, USD: 1 } });
    } catch (error) {
      sendJson(res, 200, { base: 'USD', source: 'fallback', rates: fallbackRates, error: error.message });
    }
    return;
  }

  serveFile(req, res);
});

server.listen(PORT, () => {
  console.log(`Tierra Dorada backend running at http://localhost:${PORT}`);
});
