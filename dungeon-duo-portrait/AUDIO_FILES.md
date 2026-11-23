# Dungeon Duo — Daftar File Audio

Game tetap dapat dimainkan tanpa file audio karena tersedia fallback bunyi sintetis dari Web Audio API. Untuk mengganti dengan audio produksi, taruh file MP3 berikut di `assets/audio/`.

## Musik
1. `music_stone_dungeon.mp3` — loop musik biome dungeon normal.
2. `music_boss.mp3` — loop musik boss yang lebih intens.
3. `music_menu.mp3` — musik menu utama (opsional; belum dipanggil MVP).

## UI dan transisi
4. `ui_click.mp3` — klik tombol/menu.
5. `ui_confirm.mp3` — konfirmasi pilihan upgrade (opsional).
6. `wave_warning.mp3` — peringatan sebelum wave masuk.
7. `portal_open.mp3` — portal/spawn point terbuka.
8. `level_complete.mp3` — level selesai.
9. `game_over.mp3` — kedua pemain down.

## Player
10. `weapon_melee_swing.mp3` — ayunan melee.
11. `weapon_melee_hit.mp3` — melee mengenai target.
12. `weapon_ranged_shot.mp3` — projectile player dilepas.
13. `projectile_hit.mp3` — projectile mengenai target/obstacle.
14. `player_hurt.mp3` — player terkena damage.
15. `player_down.mp3` — player memasuki downed state.
16. `player_revive.mp3` — revive berhasil.
17. `player_heal.mp3` — efek heal langsung (opsional).

## Musuh
18. `enemy_spawn.mp3` — musuh masuk arena.
19. `enemy_hurt.mp3` — musuh terkena damage.
20. `enemy_death.mp3` — musuh mati.
21. `enemy_attack_warning.mp3` — telegraph/wind-up serangan.
22. `enemy_melee_attack.mp3` — serangan melee musuh (opsional).
23. `enemy_ranged_shot.mp3` — projectile musuh (opsional).
24. `enemy_elite_aura.mp3` — loop aura elite (opsional).

## Boss
25. `boss_intro.mp3` — intro boss.
26. `boss_slam_warning.mp3` — telegraph ground slam (opsional).
27. `boss_slam.mp3` — impact ground slam.
28. `boss_projectile_burst.mp3` — radial projectile boss (opsional).
29. `boss_phase_change.mp3` — boss memasuki fase kedua (opsional).
30. `boss_death.mp3` — boss dikalahkan (opsional).

## Pickup dan upgrade
31. `pickup_heal.mp3` — heal diambil.
32. `pickup_upgrade.mp3` — upgrade dipilih.
33. `pickup_spawn.mp3` — pickup muncul (opsional).
34. `legendary_upgrade.mp3` — upgrade Legendary (opsional).

## Rekomendasi teknis
- Format utama: MP3, 44.1 kHz, stereo untuk musik dan mono untuk SFX.
- Musik sebaiknya loop mulus, sekitar 60–120 detik.
- SFX pendek: 0.05–1.2 detik.
- Normalisasi loudness: musik sekitar -16 LUFS, SFX sekitar -14 sampai -10 LUFS.
- Hindari reverb panjang agar dua pemain dan telegraph tetap mudah dibaca.

## Tambahan opsional untuk v3

File berikut belum wajib karena fallback synth tetap tersedia, tetapi dapat dipakai agar mekanik baru lebih terasa:

```text
shield_hit.mp3
shield_break.mp3
shield_recharge.mp3
projectile_fire.mp3
projectile_ice.mp3
projectile_poison.mp3
projectile_lightning.mp3
projectile_explosion.mp3
projectile_ricochet.mp3
enemy_charge_warning.mp3
enemy_charge.mp3
enemy_heal.mp3
boss_dash_warning.mp3
boss_dash.mp3
boss_laser_warning.mp3
boss_laser.mp3
boss_summon.mp3
```
