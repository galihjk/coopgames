# Bara Kembar — catatan pengembangan

Souls-like co-op tampilan atas, 1–2 pemain di satu HP yang **berhadapan**, plus mode solo dengan
bot. Grafis prosedural (stickman/monster garis) di canvas, suara sintetis WebAudio. Aturan proyek
dan masalah gestur 3 jari ada di `../CLAUDE.md`.

## Peta file (`js/`, script biasa tanpa modul; urutan muat di `index.html` penting)
- `util.js`: matematika kecil, canvas, `resize`, transformasi layar (`baseT`, `toL`, `inFrame`, `screenToFrame`).
- `world.js`: `LEVELS` (peta ASCII + gaya), `BOSS_NAMES`, simpanan `SAVE` (localStorage `barakembar`), `RULE` (Santai/Normal), `isUnlocked`.
- `audio.js`: `Snd` (semua bunyi dibuat oscillator/noise).
- `input.js`: `IN[0..1]`, keyboard, pointer, `assignTouch`, input buffer, tes sentuh (`TT`), deteksi gestur (`live`, `gestureCancelled`).
- `state.js`: `G` (mode, banner, efek global), `frames()`, `newStats()`, `players`, `L`, `cam`.
- `level.js`: `loadLevel`, `populate`, tabrakan petak, `prerenderLevel` (gaya peta `forest`/`volcano`), `SPAWN_CHARS`, `GROUP_SIZE`.
- `player.js`: kelas pemain, `updatePlayer` (mesin status), `hurtPlayer`, tali (`sepVal`), warna (`PALETTE`).
- `enemies.js`: `ETYPE`, serangan data-driven `DEF`, `AI`, `TICK`, `startAtk`/`runAttack`, `hurtEnemy`, `lvlMul`.
- `monsters.js`: monster khas L3–10 & bos L8–10; menambah ke `ETYPE`/`DEF`/`AI`/`SPAWN_CHARS`/`BEAST_DRAW`.
- `bot.js`: `botUpdate` (otak rekan solo), `botThreat`, `botTarget`, `botWarp`.
- `effects.js`: proyektil, hazard (`pillar`, `ring`, `root`, `lava`), partikel.
- `flow.js`: api unggun, kabut gerbang, bos, portal, `levelCleared`/`continueAfterClear`, `respawnAll`.
- `render.js`: `render()`, `drawStick`/`drawRoll`, `drawEnemy` (memanggil `BEAST_DRAW`), cahaya, `drawOffscreen`.
- `ui.js`: kontrol & HUD, `drawCallouts` (label+panah tombol), `menuButtons(i)`/`uiTap`, layar ringkasan, epilog, tes sentuh, `drawGestureWarn`, layar Cara main (`drawIntro`).
- `main.js`: `update`, `updateCam`, `startGame`, `step` (loop `requestAnimationFrame`).
- `menu.js` (dimuat terakhir): menu awal HTML `#menu` di `index.html`; daftar kontroler `CTRL`, `showMenu`, `pickCtrl`, `isTouchCtrl`.

## Alur
- `G.mode`: `menu` (HTML: jumlah pemain → kontroler, disimpan di `SAVE.solo`/`SAVE.ctrl`) → `title` → (`intro` sekali per browser dibuka, `G.introSeen`) → `play` ⇄ `pause` / `over` (semua tumbang → `respawnAll` di api unggun terakhir) →
  `clear` (ringkasan level) → `play` level berikutnya, atau `win` (epilog) setelah level terakhir.
  `touchtest` (Tes sentuh) dan `records` (Catatan, tab kesulitan di `G.recView`) dibuka dari layar judul.
- Level: jelajah → nyalakan api unggun (checkpoint) → kedua pemain di depan kabut → masuk arena,
  gerbang tersegel (`L.bossState='active'`) → bos tumbang → portal → kedua pemain masuk portal.
- Level dengan `bosses: [...]` (L6, L8) = beberapa bos; menang setelah semua mati (`bossFallen` lalu `bossDefeated`).
  Flag level `stagger` (L6): bos kedua baru menyerang setelah ±8 dtk / bos pertama terdesak, dan saat satu bos mulai
  menyerang kembarannya menahan diri sesaat (`startAtk`). Alasannya: pemain dulu dikeroyok sejak detik pertama.
