# MAIDA LEGACY — MDE Finance Pro

Sistem pengurusan kewangan & tempahan PlayStation untuk **Maida Digital Enterprise**
Financial Park Labuan · LA0083119-X

🔗 https://khan7-gif.github.io/maidalegacy/

---

## Fail dalam repo

| Fail | Guna |
|---|---|
| `index.html` | Aplikasi penuh (admin + staff) |
| `firebase-rules.json` | Rules keselamatan Firebase — **wajib dipasang** |
| `manifest.json` | Tetapan PWA |
| `sw.js` | Service worker |
| `icon-192.png` `icon-512.png` | Ikon aplikasi |

---

## Pemasangan

**1. Muat naik `index.html`** ke root repo.

**2. Pasang Firebase Rules** (sekali sahaja)
Firebase Console → Realtime Database → **Rules** → tampal isi `firebase-rules.json` → **Publish**

**3. Buka aplikasi** — migrasi data lama berjalan sendiri pada kali pertama.

---

## Log masuk

| Peranan | Akses |
|---|---|
| **Admin** | Semua tab |
| **Staff** | PS Booking sahaja (boleh diubah di Tetapan → Pengurusan Pengguna) |

---

## Struktur data Firebase

```
mde/
├── tx/{id}              ← satu transaksi = satu nod  (selamat berbilang pengguna)
├── ps/{id}              ← satu booking = satu nod
├── meta                 ← kategori & nota
├── users                ← akaun & kebenaran
├── ps_meta              ← nombor booking seterusnya
├── ps_stations          ← senarai station
├── ps_colors            ← warna mengikut jenis
├── psbooking/rates      ← harga, promo, peak hour
└── backup/{tarikh_jam}  ← salinan automatik setiap jam
```

**Penting:** setiap rekod disimpan pada nod sendiri. Dua pengguna yang menambah rekod
berbeza pada masa sama **tidak akan** menimpa kerja satu sama lain.

---

## Penyegerakan

- **Sambungan langsung** — perubahan sampai ke semua peranti dalam ~1 saat
- **Pengawas automatik** — saluran mati dihidupkan semula setiap 10 saat
- **Simpanan tempatan dahulu** — data selamat walaupun internet putus
- **Backup harian** dalam peranti (7 hari) + backup jam ke Firebase

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
