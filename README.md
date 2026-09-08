# MAIDA LEGACY — MDE Finance Pro

Sistem pengurusan kewangan & tempahan PlayStation untuk **Maida Digital Enterprise**
Financial Park Labuan · LA0083119-X

Backend: Node.js + MySQL (Hostinger Web Apps Hosting). Dipindah dari Firebase Realtime Database.

---

## Fail dalam repo

| Fail/folder | Guna |
|---|---|
| `public/index.html` | Aplikasi penuh (admin + staff) |
| `public/manifest.json` | Tetapan PWA |
| `public/sw.js` | Service worker |
| `public/icon-192.png` `public/icon-512.png` | Ikon aplikasi |
| `server/index.js` | Pelayan Express — hidang `public/` + laluan `/api/*` |
| `server/schema.sql` | Skema MySQL (jalankan sekali semasa persediaan) |
| `server/migrate-from-firebase.js` | Skrip sekali guna: import data lama dari Firebase |
| `firebase-rules.json` | Rules Firebase lama — kekal untuk rujukan semasa tempoh rollback |

---

## Persediaan (Hostinger Web Apps Hosting)

**1. Aktifkan pelan hosting** — sambungkan Node.js app + Managed MySQL dalam projek hPanel yang sama supaya kelayakan DB disuntik automatik.

**2. Tetapkan pemboleh ubah persekitaran** dalam panel Node.js app:
   - Kelayakan DB — guna nama pemboleh ubah yang ditunjukkan oleh hPanel (semak `server/db.js`)
   - `API_SHARED_KEY` — rentetan rawak panjang, mesti sepadan dengan `API_KEY` dalam `public/index.html`

**3. Sambungkan repo ini** ke Node.js app (Git-based deploy dalam hPanel), fail masuk: `server/index.js`.

**4. Jalankan `server/schema.sql`** sekali sahaja terhadap MySQL (phpMyAdmin/Adminer dalam hPanel).

**5. Migrasi data lama** — set `FIREBASE_DATABASE_URL` dalam `.env`, kemudian `npm run migrate` (sekali sahaja).

**6. Domain & SSL** — tetapkan domain kepada app Node.js, aktifkan SSL percuma dalam hPanel.

---

## Log masuk

| Peranan | Akses |
|---|---|
| **Admin** | Semua tab |
| **Staff** | PS Booking sahaja (boleh diubah di Tetapan → Pengurusan Pengguna) |

---

## Struktur data

```
tx/{id}                MySQL: jadual tx        — satu transaksi = satu baris
ps/{id}                MySQL: jadual ps        — satu booking = satu baris
gaji/hist/{id}         MySQL: jadual gaji_hist
syer/hist/{id}         MySQL: jadual syer_hist
backup/{tarikh_jam}    MySQL: jadual backups   — salinan automatik setiap jam
meta, users, ps_meta, ps_stations, ps_colors,
psbooking/rates, modules, docs, gaji, staff,
core, syer/cfg         MySQL: jadual kv_blobs  — satu blob JSON setiap nod
```

**Penting:** setiap rekod `tx`/`ps` disimpan pada baris sendiri (padam adalah "soft delete"
melalui `deleted_at`). Dua pengguna yang menambah rekod berbeza pada masa sama
**tidak akan** menimpa kerja satu sama lain.

---

## Penyegerakan

- **Polling ~3 saat** — perubahan sampai ke semua peranti dalam ~2-5 saat (gantian kepada
  sambungan langsung Firebase sebelum ini, yang ~1 saat)
- **Pengawas automatik** — polling terhenti dihidupkan semula setiap 10 saat
- **Simpanan tempatan dahulu** — data selamat walaupun internet putus
- **Backup harian** dalam peranti (7 hari) + backup jam ke pelayan

---

## Aliran kerja harian

1. Staff buat tempahan di **PS Booking → Panel**
2. Bila masa tamat, pilih **⏰ +1 Jam** atau **✅ Selesai**
3. Hujung hari, tab **Senarai** → tekan **📤 Kira & Hantar**
4. Jumlah masuk ke **Transaksi** sebagai `Income · 🏪 Sewaan Station`

> Rekod pada tarikh sama akan **dikemas kini**, bukan ditambah berganda.

---

## Petua

- Tunggu lencana bertukar **🟢 Langsung** sebelum tutup pelayar
- Export CSV hujung minggu sebagai salinan luar
- Station rosak → nyahaktif di tab **Station**, jangan padam
