'use strict';
// =====================================================================
//  MUSUH
// =====================================================================
const ETYPE = {
  grunt: { hp: 55, r: 12, speed: 66, poise: 26, aggro: 230, col: '#a9ab9c', sc: 1.15, lw: 2.4 },
  archer: { hp: 38, r: 11, speed: 62, poise: 14, aggro: 320, col: '#b58ad6', sc: 1.1, lw: 2.2 },
  brute: { hp: 150, r: 19, speed: 46, poise: 75, aggro: 230, col: '#d06a4e', sc: 1.75, lw: 3.4 },
  warden: { hp: 680, r: 26, speed: 72, poise: 160, aggro: 999, col: '#c9b48a', sc: 2.5, lw: 4.2, boss: true },
  queen: { hp: 820, r: 20, speed: 64, poise: 130, aggro: 999, col: '#ff9a5c', sc: 2.0, lw: 3.4, boss: true },
  exec: { hp: 920, r: 24, speed: 66, poise: 170, aggro: 999, col: '#9fb0c4', sc: 2.3, lw: 4.0, boss: true },
};
function makeEnemy(type, x, y) {
  const d = ETYPE[type];
  return {
    type, x, y, hx: x, hy: y, r: d.r, speed: d.speed, maxHp: d.hp, hp: d.hp, hpLag: d.hp, maxPoise: d.poise, poise: d.poise,
    aggroR: d.aggro, col: d.col, sc: d.sc, lw: d.lw, boss: !!d.boss, state: 'idle', st: 0, face: Math.random() * TAU,
    cd: rand(.5, 1.2), atk: null, flash: 0, showHp: 0, kx: 0, ky: 0, dead: false, deadT: 0, walk: 0, tgt: null, strafe: Math.random() < .5 ? 1 : -1,
    stagDur: 0, wA: .6, z: 0, alpha: 1, inv: false, air: false, p2: false, spdMul: 1
  };
}
function pickTarget(e) {
  let best = null, bd = 1e9;
  for (const p of players) {
    if (!p.alive) continue;
    const d = dist(e, p);
    const range = e.state === 'idle' ? e.aggroR : 650;
    if (d > range) continue;
    if (e.state === 'idle' && !los(e, p)) continue;
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
function hurtEnemy(e, dmg, src, o = {}) {
  if (e.dead || e.inv || e.air) return;
  const crit = e.state === 'parried' && o.melee;
  if (crit) dmg *= 3; else if (e.state === 'parried') dmg *= 1.5;
  e.hp -= dmg; e.flash = .12; e.showHp = 3;
  if (e.state === 'idle' && !e.boss) { e.state = 'chase'; alertNear(e); }
  e.poise -= dmg * (o.poise || 1) * (crit ? 3 : 1);
  const a = angTo(src, e);
  if (crit) { Snd.crit(); hitStop(.16); shake(9); vib(60); sparks(e.x, e.y, 30, '#ff5b3a'); blood(e.x, e.y, a, 20, '#1a0f14'); }
  else { Snd.hit(); hitStop(o.melee ? .055 : .03); shake(o.melee ? 3 : 1.5); sparks(e.x - Math.cos(a) * e.r * .5, e.y - Math.sin(a) * e.r * .5, 8, '#ffe2b0'); blood(e.x, e.y, a, 5, '#1a0f14'); }
  if (!e.boss) { const k = o.melee ? 120 : 60; e.kx += Math.cos(a) * k; e.ky += Math.sin(a) * k; }
  if (e.hp <= 0) { killEnemy(e); return; }
  if (e.poise <= 0) {
    e.poise = e.maxPoise;
    if (e.state !== 'parried') { e.state = 'stag'; e.st = 0; e.stagDur = e.boss ? 1.0 : .6; e.atk = null; e.inv = false; e.alpha = 1; }
  }
}
function alertNear(e) { for (const o of L.enemies) if (!o.dead && !o.boss && o.state === 'idle' && dist(o, e) < 170) o.state = 'chase'; }
function enemyParried(e) { e.atk = null; e.state = 'parried'; e.st = 0; e.stagDur = e.boss ? 1.3 : 1.6; e.z = 0; }
function killEnemy(e) {
  e.dead = true; e.deadT = 0; e.hp = 0; e.atk = null; Snd.enemyDie();
  for (let k = 0; k < 26; k++) part(e.x, e.y, rand(-80, 80), rand(-80, 80), rand(.5, 1.3), '#2a1d25', rand(2, 4));
  for (let k = 0; k < 12; k++) part(e.x, e.y, rand(-30, 30), rand(-70, -20), rand(.6, 1.4), '#ff9a4a', 2, true);
  if (e.boss) bossDefeated(e);
}

// ---------- serangan musuh (data + hook) ----------
function meleeArc(e, a, range, arc, dmg, o) {
  for (const p of players) {
    if (!p.alive || a.hit.has(p)) continue;
    if (dist(e, p) - p.r <= range && Math.abs(angDiff(e.face, angTo(e, p))) <= arc / 2) {
      a.hit.add(p); const r = hurtPlayer(p, dmg, e, o);
      if (r === 'parry') { enemyParried(e); return true; }
    }
  }
  return false;
}
function aoe(x, y, rad, dmg, o) { for (const p of players) if (p.alive && Math.hypot(p.x - x, p.y - y) <= rad + p.r) hurtPlayer(p, dmg, { x, y }, o); }
const fx = (e, d) => e.x + Math.cos(e.face) * d, fy = (e, d) => e.y + Math.sin(e.face) * d;

const DEF = {
  gSlash: { wind: .55, act: .12, rec: .7, track: 5, move: 70, anim: [.6, -1.9, 1.5], cd: [.7, 1.3],
    hitFn: (e, a) => meleeArc(e, a, 40, 2.0, 16, { parryable: true }), tele: (e, a, p) => teleArc(e.x, e.y, e.face, 40 + e.r, 2.0, p) },
  gHeavy: { wind: .95, act: .14, rec: .8, track: 4, move: 110, anim: [.6, -2.6, 1.6], cd: [.9, 1.5],
    hitFn: (e, a) => meleeArc(e, a, 46, 2.2, 24, { parryable: true, knock: 220 }), tele: (e, a, p) => teleArc(e.x, e.y, e.face, 46 + e.r, 2.2, p) },
  aShoot: { wind: .9, act: .05, rec: .6, anim: [0, 0, 0], cd: [1.0, 1.8], bow: true,
    windUpd: (e, a, dt) => { if (a.t < .6 && a.tgt) e.face = turnTo(e.face, angTo(e, a.tgt), 4 * dt); },
    onAct: e => { spawnProj('e', fx(e, 14), fy(e, 14), e.face, 340, 14, { kind: 'arrow', parryable: true, life: 1.4, r: 4, src: e }); Snd.bow(); },
    tele: (e, a, p) => teleLine(e.x, e.y, e.face, 320, 3 + p * 3, p) },
  bSlam: { wind: 1.0, act: .12, rec: 1.1, track: 1.6, anim: [.4, 3.0, 0], cd: [1, 1.6],
    onAct: e => { const x = fx(e, 36), y = fy(e, 36); aoe(x, y, 62, 32, { guard: 2.2, knock: 260, stagger: .5 }); slamFx(x, y, 62); },
    tele: (e, a, p) => teleCircle(fx(e, 36), fy(e, 36), 62, p) },
  bSweep: { wind: .75, act: .15, rec: .8, track: 3.5, move: 60, anim: [.4, -2.2, 2.0], cd: [.8, 1.4],
    hitFn: (e, a) => meleeArc(e, a, 60, 2.8, 22, { parryable: true, knock: 240 }), tele: (e, a, p) => teleArc(e.x, e.y, e.face, 60 + e.r, 2.8, p) },

  // ---- Penjaga Gerbang ----
  wSweep: { wind: .72, act: .15, rec: .55, track: 4.5, move: 100, anim: [.5, -2.0, 2.0], cd: [.4, .8],
    hitFn: (e, a) => meleeArc(e, a, 78, 2.9, 26, { parryable: true, knock: 260 }), tele: (e, a, p) => teleArc(e.x, e.y, e.face, 78 + e.r, 2.9, p),
    next: e => Math.random() < (e.p2 ? .75 : .45) ? DEF.wSweep2 : null },
  wSweep2: { wind: .4, act: .15, rec: .6, track: 5, move: 110, anim: [2.0, 2.4, -2.0], cd: [.5, .9],
    hitFn: (e, a) => meleeArc(e, a, 78, 2.9, 24, { parryable: true, knock: 260 }), tele: (e, a, p) => teleArc(e.x, e.y, e.face, 78 + e.r, 2.9, p),
    next: e => e.p2 && Math.random() < .7 ? DEF.wOverhead : null },
  wOverhead: { wind: .55, act: .14, rec: .9, track: 4, move: 60, anim: [-2.0, 3.0, 0], cd: [.6, 1],
    onAct: e => { const x = fx(e, 70), y = fy(e, 70); aoe(x, y, 46, 34, { guard: 2, knock: 280, stagger: .5 }); slamFx(x, y, 46); },
    tele: (e, a, p) => { teleLine(e.x, e.y, e.face, 110, 34, p); } },
  wLeap: { wind: .55, act: .6, rec: .95, anim: [.5, -2.6, -2.6], cd: [.5, .9], track: 3,
    onStart: (e, a) => { const t = a.tgt; a.tx = t.x; a.ty = t.y; Snd.bossTele(); },
    windUpd: (e, a, dt) => { if (a.tgt && a.tgt.alive && a.t < .4) { a.tx = lerp(a.tx, a.tgt.x, 6 * dt); a.ty = lerp(a.ty, a.tgt.y, 6 * dt); } },
    onAct: (e, a) => { a.sx = e.x; a.sy = e.y; e.air = true; Snd.swingHeavy(); },
    actUpd: (e, a) => { const k = clamp(a.t / .6, 0, 1); e.x = lerp(a.sx, a.tx, k); e.y = lerp(a.sy, a.ty, k); e.z = Math.sin(k * Math.PI) * 70; },
    onRec: (e, a) => {
      e.air = false; e.z = 0; resolveCircle(e); aoe(e.x, e.y, 88, 34, { guard: 2, knock: 320, stagger: .6 }); slamFx(e.x, e.y, 88);
      if (e.p2) L.hazards.push({ kind: 'ring', x: e.x, y: e.y, rad: 30, speed: 230, max: 330, w: 16, hit: new Set(), dmg: 20 });
    },
    tele: (e, a, p) => teleCircle(a.tx, a.ty, 88, p), teleAct: (e, a) => teleCircle(a.tx, a.ty, 88, 1) },
  wCharge: { wind: .75, act: .75, rec: .5, track: 5, anim: [.5, 1.6, 1.6], cd: [.5, .9],
    windUpd: (e, a) => { if (a.t > .55) a.lock = true; },
    onAct: (e, a) => { Snd.roar(); a.hitW = false; },
    actUpd: (e, a, dt) => {
      const hit = moveCircle(e, Math.cos(e.face) * 430 * dt, Math.sin(e.face) * 430 * dt);
      if (Math.random() < .6) puff(e.x, e.y, 'rgba(160,140,110,', 2);
      for (const p of players) if (p.alive && !a.hit.has(p) && dist(e, p) < e.r + p.r + 4) { a.hit.add(p); hurtPlayer(p, 28, e, { knock: 340, guard: 1.6, stagger: .5 }); }
      if (hit) { e.atk = null; e.state = 'stag'; e.st = 0; e.stagDur = 1.4; shake(10); Snd.slam(); sparks(fx(e, e.r), fy(e, e.r), 20, '#ffd28a'); }
    },
    tele: (e, a, p) => teleLine(e.x, e.y, e.face, 380, e.r * 2, p) },
  wRoar: { wind: 1.2, act: .2, rec: .5, anim: [-2.4, -2.4, -2.4], cd: [.3, .5],
    onStart: e => { e.inv = true; Snd.roar(); shake(12); },
    onAct: e => { e.inv = false; for (const p of players) if (p.alive) { const a = angTo(e, p), d = dist(e, p); if (d < 220) { p.kx = Math.cos(a) * 420; p.ky = Math.sin(a) * 420; } } L.hazards.push({ kind: 'ring', x: e.x, y: e.y, rad: 30, speed: 260, max: 360, w: 16, hit: new Set(), dmg: 12 }); },
    tele: (e, a, p) => teleCircle(e.x, e.y, 220, p * .5) },

  // ---- Ratu Abu ----
  qVolley: { wind: .75, act: .05, rec: .6, track: 4, anim: [.3, -1.2, .8], cd: [.5, 1.0],
    onAct: e => { const n = e.p2 ? 5 : 3; for (let k = 0; k < n; k++) spawnProj('e', fx(e, 20), fy(e, 20), e.face + (k - (n - 1) / 2) * .24, 190, 18, { kind: 'orb', parryable: true, life: 3, r: 8, src: e }); Snd.fire(); },
    tele: (e, a, p) => { for (let k = 0; k < (e.p2 ? 5 : 3); k++) teleLine(e.x, e.y, e.face + (k - ((e.p2 ? 5 : 3) - 1) / 2) * .24, 160, 2, p); } },
  qPillars: { wind: .5, act: .05, rec: .75, anim: [.3, -3.0, -3.0], cd: [.6, 1.1],
    onAct: e => {
      for (const p of players) if (p.alive) L.hazards.push({ kind: 'pillar', x: p.x, y: p.y, r: 44, t: 0, delay: 1.05 });
      if (e.p2) for (let k = 0; k < 4; k++) { const t = L.arenaTiles[(Math.random() * L.arenaTiles.length) | 0]; L.hazards.push({ kind: 'pillar', x: t.x, y: t.y, r: 44, t: 0, delay: 1.2 + k * .15 }); }
      Snd.bossTele();
    } },
  qNova: { wind: .85, act: .1, rec: .8, anim: [.3, -3.0, 3.0], cd: [.4, .8],
    onAct: e => { aoe(e.x, e.y, 118, 26, { knock: 360, guard: 1.8, stagger: .5 }); slamFx(e.x, e.y, 118, '#ff8a3a'); Snd.pillar(); },
    tele: (e, a, p) => teleCircle(e.x, e.y, 118, p), next: () => Math.random() < .6 ? DEF.qTele : null },
  qTele: { wind: .45, act: .05, rec: .4, anim: [.3, .3, .3], cd: [.3, .6],
    onStart: e => { e.inv = true; Snd.fire(); },
    windUpd: (e, a) => { e.alpha = 1 - a.t / .45; },
    onAct: e => {
      let best = null, bs = -1;
      for (let k = 0; k < 20; k++) {
        const t = L.arenaTiles[(Math.random() * L.arenaTiles.length) | 0];
        let md = 1e9; for (const p of players) if (p.alive) md = Math.min(md, dist(t, p));
        const s = md > 150 && md < 330 ? 1000 - Math.abs(md - 230) : md > 330 ? 300 : md;
        if (s > bs && !tileSolidW(t.x, t.y)) { bs = s; best = t; }
      }
      if (best) { e.x = best.x; e.y = best.y; }
      for (let k = 0; k < 16; k++) part(e.x, e.y, rand(-60, 60), rand(-60, 60), rand(.4, .8), '#ff9a5c', 2.5, true);
    },
    onRec: e => { e.inv = false; e.alpha = 1; } },
  qSpiral: { wind: .6, act: 2.4, rec: .8, anim: [.3, -3, -3], cd: [.8, 1.2],
    onStart: e => Snd.bossTele(),
    onAct: (e, a) => { a.emit = 0; a.ang = e.face; },
    actUpd: (e, a, dt) => { a.emit -= dt; if (a.emit <= 0) { a.emit = .14; a.ang += .42; for (let k = 0; k < 3; k++) spawnProj('e', e.x, e.y, a.ang + k * TAU / 3, 125, 14, { kind: 'orb', parryable: true, life: 4, r: 7, src: e }); Snd.fire(); } },
    tele: (e, a, p) => teleCircle(e.x, e.y, 40, p) },
  qSummon: { wind: 1.1, act: .1, rec: .5, anim: [-3, -3, -3], cd: [.4, .6],
    onStart: e => { e.inv = true; Snd.roar(); shake(8); },
    onAct: e => {
      e.inv = false;
      for (let k = 0; k < 2; k++) {
        const t = L.arenaTiles.filter(t => players.every(p => dist(t, p) > 160))[(Math.random() * 40) | 0] || L.arenaTiles[0];
        const g = makeEnemy('grunt', t.x, t.y); g.summon = true; g.state = 'chase'; L.enemies.push(g);
        for (let j = 0; j < 14; j++) part(t.x, t.y, rand(-40, 40), rand(-80, -10), rand(.5, 1), '#ff9a5c', 2.5, true);
      }
    },
    tele: (e, a, p) => teleCircle(e.x, e.y, 60, p * .4) },

  // ---- Algojo Rantai Bara (level 3) ----
  xSwing: { wind: .62, act: .15, rec: .6, track: 4.5, move: 80, anim: [.5, -2.2, 2.0], cd: [.5, .9],
    hitFn: (e, a) => meleeArc(e, a, 84, 2.6, 26, { parryable: true, knock: 250 }), tele: (e, a, p) => teleArc(e.x, e.y, e.face, 84 + e.r, 2.6, p),
    next: e => e.p2 && Math.random() < .55 ? DEF.xSwing2 : null },
  xSwing2: { wind: .38, act: .15, rec: .7, track: 5, move: 90, anim: [2.0, 2.4, -2.0], cd: [.5, .9],
    hitFn: (e, a) => meleeArc(e, a, 84, 2.6, 24, { parryable: true, knock: 250 }), tele: (e, a, p) => teleArc(e.x, e.y, e.face, 84 + e.r, 2.6, p) },
  // putaran rantai: area di sekeliling bos, bos ikut bergeser ke sasaran; setelahnya pusing (celah menyerang)
  xSpin: { wind: .8, act: 1.5, rec: 1.0, track: 3, anim: [.5, 0, 0], cd: [.6, 1],
    onAct: (e, a) => { a.tick = 0; Snd.swingHeavy(); },
    actUpd: (e, a, dt) => {
      e.face += 13 * dt;
      if (a.tgt && a.tgt.alive) { const g = angTo(e, a.tgt); moveCircle(e, Math.cos(g) * 55 * e.spdMul * dt, Math.sin(g) * 55 * e.spdMul * dt); }
      a.tick -= dt; if (a.tick <= 0) { a.tick = .3; aoe(e.x, e.y, 96, 14, { knock: 240, guard: 1.4, stagger: .3 }); Snd.swing(); }
    },
    tele: (e, a, p) => teleCircle(e.x, e.y, 96, p), teleAct: e => teleCircle(e.x, e.y, 96, .55) },
  // kait rantai: garis lurus; yang terkena ditarik ke bos lalu ditebas
  xHook: { wind: .65, act: .35, rec: .7, track: 4, anim: [.5, -1.6, 0], cd: [.5, .9],
    windUpd: (e, a) => { if (a.t > .45 / e.spdMul) a.lock = true; },
    onAct: (e, a) => { a.len = 0; Snd.chain(); Snd.swing(); },
    actUpd: (e, a) => {
      a.len = Math.min(280, a.t / .18 * 280);
      const cx = Math.cos(e.face), cy = Math.sin(e.face);
      for (const p of players) {
        if (!p.alive || a.hit.has(p)) continue;
        const ox = p.x - e.x, oy = p.y - e.y, along = ox * cx + oy * cy, perp = Math.abs(-ox * cy + oy * cx);
        if (along > 0 && along < a.len + p.r && perp < 12 + p.r) {
          a.hit.add(p); const r = hurtPlayer(p, 18, e, { parryable: true, knock: 60 });
          if (r === 'parry') { enemyParried(e); return; }
          if (r === 'hit') { const g = angTo(p, e); p.kx = Math.cos(g) * 420; p.ky = Math.sin(g) * 420; e.hookHit = true; }
        }
      }
    },
    next: e => { const h = e.hookHit; e.hookHit = false; return h ? DEF.xSwing : null; },
    tele: (e, a, p) => teleLine(e.x, e.y, e.face, 280, 24, p) },
  xSlam: { wind: .9, act: .12, rec: .9, track: 3, anim: [-2.2, 3.0, 0], cd: [.6, 1],
    onAct: e => {
      const x = fx(e, 80), y = fy(e, 80); aoe(x, y, 60, 32, { guard: 2, knock: 280, stagger: .5 }); slamFx(x, y, 60);
      L.hazards.push({ kind: 'ring', x, y, rad: 20, speed: 220, max: e.p2 ? 320 : 220, w: 14, hit: new Set(), dmg: 14 });
    },
    tele: (e, a, p) => teleCircle(fx(e, 80), fy(e, 80), 60, p) },
  // retakan bara: deret pilar api menjalar lurus ke depan (tidak bisa ditangkis)
  xQuake: { wind: .7, act: .05, rec: .8, track: 5, anim: [.5, -2.8, -2.8], cd: [.7, 1.1],
    onAct: e => {
      for (let k = 1; k <= 7; k++) { const x = fx(e, 30 + k * 52), y = fy(e, 30 + k * 52); if (tileSolidW(x, y)) break; L.hazards.push({ kind: 'pillar', x, y, r: 40, t: 0, delay: .55 + k * .11 }); }
      Snd.bossTele();
    },
    tele: (e, a, p) => teleLine(e.x, e.y, e.face, 390, 30, p) },
};
function startAtk(e, def, tgt) {
  e.state = 'atk'; e.atk = { def, ph: 'w', t: 0, tgt: tgt || e.tgt, hit: new Set() };
  def.onStart && def.onStart(e, e.atk);
  if (!def.onStart) e.boss ? Snd.bossTele() : Snd.tele();
}
function runAttack(e, dt) {
  const a = e.atk, d = a.def, sp = e.spdMul;
  a.t += dt;
  if (a.ph === 'w') {
    if (d.track && a.tgt && !a.lock) e.face = turnTo(e.face, angTo(e, a.tgt), d.track * sp * dt);
    d.windUpd && d.windUpd(e, a, dt);
    if (a.t >= d.wind / sp) { a.ph = 'a'; a.t = 0; a.hit = new Set(); d.onAct && d.onAct(e, a); }
  } else if (a.ph === 'a') {
    d.actUpd && d.actUpd(e, a, dt);
    if (e.atk !== a) return;
    if (d.move) moveCircle(e, Math.cos(e.face) * d.move * dt, Math.sin(e.face) * d.move * dt);
    if (d.hitFn && d.hitFn(e, a)) return;
    if (a.t >= d.act) { a.ph = 'r'; a.t = 0; d.onRec && d.onRec(e, a); }
  } else {
    if (a.t >= d.rec / sp) {
      e.atk = null; e.state = 'chase';
      e.cd = rand(d.cd[0], d.cd[1]) / sp;
      const n = d.next && d.next(e);
      if (n && a.tgt && a.tgt.alive) startAtk(e, n, a.tgt);
    }
  }
}
function weaponAngle(e) {
  const a = e.atk; if (!a) return e.state === 'parried' || e.state === 'stag' ? 2.6 : .6;
  const [r0, r1, r2] = a.def.anim, sp = e.spdMul;
  if (a.ph === 'w') return lerp(r0, r1, easeOut(clamp(a.t / (a.def.wind / sp), 0, 1)));
  if (a.ph === 'a') return lerp(r1, r2, easeOut(clamp(a.t / a.def.act, 0, 1)));
  const k = clamp(a.t / (a.def.rec / sp), 0, 1); return lerp(r2, r0, clamp((k - .5) * 2, 0, 1));
}

function pathMove(e, t, spd, dt) {
  let ang;
  if (los(e, t)) ang = angTo(e, t);
  else {
    const f = L.fields[t.i]; if (!f) return;
    const tx = Math.floor(e.x / T), ty = Math.floor(e.y / T);
    let best = f[ty * L.w + tx], bx = -1, by = -1;
    if (best < 0) best = 9999;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = tx + dx, ny = ty + dy; if (tileSolid(nx, ny)) continue;
      if (dx && dy && (tileSolid(tx + dx, ty) || tileSolid(tx, ty + dy))) continue;
      const v = f[ny * L.w + nx]; if (v >= 0 && v < best) { best = v; bx = nx; by = ny; }
    }
    if (bx < 0) return;
    ang = Math.atan2((by + .5) * T - e.y, (bx + .5) * T - e.x);
  }
  e.face = turnTo(e.face, ang, 7 * dt);
  moveCircle(e, Math.cos(ang) * spd * dt, Math.sin(ang) * spd * dt);
  e.walk += spd * dt * .11;
}
const AI = {
  grunt(e, t, dt) {
    const d = dist(e, t);
    if (d < 44 + t.r && e.cd <= 0 && los(e, t)) { e.face = angTo(e, t); startAtk(e, Math.random() < .7 ? DEF.gSlash : DEF.gHeavy, t); return; }
    if (d > 34) pathMove(e, t, e.speed * e.spdMul, dt);
    else { e.face = turnTo(e.face, angTo(e, t), 6 * dt); }
  },
  archer(e, t, dt) {
    const d = dist(e, t), see = los(e, t);
    if (!see) { pathMove(e, t, e.speed, dt); return; }
    const a = angTo(e, t); e.face = turnTo(e.face, a, 6 * dt);
    let mvA = null;
    if (d < 130) mvA = a + Math.PI; else if (d > 270) mvA = a; else mvA = a + e.strafe * Math.PI / 2;
    if (Math.random() < .005) e.strafe *= -1;
    const hit = moveCircle(e, Math.cos(mvA) * e.speed * .8 * dt, Math.sin(mvA) * e.speed * .8 * dt);
    if (hit) e.strafe *= -1;
    e.walk += e.speed * dt * .09;
    if (e.cd <= 0 && d < 340) startAtk(e, DEF.aShoot, t);
  },
  brute(e, t, dt) {
    const d = dist(e, t);
    if (d < 70 + t.r && e.cd <= 0 && los(e, t)) { e.face = angTo(e, t); startAtk(e, Math.random() < .5 ? DEF.bSlam : DEF.bSweep, t); return; }
    if (d > 40) pathMove(e, t, e.speed, dt);
  },
  warden(e, t, dt) {
    if (!e.p2 && e.hp < e.maxHp * .5) { e.p2 = true; e.spdMul = 1.22; startAtk(e, DEF.wRoar, t); banner('', 'Penjaga murka!', 2, '#ff6a4a', false); return; }
    const d = dist(e, t);
    e.face = turnTo(e.face, angTo(e, t), 4 * dt);
    if (e.cd <= 0) {
      if (d < 105) { startAtk(e, Math.random() < .8 ? DEF.wSweep : DEF.wLeap, t); return; }
      if (d < 320) { startAtk(e, Math.random() < .5 ? DEF.wCharge : DEF.wLeap, t); return; }
      startAtk(e, DEF.wLeap, t); return;
    }
    if (d > 80) { moveCircle(e, Math.cos(e.face) * e.speed * e.spdMul * dt, Math.sin(e.face) * e.speed * e.spdMul * dt); e.walk += e.speed * dt * .08; }
  },
  queen(e, t, dt) {
    if (!e.p2 && e.hp < e.maxHp * .5) { e.p2 = true; e.spdMul = 1.18; startAtk(e, DEF.qSummon, t); banner('', 'Abu bangkit dari bara...', 2, '#ff9a5c', false); return; }
    const d = dist(e, t), a = angTo(e, t);
    e.face = turnTo(e.face, a, 5 * dt);
    if (e.cd <= 0) {
      if (d < 115) { startAtk(e, Math.random() < .7 ? DEF.qNova : DEF.qTele, t); return; }
      const r = Math.random();
      if (e.p2 && r < .25) startAtk(e, DEF.qSpiral, t);
      else if (r < .6) startAtk(e, DEF.qVolley, t);
      else if (r < .88) startAtk(e, DEF.qPillars, t);
      else startAtk(e, DEF.qTele, t);
      return;
    }
    let mvA = d < 160 ? a + Math.PI : d > 300 ? a : a + e.strafe * Math.PI / 2;
    if (moveCircle(e, Math.cos(mvA) * e.speed * dt, Math.sin(mvA) * e.speed * dt)) e.strafe *= -1;
    if (Math.random() < .006) e.strafe *= -1;
  },
  exec(e, t, dt) {
    if (!e.p2 && e.hp < e.maxHp * .5) { e.p2 = true; e.spdMul = 1.2; startAtk(e, DEF.wRoar, t); banner('', 'Rantai membara!', 2, '#ff7a3a', false); return; }
    const d = dist(e, t);
    e.face = turnTo(e.face, angTo(e, t), 4 * dt);
    if (e.cd <= 0) {
      const r = Math.random();
      if (d < 100) { startAtk(e, r < .55 ? DEF.xSwing : r < .85 ? DEF.xSpin : DEF.xSlam, t); return; }
      if (d < 290) { startAtk(e, r < .45 ? DEF.xHook : r < .7 ? DEF.xSlam : e.p2 ? DEF.xQuake : DEF.xSpin, t); return; }
      startAtk(e, e.p2 && r < .5 ? DEF.xQuake : DEF.xHook, t); return;
    }
    if (d > 85) { moveCircle(e, Math.cos(e.face) * e.speed * e.spdMul * dt, Math.sin(e.face) * e.speed * e.spdMul * dt); e.walk += e.speed * dt * .08; }
  }
};
function updateEnemy(e, dt) {
  e.flash -= dt; e.showHp -= dt;
  e.hpLag = e.hpLag > e.hp ? Math.max(e.hp, e.hpLag - e.maxHp * .4 * dt) : e.hp;
  if (e.dead) { e.deadT += dt; return; }
  if (e.kx || e.ky) { moveCircle(e, e.kx * dt, e.ky * dt); const f = Math.pow(.001, dt); e.kx *= f; e.ky *= f; if (Math.hypot(e.kx, e.ky) < 5) e.kx = e.ky = 0; }
  if (e.boss && L.bossState !== 'active') return;
  e.cd -= dt; e.st += dt;
  if (e.state === 'stag' || e.state === 'parried') { if (e.st >= e.stagDur) { e.state = 'chase'; e.cd = Math.max(e.cd, .3); } return; }
  if (e.state === 'atk') { runAttack(e, dt); return; }
  const t = pickTarget(e);
  e.tgt = t;
  if (e.state === 'idle') { if (t) { e.state = 'chase'; alertNear(e); } else { e.walk = 0; } return; }
  if (!t) { if (!e.boss) e.state = 'idle'; return; }
  AI[e.type](e, t, dt);
}
