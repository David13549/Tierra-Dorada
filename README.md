# Tierra Dorada Exportaciones — Sitio Web

Sitio web institucional y de ventas para **Tierra Dorada Exportaciones S.A. de C.V.**, empresa exportadora de cacao tostado desde La Unión, El Salvador.

---

## Estructura del proyecto

```
Tierra-Dorada/
├── index.html                  # Página principal (landing)
├── server.js                   # Backend Node.js (factura, PDF, correo, Supabase, PayPal)
├── package.json
├── .env                        # Variables de entorno (no se sube al repo)
├── css/
│   └── styles.css              # Todos los estilos (responsive incluido)
├── js/
│   ├── main.js                 # Interactividad de la landing (carrito, toast)
│   ├── carrito.js              # Lógica completa del checkout
│   └── producto.js             # Galería y carrito de la página de producto
├── img/                        # Imágenes (logo, productos, íconos de pago)
├── Frontend/
│   ├── carrito.html            # Página de carrito y checkout
│   ├── contacto.html           # Formulario de contacto
│   ├── producto-cacao-tostado.html
│   ├── politicas-privacidad.html
│   └── terminos-condiciones.html
└── invoices/                   # Facturas generadas (HTML + PDF, autogenerada)
```

---

## Secciones de la landing (index.html)

1. **Navbar** — fijo, con menú responsive (hamburguesa en móvil)
2. **Hero** — presentación principal con tarjetas de datos clave
3. **Productos** — catálogo con precio y botón de carrito
4. **Nosotros** — historia, misión, visión y valores
5. **Proceso** — 4 pasos: selección → fermentación → secado → tostado
6. **Exportación** — países destino y convertidor de moneda
7. **CTA Band** — llamado a exportar
8. **Footer** — links, políticas y datos de la empresa

---

## Paleta de colores

| Nombre   | Hex       |
|----------|-----------|
| Vanilla  | `#D7BDA6` |
| Caramel  | `#AB7743` |
| Almond   | `#B7957F` |
| Coffee   | `#6D3914` |
| Mocca    | `#84593D` |
| Espresso | `#4C2B08` |

---

## Cómo correr localmente

```bash
npm install
npm start
```

