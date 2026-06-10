const MAX_SACKS = 400;
const SACK_KG = 50;
const FALLBACK_RATES = {
  USD: 1, SEK: 10.55, THB: 36.72, EUR: 0.92, GBP: 0.78, CAD: 1.37, MXN: 18.15,
  GTQ: 7.80, HNL: 24.75, NIO: 36.80, CRC: 520.00, COP: 3900.00, BRL: 5.25,
  JPY: 157.00, CNY: 7.24, KRW: 1375.00, INR: 83.50, AUD: 1.51, CHF: 0.89
};

const products = {
  tos: {
    name: "Cacao tostado",
    price: 190.00,
    image: "../img/cacao-tostado.png",
    description: "Granos de cacao seleccionados y tostados, con aroma intenso y textura crujiente. Presentacion lista para exportacion en sacos de 50 kg."
  }
};

const countries = [
  ["Suecia", "SEK"], ["Tailandia", "THB"], ["Estados Unidos", "USD"], ["Canada", "CAD"],
  ["Mexico", "MXN"], ["Guatemala", "GTQ"], ["Honduras", "HNL"], ["Nicaragua", "NIO"],
  ["Costa Rica", "CRC"], ["Panama", "USD"], ["Colombia", "COP"], ["Brasil", "BRL"],
  ["Espana", "EUR"], ["Francia", "EUR"], ["Alemania", "EUR"], ["Italia", "EUR"],
  ["Reino Unido", "GBP"], ["Suiza", "CHF"], ["Japon", "JPY"], ["China", "CNY"],
  ["Corea del Sur", "KRW"], ["India", "INR"], ["Australia", "AUD"]
];

const orderTypeLabels = { exportacion: "Exportacion" };
const paymentMethodLabels = { tarjeta: "Tarjeta", paypal: "PayPal", efectivo: "Efectivo" };
const cardProcessorLabels = {
  visa: "Tarjeta",
  mastercard: "Tarjeta",
  amex: "Tarjeta",
  paypal_sandbox: "PayPal"
};

let checkoutStep = 1;
let exchangeRates = { ...FALLBACK_RATES };
let currentCountry = "Suecia";
let currentCurrency = "SEK";
let rateSource = "respaldo local";
let paypalSandboxApproved = false;
const hamburger = document.getElementById("hamburger");
const mobileMenu = document.getElementById("mobileMenu");

if (hamburger && mobileMenu) {
  hamburger.addEventListener("click", () => mobileMenu.classList.toggle("open"));
}

function closeMobile() {
  if (mobileMenu) mobileMenu.classList.remove("open");
}