- Kunci level: `OPEN_LEVELS` pertama terbuka; tiap level tamat membuka satu lagi. `SAVE.clearedNormal` = tanda ✦.
- Mode Santai = nilai di `RULE` (dipakai lewat fungsinya, mis. `RULE.parryWin()`), bukan cabang kode terpisah.

## Koordinat
- Logika memakai layar "logis" landscape `W×H` (W sisi panjang). `baseT()` memutarnya ke layar asli;
  HP tegak: P1 di sisi **bawah**, P2 di **atas**. Landscape (desktop): P1 kiri, P2 kanan.
- Semua posisi sentuhan harus lewat `toL(clientX, clientY)`. Teks/HUD tiap pemain digambar di
  `inFrame(i, (LW, LH) => …)` (bingkai baca pemain i); `screenToFrame` untuk hit-test menu.
- Kamera (`cam`) membingkai pemain; zoom dibatasi `ZMIN`/`ZMAX` (dihitung di `resize`).

## Titik masuk
- **Input:** `IN[i]` = `mx,my` (joystick, −1..1) + `h[0..2]` (tombol serang / tameng-guling / ganti-ramuan).
  `pressed()` memakai buffer `BUFFER_T`; `tapped()` tanpa buffer (khusus sambung kombo).
  `updatePlayer` membaca `IN`, tidak pernah membaca sentuhan langsung.
- **Bot:** `update()` memanggil `botUpdate(players[1], players[0], dt)` sebelum `updatePlayer`, dan bot
  hanya menulis `IN[1]` seperti jempol manusia. Skill diundi berkala (`SKILL_EVERY`); senjata cenderung
  kebalikan rekan (`WANT_COMPLEMENT`). Serangan musuh baru perlu dikenali di `botThreat` agar bot bisa menghindar.
- **Level baru:** tambah objek di `LEVELS` (`map` ASCII: `#` dinding, `.` lantai, `S` start, `B` api unggun,
  `F` gerbang, `X` bos; area arena = flood fill dari `X` yang dibatasi `#`/`F`), nama bos di `BOSS_NAMES`.
  Pastikan arena tidak bocor dan semua musuh terjangkau dari `S` (cek dengan flood fill sebelum dipakai).
- **Monster/bos baru:** di `monsters.js`: `ETYPE` (+`anchored` kalau tak boleh terdorong), serangan di `DEF`
  (`wind/act/rec`, `hitFn`/`onAct`/`actUpd`, `tele`), `AI[type]`, huruf peta di `SPAWN_CHARS`,
  gambar di `BEAST_DRAW` (bukan manusia) atau dekorasi stickman di `drawEnemy`. Mekanik per frame → `TICK[type]`.

## Keputusan desain
- **Arah hadap instan** ikut joystick (kecuali saat mengayun/berguling/terhuyung): dulu badan berputar
  pelan → gagal menangkis & membidik. Gambar badan tetap berputar halus (`VTURN`).
- **Joystick dua zona** saat menahan tombol: dorongan ringan (`AIM_ONLY`) = membidik di tempat, penuh =
  melangkah pelan (`HOLD_SPD`). Supaya bisa membidik ke belakang tanpa mendekati musuh.
- **Input buffer** untuk semua tombol, kecuali sambung kombo pedang (memang menguji timing). Busur yang
  ditahan sejak berguling langsung membidik.
- **Tali:** mode 2 pemain membatasi jarak agar keduanya tetap di layar; dilonggarkan saat bos (`BOSS_SLACK`).
  Mode solo **tanpa tali** (dulu bot & pemain saling mengunci di peta berlantai); bot menyusul via `botWarp`.
- **Mode solo:** hanya P1 yang tampil (HUD, kontrol, menu); P2 = bot. Mode 2 pemain: hanya P1 memegang
  menu, P2 cukup memilih warna dan melihat "Menunggu P1…".
