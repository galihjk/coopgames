# Dungeon Duo — catatan pengembangan

Dungeon labirin co-op tanpa akhir, 1–2 pemain di satu HP tegak, duduk **berdampingan**
(layar dibagi kiri/kanan: P1 joystick kiri, P2 joystick kanan). Mode solo: P2 dimainkan bot.
Aturan proyek ada di `../CLAUDE.md`. `README.md`/`CHANGELOG.md` adalah catatan lama pembuatnya
(sebagian sudah tidak sesuai, mis. sistem wave); jangan dijadikan acuan.

## Peta file
- `index.html`: markup HUD dan semua layar (`#start-screen`, `#upgrade-screen`, `#powerup-screen`,
  `#victory-screen`, `#game-over-screen`). Layar tampil lewat class `visible`.
- `js/game.js`: seluruh logika dalam satu IIFE (canvas 720×1280, dunia lebih besar + kamera).
- `js/audio.js` → `window.GameAudio` (efek suara); `js/music-playlist.js` → `window.DungeonMusic`
  (musik level/bos/upgrade). Berkas audio di `assets/audio/` (lihat `AUDIO_FILES.md`).
- `styles.css`: tampilan; blok `@media (max-width:760px)` adalah tata letak HP.

## Alur state & layar
- Menu → `beginRun(fromCheckpoint)` → `startLevel()`: buat labirin (`generateMaze`, seed
  `state.seed + level`), taruh pemain, **simpan checkpoint**, `state.phase='levelIntro'` → `'explore'`.
- `explore`: sel baru dikunjungi → tetangganya diaktifkan dan musuh muncul (`markCellVisited`/
  `activateCell`). Masuk gerbang bos (`checkGateCrossing`, ditolak bila masih ada musuh <520 px)
  → `triggerBossEncounter`: kedua pemain dipindah ke arena, gerbang disegel, `'warning'` → `'combat'`.
- Bos mati → `triggerVictory` (layar victory, `state.paused`) → tombol Lanjutkan →
  `openUpgradeScreen` → setelah kedua pilihan masuk, `level++` dan `startLevel()`.
- Power-up di lantai: disentuh → `openPowerupPickup(index)`, game dijeda sampai pemain itu memilih.
- `checkGameOver`: semua pemain down → layar game over (Mulai dari Awal / `restartLevelAssist`).
- Checkpoint: localStorage `dungeonDuoCheckpoint`, `version:4`, berisi stat pemain
  (`snapshotPlayers`) plus bendera `solo`. Saat dimuat, mode tetap mengikuti pilihan menu;
  bendera `solo` hanya informasi, sehingga simpanan lama tanpa bendera tetap bisa dimuat.

## Titik masuk input & bot
- Semua gerak membaca `input.sticks[i].vector` (vektor satuan atau nol). Joystick muncul di titik
  sentuh (`pointerDown`): kiri layar = P1, kanan = P2. Keyboard (`readKeyboardInput`) hanya mengisi
  stick yang tidak sedang disentuh: WASD = P1, panah = P2.
- Mode solo (`soloMode`, localStorage `dungeonDuoSolo`, tombol `#mode-button`): semua sentuhan dan
  kedua set tombol keyboard menggerakkan P1; joystick P2 tidak digambar; label P2 jadi "BOT"
  (`shortName`/`longName`, `applyModeUi`).
- **Bot** (`updateBot`, dipanggil di `update()` setelah keyboard, sebelum `updatePlayers`) hanya
  mengisi `input.sticks[1].vector`. Navigasi: jalan lurus bila jalur lebar badan bebas dinding &
  jurang (`botClearPath`); kalau tidak, menuju titik terbaru dari jejak P1 (`bot.trail`) yang
  terlihat; cadangan terakhir `pathDirectionTowards`. Tersangkut/tertinggal terlalu lama →
  `teleportBotNearLead` (dihitung di `bot.stats.teleports`).
- Bot berhenti di dekat P1 (histeresis berhenti/lanjut) agar ikut menyerang, berhenti juga bila
  ada musuh menghalangi, dan "menyentil" joystick satu frame untuk menghadap musuh. P1 down → bot
  menerobos ke P1 dan diam dalam radius revive.
- Upgrade & power-up bot: `botPickCard` meng-klik kartu acak setelah jeda; kartu bot diberi class
  `bot-choosing` (tidak bisa disentuh), dan tombol acak ulang disembunyikan saat giliran bot.

## Keputusan desain (jangan diubah tanpa alasan)
- **Pemain hanya menyerang saat diam**, dan target dipilih di cone depan. Inilah inti permainan
  (bergerak vs menyerang); bot pun harus diam untuk menyerang, jadi ia tidak boleh terus mengekor.
- **Tether** (lambat saat menjauh, batas jarak keras) menjaga kamera titik-tengah tetap memuat
  kedua pemain. Jangan dipakai sebagai navigasi bot: tether hanya menarik lurus menembus dinding.
- **Aturan kalah mode solo = aturan bawaan:** run gagal hanya bila P1 dan bot sama-sama down.
  P1 yang down dibangkitkan bot; bot yang down dibangkitkan P1. Berbeda dengan Nebula Duo, karena
  di sini revive memang mekanik utama dan bot dirancang untuk melakukannya.
- Bot sengaja tidak pintar dan tidak punya aturan khusus; teleport cadangan ada agar labirin
  dengan jurang/musuh tidak membuat P1 bermain sendirian.
- Mode 2 pemain harus tetap persis seperti sebelum mode solo ada.

## Resep uji headless (Node)
1. Baca `js/game.js`, sisipkan sebelum `})();` terakhir:
   `window.__dd={get state(){return state},update,render,bot,input,dom,cellAt,findCellPath,
   cellRectFor,damagePlayer,restartLevelAssist,hasLineOfSight};`.
2. Sandbox `vm`: elemen palsu (classList, children, `click()` memanggil listener, `querySelectorAll`
   per class), `getContext` → Proxy rekursif, `window.matchMedia`, `GameAudio`/`DungeonMusic`
   palsu, `performance.now` dan `setTimeout` mengikuti jam simulasi (kartu bot memakai setTimeout).
   Isi `localStorage.dungeonDuoSolo='1'` untuk mode solo.
3. P1 tiruan: menuju sel belum dikunjungi lewat `findCellPath`, lalu sel gol dan gerbang; berhenti
   & menghadap musuh <330 px; membangkitkan bot yang down. Layar diklik otomatis.
   Jatuhkan P1 sekali per level (`damagePlayer`) dan taruh power-up di posisi bot untuk menguji
   revive & pilihan bot. Catatan: `state.seed` berasal dari `Date.now()`, jadi tiap run beda labirin.
4. Screenshot solo: salin `index.html` ke scratchpad, tambah `<base href="file:///…/dungeon-duo-portrait/">`
   dan `localStorage.setItem('dungeonDuoSolo','1')` sebelum skrip game; lebar jendela ≥500 px, tegak.

## Belum diuji di HP
- Mode solo di HP sungguhan: kenyamanan joystick tengah, apakah bot terasa membantu atau
  menghalangi di koridor sempit, dan seberapa sering teleport bot terlihat mengganggu.
