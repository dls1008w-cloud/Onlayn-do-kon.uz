let products = [];
let cart = [];
let wishlist = [];
let currentCategory = 'all';
let searchQuery = '';
let islandTimeout = null;

// Initialize cart and wishlist from LocalStorage
try {
  cart = JSON.parse(localStorage.getItem('uzum_cart') || '[]');
  wishlist = JSON.parse(localStorage.getItem('uzum_wishlist') || '[]');
} catch (e) {
  cart = [];
  wishlist = [];
}

// ---------------------------------------------------------
// Load & Render Products
// ---------------------------------------------------------
async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    products = await res.json();
    renderProducts();
    updateWishlistCount();
    renderCart();
  } catch (err) {
    console.error('Mahsulotlarni yuklashda xatolik:', err);
  }
}

function getFilteredProducts() {
  return products.filter(p => {
    // Search query filter
    const matchesSearch = !searchQuery || 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));

    // Category filter (smart keyword detection or 'all')
    if (currentCategory === 'all') return matchesSearch;

    const text = `${p.name} ${p.description || ''}`.toLowerCase();
    let matchesCategory = false;

    if (currentCategory === 'elektronika') {
      matchesCategory = /telefon|smartfon|soat|watch|noutbuk|laptop|planshet|quloqchin|naushnik|gadget|zaryad|usb|kabel/i.test(text);
    } else if (currentCategory === 'kiyim') {
      matchesCategory = /kiyim|futbolka|shim|ko'ylak|krossovka|oyoqkiyim|jaket|palto|sviter/i.test(text);
    } else if (currentCategory === 'maishiy') {
      matchesCategory = /changyutgich|dazmol|fen|muzlatgich|konditsioner|mikser|choynak/i.test(text);
    } else if (currentCategory === 'aksessuarlar') {
      matchesCategory = /chexol|kassa|sumka|kashalok|ko'zoynak|kamar|kamari/i.test(text);
    } else if (currentCategory === 'gozallik') {
      matchesCategory = /krem|atir|parfyum|makiyaj|pomada|sovun|shampun/i.test(text);
    } else if (currentCategory === 'oshxona') {
      matchesCategory = /tova|qozon|pichoq|likopcha|idish|krujka|choynak/i.test(text);
    } else if (currentCategory === 'wishlist') {
      matchesCategory = wishlist.includes(p.id);
    }

    // Fallback: if category filter has no strict match, still allow search to work if specific
    return matchesSearch && matchesCategory;
  });
}

