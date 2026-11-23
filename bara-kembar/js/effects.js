'use strict';
// ---------- proyektil & hazard ----------
function spawnProj(owner, x, y, ang, sp, dmg, o) {
  L.projectiles.push(Object.assign({ owner, x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, dmg, life: 1, r: 4, pierce: 0, hit: new Set() }, o));
}
function updateProj(dt) {
  for (const pr of L.projectiles) {
    if (pr.homing && pr.owner === 'e') { // berbelok pelan ke pemain terdekat (berhenti mengejar setelah dipantulkan)
      let tg = null, bd = 1e9; for (const p of players) if (p.alive) { const d = dist(p, pr); if (d < bd) { bd = d; tg = p; } }
      if (tg) { const sp = Math.hypot(pr.vx, pr.vy), g = turnTo(Math.atan2(pr.vy, pr.vx), angTo(pr, tg), pr.homing * dt); pr.vx = Math.cos(g) * sp; pr.vy = Math.sin(g) * sp; }
    }
    pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.life -= dt;
    if (pr.kind === 'orb' && Math.random() < .5) part(pr.x, pr.y, rand(-10, 10), rand(-10, 10), .35, pr.owner === 'p' ? '#9ff' : (pr.col || '#ff8a3a'), 2.5, true);
    if (pr.full && Math.random() < .7) part(pr.x, pr.y, 0, 0, .25, '#ffe9a8', 2, true);
    if (tileSolidW(pr.x, pr.y)) { pr.life = 0; sparks(pr.x, pr.y, 5, pr.kind === 'orb' ? '#ff8a3a' : '#d8c8a8'); Snd.arrowHit(); continue; }
    if (pr.owner === 'p') {
      for (const e of targetables()) {
        if (pr.hit.has(e) || e.air) continue;
        if (Math.hypot(e.x - pr.x, e.y - pr.y) < e.r + pr.r) {
          const by = pr.by || (pr.src instanceof Player ? pr.src : null);
          if (by && !pr.scored && !e.shield) { pr.scored = true; L.stats.hits[by.i]++; } // akurasi: panah yang mengenai musuh
          pr.hit.add(e); hurtEnemy(e, pr.dmg, { x: pr.x - pr.vx * .05, y: pr.y - pr.vy * .05 }, { poise: pr.reflected ? 2 : .8, by });
          if (pr.pierce > 0) pr.pierce--; else { pr.life = 0; break; }
        }
      }
    } else {
      for (const p of players) {
        if (!p.alive || pr.hit.has(p)) continue;
        if (Math.hypot(p.x - pr.x, p.y - pr.y) < p.r + pr.r) {
          const r = hurtPlayer(p, pr.dmg, pr, { parryable: pr.parryable, knock: 100 });
          if (r === 'parry') {
            const s = pr.src && !pr.src.dead ? pr.src : null;
            const ang = s ? angTo(pr, s) : Math.atan2(-pr.vy, -pr.vx), sp = Math.hypot(pr.vx, pr.vy) * 1.6;
            pr.owner = 'p'; pr.by = p; pr.scored = true; pr.vx = Math.cos(ang) * sp; pr.vy = Math.sin(ang) * sp; pr.dmg *= 2.4; pr.life = 2; pr.reflected = true; pr.hit = new Set();
            msg(p, 'Dipantulkan!', 1);
          } else if (r !== 'miss') {
            pr.life = 0;
            if (r === 'hit' && pr.web) { p.slowT = 2.4; msg(p, 'Terjerat jaring! Gerak melambat', 1.2); for (let k = 0; k < 10; k++) part(p.x, p.y, rand(-40, 40), rand(-40, 40), .5, '#e8e8f0', 1.5); }
          }
          else pr.hit.add(p);
          break;
        }
      }
    }
  }
  L.projectiles = L.projectiles.filter(p => p.life > 0);
  for (const h of L.hazards) {
    if (h.kind === 'pillar') {
      h.t += dt;
      if (!h.done && h.t >= h.delay) {
        h.done = true; aoe(h.x, h.y, h.r, 28, { unblockable: true, knock: 200, stagger: .5 }); Snd.pillar(); shake(5);
        for (let k = 0; k < 26; k++) part(h.x + rand(-h.r, h.r) * .6, h.y + rand(-h.r, h.r) * .6, rand(-30, 30), rand(-140, -40), rand(.4, .9), Math.random() < .5 ? '#ffb347' : '#ff5a2a', rand(2, 4), true);
        decal(h.x, h.y, h.r * .8, 'rgba(10,6,4,.5)');
      }
      if (h.t > h.delay + .45) h.gone = true;
    } else if (h.kind === 'root') { // akar ent: bisa ditangkis, menahan sesaat
      h.t += dt;
      if (!h.done && h.t >= h.delay) {
        h.done = true; aoe(h.x, h.y, h.r, 18, { knock: 160, stagger: .35 }); Snd.hit();
        for (let k = 0; k < 12; k++) part(h.x, h.y, rand(-60, 60), rand(-60, 60), rand(.3, .6), '#4a3a28', rand(2, 3.5));
      }
      if (h.t > h.delay + .6) h.gone = true;
    } else if (h.kind === 'ring') {
      h.rad += h.speed * dt;
      for (const p of players) if (p.alive && !h.hit.has(p) && Math.abs(dist(p, h) - h.rad) < h.w / 2 + p.r * .6) { h.hit.add(p); hurtPlayer(p, h.dmg, h, { knock: 220 }); }
      if (h.rad > h.max) h.gone = true;
    }
  }
  L.hazards = L.hazards.filter(h => !h.gone);
}

