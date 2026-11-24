# coopgames — catatan proyek

Kumpulan game **co-op** di browser (semua pemain satu tim). Jumlah pemain dan cara main bebas
(satu HP, satu layar, HP masing-masing, bergiliran). Yang wajib hanya: co-op.

- Repo GitHub `galihjk/coopgames`, branch `main`. Setiap push ke `main` otomatis di-deploy Netlify ke
  https://gcoopgames.netlify.app. Isinya HTML statis, tanpa build step; publish dir = root.
- `index.html` di root = galeri kartu game (lihat "Galeri" di bawah).
- Tiap game ada di foldernya sendiri dan punya `CLAUDE.md` sendiri. **Baca itu dulu** sebelum
  membaca kodenya.

| Folder | Game | Pemain | Cara main |
|---|---|---|---|
| `bara-kembar/` | Bara Kembar: souls-like 10 level | 1–2 (solo + bot) | Satu HP, berhadapan |
| `dungeon-duo-portrait/` | Dungeon Duo: dungeon tanpa akhir | 2 | Satu HP, berdampingan |
| `nebula-duo/` | Nebula Duo: shooter vertikal | 1–2 (solo + bot) | Satu HP, berdampingan |

Arsip di luar repo: `d:\Galih\bikin game\arsip\dungeon-duo` (Dungeon Duo landscape lama). Jangan
dimasukkan lagi.

## Cara kerja
- Balas dan tulis komentar kode dalam **Bahasa Indonesia**.
- **Commit & push hanya bila diminta.** Pesan commit dalam Bahasa Indonesia. Kalau perubahannya hanya
  di satu game, awali dengan nama game, mis. `Nebula Duo: ...`. Untuk galeri: `Galeri: ...`.
- Pemilik menguji di **HP Android sungguhan, posisi tegak (portrait)**. Utamakan tampilan HP tegak.
  Game satu-HP berhadapan: P1 di sisi bawah, P2 di sisi atas.
- **Jangan mengklaim "sudah jalan" tanpa bukti**, dan sebutkan apa yang belum diuji di HP.
- Sesi **koordinator** (root) mengurus galeri, deploy, konsistensi antar-game, dan prioritas.
  Pekerjaan detail di dalam satu game dikerjakan di **sesi khusus game itu**. Koordinator menuliskan
  prompt sesi game (tujuan, latar belakang, batasan, file relevan, definisi selesai, apa yang
  dilaporkan balik).
- Setiap selesai mengubah struktur atau keputusan desain sebuah game, **perbarui `CLAUDE.md` game
  itu**. Isinya hanya hal yang tidak terlihat dari kode: peta file, alur, titik masuk, keputusan
  desain + alasannya, resep uji. Jangan tulis daftar fitur atau angka balancing.

## Cara menguji
Simpan skrip uji di folder scratchpad sesi, **bukan di repo**.
- **Logika:** simulasi headless di Node. Muat JS game ke `vm` dengan DOM/canvas tiruan
  (Proxy untuk `ctx`, elemen palsu untuk `getElementById`), lalu jalankan `update(dt)` ribuan frame
  dan cek error serta perilakunya. Game yang memakai IIFE perlu disisipi satu baris yang
  mengekspos state ke `globalThis` di salinan scratchpad. Resep spesifik ada di `CLAUDE.md` tiap game.
- **Tampilan:** screenshot Edge headless:
  `"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --screenshot=<path>
  --window-size=500,900 --allow-file-access-from-files --virtual-time-budget=<ms> file:///...`
  Lebar minimum ±500 px; di bawah itu gambar terpotong. Untuk menguji suatu keadaan (mode solo,
  layar tertentu), salin HTML ke scratchpad lalu sisipkan skrip kecil (isi `localStorage`, klik tombol).

## Pelajaran untuk semua game sentuh
- Gestur Android **"usap 3 jari ke bawah"** (tangkapan layar) memutus *semua* sentuhan begitu jari
  ketiga menempel, baik lewat Pointer Events maupun Touch Events. Ini batasan sistem HP, bukan bug
  game. Main berdua di satu HP sering memakai ≥3 jari, jadi pemain perlu mematikan gestur itu.
  Galeri sudah memuat tipsnya. Bara Kembar punya layar "Tes sentuh layar" dan peringatan otomatis.
  Selalu tangani `pointercancel` agar joystick tidak "macet".
- Pola kontrol yang terbukti nyaman (Bara Kembar): arah hadap langsung mengikuti joystick, joystick
  dua zona saat menahan tombol, input buffer ±0,25 detik, label + panah pada tiap tombol.
- **Bot rekan (mode solo):** bot hanya mengisi input pemain kedua (vektor joystick/tombol) seperti
  jempol manusia, tanpa aturan khusus. Untuk game ringan, cukup pendukung yang menempel di dekat P1.

## Galeri (`index.html`)
- Tiap game = satu `<a class="card">` dengan:
  - `data-pemain`: jumlah pemain yang didukung, dipisah koma (mis. `"1,2"`);
  - `data-cara`: `satu-hp` | `satu-layar` | `hp-masing` | `bergiliran`, dipisah koma.
- Tombol filter dibuat otomatis dari atribut itu. Baris "Cara main" baru tampil kalau ada ≥2 nilai.
- Chip di kartu ditulis manual: pemain (hijau), cara main (oranye), lalu info lain (`Berhadapan`/
  `Berdampingan`, `Solo + bot`, `⌨️ Keyboard`). Chip harus sesuai dengan kemampuan game yang
  sebenarnya.
- Cara main baru: tambahkan ke `LABEL_CARA` di skrip galeri dan ke bagian "Arti tag".