function renderProducts() {
  const grid = document.getElementById('products');
  const countEl = document.getElementById('products-count');
  const filtered = getFilteredProducts();

  if (countEl) {
    countEl.textContent = `${filtered.length} ta mahsulot`;
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <h4>Mahsulot topilmadi</h4>
        <p>Qidiruv so'zini o'zgartirib ko'ring yoki boshqa toifani tanlang.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(p => {
    const isWishlisted = wishlist.includes(p.id);
    const monthlyPrice = Math.round(p.price / 12);
    const oldPrice = Math.round(p.price * 1.18);
    const ratingScore = (4.7 + ((p.id * 7) % 3) / 10).toFixed(1);
    const reviewCount = 15 + (p.id * 19) % 180;
    const discountPercent = 15 + ((p.id * 5) % 25);

    return `
      <div class="product-card">
        <div class="card-media">
          ${p.image_url ? 
            `<img src="${p.image_url}" alt="${escapeHtml(p.name)}" loading="lazy">` : 
            `<div class="no-image-placeholder">📦</div>`
          }
          <div class="discount-badge">-${discountPercent}%</div>
          <button class="card-wishlist-btn ${isWishlisted ? 'active' : ''}" onclick="toggleWishlist(${p.id}, event)" title="Saralanganlarga qo'shish">
            ${isWishlisted ? '❤️' : '🤍'}
          </button>
        </div>

        <div class="card-info">
          <div class="product-rating">
            <span class="rating-star">★</span>
            <span><strong>${ratingScore}</strong> (${reviewCount} ta sharh)</span>
          </div>

          <h3 title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</h3>
          
          <div class="monthly-chip">
            ${formatPrice(monthlyPrice)} so'm/oy
          </div>

          <div class="card-bottom">
            <div class="price-box">
              <span class="old-price">${formatPrice(oldPrice)} so'm</span>
              <span class="current-price">${formatPrice(p.price)} so'm</span>
            </div>

            <button class="card-add-btn" onclick="addToCart(${p.id})" ${p.stock <= 0 ? 'disabled' : ''} title="${p.stock <= 0 ? 'Tugagan' : 'Savatga qo\'shish'}">
              ${p.stock <= 0 ? '✕' : '+'}
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ---------------------------------------------------------
// iOS Dynamic Island Notification
// ---------------------------------------------------------
function showIslandNotification(text, icon = '✓') {
  const island = document.getElementById('dynamic-island');
  const textEl = document.getElementById('island-text');
  const iconEl = island.querySelector('.island-icon');

  if (!island || !textEl) return;

  textEl.textContent = text;
  if (iconEl) iconEl.textContent = icon;

  island.classList.add('show');

  if (islandTimeout) clearTimeout(islandTimeout);
  islandTimeout = setTimeout(() => {
    island.classList.remove('show');
  }, 2400);
}

// ---------------------------------------------------------
// Cart System with iOS Quantity Steppers
// ---------------------------------------------------------
function addToCart(id) {
  const product = products.find(p => p.id === id);
  if (!product) return;

  const existing = cart.find(i => i.id === id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image_url: product.image_url,
      qty: 1
    });
  }

  saveCart();
  renderCart();
  showIslandNotification(`${product.name.slice(0, 20)}... savatga qo'shildi`, '🛍️');

  // Badge bump animation
  const badge = document.getElementById('cart-count');
  if (badge) {
    badge.style.transform = 'scale(1.35)';
    setTimeout(() => badge.style.transform = 'scale(1)', 200);
  }
}

function updateCartQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;

  item.qty += delta;
  if (item.qty <= 0) {
    removeFromCart(id);
    return;
  }

  saveCart();
  renderCart();
}

function removeFromCart(id) {
  cart = cart.filter(i => i.id !== id);
  saveCart();
  renderCart();
}

function saveCart() {
  localStorage.setItem('uzum_cart', JSON.stringify(cart));
}

function renderCart() {
  const totalCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const cartCountEl = document.getElementById('cart-count');
  if (cartCountEl) cartCountEl.textContent = totalCount;

  const itemsEl = document.getElementById('cart-items');
  if (!itemsEl) return;

  if (cart.length === 0) {
    itemsEl.innerHTML = `
      <div class="cart-empty-view">
        <div class="cart-empty-icon">🛍️</div>
        <h4>Savatingiz hozircha bo'sh</h4>
        <p>O'zingizga yoqqan mahsulotlarni qo'shing!</p>
      </div>
    `;
  } else {
    itemsEl.innerHTML = cart.map(item => `
      <div class="cart-item">
        <div class="cart-item-info">
          <div class="cart-item-title">${escapeHtml(item.name)}</div>
          <div class="cart-item-price">${formatPrice(item.price * item.qty)} so'm</div>
        </div>

        <div class="quantity-stepper">
          <button class="qty-btn" onclick="updateCartQty(${item.id}, -1)">−</button>
          <span class="qty-count">${item.qty}</span>
          <button class="qty-btn" onclick="updateCartQty(${item.id}, 1)">+</button>
        </div>

        <button class="qty-btn" onclick="removeFromCart(${item.id})" title="O'chirish" style="color:#ff3b30">✕</button>
      </div>
    `).join('');
  }

  const total = cart.reduce((s, i) => s + (i.price * i.qty), 0);
  const totalEl = document.getElementById('cart-total');
  if (totalEl) totalEl.textContent = `${formatPrice(total)} so'm`;
}

// ---------------------------------------------------------
// Wishlist (Saralanganlar)
// ---------------------------------------------------------
function toggleWishlist(id, e) {
  if (e) e.stopPropagation();
  const index = wishlist.indexOf(id);

  if (index > -1) {
    wishlist.splice(index, 1);
    showIslandNotification("Saralanganlardan o'chirildi", '🤍');
  } else {
    wishlist.push(id);
    showIslandNotification("Saralanganlarga qo'shildi", '❤️');
  }

  localStorage.setItem('uzum_wishlist', JSON.stringify(wishlist));
  updateWishlistCount();
  renderProducts();
}

