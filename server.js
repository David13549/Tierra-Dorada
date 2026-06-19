const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

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

function buildOrderNumber() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `TD-${stamp}-${Math.floor(10000 + Math.random() * 90000)}`;
}

function getPublicBaseUrl(requestBaseUrl) {
  return (process.env.PUBLIC_BASE_URL || requestBaseUrl || `http://localhost:${PORT}`).replace(/\/$/, '');
}

function supabaseConfig() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { url, serviceKey, enabled: Boolean(url && serviceKey) };
}

function supabaseRequest(method, endpoint, payload, options = {}) {
  const config = supabaseConfig();
  if (!config.enabled) {
    return Promise.reject(new Error('Supabase no configurado. Define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.'));
  }

  const url = new URL(`${config.url}/rest/v1/${endpoint}`);
  if (options.onConflict) url.searchParams.set('on_conflict', options.onConflict);
  const body = payload === undefined ? null : JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method,
      headers: {
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: options.prefer || 'return=representation',
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {})
      }
    }, response => {
      let responseBody = '';
      response.on('data', chunk => { responseBody += chunk; });
      response.on('end', () => {
        let data = null;
        try {
          data = responseBody ? JSON.parse(responseBody) : null;
        } catch {
          data = responseBody;
        }

        if (response.statusCode < 200 || response.statusCode >= 300) {
          const message = Array.isArray(data) ? JSON.stringify(data) : (data?.message || data?.hint || responseBody || 'Error de Supabase');
          reject(new Error(message));
          return;
        }

        resolve(data);
      });
    });

    req.setTimeout(10000, () => {
      req.destroy(new Error('Tiempo agotado conectando con Supabase'));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getProductBySlug(slug) {
  const encodedSlug = encodeURIComponent(slug);
  const products = await supabaseRequest('GET', `products?slug=eq.${encodedSlug}&select=id,slug,name,price_usd,sack_kg,max_sacks&limit=1`);
  return Array.isArray(products) ? products[0] : null;
}

async function saveOrderToSupabase(order, invoice, requestBaseUrl) {
  const customerRows = await supabaseRequest('POST', 'customers', [{
    full_name: order.customer.name,
    email: order.customer.email,
    phone: order.customer.phone || null,
    country: order.destination.country,
    notes: order.customer.notes || null
  }], { onConflict: 'email', prefer: 'resolution=merge-duplicates,return=representation' });
  const customer = customerRows[0];

  const invoiceUrl = `${getPublicBaseUrl(requestBaseUrl)}/factura/${encodeURIComponent(invoice.number)}`;
  const orderRows = await supabaseRequest('POST', 'orders', [{
    order_number: buildOrderNumber(),
    customer_id: customer.id,
    status: 'confirmed',
    destination_country: order.destination.country,
    currency: order.destination.currency,
    exchange_rate: Number(order.destination.exchangeRate || 1),
    subtotal_usd: Number(order.totals.subtotalUsd || 0),
    total_local: Number(order.totals.totalLocal || 0),
    total_sacks: Number(order.totals.sacks || 0),
    total_weight_kg: Number(order.totals.weightKg || 0),
    payment_method: order.payment.method,
    invoice_number: invoice.number,
    invoice_url: invoiceUrl
  }]);
  const savedOrder = orderRows[0];

  const productCache = {};
  const itemRows = [];
  for (const item of order.items || []) {
    if (!productCache[item.id]) {
      productCache[item.id] = await getProductBySlug(item.id).catch(() => null);
    }
    const product = productCache[item.id];
    itemRows.push({
      order_id: savedOrder.id,
      product_id: product?.id || null,
      product_slug: item.id,
      product_name: item.name,
      quantity: Number(item.quantity || 0),
      unit_price_usd: Number(item.unitPrice || 0),
      total_usd: Number(item.total || 0),
      weight_kg: Number(item.weightKg || 0)
    });
  }

  if (itemRows.length) {
    await supabaseRequest('POST', 'order_items', itemRows);
  }

  await supabaseRequest('POST', 'payments', [{
    order_id: savedOrder.id,
    provider: order.payment.method,
    status: 'simulated',
    amount_usd: Number(order.totals.subtotalUsd || 0),
    metadata: { invoice_number: invoice.number }
  }]);

  const invoicePath = path.join(ROOT, 'invoices', `${invoice.number}.html`);
  if (fs.existsSync(invoicePath)) {
    try {
      await supabaseRequest('POST', 'invoices', [{
        invoice_number: invoice.number,
        order_id: savedOrder.id,
        customer_email: order.customer.email,
        html_content: fs.readFileSync(invoicePath, 'utf8'),
        invoice_url: `${getPublicBaseUrl(requestBaseUrl)}/factura/${encodeURIComponent(invoice.number)}`
      }]);
    } catch (invoiceErr) { console.error('Supabase invoice save failed:', invoiceErr.message); }
  }

  return savedOrder;
}

async function saveContactToSupabase(contact) {
  const rows = await supabaseRequest('POST', 'contact_messages', [{
    full_name: String(contact.name || '').trim(),
    company: String(contact.company || '').trim() || null,
    email: String(contact.email || '').trim(),
    phone: String(contact.phone || '').trim() || null,
    country: String(contact.country || '').trim() || null,
    volume: String(contact.volume || '').trim() || null,
    topic: String(contact.topic || '').trim() || null,
    message: String(contact.message || '').trim()
  }]);
  return rows[0];
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

function saveInvoicePdf(invoiceNumber, pdfBuffer) {
  const invoicesDir = ensureInvoicesDir();
  fs.writeFileSync(path.join(invoicesDir, `${invoiceNumber}.pdf`), pdfBuffer);
}

async function generatePdf(html) {
  const puppeteer = require('puppeteer');
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process'],
      timeout: 30000
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' }
    });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

async function serveInvoicePdf(req, res) {
  const cleanUrl = decodeURIComponent(req.url.split('?')[0]);
  const invoiceNumber = path.basename(cleanUrl.replace('/factura/', '').replace(/\/pdf$/, ''));
  const pdfPath = path.join(ROOT, 'invoices', `${invoiceNumber}.pdf`);
  const htmlPath = path.join(ROOT, 'invoices', `${invoiceNumber}.html`);

  let pdfBuffer = null;

  if (fs.existsSync(pdfPath)) {
    pdfBuffer = fs.readFileSync(pdfPath);
  } else if (fs.existsSync(htmlPath)) {
    try {
      pdfBuffer = await generatePdf(fs.readFileSync(htmlPath, 'utf8'));
      saveInvoicePdf(invoiceNumber, pdfBuffer);
    } catch (e) {
      console.error('PDF on-demand failed:', e.message);
    }
  }

  if (pdfBuffer) {
    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${invoiceNumber}.pdf"`,
      'Content-Length': pdfBuffer.length
    });
    res.end(pdfBuffer);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<h1>Factura PDF no encontrada</h1><p>Verifica el numero de factura.</p>');
}

async function serveInvoice(req, res) {
  const cleanUrl = decodeURIComponent(req.url.split('?')[0]);
  const invoiceNumber = path.basename(cleanUrl.replace('/factura/', ''));
  const invoicePath = path.join(ROOT, 'invoices', `${invoiceNumber}.html`);

  if (invoiceNumber && fs.existsSync(invoicePath)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(invoicePath, 'utf8'));
    return;
  }

  if (invoiceNumber) {
    try {
      const rows = await supabaseRequest('GET', `invoices?invoice_number=eq.${encodeURIComponent(invoiceNumber)}&select=html_content&limit=1`);
      if (Array.isArray(rows) && rows[0]?.html_content) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(rows[0].html_content);
        return;
      }
    } catch { /* caer al 404 si Supabase no responde */ }
  }

  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<h1>Factura no encontrada</h1><p>Verifica el codigo QR o el numero de factura.</p>');
}

