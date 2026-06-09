const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');

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

function loadEnvFile() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const index = trimmed.indexOf('=');
    if (index === -1) return;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, '');
    if (key && process.env[key] === undefined) process.env[key] = value;
  });
}

loadEnvFile();

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function formatUsd(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
}

function formatCurrency(value, currency) {
  return new Intl.NumberFormat('es-SV', { style: 'currency', currency: currency || 'USD' }).format(Number(value || 0));
}

function buildInvoiceNumber() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  return `TD-${stamp}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function getPublicBaseUrl(requestBaseUrl) {
  return (process.env.PUBLIC_BASE_URL || requestBaseUrl || `http://localhost:${PORT}`).replace(/\/$/, '');
}

function ensureInvoicesDir() {
  const invoicesDir = path.join(ROOT, 'invoices');
  if (!fs.existsSync(invoicesDir)) fs.mkdirSync(invoicesDir, { recursive: true });
  return invoicesDir;
}

function saveInvoiceHtml(invoiceNumber, html) {
  const invoicesDir = ensureInvoicesDir();
  fs.writeFileSync(path.join(invoicesDir, `${invoiceNumber}.html`), html, 'utf8');
}

function serveInvoice(req, res) {
  const cleanUrl = decodeURIComponent(req.url.split('?')[0]);
  const invoiceNumber = path.basename(cleanUrl.replace('/factura/', ''));
  const invoicePath = path.join(ROOT, 'invoices', `${invoiceNumber}.html`);

  if (!invoiceNumber || !fs.existsSync(invoicePath)) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>Factura no encontrada</h1><p>Verifica el codigo QR o el numero de factura.</p>');
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(fs.readFileSync(invoicePath, 'utf8'));
}

function getTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    throw new Error('SMTP no configurado. Define SMTP_USER y SMTP_PASS.');
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || 'true') === 'true',
    auth: { user, pass }
  });
}