- **Menu awal berupa halaman HTML, bukan canvas:** arah layar & layar penuh baru bisa ditentukan setelah kontroler
  dipilih (sentuh tegak vs layar komputer). Tombol "PEMAIN & KONTROL" di layar judul kembali ke menu ini.
  Kontroler dengan `ready:false` tampil redup "Segera". Rencana tahap: (2) tampilan satu layar komputer + keyboard,
  mouse, mouse+keyboard (arah bidik terpisah dari arah jalan); (3) HP sebagai stik lewat `../pad/`;
  (4) sentuh mendatar solo; (5) pilihan bahasa.
- **Petunjuk tombol hanya di layar Cara main (`intro`) & layar jeda**, tidak lagi muncul di awal level atau tiap
  ganti senjata: dulu label bertumpuk menutupi arena saat pemain ganti senjata di tengah pertarungan. Tiap pemain
  menekan OK sendiri (`G.introOk`); mode 2 pemain baru mulai setelah keduanya OK.
- **Gestur 3 jari:** `pointercancel` saat ≥3 jari → jeda + `drawGestureWarn` (sekali per sesi).
- **Membangkitkan rekan:** progres (`revT`) hanya menyusut pelan saat penolong menjauh, dan bot yang sedang menolong
  baru beranjak kalau serangan hampir kena. Mode solo: P1 yang gugur bisa MENYERAH dari layar jeda (`canGiveUp`)
  → `gameOver()`. Alasannya: dulu bot gagal menolong di arena bos dan pemain hanya bisa menonton bot.
- **Gelombang cincin (hazard `ring`) bisa diparry/ditahan dari arah mana pun** (`omni` di `hurtPlayer`):
  dulu tak bisa diparry dan menjadi sumber kena terbanyak bagi pemain yang mengandalkan parry, padahal
  guling dihukum oleh proyektil yang masih beterbangan.
- **Catatan per kesulitan** `SAVE.rec[diff]` (`best`, `time`, `losses`; akses lewat `REC()`): Santai & Normal
  tidak sebanding, jadi rekor/riwayat dipisah. Tampil di ringkasan, layar jeda, pemilih level.
- **Bot saat bos berperisai** hanya mengincar totem, terutama yang dekat rekan (walau jauh/terhalang), dan saat
  bos aktif bot menjaga jarak lebih rapat dengan P1: dulu bot menembaki bos yang kebal & terpisah sendirian.
- Musuh biasa naik kekuatannya per level (`LEVEL_SCALE`), bos tidak (diatur sendiri per bos).

## Resep uji headless (Node)
1. Baca urutan file dari `<script src>` di `index.html`, lalu `vm.runInContext` tiap file ke satu context
   (let/const global dibagi antar-file, sama seperti di browser).
2. Palsukan: `document.getElementById`/`createElement` → objek `{getContext, style, addEventListener,
   setPointerCapture}`; `getContext` → Proxy no-op (sediakan `measureText`), `querySelector: () => ({})` (dipakai `menu.js`); `innerWidth/innerHeight`
   (400×800 = HP tegak), `devicePixelRatio`, `localStorage`, `navigator`, `screen`, `performance.now`
   (jam simulasi), `requestAnimationFrame` no-op, `setTimeout` manual (dipakai portal setelah bos).
3. `SAVE.diff='normal'; G.solo=true; startGame(idx)`, lalu panggil `step(now)` per frame (now += 1000/60).
   Gerakkan P1 lewat `IN[0].joy = {dx, dy, …}` / `IN[0].kb[k]`. Cek `G.mode`, `L.enemies`, `L.stats`, `players`.
   Untuk menguji bos langsung: buang musuh biasa, set `L.bossState='active'`, `L.gateState='sealed'`.
   Ringkasan level (`G.mode==='clear'`) perlu `continueAfterClear()` agar lanjut.
Screenshot: salin `index.html` ke scratchpad dengan `src` absolut, lalu sisipkan skrip yang mengatur
keadaan (`G.mode`, posisi, `startAtk(...)`) sebelum memotret dengan Edge headless.

## Belum ada laporan uji di HP
- Sudah dilaporkan: Level 1–10 tamat di Normal, mode solo. Belum: mode Santai, Level 7–10 berdua.
- Main berdua penuh setelah gestur "usap 3 jari" dimatikan.