function updateWishlistCount() {
  const el = document.getElementById('wishlist-count');
  if (el) el.textContent = wishlist.length;
}

// ---------------------------------------------------------
// Formatting & Utilities
// ---------------------------------------------------------
function formatPrice(n) {
  return Number(n || 0).toLocaleString('ru-RU');
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------------------------------------------------------
// Event Listeners: Cart Drawer
// ---------------------------------------------------------
const cartPanel = document.getElementById('cart-panel');
const cartBackdrop = document.getElementById('cart-backdrop');
const cartBtn = document.getElementById('cart-btn');
const closeCartBtn = document.getElementById('close-cart');

function openCart() {
  cartPanel.classList.add('open');
  cartBackdrop.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  cartPanel.classList.remove('open');
  cartBackdrop.classList.remove('open');
  document.body.style.overflow = '';
}

if (cartBtn) cartBtn.addEventListener('click', openCart);
if (closeCartBtn) closeCartBtn.addEventListener('click', closeCart);
if (cartBackdrop) cartBackdrop.addEventListener('click', closeCart);

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeCart();
});

// ---------------------------------------------------------
// Event Listeners: Search & Categories
// ---------------------------------------------------------
const searchInput = document.getElementById('search-input');
const searchClear = document.getElementById('search-clear');

if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim();
    if (searchClear) {
      if (searchQuery.length > 0) {
        searchClear.classList.add('visible');
      } else {
        searchClear.classList.remove('visible');
      }
    }
    renderProducts();
  });
}

if (searchClear) {
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    searchClear.classList.remove('visible');
    searchInput.focus();
    renderProducts();
  });
}

// Category chips click
document.querySelectorAll('.cat-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    currentCategory = chip.dataset.cat;
    renderProducts();
  });
});

// Wishlist button in header filter toggle
const wishlistBtn = document.getElementById('wishlist-btn');
if (wishlistBtn) {
  wishlistBtn.addEventListener('click', () => {
    if (currentCategory === 'wishlist') {
      currentCategory = 'all';
      document.querySelector('[data-cat="all"]')?.classList.add('active');
    } else {
      document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
      currentCategory = 'wishlist';
    }
    renderProducts();
  });
}

// Logo click resets to home
document.getElementById('brand-logo')?.addEventListener('click', () => {
  currentCategory = 'all';
  searchQuery = '';
  if (searchInput) searchInput.value = '';
  if (searchClear) searchClear.classList.remove('visible');
  document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
  document.querySelector('[data-cat="all"]')?.classList.add('active');
  renderProducts();
});

// ---------------------------------------------------------
// Order Form Submission
// ---------------------------------------------------------
const orderForm = document.getElementById('order-form');
if (orderForm) {
  orderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const statusEl = document.getElementById('order-status');

    if (cart.length === 0) {
      statusEl.className = 'order-alert error';
      statusEl.textContent = 'Avval mahsulot tanlang!';
      return;
    }

    const form = new FormData(e.target);
    const body = {
      customer_name: form.get('customer_name'),
      phone: form.get('phone'),
      address: form.get('address'),
      items: cart
    };

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        statusEl.className = 'order-alert success';
        statusEl.textContent = "Buyurtmangiz qabul qilindi! Tez orada bog'lanamiz.";
        showIslandNotification('Buyurtma muvaffaqiyatli berildi!', '🎉');
        cart = [];
        saveCart();
        renderCart();
        e.target.reset();

        setTimeout(() => {
          closeCart();
          statusEl.textContent = '';
        }, 2500);
      } else {
        statusEl.className = 'order-alert error';
        statusEl.textContent = "Xatolik yuz berdi, qayta urinib ko'ring";
      }
    } catch (err) {
      statusEl.className = 'order-alert error';
      statusEl.textContent = "Server bilan aloqa uzildi";
    }
  });
}

// Initial fetch
loadProducts();
