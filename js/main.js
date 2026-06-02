/* =============================================
   TIERRA DORADA EXPORTACIONES — main.js
   ============================================= */

// === NAVBAR MOBILE ===
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');

hamburger.addEventListener('click', () => {
  mobileMenu.classList.toggle('open');
});

function closeMobile() {
  mobileMenu.classList.remove('open');
}

// Sticky nav shadow on scroll
window.addEventListener('scroll', () => {
  const nav = document.getElementById('navbar');
  if (window.scrollY > 10) {
    nav.style.boxShadow = '0 2px 16px rgba(76,43,8,0.18)';
  } else {
    nav.style.boxShadow = 'none';
  }
});

// === SCROLL TO PEDIDO ===
function scrollToPedido() {
  document.getElementById('pedido').scrollIntoView({ behavior: 'smooth' });
}

// === ORDER FORM ===
const prices = { nat: 12.50, fer: 16.00, tos: 19.00 };
const productNames = {
  nat: 'Cacao natural',
  fer: 'Cacao fermentado',
  tos: 'Cacao tostado'
};
const qty = { nat: 0, fer: 0, tos: 0 };

function changeQty(product, delta) {
  qty[product] = Math.max(0, qty[product] + delta);
  document.getElementById('qty-' + product).textContent = qty[product];
  updateSummary();
}

function updateSummary() {
  let subtotal = 0;
  Object.keys(qty).forEach(k => { subtotal += qty[k] * prices[k]; });

  const items = Object.keys(qty).filter(k => qty[k] > 0);
  const container = document.getElementById('resumen-items');

  if (items.length === 0) {
    container.innerHTML = '<p class="resumen-empty">Agrega productos para ver el resumen</p>';
  } else {
    container.innerHTML = items.map(k => `
      <div class="resumen-item">
        <span class="resumen-item-name">${productNames[k]} × ${qty[k]}</span>
        <span class="resumen-item-val">$${(qty[k] * prices[k]).toFixed(2)}</span>
      </div>
    `).join('');
  }

  document.getElementById('subtotal').textContent = '$' + subtotal.toFixed(2);
  document.getElementById('total').textContent = '$' + subtotal.toFixed(2);
  document.getElementById('envio').textContent = subtotal > 0 ? 'A coordinar' : '—';
}

function confirmarPedido() {
  const nombre = document.getElementById('inp-nombre').value.trim();
  const email  = document.getElementById('inp-email').value.trim();
  const tel    = document.getElementById('inp-tel').value.trim();
  const pais   = document.getElementById('inp-pais').value.trim();
  const tipo   = document.getElementById('inp-tipo').value;
  const notas  = document.getElementById('inp-notas').value.trim();

  const items = Object.keys(qty).filter(k => qty[k] > 0);

  // Validaciones
  if (items.length === 0) {
    alert('Por favor agrega al menos un producto antes de confirmar.');
    return;
  }
  if (!nombre) {
    alert('Por favor ingresa tu nombre completo.');
    document.getElementById('inp-nombre').focus();
    return;
  }
  if (!email && !tel) {
    alert('Por favor ingresa al menos un método de contacto (correo o teléfono).');
    document.getElementById('inp-email').focus();
    return;
  }

  // Calcular total
  let total = 0;
  items.forEach(k => { total += qty[k] * prices[k]; });

  // Generar número de pedido
  const orderNum = 'TD-' + Date.now().toString().slice(-6);

  // Mostrar confirmación
  const summaryEl = document.getElementById('order-success');
  summaryEl.innerHTML = `
    <div class="success-icon">✓</div>
    <p class="success-title">¡Pedido enviado!</p>
    <p style="font-size:12px;color:#84593D;background:#F0E8DC;padding:8px 12px;border-radius:6px;margin:10px 0;font-weight:500">
      Pedido # ${orderNum}
    </p>
    <p class="success-sub">
      Hola <strong>${nombre}</strong>, recibimos tu pedido por
      <strong>$${total.toFixed(2)}</strong>.
      ${email ? `Te escribiremos a <strong>${email}</strong>` : `Te contactaremos al <strong>${tel}</strong>`}
      para confirmar disponibilidad y coordinar el envío.
    </p>
    <button class="btn-primary" style="margin-top:14px;width:100%" onclick="resetForm()">Hacer otro pedido</button>
  `;
  summaryEl.style.display = 'block';

  // Ocultar botón confirmar
  document.getElementById('btn-confirmar').style.display = 'none';

  // Log del pedido en consola (útil para integrar con backend)
  console.log('=== NUEVO PEDIDO TIERRA DORADA ===');
  console.log('Número:', orderNum);
  console.log('Cliente:', nombre);
  console.log('Email:', email || 'No indicado');
  console.log('Teléfono:', tel || 'No indicado');
  console.log('País:', pais || 'No indicado');
  console.log('Tipo:', tipo || 'No especificado');
  console.log('Notas:', notas || 'Ninguna');
  console.log('Productos:', items.map(k => `${qty[k]}x ${productNames[k]}`).join(', '));
  console.log('Total: $' + total.toFixed(2));
}

function resetForm() {
  // Reset cantidades
  Object.keys(qty).forEach(k => {
    qty[k] = 0;
    document.getElementById('qty-' + k).textContent = 0;
  });

  // Reset campos
  ['inp-nombre','inp-email','inp-tel','inp-pais','inp-notas'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('inp-tipo').value = '';

  // Reset summary
  updateSummary();

  // Reset UI
  document.getElementById('order-success').style.display = 'none';
  document.getElementById('btn-confirmar').style.display = 'block';

  // Scroll top del formulario
  document.getElementById('pedido').scrollIntoView({ behavior: 'smooth' });
}

// Si viene de un botón de producto con pendingProduct
window.addEventListener('load', () => {
  if (window.pendingProduct) {
    setTimeout(() => {
      changeQty(window.pendingProduct, 1);
      window.pendingProduct = null;
    }, 400);
  }
});

// === ANIMACIÓN DE ENTRADA (Intersection Observer) ===
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.product-card, .value-card, .process-step, .mv-card').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  observer.observe(el);
});