function formatUsd(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function formatCurrency(value, currency) {
  return new Intl.NumberFormat("es-SV", { style: "currency", currency }).format(value);
}

function apiUrl(path) {
  const devOnlyPorts = ["5173", "5500", "5501", "8080"];
  const isFile = window.location.protocol === "file:";
  const isDevStaticServer = ["localhost", "127.0.0.1"].includes(window.location.hostname) && devOnlyPorts.includes(window.location.port);
  const base = isFile || isDevStaticServer ? "http://localhost:3000" : "";
  return `${base}${path}`;
}

function getCart() {
  try {
    const stored = JSON.parse(localStorage.getItem("tdCart") || '{"tos":0}');
    return { tos: Math.min(MAX_SACKS, Math.max(0, Number(stored.tos || 0))) };
  } catch {
    return { tos: 0 };
  }
}

function saveCart(cart) {
  localStorage.setItem("tdCart", JSON.stringify({ tos: Math.min(MAX_SACKS, Math.max(0, Number(cart.tos || 0))) }));
}

function cartItems() {
  return Object.entries(getCart()).filter(([id, qty]) => products[id] && qty > 0);
}

function totalItems() {
  return cartItems().reduce((sum, [, qty]) => sum + qty, 0);
}

function getSubtotal() {
  return cartItems().reduce((sum, [id, qty]) => sum + products[id].price * qty, 0);
}

function changeQty(product, delta) {
  const cart = getCart();
  const nextQty = Math.min(MAX_SACKS, Math.max(0, (cart[product] || 0) + delta));
  if ((cart[product] || 0) + delta > MAX_SACKS) {
    alert("El limite por contenedor es de 400 sacos de 50 kg.");
  }
  cart[product] = nextQty;
  saveCart(cart);
  if (totalItems() === 0) hideCheckoutDetails();
  renderCart();
}

function setQty(product, value) {
  const cart = getCart();
  const numericValue = Number.parseInt(value, 10);
  const nextQty = Number.isFinite(numericValue) ? Math.min(MAX_SACKS, Math.max(0, numericValue)) : 0;
  if (numericValue > MAX_SACKS) {
    alert("El limite por contenedor es de 400 sacos de 50 kg.");
  }
  cart[product] = nextQty;
  saveCart(cart);
  if (totalItems() === 0) hideCheckoutDetails();
  renderCart();
}

function setOrderType(type) {
  const input = document.querySelector(`input[name="tipoPedido"][value="${type}"]`);
  if (input) input.checked = true;
  document.querySelectorAll(".purchase-option").forEach(option => {
    const optionInput = option.querySelector('input[name="tipoPedido"]');
    option.classList.toggle("active", optionInput?.value === type);
  });
  document.getElementById("tipo-seleccionado").textContent = orderTypeLabels[type];
}

function setPaymentMethod(method) {
  const input = document.querySelector(`input[name="formaPago"][value="${method}"]`);
  if (input) input.checked = true;
  document.querySelectorAll(".payment-option").forEach(option => {
    const optionInput = option.querySelector('input[name="formaPago"]');
    option.classList.toggle("active", optionInput?.value === method);
  });
  document.getElementById("pago-seleccionado").textContent = paymentMethodLabels[method];
  const cardFields = document.getElementById("card-payment-fields");
  const directFields = document.getElementById("direct-card-fields");
  const paypalSim = document.getElementById("paypal-sandbox-sim");
  const acceptedCards = document.getElementById("accepted-card-logos");
  if (cardFields) cardFields.style.display = method === "efectivo" ? "none" : "block";
  if (directFields) directFields.style.display = method === "tarjeta" ? "block" : "none";
  if (acceptedCards) acceptedCards.style.display = method === "tarjeta" ? "flex" : "none";
  if (paypalSim) paypalSim.style.display = method === "paypal" ? "block" : "none";
  resetSandboxStatus();
}

function populateSelectors() {
  const countrySelect = document.getElementById("country-select");
  const currencySelect = document.getElementById("currency-select");
  if(!countrySelect) return;
  countrySelect.innerHTML = countries.map(([country, currency]) => `<option value="${country}|${currency}">${country} (${currency})</option>`).join("");
  const currencies = [...new Set([...Object.keys(FALLBACK_RATES), ...countries.map(([, currency]) => currency)])].sort();    
  currencySelect.innerHTML = currencies.map(currency => `<option value="${currency}">${currency}</option>`).join("");        
  countrySelect.value = "Suecia|SEK";
  currencySelect.value = "SEK";
}

function setDestinationFromSelect() {
  const [country, currency] = document.getElementById("country-select").value.split("|");
  currentCountry = country;
  currentCurrency = currency;
  document.getElementById("currency-select").value = currency;
  document.getElementById("inp-pais").value = country;
  renderCart();
}

function setCurrencyFromSelect() {
  currentCurrency = document.getElementById("currency-select").value;
  renderCart();
}

async function loadRates() {
  const note = document.getElementById("rate-note");
  try {
    const localResponse = await fetch(apiUrl("/api/rates?base=USD"), { cache: "no-store" });
    if (localResponse.ok) {
      const data = await localResponse.json();
      if (data.rates) {
        exchangeRates = { ...FALLBACK_RATES, ...data.rates, USD: 1 };
        rateSource = "API del backend";
        renderCart();
        return;
      }
    }
  } catch {}

  try {
    const publicResponse = await fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store" });
    const data = await publicResponse.json();
    if (data.rates) {
      exchangeRates = { ...FALLBACK_RATES, ...data.rates, USD: 1 };
      rateSource = "API en tiempo real";
      renderCart();
      return;
    }
  } catch {}

  rateSource = "respaldo local";
  if (note) note.textContent = "Usando tasas de respaldo local por falta de conexion con la API.";
  renderCart();
}

function showCheckoutDetails() {
  checkoutStep = 2;
  setCheckoutView(2);
  const details = document.getElementById("checkout-details");
  details.classList.add("open");
  document.getElementById("payment-details").classList.remove("open");
  document.getElementById("step-productos").classList.add("complete");
  document.getElementById("step-productos").classList.remove("active");
  document.getElementById("step-datos").classList.add("active");
  document.getElementById("step-pago").classList.remove("active");
  updateCheckoutButton();
  moveToCheckoutSection(details, "inp-nombre");
}

function showPaymentDetails() {
  checkoutStep = 3;
  setCheckoutView(3);
  document.getElementById("checkout-details").classList.remove("open");
  const paymentDetails = document.getElementById("payment-details");
  paymentDetails.classList.add("open");
  document.getElementById("step-datos").classList.add("complete");
  document.getElementById("step-datos").classList.remove("active");
  document.getElementById("step-pago").classList.add("active");
  updateCheckoutButton();
  moveToCheckoutSection(paymentDetails);
}

function moveToCheckoutSection(section, focusId) {
  if (!section) return;
  section.classList.remove("checkout-section-focus");
  window.setTimeout(() => {
    section.scrollIntoView({ behavior: "smooth", block: "start" });
    section.classList.add("checkout-section-focus");
    if (focusId) {
      const input = document.getElementById(focusId);
      window.setTimeout(() => input?.focus({ preventScroll: true }), 420);
    }
    window.setTimeout(() => section.classList.remove("checkout-section-focus"), 1400);
  }, 80);
}

function hideCheckoutDetails() {
  checkoutStep = 1;
  setCheckoutView(1);
  document.getElementById("checkout-details").classList.remove("open");
  document.getElementById("payment-details").classList.remove("open");
  document.getElementById("step-productos").classList.remove("complete");
  document.getElementById("step-productos").classList.add("active");
  document.getElementById("step-datos").classList.remove("complete", "active");
  document.getElementById("step-pago").classList.remove("active");
  updateCheckoutButton();
}

function setCheckoutView(step) {
  const productsPanel = document.getElementById("checkout-products-panel");
  const detailsPanel = document.getElementById("checkout-details");
  const paymentPanel = document.getElementById("payment-details");
  productsPanel?.classList.toggle("checkout-panel-hidden", step !== 1);
  detailsPanel?.classList.toggle("checkout-panel-hidden", step !== 2);
  paymentPanel?.classList.toggle("checkout-panel-hidden", step !== 3);
}

function goToCheckoutStep(step) {
  if (step === checkoutStep) return;
  if (step === 1) return hideCheckoutDetails();
  if (step === 2) {
    if (totalItems() === 0) {
      alert("Por favor agrega al menos un saco antes de continuar.");
      return;
    }
    return showCheckoutDetails();
  }
  if (step === 3) {
    if (totalItems() === 0) {
      alert("Por favor agrega al menos un saco antes de continuar.");
      return;
    }
    if (!validateContact()) return;
    return showPaymentDetails();
  }
}

function updateCheckoutButton() {
  const button = document.getElementById("btn-confirmar");
  const hasProducts = totalItems() > 0;
  const paymentMethod = document.querySelector('input[name="formaPago"]:checked')?.value || "tarjeta";
  if(!button) return;
  button.disabled = !hasProducts;
  button.textContent = hasProducts
    ? (checkoutStep === 1 ? "Continuar con mis datos ->" : checkoutStep === 2 ? "Continuar a pago ->" : paymentMethod === "paypal" ? "Confirmar con PayPal ->" : "Confirmar pedido ->")
    : "Agrega sacos para continuar";
}

function renderCart() {
  const items = cartItems();
  const cartContainer = document.getElementById("cart-items");
  const summaryContainer = document.getElementById("resumen-items");
  if(!cartContainer) return;
  
  const subtotal = getSubtotal();
  const localTotal = subtotal * (exchangeRates[currentCurrency] || 1);
  const sacks = totalItems();
  const weight = sacks * SACK_KG;

  if (items.length === 0) {
    cartContainer.innerHTML = '<p class="cart-empty">Tu carrito esta vacio. Agrega cacao tostado desde el catalogo para cotizar.</p>';
    summaryContainer.innerHTML = '<p class="resumen-empty">Agrega sacos para ver el resumen</p>';
  } else {
    cartContainer.innerHTML = items.map(([id, qty]) => `
      <div class="prod-row in-cart" data-product="${id}">
        <div class="prod-row-icon" style="background-image:url('${products[id].image}')"></div>
        <div class="prod-row-info">
          <p class="prod-row-name">${products[id].name}</p>
          <p class="prod-row-price">${formatUsd(products[id].price)} / saco de 50 kg</p>
          <p class="prod-row-desc">${products[id].description}</p>
        </div>
        <div class="qty-ctrl">
          <label class="qty-label" for="qty-${id}">Sacos</label>
          <input class="qty-input" id="qty-${id}" type="number" min="0" max="${MAX_SACKS}" step="1" value="${qty}" inputmode="numeric" onchange="setQty('${id}', this.value)" onblur="setQty('${id}', this.value)">
        </div>
      </div>
    `).join("");
    summaryContainer.innerHTML = items.map(([id, qty]) => `
      <div class="resumen-item">
        <span class="resumen-item-name">${products[id].name} x ${qty} sacos</span>
        <span class="resumen-item-val">${formatUsd(products[id].price * qty)}</span>
      </div>
    `).join("");
  }

  document.getElementById("subtotal").textContent = formatUsd(subtotal);
  document.getElementById("total").textContent = formatUsd(subtotal);
  document.getElementById("total-local").textContent = formatCurrency(localTotal, currentCurrency);
  document.getElementById("converter-usd").textContent = formatUsd(subtotal);
  document.getElementById("converter-local").textContent = formatCurrency(localTotal, currentCurrency);
  document.getElementById("sacos-total").textContent = `${sacks} / ${MAX_SACKS}`;
  document.getElementById("peso-total").textContent = `${weight.toLocaleString("es-SV")} kg`;
  document.getElementById("envio").textContent = subtotal > 0 ? "A coordinar" : "-";
  document.getElementById("destino-seleccionado").textContent = `${currentCountry} (${currentCurrency})`;
  document.getElementById("cart-count").textContent = sacks;
  document.getElementById("cart-count").classList.toggle("has-items", sacks > 0);
  document.getElementById("rate-note").textContent = `Tasa actual: 1 USD = ${(exchangeRates[currentCurrency] || 1).toFixed(4)} ${currentCurrency}. Fuente: ${rateSource}.`;
  updateCheckoutButton();
  highlightRequestedProduct();
}

function highlightRequestedProduct() {
  const id = new URLSearchParams(window.location.search).get("producto");
  if (!id || highlightRequestedProduct.done) return;
  const row = document.querySelector(`[data-product="${id}"]`);
  if (!row) return;
  highlightRequestedProduct.done = true;
  setTimeout(() => {
    row.scrollIntoView({ behavior: "smooth", block: "center" });
    row.classList.add("cart-row-highlight");
    setTimeout(() => row.classList.remove("cart-row-highlight"), 1600);
  }, 120);
}

function handleCheckoutAction() {
  if (totalItems() === 0) {
    alert("Por favor agrega al menos un saco antes de continuar.");
    return;
  }
  if (checkoutStep === 1) return showCheckoutDetails();
  if (checkoutStep === 2) {
    if (!validateContact()) return;
    return showPaymentDetails();
  }
  const pago = document.querySelector('input[name="formaPago"]:checked')?.value || "tarjeta";
  if (pago === "paypal" && !paypalSandboxApproved) return simulatePayPalPayment();
  confirmarPedido();
}

function validateContact() {
  const nombre = document.getElementById("inp-nombre").value.trim();
  const email = document.getElementById("inp-email").value.trim();
  const tel = document.getElementById("inp-tel").value.trim();
  if (!nombre) {
    alert("Por favor ingresa tu nombre completo.");
    document.getElementById("inp-nombre").focus();
    return false;
  }
  if (!email) {
    alert("Por favor ingresa tu correo electronico para enviarte la factura.");
    document.getElementById("inp-email").focus();
    return false;
  }
  return true;
}

function validateCardFields() {
  const processor = document.querySelector('input[name="tipoTarjeta"]:checked')?.value;
  const ids = ["inp-card-name", "inp-card-number", "inp-card-exp", "inp-card-cvv"];
  for (const id of ids) {
    const input = document.getElementById(id);
    if (!input.value.trim()) {
      alert("Por favor completa los datos de la tarjeta.");
      input.focus();
      return false;
    }
  }
  return true;
}

function buildInvoicePayload(processorLabel) {
  const subtotal = getSubtotal();
  const localTotal = subtotal * (exchangeRates[currentCurrency] || 1);
  return {
    customer: {
      name: document.getElementById("inp-nombre").value.trim(),
      email: document.getElementById("inp-email").value.trim(),
      phone: document.getElementById("inp-tel").value.trim(),
      notes: document.getElementById("inp-notas").value.trim()
    },
    destination: {
      country: currentCountry,
      currency: currentCurrency,
      exchangeRate: exchangeRates[currentCurrency] || 1
    },
    payment: {
      method: processorLabel
    },
    items: cartItems().map(([id, quantity]) => ({
      id,
      name: products[id].name,
      quantity,
      unitPrice: products[id].price,
      total: products[id].price * quantity,
      weightKg: quantity * SACK_KG
    })),
    totals: {
      subtotalUsd: subtotal,
      totalLocal: localTotal,
      sacks: totalItems(),
      weightKg: totalItems() * SACK_KG
    }
  };
}

async function sendInvoice(orderPayload) {
  let response;
  try {
    response = await fetch(apiUrl("/api/invoice-email"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderPayload)
    });
  } catch {
    throw new Error("Factura pendiente de envio. Inicia el servidor con npm start y abre http://localhost:3000/Frontend/carrito.html.");
  }
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("No se recibio respuesta valida del backend. Ejecuta npm start y abre http://localhost:3000/Frontend/carrito.html.");
  }
  if (!response.ok || !data.ok) {
    throw new Error(data.error || "No se pudo enviar la factura.");
  }
  return {
    ...data.invoice,
    orderNumber: data.order?.order_number,
    databaseWarning: data.databaseWarning,
    emailWarning: data.emailWarning
  };
}

