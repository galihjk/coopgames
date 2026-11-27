# Jayaverse Laga: Judul Tanpa Nama — rencana desain

Status: **perencanaan, belum ada kode** (disusun 27-11-2026 di sesi koordinator).
Dokumen ini mencatat keputusan pemilik dan alasannya. Perbarui setiap kali ada keputusan baru;
tandai bagian yang berubah dengan tanggal.

## 1. Ringkasan
Petualangan aksi co-op untuk **1–4 pemain** di satu layar komputer/TV yang **selalu terbelah**
(satu potongan per pemain). Tiap pemain memakai **HP-nya sendiri sebagai kontroler** (pustaka
`../pad/`). Pemain memakai avatar sendiri, memilih **kelas (Kostum Laga)**, lalu menjelajah wilayah
besar dan mengalahkan monster serta bos gaya kartun di **Jayaverse Laga**. Benang merahnya: misteri
buku tanpa judul di lobi. Game ini souls-lite yang ramah keluarga, aman untuk anak **7+**, dan
dimainkan bersama orang tua.

## 2. Keputusan yang sudah diambil
| Topik | Keputusan | Alasan / catatan |
|---|---|---|
| Jenis | Souls-like berlevel besar, versi **souls-lite** | Rasa tempur yang terbaca (ancang-ancang, guling, stamina, titik simpan, bos berpola) tanpa hukuman berat |
| Pemain | **1–4**, **tanpa bot** | Keseimbangan diatur oleh aturan permainan, bukan rekan komputer (bagian 7) |
| Layar | **Selalu terbelah**: 1 = penuh, 2 = kiri/kanan, 3–4 = 2×2 (bertiga: potongan ke-4 = peta) | Pemain bebas berpencar; kamera per pemain |
| Kode | **Mulai dari nol** | Arsitektur bersih untuk N pemain + split screen. Bara Kembar hanya rujukan pelajaran |
| Kontroler | **HP = kontroler saja** (`pad/`, tata letak `CoopPad.TATA.aksi`) | HP jarang dilihat saat bermain. **HP bukan Gelang Jaya** |
| Kelas | **Pilih kelas di lobi**, bukan ganti senjata seperti Bara Kembar | Peran jelas, mudah dipahami pemula |
| Tema | **Adaptasi dunia Jayaverse, tanpa kanon novel** | Dunia dari novel pemilik (`D:\Galih\novel bikin\terjebak-di-jayaverse`); tokoh dan alur novel tidak dipakai |
| Waktu cerita | Setelah novel; Jayaverse berjalan normal, **tanpa insiden Penyapu** | |
| Pertarungan | Ada, melawan monster, di lini judul khusus **Jayaverse Laga** | Menjelaskan di dalam dunia kenapa boleh bertarung (bagian 3) |
| Batas konten | **7+**: monster lucu, efek kartun, monster kalah jadi konfeti/cahaya | Aman ditonton dan dimainkan anak bersama keluarga |
| Nuansa islami | **Halus, hanya lewat ucapan NPC** | Pemain tidak pernah dipaksa mengucapkan apa pun |
| Misteri | **A: "Judul Tanpa Nama"** | Mudah dibuat bertahap (satu halaman per bos), memberi alasan menjelajah |
| Judul | **Jayaverse Laga: Judul Tanpa Nama** | Pola "lini + subjudul", sehingga game berikutnya cukup subjudul baru |
| Folder | `jayaverse-laga/` | |

## 3. Dunia (adaptasi Jayaverse)
- **Jayaverse Laga** adalah lini judul pertarungan di Jayanti Fun-Lab. Ruangannya terpisah dari wahana
  anak-anak; anak kecil boleh ikut kalau didampingi orang tua. Monsternya adalah **tokoh cerita yang
  memang bertugas dilawan** dan kembali utuh setiap permainan (aturan reset Jayaverse). Mengalahkan
  mereka itu permainan, bukan kekejaman.
