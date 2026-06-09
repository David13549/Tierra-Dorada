const MAX_SACKS = 400;
const products = {
  tos: {
    name: 'Cacao Tostado',
    price: 190.00,
    image: 'img/cacao-tostado.png',
    eyebrow: 'Etiqueta: Premium Export',
    desc: 'Cacao tostado salvadoreno en saco de 50 kg. Tostado controlado para maximo aroma, textura crujiente y sabor intenso. Preparado para exportacion internacional.',
    tags: ['Etiqueta: Premium', 'Etiqueta: Export', 'Saco 50 kg', 'Max. 400 sacos por contenedor'],
    specs: [
      ['Presentacion', 'Saco de 50 kg'],
      ['Origen', 'El Salvador'],
      ['Contenedor', 'Hasta 400 sacos'],
      ['Peso maximo', '20,000 kg'],
      ['Destino destacado', 'Suecia'],
      ['Precio base', 'USD']
    ]
  }
};

const currentId = 'tos';
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');

if (hamburger && mobileMenu) {
  hamburger.addEventListener('click', () => mobileMenu.classList.toggle('open'));
}

function closeMobile() {
  if (mobileMenu) mobileMenu.classList.remove('open');
}

function getCart() {
  try {
    const stored = JSON.parse(localStorage.getItem('tdCart') || '{"tos":0}');
    return { tos: Math.min(MAX_SACKS, Math.max(0, Number(stored.tos || 0))) };
  } catch {
    return { tos: 0 };
  }
}

function saveCart(cart) {
  localStorage.setItem('tdCart', JSON.stringify({ tos: Math.min(MAX_SACKS, Math.max(0, Number(cart.tos || 0))) }));
}

function updateCartBadge() {
  const count = getCart().tos;
  const badge = document.getElementById('cart-count');
  if (!badge) return;
  badge.textContent = count;
  badge.classList.toggle('has-items', count > 0);
}

function addProduct(id) {
  const cart = getCart();
  if (cart.tos >= MAX_SACKS) {
    alert('El limite por contenedor es de 400 sacos de 50 kg.');
    return;
  }
  cart[id] = (cart[id] || 0) + 1;
  saveCart(cart);
  updateCartBadge();
  const toast = document.getElementById('cart-toast');
  if (!toast) return;
  toast.textContent = `${products[id].name} agregado al carrito`;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1500);
}

function addCurrentProduct() {
  addProduct(currentId);
}

function buyCurrentProduct() {
  addProduct(currentId);
  window.location.href = `carrito.html?producto=${currentId}`;
}

function renderProduct() {
  const product = products[currentId];
  document.title = `${product.name} - Tierra Dorada`;
  document.getElementById('product-image').src = product.image;
  document.getElementById('product-image').alt = product.name;
  document.getElementById('product-eyebrow').textContent = product.eyebrow;
  document.getElementById('product-title').textContent = product.name;
  document.getElementById('product-desc').textContent = product.desc;
  document.getElementById('product-price').innerHTML = `$${product.price.toFixed(2)} <span>/ saco 50 kg</span>`;
  document.getElementById('product-tags').innerHTML = product.tags.map(tag => `<span class="tag">${tag}</span>`).join('');
  document.querySelector('.product-detail-panel').innerHTML = product.specs.map(([label, value]) => `
    <div>
      <p class="detail-label">${label}</p>
      <strong>${value}</strong>
    </div>
  `).join('');
}

renderProduct();
updateCartBadge();
