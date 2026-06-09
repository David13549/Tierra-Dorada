const MAX_SACKS = 400;
const products = {
  tos: {
    name: 'Cacao Tostado',
    price: 190.00,
    image: 'img/cacao-tostado.png',
    images: [
      'img/cacao-tostado.png',
      'img/cacao-tostado-detalle-2.png',
      'img/cacao-tostado-detalle-3.png'
    ],
    desc: 'Cacao tostado salvadoreno en saco de 50 kg. Tostado controlado para maximo aroma, textura crujiente y sabor intenso. Preparado para exportacion internacional.',
    specs: [
      ['Presentacion', 'Saco de 50 kg'],
      ['Origen', 'El Salvador'],
      ['Precio base', 'USD']
    ]
  }
};

const currentId = 'tos';
let galleryIndex = 0;
let galleryTimer = null;
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

function showGalleryImage(index) {
  const product = products[currentId];
  const images = product.images || [product.image];
  const image = document.getElementById('product-image');
  if (!image || !images.length) return;

  galleryIndex = (index + images.length) % images.length;
  image.src = images[galleryIndex];
  image.alt = `${product.name} - vista ${galleryIndex + 1}`;
  image.classList.remove('is-changing');
  void image.offsetWidth;
  image.classList.add('is-changing');

  document.querySelectorAll('.gallery-dot').forEach((dot, dotIndex) => {
    dot.classList.toggle('active', dotIndex === galleryIndex);
  });
}

function renderGalleryDots() {
  const product = products[currentId];
  const images = product.images || [product.image];
  const dots = document.getElementById('product-gallery-dots');
  if (!dots || images.length <= 1) return;

  dots.innerHTML = images.map((_, index) => (
    `<button class="gallery-dot${index === 0 ? ' active' : ''}" type="button" aria-label="Ver imagen ${index + 1}" data-gallery-index="${index}"></button>`
  )).join('');

  dots.querySelectorAll('.gallery-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      showGalleryImage(Number(dot.dataset.galleryIndex || 0));
      startGallery();
    });
  });
}

function startGallery() {
  const product = products[currentId];
  const images = product.images || [product.image];
  if (galleryTimer) clearInterval(galleryTimer);
  if (images.length <= 1) return;

  galleryTimer = setInterval(() => {
    showGalleryImage(galleryIndex + 1);
  }, 5000);
}

function renderProduct() {
  const product = products[currentId];
  document.title = `${product.name} - Tierra Dorada`;
  document.getElementById('product-image').src = (product.images || [product.image])[0];
  document.getElementById('product-image').alt = product.name;
  document.getElementById('product-title').textContent = product.name;
  document.getElementById('product-desc').textContent = product.desc;
  document.getElementById('product-price').innerHTML = `$${product.price.toFixed(2)} <span>/ saco</span>`;
  document.querySelector('.product-detail-panel').innerHTML = product.specs.map(([label, value]) => `
    <div>
      <p class="detail-label">${label}</p>
      <strong>${value}</strong>
    </div>
  `).join('');
  renderGalleryDots();
  startGallery();
}

renderProduct();
updateCartBadge();