- Unsur dunia yang dipakai:
  - **Gerbang Jaya → lobi pusat.** Pemain memilih Kostum Laga, dan rak "buku" berisi wilayah.
  - **Gelang Jaya = HUD di layar game** (bagian 5).
  - **Regu 4 orang, salinan dunia sendiri** → 1–4 pemain.
  - **Bintang Semangat:** nyawa yang ramah. Berkurang hanya karena serangan atau kecerobohan, tidak
    pernah karena hal yang tidak bisa dihindari. Habis berarti kembali ke titik simpan, tanpa kehilangan progres.
  - **Daya Khayal:** kemampuan co-op khas game ini (bagian 8). Di judul Laga, Daya Khayal boleh membentuk senjata.
  - **Matahari Jingga:** suasana pagi–senja per wilayah, **tanpa hitung mundur**.
- Tidak dipakai: tokoh, alur, dan insiden novel (Akira, Kenzo, Bubu, Bugi, Penyapu, dan lain-lain).
  Pemandu dibuat baru khusus untuk game ini (nama dan wujud belum ditentukan).

## 4. Misteri "Judul Tanpa Nama"
- Di lobi ada **buku tanpa judul** yang tidak pernah dirilis. Halamannya hilang.
- **Setiap bos menjatuhkan satu halaman.** Halaman yang terkumpul membuka sedikit demi sedikit isi
  buku itu (potongan peta, gambar, suara pembuatnya), dan mungkin membuka wilayah rahasia.
- **Akhir:** buku itu ternyata judul Laga pertama yang tidak pernah selesai dibuat. Regu
  "menamatkannya", dan buku itu akhirnya mendapat nama.
- Detail cerita (siapa pembuatnya, kenapa terhenti, isi wilayah terakhir) masih terbuka.

## 5. Gaya, batas konten 7+, dan HUD
- **Monster lucu-menggemaskan**, bukan seram. Contoh: lendir pemarah, jamur ngambek, golem batu bata,
  kepiting sok jagoan. Bos besar menegangkan karena **pola serangannya**, bukan karena seram.
- **Efek serangan kartun:** tulisan "BONK!"/"POF!", bintang berputar, badan memipih lalu memantul.
  **Tanpa darah.** Monster yang kalah pusing, lalu menjadi konfeti/cahaya dan "kembali ke rak cerita".
  Pemain yang terkena: pusing sebentar dan bintang berkurang.
- **Nuansa islami lewat NPC:** pemandu berkata "Bismillah, ayo mulai!" di gerbang; penjaga titik
  simpan menyapa "Alhamdulillah, sampai juga"; ada pengingat "Jangan lupa minum, sambil duduk, ya!";
  NPC mengajak istirahat kalau sesi sudah lama. Tanpa umpatan di semua teks.
- **Gelang Jaya sebagai HUD**, kecil di pojok tiap potongan layar: Bintang, Semangat (darah), stamina.
  **Berbasis ikon dan harus terbaca di potongan 2×2:** ikon besar, sedikit teks, bingkai warna pemain.
  Wajib dicek dengan screenshot sejak tahap 0.
- **HP bergetar** sebagai umpan balik yang tidak perlu dilihat: terkena serangan, tanda bahaya bos.

## 6. Kelas (Kostum Laga)
Semua kelas memakai tata letak HP yang sama (`CoopPad.TATA.aksi`: kiri gerak; kanan dua zona
berarah + dua tombol), dengan isi berbeda. Nama dan isi di bawah ini masih **usulan**.

