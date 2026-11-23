'use strict';
// =====================================================================
//  BOT REKAN (mode solo)
//  Bot tidak punya aturan khusus: setiap frame ia mengisi IN[i]
//  (arah joystick + tombol 1/2/3) persis seperti pemain manusia,
//  jadi stamina, i-frame, kombo, dsb. tetap berlaku untuknya.
//  Bot memakai busur: menjaga jarak, menembak, berguling menghindar,
//  minum ramuan, membangkitkan rekan, dan ikut ke kabut/arena/portal.
// =====================================================================
let brain = null;
function resetBot() {
  brain = { goalKey: '', field: null, fieldT: 0, charge: .4, healHold: false, rollCd: 0, strafe: 1, strafeT: 0, lastX: 0, lastY: 0, stuckT: 0 };
}
resetBot();

// ---------- jalan: BFS dari tujuan, lalu turuni gradiennya ----------
function bfsField(gx, gy) {
  const f = new Int16Array(L.w * L.h).fill(-1);
  const sx = clamp(Math.floor(gx / T), 0, L.w - 1), sy = clamp(Math.floor(gy / T), 0, L.h - 1);
  const q = [sx + sy * L.w]; f[q[0]] = 0; let qi = 0;
  while (qi < q.length) {
    const k = q[qi++], x = k % L.w, y = (k / L.w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy; if (tileSolid(nx, ny)) continue;
      const nk = ny * L.w + nx; if (f[nk] >= 0) continue; f[nk] = f[k] + 1; q.push(nk);
    }
  }
  return f;
}
function botPathAngle(b, g) {
  if (los(b, g)) return angTo(b, g);
  const key = Math.floor(g.x / T) + ',' + Math.floor(g.y / T) + ',' + L.gateState;
  if (key !== brain.goalKey || brain.fieldT <= 0) { brain.field = bfsField(g.x, g.y); brain.goalKey = key; brain.fieldT = .5; }
  const f = brain.field, tx = Math.floor(b.x / T), ty = Math.floor(b.y / T);
  let best = f[ty * L.w + tx], bx = -1, by = -1;
  if (best < 0) best = 9999;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const nx = tx + dx, ny = ty + dy; if (tileSolid(nx, ny)) continue;
    if (dx && dy && (tileSolid(tx + dx, ty) || tileSolid(tx, ty + dy))) continue;
    const v = f[ny * L.w + nx]; if (v >= 0 && v < best) { best = v; bx = nx; by = ny; }
  }
  if (bx < 0) return angTo(b, g);
  return Math.atan2((by + .5) * T - b.y, (bx + .5) * T - b.x);
}

