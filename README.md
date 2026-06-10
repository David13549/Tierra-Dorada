# Tierra Dorada Exportaciones â€” Sitio Web

## Estructura del proyecto

```
tierra_dorada/
â”œâ”€â”€ index.html          # PÃ¡gina principal
â”œâ”€â”€ css/
â”‚   â””â”€â”€ styles.css      # Todos los estilos
â”œâ”€â”€ js/
â”‚   â””â”€â”€ main.js         # LÃ³gica e interactividad
â”œâ”€â”€ img/                # Carpeta para tus imÃ¡genes
â””â”€â”€ README.md
```

## Secciones incluidas

1. **Navbar** â€” fijo con menÃº responsive (hamburguesa en mÃ³vil)
2. **Hero** â€” presentaciÃ³n principal con tarjetas de datos
3. **Productos** â€” catÃ¡logo de 3 variedades con precios
4. **Nosotros** â€” historia, misiÃ³n, visiÃ³n y valores
5. **Proceso** â€” 4 pasos: selecciÃ³n â†’ fermentaciÃ³n â†’ secado â†’ tostado
6. **Formulario de pedido** â€” con carrito interactivo y validaciÃ³n
7. **CTA Band** â€” llamado a exportaciÃ³n
8. **Footer** â€” links y datos de la empresa

## Paleta de colores

| Nombre   | Hex       |
|----------|-----------|
| Vanilla  | `#D7BDA6` |
| Caramel  | `#AB7743` |
| Almond   | `#B7957F` |
| Coffee   | `#6D3914` |
| Mocca    | `#84593D` |
| Espresso | `#4C2B08` |

## CÃ³mo agregar imÃ¡genes

1. Coloca tus imÃ¡genes en la carpeta `img/`
2. En `index.html` reemplaza los emojis en `.product-img` con `<img src="img/tu-imagen.jpg" alt="...">`
3. Para el hero, agrega un `background-image` en `.hero` dentro de `styles.css`

## CÃ³mo integrar con backend / WhatsApp

En `js/main.js`, dentro de `confirmarPedido()`, despuÃ©s de las validaciones puedes:

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

Solo abre `index.html` en tu navegador. No requiere servidor para la versiÃ³n bÃ¡sica.

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
**Tierra Dorada Exportaciones S.A. de C.V. Â· La UniÃ³n, El Salvador Â· 2026**