async function getTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    throw new Error('SMTP no configurado. Define SMTP_USER y SMTP_PASS.');
  }

  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  let host = smtpHost;
  try {
    const addresses = await new Promise((resolve, reject) => {
      dns.resolve4(smtpHost, (err, addrs) => err ? reject(err) : resolve(addrs));
    });
    if (addresses && addresses[0]) host = addresses[0];
  } catch { /* usar hostname original si falla */ }

  const port = Number(process.env.SMTP_PORT || 465);
  const secure = String(process.env.SMTP_SECURE || 'true') === 'true';
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    requireTLS: !secure,
    tls: { servername: smtpHost, rejectUnauthorized: false }
  });
}

function buildInvoiceHtml(invoice, order, qrCid, logoCid, { webView = false } = {}) {
  const rows = order.items.map(item => `
    <tr>
      <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;color:#111827;background:#ffffff;">
        <strong style="font-size:14px;">${escapeHtml(item.name)}</strong><br>
        <span style="color:#6b7280;font-size:12px;">Saco de 50 kg para exportacion</span>
      </td>
      <td style="padding:12px 8px;border-bottom:1px solid #e5e7eb;text-align:center;color:#111827;background:#ffffff;font-weight:700;font-size:14px;">${escapeHtml(item.quantity)}</td>
      <td style="padding:12px 8px;border-bottom:1px solid #e5e7eb;text-align:right;color:#111827;background:#ffffff;font-size:14px;">${formatUsd(item.unitPrice)}</td>
      <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;text-align:right;color:#111827;background:#ffffff;font-weight:800;font-size:14px;">${formatUsd(item.total)}</td>
    </tr>
  `).join('');

  return `
  <!doctype html>
  <html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      body { margin:0; background:#f4f7fb; color:#111827; font-family:Arial,Helvetica,sans-serif; }
      .wrapper { max-width:820px; margin:0 auto; padding:16px 12px; }
      .card { background:#ffffff; border:1px solid #d8dee8; border-radius:18px; overflow:hidden; box-shadow:0 18px 45px rgba(15,23,42,0.12); }
      .header { background:#0f172a; color:#ffffff; padding:24px 24px; }
      .header-table { width:100%; border-collapse:collapse; }
      .header-text td { vertical-align:middle; }
      .header-logo { width:108px; text-align:right; vertical-align:middle; }
      .header-title { margin:0; color:#ffffff; font-size:28px; line-height:1.15; }
      .header-sub { margin:6px 0 0; color:#dbeafe; font-size:15px; }
      .body-pad { padding:20px 20px; }
      .info-table { width:100%; border-collapse:collapse; margin-bottom:20px; background:#f8fafc; border:1px solid #d8dee8; border-radius:14px; overflow:hidden; }
      .info-data { vertical-align:top; padding:18px; }
      .info-qr { width:140px; text-align:center; padding:18px; vertical-align:middle; }
      .cols-table { width:100%; border-collapse:collapse; margin-bottom:16px; }
      .col-left { width:50%; vertical-align:top; padding-right:6px; }
      .col-right { width:50%; vertical-align:top; padding-left:6px; }
      .totals-note { vertical-align:top; padding:0 14px 0 0; color:#475569; font-size:13px; line-height:1.6; }
      .totals-box { width:320px; vertical-align:top; }
      .total-row { width:100%; border-collapse:collapse; margin:0 0 8px; }
      .total-label { color:#e5e7eb; font-size:14px; padding:0; }
      .total-value { color:#e5e7eb; font-size:14px; font-weight:700; text-align:right; padding:0; }
      .total-final-label { color:#ffffff; font-size:20px; font-weight:700; padding-top:12px; border-top:1px solid rgba(219,234,254,.35); }
      .total-final-value { color:#ffffff; font-size:20px; font-weight:800; text-align:right; padding-top:12px; border-top:1px solid rgba(219,234,254,.35); }
      @media (max-width:600px) {
        .wrapper { padding:10px 6px !important; }
        .header { padding:18px 14px !important; }
        .header-logo { display:block !important; width:100% !important; text-align:left !important; padding-top:14px !important; }
        .header-text { display:block !important; width:100% !important; }
        .header-table, .header-table tbody, .header-table tr, .header-table td { display:block !important; width:100% !important; }
        .header-title { font-size:22px !important; }
        .header-sub { font-size:13px !important; }
        .body-pad { padding:14px 12px !important; }
        .info-table, .info-table tbody, .info-table tr { display:block !important; width:100% !important; }
        .info-data { display:block !important; width:100% !important; padding:14px 14px 0 !important; box-sizing:border-box !important; }
        .info-qr { display:block !important; width:100% !important; padding:12px 14px 14px !important; box-sizing:border-box !important; text-align:left !important; }
        .cols-table, .cols-table tbody, .cols-table tr { display:block !important; width:100% !important; }
        .col-left, .col-right { display:block !important; width:100% !important; padding:0 !important; margin-bottom:10px !important; }
        .totals-note { display:block !important; width:100% !important; padding:0 0 12px 0 !important; }
        .totals-box { display:block !important; width:100% !important; }
        .totals-table, .totals-table tbody, .totals-table tr { display:block !important; }
      }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <div class="card">
        <div class="header">
          <table class="header-table">
            <tr>
              <td class="header-text">
                <p style="margin:0 0 6px;color:#93c5fd;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;">Comprobante de compra</p>
                <h1 class="header-title">Factura electronica</h1>
                <p class="header-sub">Tierra Dorada Exportaciones S.A. de C.V.</p>
              </td>
              <td class="header-logo">
                <div style="display:inline-block;background:#ffffff;border-radius:14px;padding:7px;border:1px solid rgba(255,255,255,.35);">
                  <img src="cid:${logoCid}" alt="Tierra Dorada" width="90" style="display:block;width:90px;max-width:90px;height:auto;border-radius:10px;">
                </div>
              </td>
            </tr>
          </table>
        </div>
        <div class="body-pad">
          <table class="info-table">
            <tr>
              <td class="info-data">
                <p style="margin:0 0 8px;color:#2563eb;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;">Datos de factura</p>
                <p style="margin:0 0 7px;color:#111827;font-size:14px;word-break:break-all;"><strong>No. factura:</strong> <span style="color:#1d4ed8;">${escapeHtml(invoice.number)}</span></p>
                <p style="margin:0 0 7px;color:#111827;font-size:14px;"><strong>Fecha:</strong> ${escapeHtml(invoice.date)}</p>
                <p style="margin:0;color:#111827;font-size:14px;"><strong>Estado:</strong> <span style="display:inline-block;background:#dcfce7;color:#166534;border-radius:999px;padding:3px 10px;font-weight:800;">${escapeHtml(invoice.status)}</span></p>
              </td>
              <td class="info-qr">
                <img src="cid:${qrCid}" alt="QR de factura" width="118" height="118" style="display:block;margin:0 auto;background:#ffffff;border:7px solid #ffffff;border-radius:10px;box-shadow:0 6px 14px rgba(15,23,42,0.14);">
                <p style="margin:6px 0 0;color:#475569;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;text-align:center;">Verificacion QR</p>
              </td>
            </tr>
          </table>

          <table class="cols-table">
            <tr>
              <td class="col-left">
                <div style="background:#ffffff;border:1px solid #d8dee8;border-left:5px solid #2563eb;border-radius:12px;padding:14px;">
                  <p style="margin:0 0 8px;color:#2563eb;text-transform:uppercase;font-size:11px;letter-spacing:.12em;"><strong>Cliente</strong></p>
                  <p style="margin:0 0 6px;color:#111827;font-size:15px;font-weight:800;">${escapeHtml(order.customer.name)}</p>
                  <p style="margin:0 0 6px;color:#334155;font-size:13px;word-break:break-all;">${escapeHtml(order.customer.email)}</p>
                  <p style="margin:0;color:#334155;font-size:13px;">${escapeHtml(order.customer.phone || 'Telefono no indicado')}</p>
                </div>
              </td>
              <td class="col-right">
                <div style="background:#ffffff;border:1px solid #d8dee8;border-left:5px solid #10b981;border-radius:12px;padding:14px;">
                  <p style="margin:0 0 8px;color:#047857;text-transform:uppercase;font-size:11px;letter-spacing:.12em;"><strong>Exportacion</strong></p>
                  <p style="margin:0 0 6px;color:#111827;font-size:14px;"><strong>Destino:</strong> ${escapeHtml(order.destination.country)} (${escapeHtml(order.destination.currency)})</p>
                  <p style="margin:0 0 6px;color:#111827;font-size:14px;"><strong>Pago:</strong> ${escapeHtml(order.payment.method)}</p>
                  <p style="margin:0;color:#111827;font-size:14px;"><strong>Envio:</strong> A coordinar</p>
                </div>
              </td>
            </tr>
          </table>

          <table style="width:100%;border-collapse:collapse;border:1px solid #d8dee8;border-radius:12px;overflow:hidden;margin-bottom:18px;background:#ffffff;">
            <thead>
              <tr style="background:#eef4ff;color:#111827;">
                <th style="padding:11px 10px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.06em;">Producto</th>
                <th style="padding:11px 8px;text-align:center;font-size:12px;text-transform:uppercase;letter-spacing:.06em;">Sacos</th>
                <th style="padding:11px 8px;text-align:right;font-size:12px;text-transform:uppercase;letter-spacing:.06em;">Precio</th>
                <th style="padding:11px 10px;text-align:right;font-size:12px;text-transform:uppercase;letter-spacing:.06em;">Total</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>

          <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
            <tr>
              <td class="totals-note">
                <div style="background:#f8fafc;border:1px solid #d8dee8;border-radius:12px;padding:14px;">
                  <strong style="display:block;color:#111827;margin-bottom:5px;">Nota de exportacion</strong>
                  La logistica internacional, documentacion aduanera y terminos finales se coordinan despues de confirmar disponibilidad.
                </div>
              </td>
              <td class="totals-box">
                <div style="background:#0f172a;color:#ffffff;border-radius:14px;padding:18px;">
                  <table style="width:100%;border-collapse:collapse;" class="totals-table">
                    <tr><td class="total-label">Subtotal USD</td><td class="total-value">${formatUsd(order.totals.subtotalUsd)}</td></tr>
                    <tr><td class="total-label">Total moneda local</td><td class="total-value">${formatCurrency(order.totals.totalLocal, order.destination.currency)}</td></tr>
                    <tr><td class="total-label" style="padding-bottom:10px;">Peso total</td><td class="total-value" style="padding-bottom:10px;">${escapeHtml(order.totals.weightKg.toLocaleString('es-SV'))} kg</td></tr>
                    <tr><td class="total-final-label">Total estimado</td><td class="total-final-value">${formatUsd(order.totals.subtotalUsd)}</td></tr>
                  </table>
                </div>
              </td>
            </tr>
          </table>

          ${webView ? `
          <div style="text-align:center;margin-bottom:16px;">
            <a href="/factura/${escapeHtml(invoice.number)}/pdf"
               style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 28px;border-radius:10px;letter-spacing:.04em;">
              Descargar PDF
            </a>
          </div>` : ''}
          <p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;text-align:center;">Esta factura/comprobante fue generado electronicamente por Tierra Dorada Exportaciones.</p>
        </div>
      </div>
    </div>
  </body>
  </html>`;
}

