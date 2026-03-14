// ────────────────────────────────────────────────
// STATE
// ────────────────────────────────────────────────
let allProducts = [];
let cart = JSON.parse(localStorage.getItem('swiftcart') || '[]');

// ────────────────────────────────────────────────
// INIT
// ────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  await loadCategories();   // load dynamic category buttons
  await loadAllProducts();  // load all products from API
  renderCartCount();        // update cart badge
});

// ────────────────────────────────────────────────
// API FETCH
// ────────────────────────────────────────────────
async function fetchJSON(url) {
  const res = await fetch(url);
  return res.json();
}

// Load all products from API
async function loadAllProducts() {
  allProducts = await fetchJSON('https://fakestoreapi.com/products');
  renderTopRated();          // show top 3 by rating in trending
  renderProducts(allProducts); // show all in products section
}

// Load categories dynamically and create filter buttons
async function loadCategories() {
  const cats = await fetchJSON('https://fakestoreapi.com/products/categories');
  const bar = document.getElementById('categories-bar');
  cats.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'cat-btn';
    btn.dataset.cat = cat;
    btn.textContent = capitalize(cat);
    btn.onclick = () => filterCategory(cat, btn);
    bar.appendChild(btn);
  });
}

// ────────────────────────────────────────────────
// RENDER
// ────────────────────────────────────────────────

// Top 3 products sorted by rating (as required)
function renderTopRated() {
  const top3 = [...allProducts]
    .sort((a, b) => b.rating.rate - a.rating.rate)
    .slice(0, 3);
  document.getElementById('top-grid').innerHTML = top3.map(p => productCardHTML(p)).join('');
}

function renderProducts(products) {
  const grid = document.getElementById('products-grid');
  if (!products.length) {
    grid.innerHTML = '<p style="color:#6b7280;text-align:center;grid-column:1/-1;padding:3rem">No products found.</p>';
    return;
  }
  grid.innerHTML = products.map(p => productCardHTML(p)).join('');
}

// Product card HTML — all required fields
function productCardHTML(p) {
  const inCart = cart.find(i => i.id === p.id);
  return `
    <div class="product-card">
      <div class="card-img-wrap">
        <img src="${p.image}" alt="${p.title}" loading="lazy"/>
      </div>
      <div class="card-body">
        <span class="card-category">${p.category}</span>
        <h3 class="card-title" title="${p.title}">${p.title}</h3>
        <p class="card-price">$${p.price.toFixed(2)}</p>
        <div class="card-rating">
          <span class="stars">${starsHTML(p.rating.rate)}</span>
          <span>${p.rating.rate} (${p.rating.count})</span>
        </div>
        <div class="card-actions">
          <button class="btn-details" onclick="openModal(${p.id})">
            <i class="fa fa-eye"></i> Details
          </button>
          <button class="btn-add-cart ${inCart ? 'added' : ''}" id="cbtn-${p.id}" onclick="addToCart(${p.id})">
            <i class="fa ${inCart ? 'fa-check' : 'fa-cart-plus'}"></i>
            ${inCart ? 'Added' : 'Add'}
          </button>
        </div>
      </div>
    </div>`;
}

// ────────────────────────────────────────────────
// CATEGORY FILTER — active state + spinner
// ────────────────────────────────────────────────
async function filterCategory(cat, el) {
  // ACTIVE STATE: highlight selected, remove from others
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');

  // Show loading spinner
  document.getElementById('products-grid').innerHTML =
    '<div class="spinner-wrap"><div class="spinner"></div></div>';

  let products;
  if (cat === 'all') {
    products = allProducts;
  } else {
    // Fetch products by specific category from API
    products = await fetchJSON(`https://fakestoreapi.com/products/category/${encodeURIComponent(cat)}`);
  }
  renderProducts(products);
}