| Kelas | Peran | Zona berarah atas | Zona berarah bawah | Tombol | Kesulitan |
|---|---|---|---|---|---|
| Penjaga | Tameng tim | Ayunan palu | Perisai besar berarah (juga melindungi kawan dari tembakan) | Hentak (menarik perhatian musuh), guling | Mudah |
| Penyembuh | Pendukung | Bola cahaya | Sinar penyembuh diarahkan ke kawan | Kubah pelindung, bangkitkan dari jauh | Mudah |
| Pemburu | Jarak jauh | Panah (tahan = isi tenaga) | Jebakan dilempar berarah | Lompat mundur, panah sebar | Sedang |
| Pendekar | Jarak dekat | Tebasan (ketuk = kombo, tahan = tusukan) | Tangkis berarah (balas serang kalau tepat waktu) | Serbu, jurus | Menantang |
| Penyihir | Pengendali area | Mantra berarah | Dinding berarah | Kedip, mantra area | Sedang |

- **Kelas yang sama boleh dipilih lebih dari satu pemain.** Keseimbangan tidak bergantung pada
  komposisi tim; hanya ada bonus kecil untuk tim yang beragam.
- **Setiap kelas harus bisa menamatkan game sendirian.** Syarat ini diuji di setiap tahap.
- Data `info.durasi`, `info.arah`, dan `CoopPad.jenis()` dari `pad/` cukup untuk membedakan
  ketuk, tahan, sentilan berarah, dan bidikan.

## 7. Keseimbangan 1–4 pemain tanpa bot
- Kekuatan musuh mengikuti **jumlah pemain yang hadir di pertempuran itu**, bukan total pemain
  (karena pemain bisa berpencar).
- **Darah musuh naik lebih lambat dari jumlah pemain** (contoh ×1 / ×1,7 / ×2,3 / ×2,9). Kerusakan
  tidak dinaikkan.
- **Jatah serang:** hanya sejumlah musuh yang boleh menyerang satu pemain pada saat yang sama;
  sisanya mengitari. Pemain tidak dikeroyok, baik solo maupun anak kecil di tim.
- **Bos beradaptasi:** semakin banyak pemain, semakin banyak serangan yang menyasar beberapa orang,
  bukan hanya darah yang lebih tebal.
- **Solo tetap utuh:** satu kali bangkit sendiri per titik simpan. Pemain bisa bergabung atau keluar
  di tengah permainan, dan keseimbangan menyesuaikan saat itu juga.

## 8. Ramah keluarga dan mekanik khas
- **Kesulitan per pemain** (Santai / Normal / Tantangan), dipilih di lobi: kerusakan yang diterima
  dan jendela tangkis berbeda per pemain, di dunia yang sama.
- **Mati tidak menghilangkan apa pun.** Titik simpan rapat. Membangkitkan kawan cukup berdiri di
  dekatnya dengan waktu longgar; di Santai, pemain bangkit sendiri setelah beberapa detik.
- **Tanda bahaya jelas**: area besar, bunyi, dan getar HP sebelum pukulan bos.
- **Tidak ada** jebakan jatuh, jebakan tersembunyi, atau teks panjang.
- **Bantuan bos:** kalau tim kalah beberapa kali berturut-turut, tawarkan "bos melemah" (opsional).
- **Wilayah pendek** (±20–30 menit) dengan simpanan otomatis.
- **Daya Khayal (co-op khas):** pemain yang berdekatan menahan kontrol bersamaan untuk mewujudkan
  sesuatu, misalnya jembatan, perisai besar, atau alat pengepung bos. Semakin banyak yang ikut,
  semakin kuat. Rinciannya masih terbuka.

## 9. Arsitektur teknis (usulan untuk sesi game)
- **Modul JavaScript asli** (`<script type="module">`), tanpa build step, tetap HTML statis.
  Uji tampilan lewat server lokal (resep di `../pad/CLAUDE.md`), karena modul tidak bisa dibuka
  langsung dari `file://`.
- **Langkah logika tetap 60×/detik**, terpisah dari gambar, supaya deterministik dan mudah diuji headless.
- **Slot pemain 0..3**, masing-masing punya sumber input (HP lewat CoopPad; keyboard untuk
  pengembangan). Semua sumber mengisi satu struktur input yang sama.
- **Kamera dan viewport per pemain.** Fungsi gambar dunia menerima kamera dan kotak layar sebagai
  parameter, tidak memakai kamera global.