function buildInvoiceHtml(invoice, order, qrCid, logoCid) {
  const rows = order.items.map(item => `
    <tr>
      <td style="padding:16px 14px;border-bottom:1px solid #e5e7eb;color:#111827;background:#ffffff;">
        <strong style="font-size:15px;">${escapeHtml(item.name)}</strong><br>
        <span style="color:#6b7280;font-size:13px;">Saco de 50 kg para exportacion</span>
      </td>
      <td style="padding:16px 14px;border-bottom:1px solid #e5e7eb;text-align:center;color:#111827;background:#ffffff;font-weight:700;">${escapeHtml(item.quantity)}</td>
      <td style="padding:16px 14px;border-bottom:1px solid #e5e7eb;text-align:right;color:#111827;background:#ffffff;">${formatUsd(item.unitPrice)}</td>
      <td style="padding:16px 14px;border-bottom:1px solid #e5e7eb;text-align:right;color:#111827;background:#ffffff;font-weight:800;">${formatUsd(item.total)}</td>
    </tr>
  `).join('');

  return `
  <!doctype html>
  <html lang="es">
  <body style="margin:0;background:#f4f7fb;color:#111827;font-family:Arial,Helvetica,sans-serif;color-scheme:light;">
    <div style="max-width:820px;margin:0 auto;padding:28px 16px;">
      <div style="background:#ffffff;border:1px solid #d8dee8;border-radius:18px;overflow:hidden;box-shadow:0 18px 45px rgba(15,23,42,0.12);">
        <div style="background:#0f172a;color:#ffffff;padding:30px 34px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="vertical-align:middle;">
                <p style="margin:0 0 8px;color:#93c5fd;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;">Comprobante de compra</p>
                <h1 style="margin:0;color:#ffffff;font-size:32px;line-height:1.12;">Factura electronica</h1>
                <p style="margin:8px 0 0;color:#dbeafe;font-size:17px;">Tierra Dorada Exportaciones S.A. de C.V.</p>
              </td>
              <td style="width:132px;text-align:right;vertical-align:middle;">
                <div style="display:inline-block;background:#ffffff;border-radius:14px;padding:8px;border:1px solid rgba(255,255,255,.35);">
                  <img src="cid:${logoCid}" alt="Tierra Dorada" width="108" style="display:block;width:108px;max-width:108px;height:auto;border-radius:10px;">
                </div>
              </td>
            </tr>
          </table>
        </div>
        <div style="padding:30px 34px;">
          <table style="width:100%;border-collapse:collapse;margin-bottom:24px;background:#f8fafc;border:1px solid #d8dee8;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="vertical-align:top;padding:20px;">
                <p style="margin:0 0 10px;color:#2563eb;font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;">Datos de factura</p>
                <p style="margin:0 0 8px;color:#111827;font-size:15px;"><strong>No. factura:</strong> <span style="color:#1d4ed8;">${escapeHtml(invoice.number)}</span></p>
                <p style="margin:0 0 8px;color:#111827;font-size:15px;"><strong>Fecha:</strong> ${escapeHtml(invoice.date)}</p>
                <p style="margin:0;color:#111827;font-size:15px;"><strong>Estado:</strong> <span style="display:inline-block;background:#dcfce7;color:#166534;border-radius:999px;padding:4px 10px;font-weight:800;">${escapeHtml(invoice.status)}</span></p>
              </td>
              <td style="width:150px;text-align:center;padding:20px;">
                <img src="cid:${qrCid}" alt="QR de factura" width="126" height="126" style="display:block;margin:0 auto;background:#ffffff;border:8px solid #ffffff;border-radius:12px;box-shadow:0 8px 18px rgba(15,23,42,0.14);">
                <p style="margin:8px 0 0;color:#475569;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">Verificacion QR</p>
              </td>
            </tr>
          </table>

          <table style="width:100%;border-collapse:separate;border-spacing:0 12px;margin-bottom:20px;">
            <tr>
              <td style="width:50%;vertical-align:top;padding-right:7px;">
                <div style="background:#ffffff;border:1px solid #d8dee8;border-left:5px solid #2563eb;border-radius:12px;padding:18px;">
                  <p style="margin:0 0 10px;color:#2563eb;text-transform:uppercase;font-size:12px;letter-spacing:.12em;"><strong>Cliente</strong></p>
                  <p style="margin:0 0 7px;color:#111827;font-size:17px;font-weight:800;">${escapeHtml(order.customer.name)}</p>
                  <p style="margin:0 0 7px;color:#334155;font-size:14px;">${escapeHtml(order.customer.email)}</p>
                  <p style="margin:0;color:#334155;font-size:14px;">${escapeHtml(order.customer.phone || 'Telefono no indicado')}</p>
                </div>
              </td>
              <td style="width:50%;vertical-align:top;padding-left:7px;">
                <div style="background:#ffffff;border:1px solid #d8dee8;border-left:5px solid #10b981;border-radius:12px;padding:18px;">
                  <p style="margin:0 0 10px;color:#047857;text-transform:uppercase;font-size:12px;letter-spacing:.12em;"><strong>Exportacion</strong></p>
                  <p style="margin:0 0 7px;color:#111827;font-size:15px;"><strong>Destino:</strong> ${escapeHtml(order.destination.country)} (${escapeHtml(order.destination.currency)})</p>
                  <p style="margin:0 0 7px;color:#111827;font-size:15px;"><strong>Pago:</strong> ${escapeHtml(order.payment.method)}</p>
                  <p style="margin:0;color:#111827;font-size:15px;"><strong>Envio:</strong> A coordinar</p>
                </div>
              </td>
            </tr>
          </table>

          <table style="width:100%;border-collapse:collapse;border:1px solid #d8dee8;border-radius:12px;overflow:hidden;margin-bottom:22px;background:#ffffff;">
            <thead>
              <tr style="background:#eef4ff;color:#111827;">
                <th style="padding:14px;text-align:left;font-size:13px;text-transform:uppercase;letter-spacing:.08em;">Producto</th>
                <th style="padding:14px;text-align:center;font-size:13px;text-transform:uppercase;letter-spacing:.08em;">Sacos</th>
                <th style="padding:14px;text-align:right;font-size:13px;text-transform:uppercase;letter-spacing:.08em;">Precio</th>
                <th style="padding:14px;text-align:right;font-size:13px;text-transform:uppercase;letter-spacing:.08em;">Total</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>

          <table style="width:100%;border-collapse:collapse;margin-bottom:22px;">
            <tr>
              <td style="vertical-align:top;padding:0 16px 0 0;color:#475569;font-size:13px;line-height:1.6;">
                <div style="background:#f8fafc;border:1px solid #d8dee8;border-radius:12px;padding:16px;">
                  <strong style="display:block;color:#111827;margin-bottom:6px;">Nota de exportacion</strong>
                  La logistica internacional, documentacion aduanera y terminos finales se coordinan despues de confirmar disponibilidad.
                </div>
              </td>
              <td style="width:360px;vertical-align:top;">
                <div style="background:#0f172a;color:#ffffff;border-radius:14px;padding:20px;">
                  <p style="display:flex;justify-content:space-between;margin:0 0 10px;color:#e5e7eb;"><span>Subtotal USD</span><strong>${formatUsd(order.totals.subtotalUsd)}</strong></p>
                  <p style="display:flex;justify-content:space-between;margin:0 0 10px;color:#e5e7eb;"><span>Total moneda local</span><strong>${formatCurrency(order.totals.totalLocal, order.destination.currency)}</strong></p>
                  <p style="display:flex;justify-content:space-between;margin:0 0 14px;color:#e5e7eb;"><span>Peso total</span><strong>${escapeHtml(order.totals.weightKg.toLocaleString('es-SV'))} kg</strong></p>
                  <p style="display:flex;justify-content:space-between;margin:0;padding-top:16px;border-top:1px solid rgba(219,234,254,.35);font-size:22px;color:#ffffff;"><span>Total estimado</span><strong>${formatUsd(order.totals.subtotalUsd)}</strong></p>
                </div>
              </td>
            </tr>
          </table>

          <p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;text-align:center;">Esta factura/comprobante fue generado electronicamente por Tierra Dorada Exportaciones.</p>
        </div>
      </div>
    </div>
  </body>
  </html>`;
}