async function prepareInvoice(order, requestBaseUrl) {
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
  const publicHtml = buildInvoiceHtml(invoice, order, qrDataUrl, logoDataUrl, { webView: true });
  saveInvoiceHtml(invoice.number, publicHtml);

  let pdfBuffer = null;
  try {
    const pdfHtml = buildInvoiceHtml(invoice, order, qrDataUrl, logoDataUrl);
    pdfBuffer = await generatePdf(pdfHtml);
    saveInvoicePdf(invoice.number, pdfBuffer);
  } catch (pdfError) {
    console.error('PDF generation failed:', pdfError.message);
  }

  return { invoice, html, qrBase64, qrCid, logoCid, logoPath, pdfBuffer };
}

async function dispatchInvoiceEmail(order, invoice, html, qrBase64, qrCid, logoCid, logoPath, pdfBuffer) {
  const fromName = process.env.INVOICE_FROM_NAME || 'Tierra Dorada Exportaciones';

  if (process.env.RESEND_API_KEY) {
    const qrDataUrl = `data:image/png;base64,${qrBase64}`;
    const logoDataUrl = fs.existsSync(logoPath)
      ? `data:image/jpeg;base64,${fs.readFileSync(logoPath).toString('base64')}`
      : '';
    const emailHtml = buildInvoiceHtml(invoice, order, qrDataUrl, logoDataUrl);
    const attachments = pdfBuffer
      ? [{ filename: `${invoice.number}.pdf`, content: pdfBuffer.toString('base64') }]
      : [];
    const payload = JSON.stringify({
      from: `${fromName} <onboarding@resend.dev>`,
      to: [order.customer.email],
      subject: `Factura ${invoice.number} - Tierra Dorada`,
      html: emailHtml,
      attachments
    });
    await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.resend.com',
        path: '/emails',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(JSON.parse(body));
          else reject(new Error(`Resend error ${res.statusCode}: ${body}`));
        });
      });
      req.setTimeout(15000, () => req.destroy(new Error('Resend timeout')));
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
    return;
  }

  const fromEmail = process.env.INVOICE_FROM_EMAIL || process.env.SMTP_USER;
  const transporter = await getTransporter();
  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: order.customer.email,
    subject: `Factura ${invoice.number} - Tierra Dorada`,
    html,
    attachments: [
      { filename: `${invoice.number}-qr.png`, content: Buffer.from(qrBase64, 'base64'), cid: qrCid },
      { filename: 'tierra-dorada-logo.jpg', path: logoPath, cid: logoCid },
      { filename: `${invoice.number}.html`, content: html, contentType: 'text/html; charset=utf-8' },
      ...(pdfBuffer ? [{ filename: `${invoice.number}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }] : [])
    ]
  });
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

function paypalConfig() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const env = process.env.PAYPAL_ENV || 'sandbox';
  const baseUrl = env === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  return { clientId, clientSecret, baseUrl, enabled: Boolean(clientId && clientSecret) };
}

function getPayPalAccessToken() {
  const config = paypalConfig();
  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
  const body = 'grant_type=client_credentials';
  return new Promise((resolve, reject) => {
    const url = new URL(`${config.baseUrl}/v1/oauth2/token`);
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      }
    }, response => {
      let responseBody = '';
      response.on('data', chunk => { responseBody += chunk; });
      response.on('end', () => {
        try {
          const data = JSON.parse(responseBody);
          if (data.access_token) resolve(data.access_token);
          else reject(new Error(data.error_description || 'No access_token de PayPal'));
        } catch { reject(new Error('Respuesta invalida de PayPal')); }
      });
    });
    req.setTimeout(10000, () => req.destroy(new Error('PayPal token timeout')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function paypalApiRequest(method, endpoint, payload, accessToken) {
  const config = paypalConfig();
  const body = payload && Object.keys(payload).length > 0 ? JSON.stringify(payload) : null;
  return new Promise((resolve, reject) => {
    const url = new URL(`${config.baseUrl}${endpoint}`);
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    if (body) headers['Content-Length'] = Buffer.byteLength(body);
    const req = https.request(url, { method, headers }, response => {
      let responseBody = '';
      response.on('data', chunk => { responseBody += chunk; });
      response.on('end', () => {
        let data = null;
        try { data = responseBody ? JSON.parse(responseBody) : null; } catch { data = responseBody; }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error((data && (data.message || data.error_description)) || `PayPal HTTP ${response.statusCode}`));
          return;
        }
        resolve(data);
      });
    });
    req.setTimeout(15000, () => req.destroy(new Error('PayPal API timeout')));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
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

      // 1. Genera numero, QR y HTML de factura â€” siempre
      const prepared = await prepareInvoice(order, requestBaseUrl);
      const { invoice } = prepared;

      // 2. Guarda en Supabase â€” independiente del email
      let savedOrder = null;
      let databaseWarning = null;
      try {
        savedOrder = await saveOrderToSupabase(order, invoice, requestBaseUrl);
      } catch (databaseError) {
        databaseWarning = databaseError.message;
      }

      // 3. Envia email â€” si falla el pedido ya esta guardado
      let emailWarning = null;
      try {
        await dispatchInvoiceEmail(order, invoice, prepared.html, prepared.qrBase64, prepared.qrCid, prepared.logoCid, prepared.logoPath, prepared.pdfBuffer);
      } catch (emailError) {
        emailWarning = emailError.message;
      }

      sendJson(res, 200, { ok: true, invoice, order: savedOrder, databaseWarning, emailWarning });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message });
    }
    return;
  }

  if (req.url.startsWith('/api/contact')) {
    if (req.method !== 'POST') {
      sendJson(res, 405, { ok: false, error: 'Metodo no permitido' });
      return;
    }

    try {
      const contact = await readJsonBody(req);
      if (!String(contact.name || '').trim() || !String(contact.email || '').trim() || !String(contact.message || '').trim()) {
        sendJson(res, 400, { ok: false, error: 'Nombre, correo y mensaje son obligatorios.' });
        return;
      }
      const savedContact = await saveContactToSupabase(contact);
      sendJson(res, 200, { ok: true, contact: savedContact });
    } catch (error) {
      console.error('Contact API error:', error.message);
      sendJson(res, 500, { ok: false, error: 'Error interno del servidor.' });
    }
    return;
  }

  if (req.url === '/api/paypal/create-order' && req.method === 'POST') {
    try {
      const config = paypalConfig();
      if (!config.enabled) {
        sendJson(res, 503, { ok: false, error: 'PayPal no configurado. Agrega PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET al .env.' });
        return;
      }
      const body = await readJsonBody(req);
      const amount = Number(body.amount || 0).toFixed(2);
      if (Number(amount) <= 0) {
        sendJson(res, 400, { ok: false, error: 'Monto invalido.' });
        return;
      }
      const accessToken = await getPayPalAccessToken();
      const order = await paypalApiRequest('POST', '/v2/checkout/orders', {
        intent: 'CAPTURE',
        purchase_units: [{ amount: { currency_code: 'USD', value: amount }, description: 'Tierra Dorada - Cacao Tostado' }]
      }, accessToken);
      sendJson(res, 200, { ok: true, id: order.id });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message });
    }
    return;
  }

  if (req.url === '/api/paypal/capture-order' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const { orderID } = body;
      if (!orderID) {
        sendJson(res, 400, { ok: false, error: 'orderID requerido.' });
        return;
      }
      const accessToken = await getPayPalAccessToken();
      const capture = await paypalApiRequest('POST', `/v2/checkout/orders/${orderID}/capture`, {}, accessToken);
      sendJson(res, 200, { ok: true, capture });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message });
    }
    return;
  }

  if (req.url.includes('/pdf') && req.url.startsWith('/factura/')) {
    await serveInvoicePdf(req, res);
    return;
  }

  if (req.url.startsWith('/factura/')) {
    await serveInvoice(req, res);
    return;
  }

  serveFile(req, res);
});

server.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    console.error(`El puerto ${PORT} ya esta en uso. Abre http://localhost:${PORT}/Frontend/carrito.html si el servidor ya esta corriendo, o ejecuta: npm run start:3001`);
    process.exit(1);
  }
  throw error;
});

server.listen(PORT, () => {
  console.log(`Tierra Dorada backend running at http://localhost:${PORT}`);
});