async function confirmarPedido() {
  const nombre = document.getElementById("inp-nombre").value.trim();
  const tipo = document.querySelector('input[name="tipoPedido"]:checked')?.value || "exportacion";
  const pago = document.querySelector('input[name="formaPago"]:checked')?.value || "tarjeta";
  const processor = document.querySelector('input[name="tipoTarjeta"]:checked')?.value || "visa";
  const total = getSubtotal();
  const localTotal = total * (exchangeRates[currentCurrency] || 1);

  if (!validateContact()) return;
  if (pago === "tarjeta" && !validateCardFields()) return;

  const processorLabel = pago === "tarjeta" ? cardProcessorLabels[processor] : paymentMethodLabels[pago];
  const invoiceNoticeId = "invoice-send-status";
  document.getElementById("order-success").innerHTML = `
    <div class="success-icon">OK</div>
    <p class="success-title">Pedido enviado</p>
    <p class="success-sub">Hola <strong>${nombre}</strong>, recibimos tu pedido de <strong>${totalItems()} sacos</strong> para <strong>${currentCountry}</strong>. Total estimado: <strong>${formatUsd(total)}</strong> / <strong>${formatCurrency(localTotal, currentCurrency)}</strong>, pago en <strong>${processorLabel}</strong>.</p>
    <p class="invoice-status pending" id="${invoiceNoticeId}">Enviando factura electronica al correo del cliente...</p>
    <button class="btn-primary" style="margin-top:14px;width:100%" onclick="resetCart()">Hacer otro pedido</button>
  `;
  document.getElementById("order-success").style.display = "block";
  document.getElementById("btn-confirmar").style.display = "none";

  const invoiceStatus = document.getElementById(invoiceNoticeId);
  try {
    const invoice = await sendInvoice(buildInvoicePayload(processorLabel));
    if (invoiceStatus) {
      const orderNote = invoice.orderNumber ? ` Pedido ${invoice.orderNumber} registrado.` : "";
      const databaseNote = invoice.databaseWarning ? ` BD: ${invoice.databaseWarning}` : "";
      if (invoice.emailWarning) {
        invoiceStatus.className = "invoice-status error";
        invoiceStatus.textContent = `Pedido guardado en base de datos.${orderNote} El correo no se pudo enviar: ${invoice.emailWarning}${databaseNote}`;
      } else {
        invoiceStatus.className = "invoice-status sent";
        invoiceStatus.textContent = `Factura ${invoice.number} enviada a ${document.getElementById("inp-email").value.trim()}.${orderNote}${databaseNote}`;
      }
    }
  } catch (error) {
    if (invoiceStatus) {
      invoiceStatus.className = "invoice-status error";
      invoiceStatus.textContent = error.message.startsWith("Factura pendiente")
        ? error.message
        : `Pedido registrado. La factura no se pudo enviar: ${error.message}`;
    }
  }
}

