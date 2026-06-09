const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');

if (hamburger && mobileMenu) {
  hamburger.addEventListener('click', () => mobileMenu.classList.toggle('open'));
}

function closeMobile() {
  if (mobileMenu) mobileMenu.classList.remove('open');
}

window.addEventListener('scroll', () => {
  const nav = document.getElementById('navbar');
  if (!nav) return;
  nav.style.boxShadow = window.scrollY > 10 ? '0 2px 16px rgba(76,43,8,0.18)' : 'none';
});

const MAX_SACKS = 400;
const prices = { tos: 190.00 };
const productNames = { tos: 'Cacao tostado' };

function goToProduct(product) {
  window.location.href = `producto.html?producto=${product}`;
}

function goToCart() {
  window.location.href = 'carrito.html';
}

function getStoredCart() {
  try {
    const stored = JSON.parse(localStorage.getItem('tdCart') || '{"tos":0}');
    return { tos: Math.min(MAX_SACKS, Math.max(0, Number(stored.tos || 0))) };
  } catch {
    return { tos: 0 };
  }
}

function saveStoredCart(cart) {
  localStorage.setItem('tdCart', JSON.stringify({ tos: Math.min(MAX_SACKS, Math.max(0, Number(cart.tos || 0))) }));
}

function addStoredProduct(product) {
  const cart = getStoredCart();
  if (product !== 'tos') return cart;
  if (cart.tos >= MAX_SACKS) {
    alert('El limite por contenedor es de 400 sacos de 50 kg.');
    return cart;
  }
  cart.tos += 1;
  saveStoredCart(cart);
  return cart;
}

function addProductFromCard(product, shouldGoToCart = false) {
  addStoredProduct(product);
  showCartToast(productNames[product]);
  updateCartCount();
  if (shouldGoToCart) window.location.href = `carrito.html?producto=${product}`;
}

function addToCartAndGo(product) {
  addProductFromCard(product, true);
}

function handleProductCardKey(event, product) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  goToProduct(product);
}

function updateCartCount() {
  const count = getStoredCart().tos;
  const badge = document.getElementById('cart-count');
  if (!badge) return;
  badge.textContent = count;
  badge.classList.toggle('has-items', count > 0);
}

function showCartToast(productName) {
  const toast = document.getElementById('cart-toast');
  if (!toast) return;
  toast.textContent = `${productName} agregado al carrito`;
  toast.classList.add('show');
  clearTimeout(showCartToast.timeoutId);
  showCartToast.timeoutId = setTimeout(() => toast.classList.remove('show'), 1800);
}

updateCartCount();

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.product-card, .value-card, .process-step, .mv-card, .export-card').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  observer.observe(el);
});