// ────────────────────────────────────────────────
// MODAL — full details + Buy Now + Add to Cart
// ────────────────────────────────────────────────
async function openModal(id) {
  const p = allProducts.find(x => x.id === id)
    || await fetchJSON(`https://fakestoreapi.com/products/${id}`);

  document.getElementById('modal-img').src = p.image;
  document.getElementById('modal-cat').textContent = p.category;
  document.getElementById('modal-title').textContent = p.title;
  document.getElementById('modal-price').textContent = `$${p.price.toFixed(2)}`;
  document.getElementById('modal-rating').innerHTML =
    `<span class="stars">${starsHTML(p.rating.rate)}</span>&nbsp;${p.rating.rate} / 5 &nbsp;(${p.rating.count} reviews)`;
  document.getElementById('modal-desc').textContent = p.description;

  const cartBtn = document.getElementById('modal-cart-btn');
  const buyBtn  = document.getElementById('modal-buynow-btn');
  const inCart  = cart.find(i => i.id === p.id);

  cartBtn.textContent = inCart ? '✓ Already in Cart' : 'Add to Cart';
  cartBtn.onclick = () => {
    addToCart(p.id);
    cartBtn.textContent = '✓ Added!';
  };
  buyBtn.onclick = () => {
    addToCart(p.id);
    closeModalDirect();
    openCart();
  };

  document.getElementById('modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(e) {
  if (e.target === document.getElementById('modal-overlay')) closeModalDirect();
}
function closeModalDirect() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

// ────────────────────────────────────────────────
// CART — add, remove, qty, total, LocalStorage
// ────────────────────────────────────────────────
function addToCart(id) {
  const p = allProducts.find(x => x.id === id);
  if (!p) return;
  const existing = cart.find(i => i.id === id);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ ...p, qty: 1 });
  }
  saveCart();
  renderCartCount();
  updateCardBtns(id);
  showToast(`"${p.title.substring(0, 30)}…" added to cart!`);
}

function removeFromCart(id) {
  cart = cart.filter(i => i.id !== id);
  saveCart(); renderCartCount(); renderCartSidebar();
}

function changeQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    removeFromCart(id);
  } else {
    saveCart(); renderCartSidebar(); renderCartCount();
  }
}

function saveCart() {
  localStorage.setItem('swiftcart', JSON.stringify(cart));
}

function renderCartCount() {
  const total = cart.reduce((s, i) => s + i.qty, 0);
  document.getElementById('cart-count').textContent = total;
}

function openCart() {
  renderCartSidebar();
  document.getElementById('cart-sidebar').classList.add('open');
  document.getElementById('cart-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeCart() {
  document.getElementById('cart-sidebar').classList.remove('open');
  document.getElementById('cart-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function renderCartSidebar() {
  const list   = document.getElementById('cart-items-list');
  const footer = document.getElementById('cart-footer');

  if (!cart.length) {
    list.innerHTML = `<div class="cart-empty">
      <i class="fa fa-cart-shopping"></i>
      <p>Your cart is empty.</p>
    </div>`;
    footer.style.display = 'none';
    return;
  }

  footer.style.display = 'block';
  list.innerHTML = cart.map(item => `
    <div class="cart-item">
      <img src="${item.image}" alt="${item.title}"/>
      <div class="cart-item-info">
        <p class="cart-item-title">${item.title}</p>
        <p class="cart-item-price">$${(item.price * item.qty).toFixed(2)}</p>
        <div class="cart-item-qty">
          <button class="qty-btn" onclick="changeQty(${item.id}, -1)">−</button>
          <span class="qty-val">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty(${item.id}, 1)">+</button>
        </div>
      </div>
      <button class="cart-item-remove" onclick="removeFromCart(${item.id})" title="Remove">
        <i class="fa fa-trash"></i>
      </button>
    </div>`).join('');

  // Live total price calculation
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  document.getElementById('cart-total').textContent = `$${total.toFixed(2)}`;
}

function updateCardBtns(id) {
  document.querySelectorAll(`#cbtn-${id}`).forEach(btn => {
    btn.innerHTML = '<i class="fa fa-check"></i> Added';
    btn.classList.add('added');
  });
}

// ────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────
function starsHTML(rate) {
  let s = '';
  for (let i = 1; i <= 5; i++) s += i <= Math.round(rate) ? '★' : '☆';
  return s;
}

function capitalize(str) {
  return str.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ────────────────────────────────────────────────
// NEWSLETTER
// ────────────────────────────────────────────────
function subscribe() {
  const val = document.getElementById('email-input').value.trim();
  if (!val || !val.includes('@')) {
    alert('Please enter a valid email address.');
    return;
  }
  document.getElementById('sub-msg').style.display = 'block';
  document.getElementById('email-input').value = '';
}

// ────────────────────────────────────────────────
// MOBILE NAV
// ────────────────────────────────────────────────
function toggleMenu() {
  document.getElementById('nav-links').classList.toggle('open');
}
document.querySelectorAll('.nav-links a').forEach(a =>
  a.addEventListener('click', () => document.getElementById('nav-links').classList.remove('open'))
);
