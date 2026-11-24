# Nebula Duo — catatan pengembangan

Shooter vertikal co-op tanpa akhir, 1–2 pemain di satu HP tegak, duduk **berdampingan**
(P1 joystick kiri bawah, P2 joystick kanan bawah). Mode solo: P2 dimainkan bot.
Aturan proyek ada di `../CLAUDE.md`.

## Peta file
- `index.html`: seluruh game (CSS + markup layar + satu `<script>` IIFE ±600 baris). Tanpa modul.
- `sounds/*.mp3`: efek dan musik; daftar namanya ada di `SOUND_FILES`. `DAFTAR_FILE_SUARA_NEBULA_DUO.txt`
  adalah catatan lama dari pembuatnya (nama HTML di dalamnya sudah tidak berlaku).
- Grafis semuanya prosedural di canvas, tanpa sprite.

## Urutan isi skrip
audio → helper (`clamp`, `rand`, `irand`, RNG berbiji `R`) → simpanan (`save`, localStorage
`nebulaDuoSave`) → joystick `joy1`/`joy2` → `makePlayer` → `upgradePool` → layar (menu/HUD) →
level & musuh (`startLevel`, `nextWave`, `spawnBoss`) → bot (`updateBot`) → tembakan/damage →
`loseLevel`/`levelComplete`/`openUpgrade` → `update` → `draw*` → input pointer → tombol menu.

## Alur permainan
- Menu → `startFromMenu`. Kalau `save.level > 1`, pemain mendapat (level−1) kali `openUpgrade(true)`
  dulu, sebagai "upgrade persiapan", karena pesawat selalu dibuat ulang dari nol.
- Level: beberapa wave lalu bos. Bos mati → `levelComplete` → `save.level++` → `openUpgrade(false)`.
- Kalah → `loseLevel`: kesulitan adaptif turun (`save.difficulty *= .9`), level yang sama diulang dari menu.
- Pemain yang hancur (`alive=false`) **tidak bisa dibangkitkan** sampai level berikutnya.
- Seed level berasal dari `save.seed + level`, jadi wave/latar deterministik, tapi `Math.random` juga
  dipakai di banyak tempat.

## Titik masuk penting
- **Input:** `joy1`/`joy2` (`dx`,`dy` ∈ [-1,1]). `update()` hanya membaca nilai ini, dan pesawat
  menembak otomatis. Joystick posisinya tetap (`layoutJoys`), bukan muncul di titik sentuh.
  Pembagian sentuhan ada di `pointerDown`: kiri = P1, kanan = P2. Di mode solo semua sentuhan masuk ke P1.
- **Bot** (`updateBot`): hanya mengisi `joy2`. Ia menuju titik di samping P1 (±48 px, sisi
  berganti kalau mepet tepi), ditambah dorongan menjauh dari `enemyBullets` (<80 px) dan badan musuh.
  Bot memilih upgrade dengan meng-klik kartu acak 0,7 detik setelah `openUpgrade`.
- **Upgrade:** `upgradePool` berisi objek `{n, d, i, r, f(player)}`; `f` langsung mengubah stat pemain.

## Keputusan desain (jangan diubah tanpa alasan)
- Mode solo: **level gagal begitu P1 hancur** walaupun bot masih hidup (`allPlayersDead`), karena
  menonton bot bermain sendirian tidak seru.
- Bot sengaja tidak pintar: ia pendukung yang menempel, bukan pemain kedua yang mandiri.
- `save.solo` ikut disimpan, dan "Reset progres" mempertahankan pilihan mode.
- Tidak ada kontrol keyboard (hanya sentuh/pointer).

## Resep uji headless (Node)
1. Ambil isi `<script>` dari `index.html`, lalu ganti `})();` terakhir dengan
   `globalThis.__T={get players(){return players}, get save(){return save}, update, draw,
   startFromMenu, joy1, joy2, get enemies(){return enemies}, ...};})();`.
2. Sandbox `vm`: `document.getElementById` mengembalikan elemen palsu (dengan `classList`,
   `children`, `appendChild`, `click()` yang memanggil `onclick`, dan `getBoundingClientRect` → 500×900);
   `getContext` → Proxy yang semua metodenya no-op; `localStorage` dari objek;
   `Audio` palsu dengan `play()` → Promise; `setTimeout` dijalankan manual mengikuti jam simulasi
   (dibutuhkan untuk pilihan upgrade bot dan munculnya layar).
3. Jalankan `update(1/60)` berulang. Layar aktif dicek lewat `classList.contains('show')` pada
   `menu` / `upgradeScreen` / `gameOver`.
Untuk screenshot dalam mode solo: salin HTML ke scratchpad dan sisipkan
`localStorage.setItem("nebulaDuoSave", JSON.stringify({solo:true,...}))` sebelum skrip game.

## Belum diuji di HP
- Kenyamanan joystick tengah di mode solo, dan apakah bot terasa membantu atau menghalangi.
