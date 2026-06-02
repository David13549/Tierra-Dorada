const products = {
  nat: {
    name: 'Cacao natural',
    price: 12.50,
    image: 'img/cacao-natural.png',
    specs: 'Sin procesar · Alto en antioxidantes'
  },
  fer: {
    name: 'Cacao fermentado',
    price: 16.00,
    image: 'img/cacao-fermentado.png',
    specs: 'Afrutado · Artesanal · Más pedido'
  },
  tos: {
    name: 'Cacao tostado',
    price: 19.00,
    image: 'img/cacao-tostado.png',
    specs: 'Tostado controlado · Aroma intenso · Premium'
  }
};

const orderTypeLabels = {
  personal: 'Consumo',
  mayoreo: 'Mayoreo',
  exportacion: 'Exportación'
};

let checkoutDetailsOpen = false;

function getCart() {
  return JSON.parse(localStorage.getItem('tdCart') || '{"nat":0,"fer":0,"tos":0}');
}

function saveCart(cart) {
  localStorage.setItem('tdCart', JSON.stringify(cart));
}

function cartItems() {
  return Object.entries(getCart()).filter(([, qty]) => qty > 0);
}

function totalItems() {
  return cartItems().reduce((sum, [, qty]) => sum + qty, 0);
}

function changeQty(product, delta) {
  const cart = getCart();
  cart[product] = Math.max(0, (cart[product] || 0) + delta);
  saveCart(cart);
  if (totalItems() === 0) hideCheckoutDetails();
  renderCart();
}

function setOrderType(type) {
  const input = document.querySelector(`input[name="tipoPedido"][value="${type}"]`);
  if (input) input.checked = true;

  document.querySelectorAll('.purchase-option').forEach(option => {
    const optionInput = option.querySelector('input[name="tipoPedido"]');
    option.classList.toggle('active', optionInput?.value === type);
  });

  document.getElementById('tipo-seleccionado').textContent = orderTypeLabels[type];
}

function showCheckoutDetails() {
  checkoutDetailsOpen = true;
  document.getElementById('checkout-details').classList.add('open');
  document.getElementById('step-productos').classList.add('complete');
  document.getElementById('step-datos').classList.add('active');
  updateCheckoutButton();
  setTimeout(() => document.getElementById('inp-nombre').focus(), 120);
}

function hideCheckoutDetails() {
  checkoutDetailsOpen = false;
  document.getElementById('checkout-details').classList.remove('open');
  document.getElementById('step-productos').classList.remove('complete');
  document.getElementById('step-datos').classList.remove('active');
  updateCheckoutButton();
}

function updateCheckoutButton() {
  const button = document.getElementById('btn-confirmar');
  const hasProducts = totalItems() > 0;
  button.disabled = !hasProducts;
  button.textContent = hasProducts
    ? (checkoutDetailsOpen ? 'Confirmar pedido →' : 'Continuar con mis datos →')
    : 'Agrega productos para continuar';
}

function renderCart() {
  const items = cartItems();
  const cartContainer = document.getElementById('cart-items');
  const summaryContainer = document.getElementById('resumen-items');
  const subtotal = items.reduce((sum, [id, qty]) => sum + products[id].price * qty, 0);

  if (items.length === 0) {
    cartContainer.innerHTML = '<p class="cart-empty">Tu carrito está vacío. Agrega productos desde el catálogo para verlos aquí.</p>';
    summaryContainer.innerHTML = '<p class="resumen-empty">Agrega productos para ver el resumen</p>';
  } else {
    cartContainer.innerHTML = items.map(([id, qty]) => `
      <div class="prod-row in-cart" data-product="${id}">
        <div class="prod-row-icon" style="background-image:url('${products[id].image}')"></div>
        <div class="prod-row-info">
          <p class="prod-row-name">${products[id].name}</p>
          <p class="prod-row-price">$${products[id].price.toFixed(2)} / 500g · ${products[id].specs}</p>
        </div>
        <div class="qty-ctrl">
          <button class="qty-btn" onclick="changeQty('${id}', -1)">−</button>
          <span class="qty-num">${qty}</span>
          <button class="qty-btn" onclick="changeQty('${id}', 1)">+</button>
        </div>
      </div>
    `).join('');

    summaryContainer.innerHTML = items.map(([id, qty]) => `
      <div class="resumen-item">
        <span class="resumen-item-name">${products[id].name} × ${qty}</span>
        <span class="resumen-item-val">$${(products[id].price * qty).toFixed(2)}</span>
      </div>
    `).join('');
  }

  document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
  document.getElementById('total').textContent = `$${subtotal.toFixed(2)}`;
  document.getElementById('envio').textContent = subtotal > 0 ? 'A coordinar' : '—';
  document.getElementById('cart-count').textContent = totalItems();
  document.getElementById('cart-count').classList.toggle('has-items', totalItems() > 0);
  updateCheckoutButton();
  highlightRequestedProduct();
}

function highlightRequestedProduct() {
  const id = new URLSearchParams(window.location.search).get('producto');
  if (!id) return;
  const row = document.querySelector(`[data-product="${id}"]`);
  if (!row) return;
  setTimeout(() => {
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row.classList.add('cart-row-highlight');
    setTimeout(() => row.classList.remove('cart-row-highlight'), 1600);
  }, 120);
}

function handleCheckoutAction() {
  if (totalItems() === 0) {
    alert('Por favor agrega al menos un producto antes de continuar.');
    return;
  }
  if (!checkoutDetailsOpen) {
    showCheckoutDetails();
    return;
  }
  confirmarPedido();
}

function confirmarPedido() {
  const nombre = document.getElementById('inp-nombre').value.trim();
  const email = document.getElementById('inp-email').value.trim();
  const tel = document.getElementById('inp-tel').value.trim();
  const tipo = document.querySelector('input[name="tipoPedido"]:checked')?.value || 'personal';
  const items = cartItems();
  const total = items.reduce((sum, [id, qty]) => sum + products[id].price * qty, 0);

  if (!nombre) {
    alert('Por favor ingresa tu nombre completo.');
    document.getElementById('inp-nombre').focus();
    return;
  }
  if (!email && !tel) {
    alert('Por favor ingresa al menos un método de contacto.');
    document.getElementById('inp-email').focus();
    return;
  }

  document.getElementById('order-success').innerHTML = `
    <div class="success-icon">✓</div>
    <p class="success-title">¡Pedido enviado!</p>
    <p class="success-sub">Hola <strong>${nombre}</strong>, recibimos tu pedido de <strong>${orderTypeLabels[tipo]}</strong> por <strong>$${total.toFixed(2)}</strong>. Te contactaremos pronto para coordinar.</p>
    <button class="btn-primary" style="margin-top:14px;width:100%" onclick="resetCart()">Hacer otro pedido</button>
  `;
  document.getElementById('order-success').style.display = 'block';
  document.getElementById('btn-confirmar').style.display = 'none';
}

function resetCart() {
  saveCart({ nat: 0, fer: 0, tos: 0 });
  ['inp-nombre', 'inp-email', 'inp-tel', 'inp-pais', 'inp-notas'].forEach(id => {
    document.getElementById(id).value = '';
  });
  setOrderType('personal');
  hideCheckoutDetails();
  document.getElementById('order-success').style.display = 'none';
  document.getElementById('btn-confirmar').style.display = 'block';
  renderCart();
}

renderCart();
