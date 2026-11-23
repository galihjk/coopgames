# Dungeon Duo — Browser Co-op MVP v3

Versi ini memperluas MVP menjadi endless co-op yang lebih stabil untuk run panjang. Fokus utama v3 adalah scaling level, kamera midpoint tanpa edge clamp, variasi boss/musuh, upgrade yang lebih terlihat, shield nyata, dan tampilan yang lebih kaya.

## Fitur gameplay

- Local co-op dua pemain pada satu perangkat.
- Dynamic joystick multitouch kiri dan kanan.
- Keyboard fallback: P1 = WASD, P2 = arrow keys.
- Player hanya menyerang saat berhenti.
- Target hanya dipilih pada cone di depan; melee diprioritaskan sebelum ranged.
- Cone ranged dasar dipersempit menjadi 60°.
- Attack wind-up dibatalkan jika player kembali bergerak.
- World-space 2400 × 1500.
- Kamera selalu mengikuti titik tengah dua pemain, termasuk ketika berada dekat batas arena.
- Player tetap tidak dapat melewati collider batas level.
- Dynamic zoom mengikuti jarak antar-player.
- Soft tether memberi peringatan, perlambatan saat menjauh, dan batas jarak maksimum.
- Spawn player/obstacle divalidasi dan collision resolver dapat mengeluarkan karakter dari overlap.
- Telegraph serangan musuh menggunakan aim yang dikunci dan sesuai area damage.
- 3 wave pada level awal, 4 wave mulai Level 7, dan 5 wave mulai Level 15.
- Boss muncul pada wave terakhir setiap level genap.
- Downed, revive partner, checkpoint level, restart level dengan difficulty assist, dan fullscreen.

## Scaling run panjang

- HP, damage, speed, attack cooldown, dan projectile speed musuh meningkat secara terpisah.
- Scaling setelah Level 8 dan Level 10 dipercepat tanpa hanya mengandalkan penambahan HP.
- Build yang memiliki upgrade jauh di atas ekspektasi memperoleh sedikit adaptive pressure pada HP/damage musuh.
- Upgrade tengah level tidak muncul pada setiap level: tersedia pada Level 1–2 dan setiap kelipatan 3.
- Level modifier mulai muncul dari Level 3.
- Enemy modifier mulai muncul dari Level 4 dan dapat bertumpuk pada level tinggi.

## Variasi musuh dan boss

Archetype musuh:

- Grunt
- Archer
- Brute
- Spearman
- Mage
- Charger
- Healer
- Elite

Enemy modifier:

- Fast
- Armored
- Regenerating
- Shielded
- Explosive
- Enraged

Boss memiliki empat bentuk dasar:

- Rift Golem
- Abyssal Horn
- Prismatic Warden
- Echo Necromancer

Setiap encounter memilih tiga serangan dari:

- Ground slam
- Radial projectile burst
- Dash line
- Laser line
- Summon minion

## Upgrade dan balancing

Terdapat lebih dari 30 upgrade melee, ranged, elemental, defense, movement, co-op, dan special.

Multishot tidak memberikan full damage pada setiap projectile:

- 1 projectile: 100% per projectile
- 2 projectile: 72% per projectile, total 144%
- 3 projectile: 56% per projectile, total 168%
- 4 projectile: 46% per projectile, total 184%
- 5 projectile: 39% per projectile, total 195%

Shield sekarang memiliki:

- Shield HP terpisah dari HP.
- Shield bar pada HUD.
- Regenerasi setelah beberapa detik tidak terkena damage.
- Visual hexagonal di sekitar karakter.

Projectile dapat berubah menjadi:

- Fire
- Ice
- Poison
- Lightning
- Explosive
- Homing
- Piercing
- Ricochet
- Multishot

Upgrade lain yang terlihat antara lain armor, heavy weapon, speed trail, orbiting blade, elemental marks, shockwave melee, dan linked ward.

## Menjalankan

```bash
python -m http.server 8080
```

Buka:

```text
http://localhost:8080
```

## Kontrol

- Player 1: joystick kiri atau `W A S D`.
- Player 2: joystick kanan atau tombol panah.
- Fullscreen: tombol **Fullscreen** atau tombol `F`.

## Struktur file

- `index.html` — canvas, HUD, overlay, upgrade screen, dan fullscreen.
- `styles.css` — tampilan responsive landscape dan rarity upgrade.
- `js/game.js` — gameplay, camera, scaling, boss, enemy modifier, upgrade, shield, dan rendering.
- `js/audio.js` — audio loader dan fallback Web Audio synth.
- `assets/audio/` — tempat file suara produksi.
- `AUDIO_FILES.md` — daftar file suara.
- `CHANGELOG.md` — rincian perubahan v3.
