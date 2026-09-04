# Onlayn do'kon

To'liq funksional onlayn do'kon: mijozlar uchun sotuv sahifasi + admin panel.
Backend: Node.js (Express), baza: SQLite (qo'shimcha sozlashsiz ishlaydi).

## Tarkibi

- `server.js` — API server (mahsulotlar, buyurtmalar, admin autentifikatsiya)
- `public/index.html`, `store.js` — mijozlar ko'radigan do'kon sahifasi
- `public/admin.html`, `admin.js` — admin panel (login: `.env` dagi parol)
- `store.db` — SQLite baza fayli (birinchi ishga tushganda avtomatik yaratiladi)

## O'zingizda ishga tushirish

1. Node.js o'rnatilgan bo'lishi kerak (18+ versiya tavsiya etiladi).
2. Loyiha papkasida:
   ```
   npm install
   cp .env.example .env
   ```
3. `.env` faylini oching va `ADMIN_PASSWORD` hamda `ADMIN_TOKEN_SECRET` qiymatlarini o'zingiznikiga almashtiring.
4. Ishga tushirish:
   ```
   npm start
   ```
5. Brauzerda oching:
   - Do'kon: `http://localhost:3000`
   - Admin panel: `http://localhost:3000/admin.html`

## Deploy qilish (server o'zingizda bo'lsa)

1. Loyihani serverga ko'chiring (`git`, `scp`, yoki fayllarni to'g'ridan-to'g'ri yuklab).
2. Serverda `npm install --production` va `.env` faylini sozlang.
3. Doimiy ishlashi uchun process manager tavsiya etiladi, masalan:
   ```
   npm install -g pm2
   pm2 start server.js --name onlayn-dokon
   ```
4. Agar domen orqali (80/443 port) ochmoqchi bo'lsangiz, Nginx'ni reverse proxy sifatida sozlang — tashqi so'rovlarni ichki 3000-portga yo'naltiradi. HTTPS uchun Let's Encrypt (certbot) tavsiya etiladi.

## Deploy qilish (bepul xizmatlar orqali, server sozlashsiz)

Render, Railway yoki Fly.io kabi xizmatlar Node.js loyihalarini to'g'ridan-to'g'ri GitHub repo'dan deploy qiladi — server sozlash shart emas:
1. Loyihani GitHub'ga yuklang.
2. Tanlangan xizmatda yangi "Web Service" yarating, repo'ni bog'lang.
3. Environment o'zgaruvchilarga (`ADMIN_PASSWORD`, `ADMIN_TOKEN_SECRET`) qiymat kiriting.
4. Build buyrug'i: `npm install`, start buyrug'i: `npm start`.

**Eslatma:** SQLite fayl asosida ishlaydi — ba'zi bepul hostinglarda (masalan Railway'ning vaqtinchalik disk fayl tizimi) qayta deploy qilinganda baza tozalanishi mumkin. Doimiy ma'lumot saqlash kerak bo'lsa, keyinchalik PostgreSQL'ga o'tish tavsiya etiladi.

## Muhim eslatmalar

- Hozircha to'lov tizimi ulanmagan — buyurtma faqat mijoz ma'lumotlari (ism, telefon, manzil) va mahsulotlar ro'yxati sifatida saqlanadi; to'lovni telefon orqali kelishasiz. Click/Payme kabi tizimlar keyinchalik qo'shilishi mumkin.
- Admin panelga kirish — bitta umumiy parol orqali (ko'p foydalanuvchili tizim emas).
- Mahsulot rasmlarini hozircha URL orqali qo'shasiz (masalan, boshqa saytga yuklab, havolasini kiritasiz). Fayl yuklash funksiyasi keyinchalik qo'shilishi mumkin.