// ---------- bahaya terdekat: { t: detik sampai kena, x/y: arah kabur, walk, ring } ----------
let BOT_ARC = null; // serangan tebasan: [jangkauan, lebar busur]
function botThreat(b) {
  if (!BOT_ARC) BOT_ARC = new Map([[DEF.gSlash, [40, 2.0]], [DEF.gHeavy, [46, 2.2]], [DEF.bSweep, [60, 2.8]], [DEF.wSweep, [78, 2.9]], [DEF.wSweep2, [78, 2.9]]]);
  let best = null;
  const add = (t, fx, fy, o = {}) => {
    if (best && best.t <= t) return;
    const l = Math.hypot(fx, fy) || 1;
    best = { t: Math.max(0, t), x: fx / l, y: fy / l, walk: o.walk !== false, ring: !!o.ring };
  };
  const pad = b.r + 10;
  for (const e of L.enemies) {
    if (e.dead || e.state !== 'atk' || !e.atk) continue;
    const a = e.atk, d = a.def, sp = e.spdMul;
    const left = a.ph === 'w' ? d.wind / sp - a.t : a.ph === 'a' ? 0 : -1;
    if (left < 0 || left > 1.2) continue;
    const ox = b.x - e.x, oy = b.y - e.y;
    if (d === DEF.wLeap) {
      if (a.tx == null) continue;
      if (Math.hypot(b.x - a.tx, b.y - a.ty) < 88 + pad) add(a.ph === 'w' ? left + .6 : .6 - a.t, b.x - a.tx, b.y - a.ty);
    } else if (d === DEF.wCharge) {
      const cx = Math.cos(e.face), cy = Math.sin(e.face), along = ox * cx + oy * cy, perp = -ox * cy + oy * cx, s = perp >= 0 ? 1 : -1;
      if (along > -10 && along < 420 && Math.abs(perp) < e.r + pad) add(left + Math.max(0, along) / 430, -cy * s, cx * s);
    } else if (d === DEF.bSlam || d === DEF.wOverhead || d === DEF.qNova) {
      const off = d === DEF.bSlam ? 36 : d === DEF.wOverhead ? 70 : 0, rad = d === DEF.bSlam ? 62 : d === DEF.wOverhead ? 46 : 118;
      const cx = fx(e, off), cy = fy(e, off);
      if (Math.hypot(b.x - cx, b.y - cy) < rad + pad) add(left, b.x - cx, b.y - cy);
    } else {
      const arc = BOT_ARC.get(d);
      if (arc && Math.hypot(ox, oy) - b.r <= arc[0] + e.r * .5 + 24 && (a.tgt === b || Math.abs(angDiff(e.face, angTo(e, b))) <= arc[1] / 2 + .35)) add(left, ox, oy);
    }
  }
  for (const pr of L.projectiles) {
    if (pr.owner !== 'e') continue;
    const v2 = pr.vx * pr.vx + pr.vy * pr.vy; if (v2 < 1) continue;
    const t = ((b.x - pr.x) * pr.vx + (b.y - pr.y) * pr.vy) / v2; if (t < 0 || t > .7) continue;
    const cx = pr.x + pr.vx * t, cy = pr.y + pr.vy * t;
    if (Math.hypot(b.x - cx, b.y - cy) < b.r + pr.r + 8) {
      let px = b.x - cx, py = b.y - cy; if (Math.hypot(px, py) < 1) { px = -pr.vy; py = pr.vx; }
      add(t, px, py);
    }
  }
  for (const h of L.hazards) {
    if (h.kind === 'pillar' && !h.done) { if (dist(b, h) < h.r + pad) add(h.delay - h.t, b.x - h.x, b.y - h.y); }
    else if (h.kind === 'ring') {
      const gap = dist(b, h) - h.rad - h.w / 2 - b.r;
      if (gap > -4 && gap < 80 && h.rad < h.max) add(gap / h.speed, h.x - b.x, h.y - b.y, { walk: false, ring: true }); // guling menembus cincin
    }
  }
  return best;
}

// ---------- pilih sasaran ----------
function botTarget(b, h) {
  let best = null, bs = 1e9;
  for (const e of targetables()) {
    if (e.air) continue;
    const d = dist(b, e); if (d > 430 || !los(b, e)) continue;
    let s = d;
    if (e.tgt === b) s -= 90;                                   // yang sedang mengincar bot
    if (h.alive && dist(h, e) < 130) s -= 70;                   // yang menekan rekan
    if (e.state === 'idle' && h.alive && dist(h, e) > 260) s += 250; // jangan memancing musuh jauh
    if (s < bs) { bs = s; best = e; }
  }
  return best;
}