- **Performa 4 pandangan:** peta dipra-gambar per potongan (chunk); hanya benda yang terlihat di tiap
  pandangan yang digambar. **Target 60 fps dengan 4 pandangan di laptop biasa, diukur sejak tahap 0.**
- **Dunia:** peta petak per wilayah dalam format data, dimuat per wilayah.
- **Pertarungan berbasis data:** serangan = ancang-ancang, aktif, pulih, plus tanda bahaya (pola yang
  terbukti di Bara Kembar).
- **Simpanan:** progres per wilayah. Karakter bisa diikat ke ID perangkat HP, sehingga pemain yang
  kembali mendapat karakternya lagi (kemampuan ini sudah ada di `pad/`).

## 10. Tahapan
Satu tahap = satu atau beberapa sesi game. Koordinator menulis prompt per tahap, setelah hasil tahap
sebelumnya terlihat. **Tahap 2 adalah titik keputusan:** dimainkan sungguhan bersama keluarga sebelum
masuk konten besar.

| Tahap | Isi | Selesai bila |
|---|---|---|
| 0. Kerangka | Folder, loop, 1–4 slot, split screen, HUD Gelang Jaya sederhana, input HP + keyboard, peta uji, penghitung fps | 4 HP tiruan bergerak di 4 pandangan; fps terukur (target 60); HUD terbaca di 2×2 |
| 1. Inti tempur | 2 kelas (usul: Penjaga + Pemburu), stamina, guling, 2 jenis monster kartun, Bintang Semangat, membangkitkan kawan | Simulasi headless 1–4 pemain tanpa error; semua kontrol HP terpetakan |
| 2. Satu wilayah utuh | Peta besar, titik simpan, gerbang bos, 1 bos, halaman pertama "Judul Tanpa Nama", simpanan | **Uji main di HP bersama keluarga**, lalu putuskan lanjut atau revisi |
| 3. Progres | Kelas lain, peningkatan, item | Satu putaran progres utuh teruji |
| 4. Konten | Wilayah 2..N, monster dan bos baru, halaman misteri | Per wilayah: tamat dalam simulasi + uji HP |
| 5. Keseimbangan | Jatah serang, kesulitan per pemain, penyesuaian 1–4 pemain, bantuan bos | Setiap kelas bisa menamatkan wilayah 1 sendirian |
| 6. Polesan | Lobi, audio, akhir misteri, kartu galeri, `CLAUDE.md` game | Tayang di galeri |

## 11. Risiko dan penanganannya
- **Performa 4 pandangan:** diukur sejak tahap 0.
- **HUD terlalu kecil di 2×2:** desain berbasis ikon, dicek dengan screenshot di setiap tahap.
- **Cakupan membengkak:** konten besar baru dimulai setelah tahap 2 terasa menyenangkan dimainkan.
- **Hanya jalan di WiFi router yang sama:** dicantumkan jelas di lobi dan kartu galeri.

## 12. Pekerjaan tingkat proyek (sesi koordinator)
- `pad/`: **susunan kontrol per pemain** (label berbeda per kelas). Sekarang `CoopPad` hanya punya
  satu susunan untuk semua HP.
- `pad/`: **navigasi lobi dari HP** (memilih kelas dan kesulitan), dengan pilihan tetap ditampilkan di layar.
- Galeri: cara main baru `Layar + HP` di `LABEL_CARA`. Bara Kembar juga bisa memakai tag ini.

## 13. Keputusan yang masih terbuka
- Gaya grafis: prosedural seperti Bara Kembar, atau gambar/sprite.
- Kontroler tambahan: keyboard/mouse untuk 1–2 pemain, dan stik game lewat Gamepad API.
- Aturan berpencar: misalnya pintu bos baru terbuka kalau semua hadir, atau ada teleport ke kawan.
- Nama dan wujud pemandu baru; nama final kelas.
- Daftar wilayah dan tema tiap wilayah.
- Detail cerita "Judul Tanpa Nama".
