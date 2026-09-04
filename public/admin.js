let token = sessionStorage.getItem('admin_token') || '';

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatPrice(n) {
  return Number(n || 0).toLocaleString('ru-RU');
}

function showAdmin() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('admin-panel').classList.remove('hidden');
  loadProducts();
}

if (token) showAdmin();

// Login handling
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = document.getElementById('password').value;
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    if (res.ok) {
      const data = await res.json();
      token = data.token;
      sessionStorage.setItem('admin_token', token);
      showAdmin();
    } else {
      document.getElementById('login-error').textContent = 'Parol noto\'g\'ri!';
    }
  } catch (err) {
    document.getElementById('login-error').textContent = 'Server bilan ulanishda xatolik';
  }
});

// Logout
document.getElementById('logout-btn').addEventListener('click', () => {
  sessionStorage.removeItem('admin_token');
  location.reload();
});

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    document.getElementById('tab-' + btn.dataset.tab).classList.remove('hidden');
    if (btn.dataset.tab === 'orders') loadOrders();
    if (btn.dataset.tab === 'products') loadProducts();
  });
});

async function authFetch(url, options = {}) {
  options.headers = { ...(options.headers || {}), Authorization: `Bearer ${token}` };
  const res = await fetch(url, options);
  if (res.status === 401) {
    sessionStorage.removeItem('admin_token');
    location.reload();
  }
  return res;
}

// ---------------------------------------------------------
// Products Management
// ---------------------------------------------------------
async function loadProducts() {
  try {
    const res = await authFetch('/api/admin/products');
    const products = await res.json();
    const list = document.getElementById('product-list');

    if (products.length === 0) {
      list.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 24px;">Mahsulotlar mavjud emas</td></tr>';
      return;
    }

    list.innerHTML = products.map(p => `
      <tr>
        <td style="width: 50px;">
          ${p.image_url ? 
            `<img src="${p.image_url}" style="width: 42px; height: 42px; border-radius: 8px; object-fit: cover;">` : 
            `<div style="width: 42px; height: 42px; border-radius: 8px; background: #f0f2f7; display: flex; align-items: center; justify-content: center; font-size: 18px;">📦</div>`
          }
        </td>
        <td>
          <strong>${escapeHtml(p.name)}</strong>
          ${p.description ? `<div style="font-size: 12px; color: var(--text-secondary);">${escapeHtml(p.description)}</div>` : ''}
        </td>
        <td><strong>${formatPrice(p.price)} so'm</strong></td>
        <td>${p.stock > 0 ? `<span style="color: #34c759; font-weight: 600;">${p.stock} dona</span>` : `<span style="color: #ff3b30; font-weight: 600;">Tugagan</span>`}</td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="admin-action-btn btn-edit" onclick='editProduct(${JSON.stringify(p)})'>Tahrirlash</button>
          <button class="admin-action-btn btn-delete" onclick="deleteProduct(${p.id})">O'chirish</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Mahsulotlarni yuklashda xatolik:', err);
  }
}

function editProduct(p) {
  document.getElementById('product-id').value = p.id;
  document.getElementById('p-name').value = p.name;
  document.getElementById('p-desc').value = p.description || '';
  document.getElementById('p-price').value = p.price;
  document.getElementById('p-image').value = p.image_url || '';
  document.getElementById('p-stock').value = p.stock;
  document.getElementById('p-submit').textContent = 'Saqlash';
  document.getElementById('p-cancel').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('p-cancel').addEventListener('click', resetForm);

function resetForm() {
  document.getElementById('product-form').reset();
  document.getElementById('product-id').value = '';
  document.getElementById('p-submit').textContent = "+ Qo'shish";
  document.getElementById('p-cancel').classList.add('hidden');
}

document.getElementById('product-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('product-id').value;
  const body = {
    name: document.getElementById('p-name').value,
    description: document.getElementById('p-desc').value,
    price: Number(document.getElementById('p-price').value),
    image_url: document.getElementById('p-image').value,
    stock: Number(document.getElementById('p-stock').value) || 0
  };
  const url = id ? `/api/admin/products/${id}` : '/api/admin/products';
  const method = id ? 'PUT' : 'POST';

  await authFetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  resetForm();
  loadProducts();
});

async function deleteProduct(id) {
  if (!confirm("Rostdan ham bu mahsulotni o'chirmoqchimisiz?")) return;
  await authFetch(`/api/admin/products/${id}`, { method: 'DELETE' });
  loadProducts();
}

// ---------------------------------------------------------
// Orders Management
// ---------------------------------------------------------
async function loadOrders() {
  try {
    const res = await authFetch('/api/admin/orders');
    const orders = await res.json();
    const list = document.getElementById('order-list');

    if (orders.length === 0) {
      list.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 24px;">Hozircha buyurtmalar yo\'q</td></tr>';
      return;
    }

    list.innerHTML = orders.map(o => `
      <tr>
        <td><strong>${escapeHtml(o.customer_name)}</strong></td>
        <td><a href="tel:${escapeHtml(o.phone)}" style="color: var(--primary); text-decoration: none;">${escapeHtml(o.phone)}</a></td>
        <td><small>${escapeHtml(o.address || 'Belgilanmagan')}</small></td>
        <td>
          <div style="font-size: 13px;">
            ${o.items.map(i => `${escapeHtml(i.name)} <strong>×${i.qty}</strong>`).join('<br>')}
          </div>
        </td>
        <td><strong>${formatPrice(o.total)} so'm</strong></td>
        <td>
          <select class="status-select" onchange="updateStatus(${o.id}, this.value)">
            <option value="yangi" ${o.status === 'yangi' ? 'selected' : ''}>🔵 Yangi</option>
            <option value="jarayonda" ${o.status === 'jarayonda' ? 'selected' : ''}>🟠 Jarayonda</option>
            <option value="yetkazildi" ${o.status === 'yetkazildi' ? 'selected' : ''}>🟢 Yetkazildi</option>
            <option value="bekor" ${o.status === 'bekor' ? 'selected' : ''}>🔴 Bekor qilindi</option>
          </select>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Buyurtmalarni yuklashda xatolik:', err);
  }
}

async function updateStatus(id, status) {
  await authFetch(`/api/admin/orders/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
}