function resetCart() {
  saveCart({ tos: 0 });
  ["inp-nombre", "inp-email", "inp-tel", "inp-pais", "inp-notas", "inp-card-name", "inp-card-number", "inp-card-exp", "inp-card-cvv"].forEach(id => {
    const input = document.getElementById(id);
    if (input) input.value = "";
  });
  setOrderType("exportacion");
  setPaymentMethod("tarjeta");
  paypalSandboxApproved = false;
  resetSandboxStatus();
  hideCheckoutDetails();
  document.getElementById("order-success").style.display = "none";
  document.getElementById("btn-confirmar").style.display = "block";
  renderCart();
}

function setCardProcessor(processor) {
  const input = document.querySelector(`input[name="tipoTarjeta"][value="${processor}"]`);
  if (input) input.checked = true;
  document.querySelectorAll(".card-method").forEach(method => {
    const methodInput = method.querySelector('input[name="tipoTarjeta"]');
    method.classList.toggle("active", methodInput?.value === processor);
  });
  
  const directFields = document.getElementById("direct-card-fields");
  const paypalSim = document.getElementById("paypal-sandbox-sim");
  
  if (directFields) directFields.style.display = processor === "paypal_sandbox" ? "none" : "block";
  if (paypalSim) paypalSim.style.display = processor === "paypal_sandbox" ? "block" : "none";
  resetSandboxStatus();
}

