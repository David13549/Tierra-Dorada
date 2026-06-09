# Tierra Dorada Exportaciones — Sitio Web

## Estructura del proyecto

```
tierra_dorada/
├── index.html          # Página principal
├── css/
│   └── styles.css      # Todos los estilos
├── js/
│   └── main.js         # Lógica e interactividad
├── img/                # Carpeta para tus imágenes
└── README.md
```

## Secciones incluidas

1. **Navbar** — fijo con menú responsive (hamburguesa en móvil)
2. **Hero** — presentación principal con tarjetas de datos
3. **Productos** — catálogo de 3 variedades con precios
4. **Nosotros** — historia, misión, visión y valores
5. **Proceso** — 4 pasos: selección → fermentación → secado → tostado
6. **Formulario de pedido** — con carrito interactivo y validación
7. **CTA Band** — llamado a exportación
8. **Footer** — links y datos de la empresa

## Paleta de colores

| Nombre   | Hex       |
|----------|-----------|
| Vanilla  | `#D7BDA6` |
| Caramel  | `#AB7743` |
| Almond   | `#B7957F` |
| Coffee   | `#6D3914` |
| Mocca    | `#84593D` |
| Espresso | `#4C2B08` |

## Cómo agregar imágenes

1. Coloca tus imágenes en la carpeta `img/`
2. En `index.html` reemplaza los emojis en `.product-img` con `<img src="img/tu-imagen.jpg" alt="...">`
3. Para el hero, agrega un `background-image` en `.hero` dentro de `styles.css`

## Cómo integrar con backend / WhatsApp

En `js/main.js`, dentro de `confirmarPedido()`, después de las validaciones puedes:

```javascript
// Enviar a WhatsApp
const mensaje = encodeURIComponent(`Pedido #${orderNum}\nNombre: ${nombre}\nProductos: ...\nTotal: $${total}`);
window.open(`https://wa.me/50300000000?text=${mensaje}`);

// O enviar a un endpoint
fetch('/api/pedidos', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ nombre, email, tel, items, total })
});
```

## Para correr localmente

Solo abre `index.html` en tu navegador. No requiere servidor para la versión básica.

## Backend y Supabase

Para el checkout con factura, correo y Supabase, usa el servidor:

```bash
npm install
npm start
```

Luego abre `http://localhost:3000`.

La base de datos esta definida en:

```text
supabase/migrations/202606090001_tierra_dorada_core.sql
```

Tablas incluidas:

- `products`: catalogo de productos.
- `customers`: compradores/contactos del checkout.
- `orders`: pedidos exportadores y factura asociada.
- `order_items`: detalle de productos por pedido.
- `payments`: metodo y estado del pago simulado.
- `contact_messages`: solicitudes enviadas desde `contactenos.html`.

Variables necesarias en `.env` local y en los secretos del hosting/GitHub:

```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

La `service_role_key` debe usarse solo en `server.js`, nunca en archivos del navegador. Ejecuta la migracion SQL desde Supabase SQL Editor o con Supabase CLI.

---
**Tierra Dorada Exportaciones S.A. de C.V. · La Unión, El Salvador · 2025**
