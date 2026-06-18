# Tierra Dorada Exportaciones — Sitio Web

Sitio web institucional y de ventas para **Tierra Dorada Exportaciones S.A. de C.V.**, empresa exportadora de cacao tostado desde La Unión, El Salvador.

---

## Estructura del proyecto

```
Tierra-Dorada/
├── index.html                  # Página principal (landing)
├── server.js                   # Backend Node.js (factura, correo, Supabase)
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
└── invoices/                   # Facturas HTML generadas (autogenerada)
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

> Sin el servidor, puedes abrir `index.html` directamente, pero el checkout (factura y correo) no funcionará.

---

## Variables de entorno (.env)

Crea un archivo `.env` en la raíz con:

```env
# Supabase
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key

# SMTP (para envío de facturas por correo)
SMTP_USER=tucorreo@gmail.com
SMTP_PASS=tu_app_password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true

# Opcional
INVOICE_FROM_EMAIL=tucorreo@gmail.com
INVOICE_FROM_NAME=Tierra Dorada Exportaciones
PUBLIC_BASE_URL=https://tudominio.com
```

> **La `SUPABASE_SERVICE_ROLE_KEY` solo debe usarse en `server.js`**, nunca en archivos del navegador.

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
| `payments`         | Método y estado del pago simulado                |
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
3. Al confirmar, el servidor:
   - Genera un número de factura y código QR
   - Guarda el pedido en Supabase (`customers`, `orders`, `order_items`, `payments`)
   - Guarda la factura HTML en disco (`invoices/`) y en Supabase
   - Envía la factura al correo del cliente vía SMTP
4. El cliente puede ver su factura en `/factura/<numero>`

---

## APIs del servidor

| Método | Ruta                | Descripción                                  |
|--------|---------------------|----------------------------------------------|
| GET    | `/api/rates`        | Tasas de cambio (USD base, desde open.er-api.com) |
| POST   | `/api/invoice-email`| Genera y envía la factura electrónica        |
| POST   | `/api/contact`      | Guarda un mensaje de contacto en Supabase    |
| GET    | `/factura/:numero`  | Sirve una factura HTML por número            |

---

**Tierra Dorada Exportaciones S.A. de C.V. · La Unión, El Salvador · 2026**