function simulatePayPalPayment() {
  if (!validateContact()) return;

  const btn = document.querySelector(".paypal-sandbox-btn");
  const status = document.getElementById("paypal-sandbox-status");
  const checkoutButton = document.getElementById("btn-confirmar");
  if (!btn || !status) return confirmarPedido();

  btn.disabled = true;
  if (checkoutButton) checkoutButton.disabled = true;
  btn.textContent = "Conectando con PayPal...";
  status.textContent = "Conectando con PayPal";
  status.className = "sandbox-status processing";
  
  setTimeout(() => {
    btn.textContent = "Procesando aprobacion...";
    status.textContent = "Procesando aprobacion";
    setTimeout(() => {
      paypalSandboxApproved = true;
      status.textContent = "Aprobado por PayPal";
      status.className = "sandbox-status approved";
      btn.textContent = "Pago aprobado";
      if (checkoutButton) checkoutButton.disabled = false;
      confirmarPedido();
    }, 1500);
  }, 1000);
}

function resetSandboxStatus() {
  paypalSandboxApproved = false;
  const btn = document.querySelector(".paypal-sandbox-btn");
  const status = document.getElementById("paypal-sandbox-status");
  if (btn) {
    btn.disabled = false;
    btn.textContent = "Confirmar con PayPal";
  }
  if (status) {
    status.textContent = "Pendiente de aprobacion";
    status.className = "sandbox-status pending";
  }
  updateCheckoutButton();
}

populateSelectors();
if(document.getElementById("inp-pais")) document.getElementById("inp-pais").value = currentCountry;
setOrderType("exportacion");
setPaymentMethod("tarjeta");
setCardProcessor("visa");
setCheckoutView(1);
renderCart();
loadRates();