async function sendInvoiceEmail(order, requestBaseUrl) {
  if (!order.customer?.email) {
    throw new Error('El correo del cliente es obligatorio para enviar la factura.');
  }

  const invoice = {
    number: buildInvoiceNumber(),
    date: new Intl.DateTimeFormat('es-SV', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/El_Salvador' }).format(new Date()),
    status: 'Emitida'
  };
  const invoiceUrl = `${getPublicBaseUrl(requestBaseUrl)}/factura/${encodeURIComponent(invoice.number)}`;
  const qrDataUrl = await QRCode.toDataURL(invoiceUrl, { margin: 1, width: 220 });
  const qrBase64 = qrDataUrl.split(',')[1];
  const qrCid = `${invoice.number}@tierra-dorada`;
  const logoCid = `logo-${invoice.number}@tierra-dorada`;
  const logoPath = path.join(ROOT, 'img', 'logo.jpg');
  const html = buildInvoiceHtml(invoice, order, qrCid, logoCid);
  const logoDataUrl = fs.existsSync(logoPath)
    ? `data:image/jpeg;base64,${fs.readFileSync(logoPath).toString('base64')}`
    : '';
  const publicHtml = buildInvoiceHtml(invoice, order, qrDataUrl, logoDataUrl);
  saveInvoiceHtml(invoice.number, publicHtml);

  const fromEmail = process.env.INVOICE_FROM_EMAIL || process.env.SMTP_USER;
  const fromName = process.env.INVOICE_FROM_NAME || 'Tierra Dorada Exportaciones';
  const transporter = getTransporter();

  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: order.customer.email,
    subject: `Factura ${invoice.number} - Tierra Dorada`,
    html,
    attachments: [
      {
        filename: `${invoice.number}-qr.png`,
        content: Buffer.from(qrBase64, 'base64'),
        cid: qrCid
      },
      {
        filename: 'tierra-dorada-logo.jpg',
        path: logoPath,
        cid: logoCid
      },
      {
        filename: `${invoice.number}.html`,
        content: html,
        contentType: 'text/html; charset=utf-8'
      }
    ]
  });

  return invoice;
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
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
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  if (req.url.startsWith('/api/rates')) {
    try {
      const rates = await fetchRates();
      sendJson(res, 200, { base: 'USD', source: 'open.er-api.com', rates: { ...fallbackRates, ...rates, USD: 1 } });
    } catch (error) {
      sendJson(res, 200, { base: 'USD', source: 'fallback', rates: fallbackRates, error: error.message });
    }
    return;
  }

  if (req.url.startsWith('/api/invoice-email')) {
    if (req.method !== 'POST') {
      sendJson(res, 405, { ok: false, error: 'Metodo no permitido' });
      return;
    }

    try {
      const order = await readJsonBody(req);
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const requestBaseUrl = `${protocol}://${req.headers.host}`;
      const invoice = await sendInvoiceEmail(order, requestBaseUrl);
      sendJson(res, 200, { ok: true, invoice });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message });
    }
    return;
  }

  if (req.url.startsWith('/factura/')) {
    serveInvoice(req, res);
    return;
  }

  serveFile(req, res);
});

server.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    console.error(`El puerto ${PORT} ya esta en uso. Abre http://localhost:${PORT}/carrito.html si el servidor ya esta corriendo, o ejecuta: npm run start:3001`);
    process.exit(1);
  }
  throw error;
});

server.listen(PORT, () => {
  console.log(`Tierra Dorada backend running at http://localhost:${PORT}`);
});
