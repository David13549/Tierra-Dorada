const products = {
  nat: {
    name: 'Cacao Natural',
    price: 12.50,
    image: 'img/cacao-natural.png',
    eyebrow: 'Sin procesar',
    desc: 'Semillas frescas del fruto, conservando antioxidantes, minerales y el perfil natural del cacao salvadoreño.',
    tags: ['Sin procesar', 'Antioxidantes', 'Natural'],
    specs: ['Textura fresca', 'Ideal para transformación', 'Origen salvadoreño']
  },
  fer: {
    name: 'Cacao Fermentado',
    price: 16.00,
    image: 'img/cacao-fermentado.png',
    eyebrow: 'Más pedido',
    desc: 'Fermentación artesanal con notas afrutadas y dulces para un sabor más complejo y profundo.',
    tags: ['Afrutado', 'Artesanal', 'Gourmet'],
    specs: ['Perfil aromático', 'Proceso controlado', 'Ideal para chocolatería']
  },
  tos: {
    name: 'Cacao Tostado',
    price: 19.00,
    image: 'img/cacao-tostado.png',
    eyebrow: 'Premium',
    desc: 'Tostado controlado para máximo aroma, textura crujiente y sabor intenso. Listo para consumo o exportación.',
    tags: ['Premium', 'Export', 'Sin conservantes'],
    specs: ['Aroma intenso', 'Textura crujiente', 'Listo para consumo']
  }
};

const params = new URLSearchParams(window.location.search);
const currentId = products[params.get('producto')] ? params.get('producto') : 'nat';

function getCart() {
  return JSON.parse(localStorage.getItem('tdCart') || '{"nat":0,"fer":0,"tos":0}');
}

function saveCart(cart) {
  localStorage.setItem('tdCart', JSON.stringify(cart));
}

function updateCartBadge() {
  const cart = getCart();
  const count = Object.values(cart).reduce((sum, value) => sum + value, 0);
  document.getElementById('cart-count').textContent = count;
  document.getElementById('cart-count').classList.toggle('has-items', count > 0);
}

function addProduct(id) {
  const cart = getCart();
  cart[id] = (cart[id] || 0) + 1;
  saveCart(cart);
  updateCartBadge();
  const toast = document.getElementById('cart-toast');
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

function openProduct(id) {
  window.location.href = `producto.html?producto=${id}`;
}

function renderProduct() {
  const product = products[currentId];
  document.title = `${product.name} - Tierra Dorada`;
  document.getElementById('product-image').src = product.image;
  document.getElementById('product-image').alt = product.name;
  document.getElementById('product-eyebrow').textContent = product.eyebrow;
  document.getElementById('product-title').textContent = product.name;
  document.getElementById('product-desc').textContent = product.desc;
  document.getElementById('product-price').innerHTML = `$${product.price.toFixed(2)} <span>/ 500g</span>`;
  document.getElementById('product-tags').innerHTML = product.tags.map(tag => `<span class="tag">${tag}</span>`).join('');

  document.querySelector('.product-detail-panel').innerHTML = product.specs.map(spec => `
    <div>
      <p class="detail-label">Detalle</p>
      <strong>${spec}</strong>
    </div>
  `).join('');

  document.getElementById('related-products').innerHTML = Object.entries(products)
    .filter(([id]) => id !== currentId)
    .map(([id, item]) => `
      <div class="product-card" onclick="openProduct('${id}')">
        <div class="product-img" style="background-image:linear-gradient(rgba(76,43,8,0.08), rgba(76,43,8,0.18)), url('${item.image}')"></div>
        <div class="product-body">
          <div class="product-name">${item.name}</div>
          <p class="product-desc">${item.desc}</p>
          <div class="product-footer">
            <div class="product-price">$${item.price.toFixed(2)} <span>/ 500g</span></div>
            <button class="btn-cart" onclick="event.stopPropagation(); addProduct('${id}')">Agregar</button>
          </div>
        </div>
      </div>
    `).join('');
}

renderProduct();
updateCartBadge();
