# Changelog

## v5.0 — Ogos 2026

### Pembetulan kritikal

**Data hilang antara syif** — punca: seluruh senarai transaksi ditulis sebagai satu
blok. Pengguna terakhir menyimpan menimpa kerja orang lain. Kini setiap rekod ditulis
pada nod sendiri (`mde/tx/{id}`), jadi tiada konflik.

**Ralat 400 senyap** — ID dijana dengan `Date.now() + Math.random()` menghasilkan
nombor bertitik (`1785861483412.578`). Firebase menolak titik dalam laluan, jadi rekod
tersebut **tidak pernah** tersimpan. Kini guna ID asas-36 tanpa titik, dan ID lama
dibetulkan sendiri.

**"Offline" palsu** — kod menyemak `navigator.onLine` sebelum menghantar. Dalam webview
iOS nilai itu kadangkala salah, menyebabkan 187 rekod tersekat. Kini sistem cuba dahulu.

**Data tidak selari antara peranti** — dulu tinjau setiap 2–5 minit. Kini sambungan
langsung (SSE) menghantar perubahan dalam ~1 saat, dengan penggunaan data lebih rendah.

**Tetapan admin tidak sampai ke staff** — `saveUsers()` hanya menyimpan ke localStorage
peranti admin. Kini disegerak ke `mde/users` dan disiarkan langsung.

**Kebenaran tidak konsisten** — tab kelihatan tetapi tidak boleh diklik kerana dua
fungsi menggunakan peraturan berbeza. Kini kedua-duanya guna senarai sama.

**eRacing dikira sebagai PS4** dalam laporan Analisis. Kini berasingan.

**Station dinyahaktif masih ditawarkan** semasa tukar station. Kini ditapis.

**Storan penuh membuang rekod** — `tx.slice(-500)` memadam rekod lama secara senyap.
Dibuang; pengguna dimaklumkan sebaliknya.

### Ciri baharu

- Tab **Dashboard Operasi** — prestasi station, waktu sibuk, kaedah bayaran
- **Analitik Kewangan** di Home — penapis tempoh, KPI, graf trend, donut, insight
- Tab **Station** — aktif/nyahaktif, tambah, tukar nama & warna
- Warna mengikut jenis: PS5 biru · PS4 ungu · eRacing oren
- Butang **✅ Selesai** pada kad bila masa tamat
- **Tukar Station** kini untuk semua jenis, dengan pratonton harga
- Menu skrin penuh gaya Apple untuk telefon
- Backup automatik setiap jam

### Dibuang

Tab Pelanggan, Stok, Pencapaian, PS Overlay.
Auto-hantar ke Transaksi bila sesi tamat — kembali kepada **Kira & Hantar** manual.
