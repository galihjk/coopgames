'use strict';
// =====================================================================
//  ALUR LEVEL: api unggun, kabut, bos, portal
// =====================================================================
const bossTitle = () => L.def.title || BOSS_NAMES[L.def.boss];
const aliveBosses = () => (L.bosses || []).filter(b => !b.dead);
// salah satu bos kembar tumbang: kembarannya murka (fase 2, lebih cepat)
function bossFallen(e) {
  G.slowT = .8; shake(8); Snd.roar();
  for (const b of aliveBosses()) { b.p2 = true; b.spdMul = Math.max(b.spdMul, 1.3); b.cd = Math.min(b.cd, .6); }
  banner('', BOSS_NAMES[e.type] + ' tumbang — kembarannya murka!', 2.6, '#ff7a3a', false);
}
function bossDefeated(e) {
  L.bossState = 'dead'; L.gateState = 'open'; L.eclipse = 0; G.slowT = 1.4; Snd.music(false); Snd.victory();
  banner('MUSUH BESAR DITUMBANGKAN', bossTitle(), 4.5, '#ffd27a');
  for (const o of L.enemies) if (o.summon && !o.dead) killEnemy(o);
  L.projectiles = L.projectiles.filter(p => p.owner === 'p'); L.hazards = [];
  for (const p of players) if (p.down || p.dead) { if (p.dead) { p.x = e.x + rand(-30, 30); p.y = e.y + rand(-30, 30); resolveCircle(p); } revivePlayer(p, .5); }
  setTimeout(() => { if (L && L.bossState === 'dead') { L.portal = { x: L.bossSpawn.x, y: L.bossSpawn.y, t: 0 }; Snd.portal(); } }, 2200);
}
function respawnAll() {
  L.decals = []; L.particles = []; L.eclipse = 0;
  if (L.bossState !== 'dead') { L.bossState = 'dormant'; L.gateState = 'fog'; }
  populate();
  placePlayers(L.checkpoint, true);
  G.mode = 'play'; Snd.music(false);
  cam.x = L.checkpoint.x; cam.y = L.checkpoint.y;
  banner('', 'Bangkit kembali di api unggun', 2.2, '#e8d9b0', false);
}
function updateFlow(dt) {
  // revive
  for (const p of players) {
    if (!p.down) continue;
    const q = players[1 - p.i];
    p.downT -= dt;
    if (q.alive && dist(p, q) < 46) { p.revT += dt; if (Math.random() < .3) part(p.x + rand(-8, 8), p.y + rand(-8, 8), 0, -30, .6, '#fff1c0', 2, true); }
    else p.revT = Math.max(0, p.revT - dt * .5);
    if (p.revT >= 2.2) { revivePlayer(p, .4); msg(q, 'Rekanmu bangkit!', 1.5); }
    else if (p.downT <= 0 && G.mode === 'play') {
      p.down = false; p.dead = true; p.state = 'dead';
      msg(q, 'Rekanmu gugur. Capai api unggun atau kalahkan bos untuk membangkitkannya', 4);
    }
  }
  if (G.mode === 'play' && !players.some(p => p.alive)) gameOver();
  // api unggun
  for (const b of L.bonfires) {
    for (const p of players) {
      if (!p.alive || dist(p, b) > 40) continue;
      if (!b.lit) {
        b.lit = true; L.checkpoint = b; L.stats.bonfires++; Snd.bonfire(); banner('API UNGGUN MENYALA', 'Titik bangkit tersimpan', 3, '#ffb35c');
        for (const q of players) { if (q.dead) { q.x = b.x + rand(-20, 20); q.y = b.y + 20; resolveCircle(q); revivePlayer(q, 1); } if (q.alive) { q.hp = q.maxHp; q.flasks = RULE.flasks(); } }
        for (let k = 0; k < 40; k++) part(b.x, b.y, rand(-50, 50), rand(-120, -20), rand(.5, 1.2), '#ffb35c', 3, true);
      } else {
        const q = players[1 - p.i];
        if (q.dead) { q.x = b.x + rand(-20, 20); q.y = b.y + 20; resolveCircle(q); revivePlayer(q, 1); msg(p, 'Api unggun membangkitkan rekanmu', 2); }
      }
    }
  }
  // kabut gerbang
  const nearGate = (p, r) => L.gates.some(g => dist(p, g) < r);
  const living = players.filter(p => !p.dead);
  if (L.gateState === 'fog') {
    const near = living.filter(p => p.alive && nearGate(p, 85));
    if (living.length && near.length === living.length) { L.gateState = 'open'; Snd.fog(); }
    else if (near.length) { for (const p of near) if (!p.msg) msg(p, 'Tunggu rekanmu di depan kabut', 1.2); }
  } else if (L.gateState === 'open' && L.bossState === 'dormant') {
    if (living.length && living.every(p => p.alive && inArena(p))) {
      // pastikan tidak ada yang berdiri di petak gerbang
      if (!players.some(p => !p.dead && L.gates.some(g => Math.abs(p.x - g.x) < T / 2 + p.r && Math.abs(p.y - g.y) < T / 2 + p.r))) {
        L.gateState = 'sealed'; L.bossState = 'active';
        L.bosses.forEach((b, k) => { b.state = 'chase'; b.cd = 1.4 + k * .9; b.face = angTo(b, players.find(p => p.alive)); });
        banner(bossTitle(), '', 3.5, '#e8d9b0'); Snd.roar(); Snd.music(true); shake(8);
      }
    }
  }
  // portal
  if (L.portal) {
    L.portal.t += dt;
    const liv = players.filter(p => p.alive);
    if (liv.length && liv.every(p => dist(p, L.portal) < 52) && G.fadeDir === 0) {
      Snd.portal();
      levelCleared();
    } else if (liv.some(p => dist(p, L.portal) < 52)) for (const p of liv) if (dist(p, L.portal) < 52 && !p.msg) msg(p, 'Kedua pemain harus masuk portal', 1.2);
  }
}
function fadeTo(cb) { G.fadeDir = 1; G.fadeCb = cb; }
// level tamat: simpan progres & rekor, lalu tampilkan ringkasan statistik (lanjut lewat tombol P1)
function levelCleared() {
  const idx = L.idx, s = L.stats, rec = REC(), prev = rec.best[idx];
  const unlockedBefore = unlockedCount();
  if (!SAVE.cleared.includes(idx)) SAVE.cleared.push(idx);
  if (!isEasy() && !SAVE.clearedNormal.includes(idx)) SAVE.clearedNormal.push(idx);
  const record = prev == null || s.t < prev; if (record) rec.best[idx] = s.t;
  saveGame();
  G.clear = { idx, s, prev, record, easy: isEasy(), newUnlock: unlockedCount() > unlockedBefore ? unlockedCount() - 1 : -1 };
  fadeTo(() => { G.mode = 'clear'; G.clearT = 0; Snd.music(false); });
}
function continueAfterClear() {
  const next = G.clear.idx + 1;
  fadeTo(() => {
    if (next >= LEVELS.length) { G.mode = 'win'; G.winT = 0; Snd.victory(); }
    else if (isUnlocked(next)) { loadLevel(next); G.mode = 'play'; levelIntro(); }
    else { G.sel = next; G.mode = 'title'; } // jaga-jaga: level berikutnya masih terkunci
  });
}
function levelIntro() { banner('LEVEL ' + (L.idx + 1), L.def.name + (isEasy() ? '  ·  Santai' : ''), 3.2, '#e8d9b0'); }

function separate() {
  const all = players.filter(p => p.alive && p.state !== 'roll').concat(L.enemies.filter(e => !e.dead && !e.air && !(e.inv && e.type === 'queen')));
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const a = all[i], b = all[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = a.r + b.r;
    if (d < m && d > .01) {
      const o = (m - d) / d; const wt = o => o.maxPoise ? (ETYPE[o.type].anchored ? .01 : o.boss ? .1 : .4) : .6, wa = wt(a), wb = wt(b); // totem nyaris tak tergeser
      const s = wa + wb;
      a.x -= dx * o * wa / s; a.y -= dy * o * wa / s; b.x += dx * o * wb / s; b.y += dy * o * wb / s;
      resolveCircle(a); resolveCircle(b);
    }
  }
}
