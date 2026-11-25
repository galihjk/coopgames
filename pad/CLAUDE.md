# pad/ — acuan format "Layar + HP pengendali"

Fondasi bersama untuk game yang tampil di layar komputer/TV, dengan tiap pemain memakai HP-nya
sendiri sebagai kontroler (memindai QR). Aturan proyek ada di `../CLAUDE.md`.
Contoh pemakaian lengkap: `../uji-koneksi/index.html` (±200 baris).

## Isi folder
| File | Dipakai oleh | Isi |
|---|---|---|
| `koneksi.js` | layar & HP | `CoopNet`: transport PeerJS (WebRTC), kode ruang, ping, sambung ulang, diagnosis. Game tidak memanggilnya langsung. |
| `kontrol.js` | layar (game) | `CoopPad.host(...)`: slot pemain, warna, input bernama, aksi, input netral saat HP diam, statistik ping, preset `SUSUNAN`. **Ini API untuk game.** |
| `index.html` | HP | Pengendali generik, alamatnya `/pad/#KODE`. Menggambar kontrol sesuai susunan yang dikirim layar. Satu halaman untuk semua game. |

## Membuat game baru format ini
1. Di HTML game, muat berurutan: PeerJS 1.5.4 (jsdelivr), `qrcode-generator@1.4.4` (jsdelivr),
   `../pad/koneksi.js`, `../pad/kontrol.js`.
2. `const pad = CoopPad.host({ susunan, onSiap(kode, url){ tampilkan QR berisi url }, onAksi(p, id, arah){...}, ... })`.
   API lengkapnya ada di komentar kepala `kontrol.js`.
3. Tiap frame, baca `p.input` untuk setiap `p` di `pad.pemain`. Data game per pemain disimpan di
   Map terpisah dengan kunci `p.id`, jangan ditempel ke objek `p`.
4. Tentukan aturan saat pemain terputus atau diam (`onKeluar`, `onDiam`, `p.tersambung`, `p.aktif`):
   jeda, bot mengambil alih, atau karakter diam. Itu keputusan game. Input sudah dinetralkan
   otomatis oleh `kontrol.js`.
5. Susunan kontrol: **tata letak dan isi dipisah.** Pakai tata letak yang ada, lalu isi slotnya
   dengan aksi game sendiri, mis. `CoopPad.TATA.aksi({ gerak:{...}, arah:{...}, kananAtas:{...},
   kiriBawah:{...}, kananBawah:{...} })`. Slot tombol boleh dikosongkan.
   `CoopPad.SUSUNAN.aksi` (SERANG/SKILL/TANGKIS/GULING) **hanya contoh pengisian**, jangan dianggap
   aturan. Bentuk area di luar tata letak yang ada boleh dibuat langsung dengan format di
   `kontrol.js`; kalau berguna untuk game lain, jadikan tata letak baru di `CoopPad.TATA`.
   Kalau butuh jenis kontrol baru (mis. slider atau tampilan pribadi per pemain untuk game
   asimetris), tambahkan di `index.html` + `kontrol.js` sebagai jenis zona/tombol baru, jangan
   membuat halaman HP terpisah.

## Keputusan desain (jangan diubah tanpa alasan)
- **Semua kontrol berupa area kotak** (relatif 0..1), bukan titik. Hasil uji HP (24 & 25-11-2026):
  saat mata menatap layar komputer, jempol tidak bisa membidik tombol kecil, dan tombol yang jauh
  (mis. SKILL di tengah atas) terasa terlalu jauh.
  - Zona (`stik`/`arah`) **mengambang**: titik jempol mendarat di dalam area = pusat lingkaran.
  - Tombol = **area besar di pinggir** yang bisa ditemukan dengan meraba. Boleh berbentuk L (beberapa kotak).
  - Tata letak `aksi` adalah rancangan pemilik: separuh kiri gerak; separuh kanan = area aksi
    berarah yang dikelilingi tiga tombol (kanan atas, kiri bawah, kanan bawah berbentuk L).
    Isi tiap slot ditentukan per game.
- **Tombol mengirim tekan, tahan, dan lepas.** `onAksi` saat ditekan (lebih cepat), `onLepas` saat
  dilepas, dan `p.input[id].tahan` selama ditahan (mis. tangkisan). Zona `arah` memicu `onAksi` saat
  dilepas, karena bidikannya baru final saat itu.
- **Aksi dikirim sebagai penghitung**, bukan sebagai kejadian: aksi tidak hilang walaupun ada paket
  jatuh. Kanal PeerJS `reliable:false` = tanpa urutan; paket ber-nomor-urut lama dibuang.
- **HP mengirim minimal 10×/dtk.** Kalau tidak ada data >0,4 dtk, layar menganggap HP diam dan
  menetralkan inputnya, supaya karakter tidak terus berjalan dengan input terakhir.
- **Slot mengikuti ID perangkat** (localStorage HP): menutup browser lalu memindai QR lagi kembali ke
  slot yang sama. **Kode ruang disimpan per tab** (sessionStorage layar): layar yang dimuat ulang
  memakai kode yang sama dan HP tersambung ulang sendiri (±2 dtk).
- **Tanpa registrasi:** server perantara publik PeerJS + STUN Google.

## Batasan jaringan (diuji di HP sungguhan, 24-11-2026)
- **WiFi router yang sama: jalan, ping ±15 ms.** Cukup untuk game aksi.
- **Laptop di hotspot HP: gagal** di langkah jalur langsung (ICE). Relay (TURN) gratis tanpa
  registrasi sudah tidak ada: relay bawaan PeerJS dan Open Relay tidak bisa di-resolve.
  Kalau hotspot perlu didukung, tambahkan relay berakun (mis. Metered/ExpressTURN) di `koneksi.js`.
  Konsekuensinya: kunci relay terlihat di kode statis.
- HP menampilkan diagnosis bertahap (perantara → layar ditemukan → jalur langsung) bila gagal.

## Resep uji otomatis
Skrip uji disimpan di scratchpad, bukan di repo.
1. Server statis Node: `/` = repo, `/__uji/` = folder uji di scratchpad.
2. Halaman pembungkus di `/__uji/` berisi iframe layar (`/uji-koneksi/` atau halaman game) dan
   iframe HP `/pad/?id=hp1#KODE`, `/pad/?id=hp2#KODE`. Parameter `?id=` memaksa ID perangkat
   berbeda per iframe, karena localStorage dipakai bersama satu origin.
3. Edge headless `--remote-debugging-port`, dikendalikan dari Node lewat WebSocket bawaan
   (DevTools Protocol). Baca `kode` dari iframe layar, klik `#tombolGabung` di iframe HP, lalu kirim
   sentuhan dengan `Input.dispatchTouchEvent` (koordinat halaman = posisi iframe + posisi di HP).
   Koneksinya memakai server PeerJS sungguhan.
4. Periksa lewat `Runtime.evaluate`: `ujiState.pad.pemain` (input, aktif, tersambung),
   `st` di iframe HP. Untuk meniru HP mendadak diam: `net.kirim=()=>false` di iframe HP.
   Untuk meniru jalur langsung gagal: ganti `window.Peer` di iframe HP dengan subclass yang
   memakai `config:{iceServers:[], iceTransportPolicy:'relay'}`.

## Belum diuji di HP sungguhan
- Susunan `aksi` versi area (SERANG dikelilingi SKILL/TANGKIS/GULING).
- Menutup browser HP lalu memindai lagi, dan memuat ulang halaman layar, di jaringan sungguhan.
