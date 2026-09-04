require('dotenv').config();
const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_TOKEN_SECRET = process.env.ADMIN_TOKEN_SECRET || 'change-this-secret';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Database setup ---
const db = new Database(path.join(__dirname, 'store.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL,
  image_url TEXT,
  stock INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT,
  items TEXT NOT NULL,
  total REAL NOT NULL,
  status TEXT DEFAULT 'yangi',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

// Seed a couple of example products if table is empty, so the storefront isn't blank on first run
const count = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
if (count === 0) {
  const insert = db.prepare('INSERT INTO products (name, description, price, image_url, stock) VALUES (?, ?, ?, ?, ?)');
  insert.run('Namuna mahsulot 1', 'Mahsulot tavsifini shu yerga yozing.', 150000, '', 10);
  insert.run('Namuna mahsulot 2', 'Mahsulot tavsifini shu yerga yozing.', 250000, '', 5);
}

// --- Password security helpers ---
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || typeof password !== 'string') return false;
  if (stored.includes(':')) {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    const verifyHash = crypto.scryptSync(password, salt, 64).toString('hex');
    const hashBuf = Buffer.from(hash, 'hex');
    const verifyBuf = Buffer.from(verifyHash, 'hex');
    if (hashBuf.length !== verifyBuf.length) return false;
    return crypto.timingSafeEqual(hashBuf, verifyBuf);
  }
  const a = Buffer.from(password);
  const b = Buffer.from(stored);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function getStoredPassword() {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_password');
  if (row) return row.value;
  return process.env.ADMIN_PASSWORD || 'admin123';
}

function saveAdminPassword(newPassword) {
  const hashed = hashPassword(newPassword);
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run('admin_password', hashed);
}

function getTokenSecret() {
  if (process.env.ADMIN_TOKEN_SECRET && process.env.ADMIN_TOKEN_SECRET !== 'change-this-secret') {
    return process.env.ADMIN_TOKEN_SECRET;
  }
  let row = db.prepare('SELECT value FROM settings WHERE key = ?').get('token_secret');
  if (!row) {
    const randomSecret = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run('token_secret', randomSecret);
    return randomSecret;
  }
  return row.value;
}

// --- Simple admin auth (signed token) ---
function makeToken() {
  const payload = `admin:${Date.now()}`;
  const sig = crypto.createHmac('sha256', getTokenSecret()).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64');
}

function checkToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const [prefix, ts, sig] = decoded.split(':');
    const payload = `${prefix}:${ts}`;
    const expected = crypto.createHmac('sha256', getTokenSecret()).update(payload).digest('hex');
    if (sig !== expected) return false;
    // token valid for 12 hours
    const age = Date.now() - Number(ts);
    return age >= 0 && age < 12 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!checkToken(token)) return res.status(401).json({ error: 'Ruxsat yo\'q' });
  next();
}

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password && verifyPassword(password, getStoredPassword())) {
    return res.json({ token: makeToken() });
  }
  res.status(401).json({ error: 'Parol noto\'g\'ri' });
});

app.put('/api/admin/change-password', requireAdmin, (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ error: 'Barcha maydonlarni to\'ldiring' });
  }
  if (!verifyPassword(currentPassword, getStoredPassword())) {
    return res.status(400).json({ error: 'Hozirgi parol noto\'g\'ri' });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'Yangi parollar bir-biriga mos kelmadi' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Yangi parol kamida 8 ta belgidan iborat bo\'lishi kerak' });
  }
  saveAdminPassword(newPassword);
  res.json({ ok: true, message: 'Parol muvaffaqiyatli o\'zgartirildi' });
});

// --- Public product API ---
app.get('/api/products', (req, res) => {
  const products = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
  res.json(products);
});

// --- Public order creation ---
app.post('/api/orders', (req, res) => {
  const { customer_name, phone, address, items } = req.body;
  if (!customer_name || !phone || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Ma\'lumotlar to\'liq emas' });
  }

  const verifiedItems = [];
  let total = 0;
  const getProductStmt = db.prepare('SELECT id, name, price, stock FROM products WHERE id = ?');

  for (const item of items) {
    if (!item || !item.id || !Number.isInteger(item.qty) || item.qty <= 0) {
      return res.status(400).json({ error: 'Har bir mahsulot soni 0 dan katta butun son bo\'lishi kerak' });
    }

    const product = getProductStmt.get(item.id);
    if (!product) {
      return res.status(400).json({ error: 'Tanlangan mahsulot topilmadi' });
    }

    const itemPrice = Number(product.price);
    total += itemPrice * item.qty;

    verifiedItems.push({
      id: product.id,
      name: product.name,
      price: itemPrice,
      qty: item.qty
    });
  }

  const stmt = db.prepare('INSERT INTO orders (customer_name, phone, address, items, total) VALUES (?, ?, ?, ?, ?)');
  const info = stmt.run(customer_name, phone, address || '', JSON.stringify(verifiedItems), total);
  res.json({ id: info.lastInsertRowid, total });
});

// --- Admin: products CRUD ---
app.get('/api/admin/products', requireAdmin, (req, res) => {
  res.json(db.prepare('SELECT * FROM products ORDER BY created_at DESC').all());
});

app.post('/api/admin/products', requireAdmin, (req, res) => {
  const { name, description, price, image_url, stock } = req.body;
  if (!name || price == null) return res.status(400).json({ error: 'Nom va narx kerak' });
  const stmt = db.prepare('INSERT INTO products (name, description, price, image_url, stock) VALUES (?, ?, ?, ?, ?)');
  const info = stmt.run(name, description || '', price, image_url || '', stock || 0);
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/admin/products/:id', requireAdmin, (req, res) => {
  const { name, description, price, image_url, stock } = req.body;
  db.prepare('UPDATE products SET name=?, description=?, price=?, image_url=?, stock=? WHERE id=?')
    .run(name, description || '', price, image_url || '', stock || 0, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM products WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// --- Admin: orders ---
app.get('/api/admin/orders', requireAdmin, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all()
    .map(o => ({ ...o, items: JSON.parse(o.items) }));
  res.json(orders);
});

app.put('/api/admin/orders/:id', requireAdmin, (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE orders SET status=? WHERE id=?').run(status, req.params.id);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server ishga tushdi: http://localhost:${PORT}`);
});