// ---------- partikel ----------
function part(x, y, vx, vy, life, col, size, glow) { if (L.particles.length < 500) L.particles.push({ x, y, vx, vy, life, max: life, col, size, glow }); }
function sparks(x, y, n, col) { for (let k = 0; k < n; k++) { const a = Math.random() * TAU, s = rand(60, 260); part(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(.15, .4), col, rand(1.5, 2.8), true); } }
function blood(x, y, ang, n, col) {
  for (let k = 0; k < n; k++) { const a = ang + rand(-.7, .7), s = rand(40, 180); part(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(.3, .6), col, rand(2, 3.5)); }
  decal(x + Math.cos(ang) * 10, y + Math.sin(ang) * 10, rand(5, 10), col === '#8a1010' ? 'rgba(90,8,8,.6)' : 'rgba(15,8,12,.55)');
}
function puff(x, y, base, s) { part(x + rand(-5, 5), y + rand(-5, 5), rand(-15, 15), rand(-15, 15), rand(.3, .6), base + '.35)', rand(3, 6) * s); }
function decal(x, y, r, col) { L.decals.push({ x, y, r, col, rot: Math.random() * TAU }); if (L.decals.length > 140) L.decals.shift(); }
function slamFx(x, y, r, col = '#d8c8a8') {
  shake(11); Snd.slam(); vib(35);
  for (let k = 0; k < 30; k++) { const a = Math.random() * TAU, s = rand(80, 220); part(x + Math.cos(a) * r * .3, y + Math.sin(a) * r * .3, Math.cos(a) * s, Math.sin(a) * s, rand(.3, .7), col, rand(2, 4)); }
  G.fx.push({ kind: 'shock', x, y, r, t: 0 });
  decal(x, y, r * .55, 'rgba(0,0,0,.35)');
}
function updateParticles(dt) {
  for (const p of L.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.pow(.05, dt); p.vy *= Math.pow(.05, dt); p.life -= dt; }
  L.particles = L.particles.filter(p => p.life > 0);
  for (const f of G.fx) f.t += dt;
  G.fx = G.fx.filter(f => f.t < .4);
}