Abre [http://localhost:3000](http://localhost:3000) en el navegador.

> Sin el servidor, puedes abrir `index.html` directamente, pero el checkout (factura, PDF, correo y PayPal) no funcionará.

---

## Variables de entorno (.env)

Crea un archivo `.env` en la raíz (usa `.env.example` como base):

```env
# Puerto (opcional, default 3000)
PORT=3000

# SMTP — para envío de facturas por correo
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=tucorreo@gmail.com
SMTP_PASS=tu_contrasena_de_aplicacion   # En Gmail: usa una Contraseña de Aplicación

# Remitente del correo (opcional, toma SMTP_USER si se omite)
INVOICE_FROM_EMAIL=tucorreo@gmail.com
INVOICE_FROM_NAME=Tierra Dorada Exportaciones

# URL pública — necesaria para que el QR del PDF apunte al dominio correcto
PUBLIC_BASE_URL=https://tudominio.com

# PayPal
PAYPAL_CLIENT_ID=tu_paypal_client_id
PAYPAL_CLIENT_SECRET=tu_paypal_client_secret
PAYPAL_ENV=sandbox   # Cambia a "live" para producción

# Supabase
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

> **La `SUPABASE_SERVICE_ROLE_KEY` y `PAYPAL_CLIENT_SECRET` solo deben usarse en `server.js`**, nunca en archivos del navegador.

### Contraseña de aplicación de Gmail (SMTP_PASS)

Gmail no permite usar tu contraseña normal para SMTP. Debes generar una **Contraseña de Aplicación**:

1. Ve a [myaccount.google.com/security](https://myaccount.google.com/security)
2. Activa la **Verificación en dos pasos** (si no la tienes)
3. Busca **Contraseñas de aplicación** → elige "Correo" y "Otro (nombre personalizado)"
4. Copia la contraseña de 16 caracteres y úsala como `SMTP_PASS`

---

## PayPal

El backend integra la **API REST de PayPal** (v2 Checkout) para pagos en línea.

### Configuración

1. Crea una cuenta en [developer.paypal.com](https://developer.paypal.com)
2. En **My Apps & Credentials**, crea una aplicación
3. Copia el **Client ID** y el **Client Secret** de la app
4. Ponlos en el `.env`:

```env
PAYPAL_CLIENT_ID=AaBbCc...
PAYPAL_CLIENT_SECRET=XxYyZz...
PAYPAL_ENV=sandbox   # "sandbox" para pruebas, "live" para producción
```

### Flujo de pago PayPal

```
Frontend                           Backend
   |                                  |
   |-- POST /api/paypal/create-order ->|  Crea la orden en PayPal y devuelve { id }
   |<-- { ok: true, id: "..." } -------|
   |                                  |
   | (botón PayPal SDK → aprueba) |
   |                                  |
   |-- POST /api/paypal/capture-order->|  Captura el pago con el orderID
   |<-- { ok: true, capture: {...} } --|
   |                                  |
   |-- POST /api/invoice-email ------->|  Genera factura + PDF y envía correo
```

### Cuentas de prueba (Sandbox)

En [developer.paypal.com → Sandbox → Accounts](https://developer.paypal.com/dashboard/accounts) encontrarás cuentas de comprador y vendedor de prueba para simular pagos sin dinero real.

---

## Factura electrónica y PDF

Al completar un pedido, el servidor:

1. Genera un número de factura único (`TD-YYYYMMDDHHMMSS-XXXX`) y un código QR
2. Crea el HTML de la factura con diseño responsive (para correo y vista web)
3. **Genera un PDF** con Puppeteer (Chromium headless) y lo guarda en `invoices/`
4. Guarda el HTML y el PDF en disco y el registro en Supabase
5. Envía el correo al cliente con el **PDF adjunto**

El cliente puede:
- Ver la factura en el navegador: `/factura/<numero>`
- Descargar el PDF desde el botón **"Descargar PDF"** en la vista web
- Descargar el PDF directamente: `/factura/<numero>/pdf`

> Si el PDF no existe aún (facturas antiguas), la ruta `/pdf` lo genera al vuelo desde el HTML guardado.

---

## Base de datos (Supabase)

El esquema SQL se encuentra en:

```
supabase/migrations/202606090001_tierra_dorada_core.sql
```

Tablas:

| Tabla              | Descripción                                      |
|--------------------|--------------------------------------------------|
| `products`         | Catálogo de productos                            |
| `customers`        | Compradores/contactos registrados en el checkout |
| `orders`           | Pedidos con factura y estado                     |
| `order_items`      | Detalle de productos por pedido                  |
| `payments`         | Método y estado del pago                         |
| `invoices`         | HTML de la factura electrónica (respaldo)        |
| `contact_messages` | Solicitudes del formulario de contacto           |

Ejecuta la migración desde el **SQL Editor de Supabase** o con la CLI:

```bash
supabase db push
```

---

## Flujo del checkout

1. El cliente agrega sacos al carrito y elige país/moneda
2. Ingresa sus datos de contacto y método de pago (tarjeta / PayPal / efectivo)
3. Si elige **PayPal**: el SDK de PayPal abre el popup de pago → se captura el pago vía API
4. Al confirmar, el servidor:
   - Genera número de factura, QR y factura HTML responsive
   - **Genera el PDF de la factura** con Puppeteer
   - Guarda HTML + PDF en `invoices/` y el registro en Supabase
   - Envía el correo al cliente con la factura y el **PDF adjunto**
5. El cliente ve su factura en `/factura/<numero>` y puede descargar el PDF

---

## APIs del servidor

| Método | Ruta                           | Descripción                                         |
|--------|--------------------------------|-----------------------------------------------------|
| GET    | `/api/rates`                   | Tasas de cambio (USD base, desde open.er-api.com)   |
| POST   | `/api/invoice-email`           | Genera factura + PDF y envía correo al cliente      |
| POST   | `/api/contact`                 | Guarda un mensaje de contacto en Supabase           |
| POST   | `/api/paypal/create-order`     | Crea una orden de pago en PayPal, devuelve `id`     |
| POST   | `/api/paypal/capture-order`    | Captura el pago aprobado de PayPal                  |
| GET    | `/factura/:numero`             | Sirve la factura HTML con botón de descarga PDF     |
| GET    | `/factura/:numero/pdf`         | Descarga la factura en formato PDF                  |

---

**Tierra Dorada Exportaciones S.A. de C.V. · La Unión, El Salvador · 2026**