// ---------- otak per frame (dipanggil dari update, sebelum updatePlayer) ----------
function botUpdate(b, h, dt) {
  const inp = IN[b.i];
  inp.h[0] = inp.h[1] = inp.h[2] = 0; inp.mx = 0; inp.my = 0;
  brain.fieldT -= dt; brain.rollCd -= dt; brain.strafeT -= dt;
  if (!b.alive) { brain.healHold = false; return; }
  const move = (ang, mag = 1) => { inp.mx = Math.cos(ang) * mag; inp.my = Math.sin(ang) * mag; };

  // jaga-jaga: bot selalu pakai busur (ketuk tombol 3 = ganti senjata)
  if (b.weapon !== 'bow') { if (b.state === 'free' && IN[b.i].pv[2] === 0) inp.h[2] = 1; return; }

  // 1) menghindar: guling saat serangan hampir kena
  const th = botThreat(b);
  if (th && th.t < (th.ring ? .14 : .26) && (b.state === 'free' || b.state === 'draw') && b.stam >= 12 && brain.rollCd <= 0) {
    move(Math.atan2(th.y, th.x)); inp.h[1] = 1; brain.healHold = false; brain.rollCd = .5; return;
  }
  const fleeing = th && th.walk && th.t < 1.0;

  // 2) minum ramuan: tahan tombol 3 sampai mulai minum (melepas lebih awal = ganti senjata)
  if (brain.healHold) {
    if (b.state === 'free' && b.flasks > 0) inp.h[2] = 1; else brain.healHold = false;
  } else if (b.state === 'free' && b.flasks > 0 && b.hp < b.maxHp * .45 && !(th && th.t < 1.5)
    && !L.enemies.some(e => !e.dead && !(e.boss && L.bossState !== 'active') && dist(e, b) < 150)) {
    brain.healHold = true; inp.h[2] = 1;
  }

  // 3) tujuan khusus (mendahului pertarungan)
  const tgt = botTarget(b, h);
  let goal = null, stop = 0;
  if (h.down) { goal = h; stop = 26; }                                   // bangkitkan rekan
  else if (h.dead && L.gateState !== 'sealed' && L.bonfires.length) {     // rekan gugur → ke api unggun
    goal = L.bonfires.reduce((a, c) => dist(b, c) < dist(b, a) ? c : a); stop = 20;
  } else if (L.portal) { goal = L.portal; stop = 22; }                   // tunggu di portal
  else if (L.gateState === 'open' && L.bossState === 'dormant' && inArena(h)) {
    // rekan sudah di arena: masuk juga dan jangan berdiri di petak gerbang
    if (!inArena(b) || L.gates.some(g => dist(b, g) < T * 1.3)) { goal = { x: lerp(h.x, L.bossSpawn.x, .4), y: lerp(h.y, L.bossSpawn.y, .4) }; stop = 20; }
  } else if (L.gateState === 'fog' && h.alive && L.gates.some(g => dist(h, g) < 110)) {
    goal = L.gates.reduce((a, c) => dist(b, c) < dist(b, a) ? c : a); stop = 50; // ikut berdiri di depan kabut
  }

  // 4) gerak
  let wantShoot = false;
  if (goal) {
    const d = dist(b, goal);
    if (d > stop) move(botPathAngle(b, goal), 1);
    wantShoot = !!tgt && d <= stop + 30 && !h.down;
  } else if (tgt) {
    const d = dist(b, tgt), a = angTo(b, tgt);
    if (h.alive && dist(b, h) > 250) move(botPathAngle(b, h), 1);           // jangan tertinggal
    else if (d < 120) move(a + Math.PI + brain.strafe * .5, 1);              // terlalu dekat → mundur
    else if (d > 300) move(botPathAngle(b, tgt), .9);                        // terlalu jauh → maju
    else {                                                                   // jarak ideal → memutar
      if (brain.strafeT <= 0) { brain.strafe = Math.random() < .5 ? 1 : -1; brain.strafeT = rand(1.2, 2.8); }
      move(a + brain.strafe * Math.PI / 2, .55);
    }
    wantShoot = true;
  } else if (h.alive) {
    const dh = dist(b, h);
    if (dh > 130) move(botPathAngle(b, h), dh > 220 ? 1 : .7);
  }
  if (fleeing) move(Math.atan2(th.y, th.x), 1);

  // 5) memanah: tahan tombol 1 sampai cukup kuat & bidikan pas, lalu lepas
  if (b.state === 'draw') {
    if (tgt) {
      const a = angTo(b, tgt), err = Math.abs(angDiff(b.face, a));
      const ready = b.drawT >= brain.charge || (dist(b, tgt) < 90 && b.drawT >= .3);
      if (!fleeing) move(a, .25); // saat menarik busur, arah gerak = arah bidik
      if (!(ready && err < .25)) inp.h[0] = 1;
    }
  } else if (b.state === 'free' && wantShoot && !fleeing && !brain.healHold && b.stam > 30) {
    const d = dist(b, tgt), a = angTo(b, tgt);
    if (Math.abs(angDiff(b.face, a)) < 1.2) {
      inp.h[0] = 1;
      brain.charge = (d > 170 && tgt.tgt !== b) || (tgt.boss && d > 140) ? .95 : .4; // jauh & aman → tembakan penuh
    } else move(a, .3); // putar badan dulu
  }

  // 6) macet di dinding / tertahan tali rekan → belok
  const moved = Math.hypot(b.x - brain.lastX, b.y - brain.lastY); brain.lastX = b.x; brain.lastY = b.y;
  if (b.state === 'free' && Math.hypot(inp.mx, inp.my) > .5 && moved < 10 * dt) brain.stuckT += dt; else brain.stuckT = Math.max(0, brain.stuckT - dt);
  if (brain.stuckT > .6) {
    const a = Math.atan2(inp.my, inp.mx) + brain.strafe * 1.2; move(a, 1);
    if (brain.stuckT > 1.4) { brain.stuckT = 0; brain.strafe *= -1; }
  }
}
