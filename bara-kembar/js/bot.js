'use strict';
// =====================================================================
//  BOT REKAN (mode solo)
//  Bot tidak punya aturan khusus: setiap frame ia mengisi IN[i]
//  (arah joystick + tombol 1/2/3) persis seperti pemain manusia,
//  jadi stamina, i-frame, kombo, tangkisan, dsb. tetap berlaku untuknya.
//
//  • Senjata: cenderung melengkapi rekan — rekan pakai busur → bot pedang,
//    rekan pakai pedang → bot busur (tidak selalu; lihat WANT_COMPLEMENT).
//  • Kemampuan: diundi ulang acak setiap beberapa detik (brain.skill).
//    Makin rendah, makin sering bot telat/terlalu cepat menghindar,
//    meleset, bengong, dan lupa menyambung kombo.
// =====================================================================
// rentang undian kemampuan (1 = sempurna): RULE.botSkill() di world.js (Santai lebih tinggi)
const SKILL_EVERY = [10, 25];           // kemampuan diundi ulang tiap 10–25 detik
const WANT_COMPLEMENT = .8;             // peluang memilih senjata pelengkap rekan

let brain = null;
function resetBot() {
  brain = {
    skill: rand(...RULE.botSkill()), skillT: rand(SKILL_EVERY[0], SKILL_EVERY[1]), seen: new WeakMap(),
    goalKey: '', field: null, fieldT: 0,
    humanWeapon: null, want: 'bow', swapT: 0, swapTap: false,
    healHold: false, rollCd: 0, blockT: 0, blockSrc: null, daze: 0, recover: false,
    charge: .4, shotCd: 0, chainGo: false, early: false, prevState: '',
    strafe: 1, strafeT: 0, lastX: 0, lastY: 0, stuckT: 0, farT: 0,
  };
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

// ---------- persepsi: tiap serangan diputuskan sekali apakah "terlihat" & kapan bereaksi ----------
function botNotice(key) {
  let n = brain.seen.get(key);
  if (!n) {
    const s = brain.skill;
    n = { miss: Math.random() < (1 - s) * .55, lead: Math.max(.02, .2 + rand(-1, 1) * (1 - s) * .3) };
    brain.seen.set(key, n);
  }
  return n;
}

// ---------- bahaya terdekat ----------
// hasil: { t: detik sampai kena, x/y: arah kabur, sx/sy: sumber (untuk menghadap saat menangkis),
//          block: bisa ditangkis, walk: bisa dihindari dengan berjalan, ring, lead: waktu reaksi }
let BOT_ARC = null; // serangan tebasan: [jangkauan, lebar busur]
function botThreat(b) {
  if (!BOT_ARC) BOT_ARC = new Map([[DEF.gSlash, [40, 2.0]], [DEF.gHeavy, [46, 2.2]], [DEF.bSweep, [60, 2.8]], [DEF.wSweep, [78, 2.9]], [DEF.wSweep2, [78, 2.9]], [DEF.xSwing, [84, 2.6]], [DEF.xSwing2, [84, 2.6]], [DEF.k1, [64, 2.2]], [DEF.k2, [64, 2.2]], [DEF.lSweep, [92, 3.0]]]);
  let best = null;
  const add = (key, t, fx, fy, src, o = {}) => {
    if (best && best.t <= t) return;
    const n = botNotice(key); if (n.miss) return;
    const l = Math.hypot(fx, fy) || 1;
    best = { t: Math.max(0, t), x: fx / l, y: fy / l, sx: src.x, sy: src.y, block: o.block !== false, walk: o.walk !== false, ring: !!o.ring, lead: n.lead };
  };
  const pad = b.r + 10;
  for (const e of L.enemies) {
    if (e.dead || e.state !== 'atk' || !e.atk) continue;
    const a = e.atk, d = a.def, sp = tempo(e);
    const left = a.ph === 'w' ? d.wind / sp - a.t : a.ph === 'a' ? 0 : -1;
    if (left < 0 || left > 1.2) continue;
    const ox = b.x - e.x, oy = b.y - e.y;
    const line = (len, hw, speed) => { // serangan berbentuk garis lurus dari bos
      const cx = Math.cos(e.face), cy = Math.sin(e.face), along = ox * cx + oy * cy, perp = -ox * cy + oy * cx, s = perp >= 0 ? 1 : -1;
      if (along > -10 && along < len && Math.abs(perp) < hw + pad) add(a, left + Math.max(0, along) / speed, -cy * s, cx * s, e);
    };
    if (d === DEF.wLeap) {
      if (a.tx == null) continue;
      if (Math.hypot(b.x - a.tx, b.y - a.ty) < 88 + pad) add(a, a.ph === 'w' ? left + .6 : .6 - a.t, b.x - a.tx, b.y - a.ty, { x: a.tx, y: a.ty });
    } else if (d === DEF.wCharge) line(420, e.r, 430);
    else if (d === DEF.xHook) line(290, 12, 1500);
    else if (d === DEF.kDash) line(300, e.r, 620);
    else if (d === DEF.k3) line(150, 10, 900);
    else if (d === DEF.vBeam) { // sinar berputar: hitung kapan sinar menyapu posisi bot, lalu guling menembusnya
      if (a.ph !== 'a') continue;
      const sp = e.p2 ? 1.05 : .78, diff = angDiff(a.ang, angTo(e, b)) * a.dir;
      if (Math.hypot(ox, oy) < (a.len || 460) + pad && diff > -.15 && diff < .9)
        add(a, Math.max(0, diff) / sp, Math.sin(a.ang) * a.dir, -Math.cos(a.ang) * a.dir, e, { walk: false, ring: true });
    }
    else if (d === DEF.xSpin) {
      if (Math.hypot(ox, oy) < 96 + pad) add(a, left, ox, oy, e, { block: a.ph === 'w' }); // saat berputar: menjauh, jangan bertahan
    } else if (d === DEF.bSlam || d === DEF.wOverhead || d === DEF.qNova || d === DEF.xSlam || d === DEF.vNova) {
      const off = d === DEF.bSlam ? 36 : d === DEF.wOverhead ? 70 : d === DEF.xSlam ? 80 : 0;
      const rad = d === DEF.bSlam ? 62 : d === DEF.wOverhead ? 46 : d === DEF.xSlam ? 60 : d === DEF.vNova ? 110 : 118;
      const cx = fx(e, off), cy = fy(e, off);
      if (Math.hypot(b.x - cx, b.y - cy) < rad + pad) add(a, left, b.x - cx, b.y - cy, { x: cx, y: cy });
    } else {
      const arc = BOT_ARC.get(d);
      if (arc && Math.hypot(ox, oy) - b.r <= arc[0] + e.r * .5 + 24 && (a.tgt === b || Math.abs(angDiff(e.face, angTo(e, b))) <= arc[1] / 2 + .35)) add(a, left, ox, oy, e);
    }
  }
  for (const pr of L.projectiles) {
    if (pr.owner !== 'e') continue;
    const v2 = pr.vx * pr.vx + pr.vy * pr.vy; if (v2 < 1) continue;
    const t = ((b.x - pr.x) * pr.vx + (b.y - pr.y) * pr.vy) / v2; if (t < 0 || t > .7) continue;
    const cx = pr.x + pr.vx * t, cy = pr.y + pr.vy * t;
    if (Math.hypot(b.x - cx, b.y - cy) < b.r + pr.r + 8) {
      let px = b.x - cx, py = b.y - cy; if (Math.hypot(px, py) < 1) { px = -pr.vy; py = pr.vx; }
      add(pr, t, px, py, pr);
    }
  }
  for (const h of L.hazards) {
    if (h.kind === 'pillar' && !h.done) { if (dist(b, h) < h.r + pad) add(h, h.delay - h.t, b.x - h.x, b.y - h.y, h, { block: false }); }
    else if (h.kind === 'ring') {
      const gap = dist(b, h) - h.rad - h.w / 2 - b.r;
      if (gap > -4 && gap < 80 && h.rad < h.max) add(h, gap / h.speed, h.x - b.x, h.y - b.y, h, { walk: false, ring: true });
    }
  }
  return best;
}

// ---------- pilih sasaran ----------
function botTarget(b, h, melee) {
  let best = null, bs = 1e9;
  for (const e of targetables()) {
    if (e.air) continue;
    const d = dist(b, e);
    if (melee ? d > 360 || (d > 160 && !los(b, e)) : d > 430 || !los(b, e)) continue;
    let s = melee ? d * .5 + (h.alive ? dist(h, e) * .5 : d * .5) : d;   // pedang: lindungi rekan
    if (e.shield) s += 400;                                             // bos berperisai → incar totem dulu
    if (e.tgt === b) s -= 90;
    if (h.alive && (melee ? e.tgt === h : dist(h, e) < 130)) s -= 70;
    if (e.state === 'idle' && h.alive && dist(h, e) > 260) s += 250;    // jangan memancing musuh jauh
    if (s < bs) { bs = s; best = e; }
  }
  return best;
}

function botWarp(b, h) {
  for (let r = 40; r <= 120; r += 20) for (let k = 0; k < 8; k++) {
    const g = k / 8 * TAU, x = h.x + Math.cos(g) * r, y = h.y + Math.sin(g) * r;
    if (tileSolidW(x, y) || !los(h, { x, y })) continue;
    for (let j = 0; j < 14; j++) part(b.x, b.y, rand(-40, 40), rand(-70, -10), rand(.4, .8), '#ffb35c', 2.5, true);
    b.x = x; b.y = y; b.kx = b.ky = 0; resolveCircle(b);
    for (let j = 0; j < 18; j++) part(x, y, rand(-50, 50), rand(-80, -10), rand(.4, .9), '#ffd27a', 2.5, true);
    Snd.heal(); return;
  }
}

// ---------- otak per frame (dipanggil dari update, sebelum updatePlayer) ----------
function botUpdate(b, h, dt) {
  for (const k of ['fieldT', 'rollCd', 'strafeT', 'shotCd', 'swapT', 'blockT', 'daze', 'skillT']) brain[k] -= dt;
  if (brain.skillT <= 0) { brain.skill = rand(...RULE.botSkill()); brain.skillT = rand(SKILL_EVERY[0], SKILL_EVERY[1]); }
  const inp = IN[b.i], s = brain.skill;
  inp.h[0] = inp.h[1] = inp.h[2] = 0; inp.mx = 0; inp.my = 0;
  if (b.state === 'shoot_r' && brain.prevState !== 'shoot_r') brain.shotCd = rand(.05, .8) * (1.2 - s); // jeda antar tembakan
  brain.prevState = b.state;
  if (!b.alive) { brain.healHold = false; brain.blockT = 0; return; }
  const move = (ang, mag = 1) => { inp.mx = Math.cos(ang) * mag; inp.my = Math.sin(ang) * mag; };
  const tap = k => { if (!inp.pv[k]) inp.h[k] = 1; };

  // ketuk tombol 3 = ganti senjata: frame ini dilepas tanpa menekan apa pun
  if (brain.swapTap) { brain.swapTap = false; return; }

  // pilih senjata: cenderung kebalikan rekan, diputuskan ulang saat rekan ganti senjata
  if (h.weapon !== brain.humanWeapon) {
    brain.humanWeapon = h.weapon;
    const comp = h.weapon === 'bow' ? 'sword' : 'bow';
    brain.want = Math.random() < WANT_COMPLEMENT ? comp : h.weapon;
    brain.swapT = rand(.3, 1.2) + (1 - s);
  }
  const sword = b.weapon === 'sword';

  // jaring pengaman: tertinggal jauh cukup lama (dan tidak sedang diincar musuh) → muncul di dekat rekan
  const busy = L.enemies.some(e => !e.dead && e.tgt === b && dist(e, b) < 260);
  brain.farT = h.alive && dist(b, h) > 420 && !busy ? brain.farT + dt : 0;
  if (brain.farT > 4) { brain.farT = 0; botWarp(b, h); return; }

  // 1) bertahan
  const th = botThreat(b);
  const freeish = b.state === 'free' || b.state === 'draw' || b.state === 'block';
  if (th && !sword && th.t < (th.ring ? th.lead * .6 : th.lead) && (b.state === 'free' || b.state === 'draw') && b.stam >= 12 && brain.rollCd <= 0) {
    move(Math.atan2(th.y, th.x)); inp.h[1] = 1; brain.healHold = false; brain.rollCd = .5; return; // guling
  }
  if (th && sword && th.block && th.t < th.lead + .06 && b.stam > 6 && freeish) { brain.blockT = .3; brain.blockSrc = { x: th.sx, y: th.sy }; }
  if (sword && brain.blockT > 0 && (b.state === 'free' || b.state === 'block') && b.stam > 0) {
    inp.h[1] = 1; brain.healHold = false; move(angTo(b, brain.blockSrc), .3); // tahan tameng sambil menghadap sumber
    if (th && th.block && th.t < .6) brain.blockT = Math.max(brain.blockT, .15);
    return;
  }
  const fleeing = th && th.walk && th.t < 1.0 && (!sword || !th.block || th.t > .25 || b.stam < 25);

  // bengong sesaat (makin sering kalau kemampuan rendah)
  if (brain.daze <= 0 && Math.random() < (1 - s) * .12 * dt) brain.daze = rand(.4, 1.1);
  if (brain.daze > 0 && !brain.healHold) return;

  // 2) minum ramuan: tahan tombol 3 sampai mulai minum (melepas lebih awal = ganti senjata)
  if (brain.healHold) {
    if (b.state === 'free' && b.flasks > 0) inp.h[2] = 1; else brain.healHold = false;
  } else if (b.state === 'free' && b.flasks > 0 && b.hp < b.maxHp * (.3 + s * .2) && !(th && th.t < 1.5)
    && !L.enemies.some(e => !e.dead && !(e.boss && L.bossState !== 'active') && dist(e, b) < 150)) {
    brain.healHold = true; inp.h[2] = 1;
  }

  // 3) ganti senjata kalau belum sesuai keinginan
  if (!brain.healHold && b.weapon !== brain.want && brain.swapT <= 0 && b.state === 'free' && !(th && th.t < 1.2) && !inp.pv[2]) {
    inp.h[2] = 1; brain.swapTap = true; return;
  }

  // 4) tujuan khusus (mendahului pertarungan)
  const tgt = botTarget(b, h, sword);
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

  // 5) gerak
  if (sword) { if (b.stam < 22) brain.recover = true; else if (b.stam > 65) brain.recover = false; }
  let wantAtk = false;
  if (goal) {
    const d = dist(b, goal);
    if (d > stop) move(botPathAngle(b, goal), 1);
    wantAtk = !!tgt && d <= stop + 30 && !h.down;
  } else if (tgt && sword) {
    const d = dist(b, tgt), a = angTo(b, tgt);
    if (h.alive && dist(b, h) > 280) move(botPathAngle(b, h), 1);         // jangan tertinggal
    else if (brain.recover) move(a + Math.PI + brain.strafe * .6, .9);    // stamina tipis → mundur dulu
    else if (d - tgt.r > 34) move(botPathAngle(b, tgt), 1);                // dekati
    else move(a, .25);                                                     // sudah dekat → hadapi
    wantAtk = true;
  } else if (tgt) {
    const d = dist(b, tgt), a = angTo(b, tgt);
    if (h.alive && dist(b, h) > 250) move(botPathAngle(b, h), 1);
    else if (d < 120) move(a + Math.PI + brain.strafe * .5, 1);           // terlalu dekat → mundur
    else if (d > 300) move(botPathAngle(b, tgt), .9);                     // terlalu jauh → maju
    else {                                                                // jarak ideal → memutar
      if (brain.strafeT <= 0) { brain.strafe = Math.random() < .5 ? 1 : -1; brain.strafeT = rand(1.2, 2.8); }
      move(a + brain.strafe * Math.PI / 2, .55);
    }
    wantAtk = true;
  } else if (h.alive) {
    const dh = dist(b, h);
    if (dh > 130) move(botPathAngle(b, h), dh > 220 ? 1 : .7);
  }
  if (fleeing) move(Math.atan2(th.y, th.x), 1);

  // 6) menyerang
  if (sword) {
    const reach = tgt ? dist(b, tgt) - tgt.r : 1e9;
    if (b.state === 'atk_r' && tgt) {
      const a = COMBO[b.combo], open = b.combo < 2 && !b.chainLock && b.st >= a.rec - CHAIN_WIN;
      if (brain.early && b.st > .05 && !open) { tap(0); brain.early = false; }           // kepencet terlalu cepat → kombo putus
      else if (open && brain.chainGo && reach < 55 && b.stam > 15 && !fleeing) {
        tap(0); brain.chainGo = Math.random() < .2 + s * .6; brain.early = Math.random() < (1 - s) * .3;
      }
    } else if (b.state === 'free' && wantAtk && tgt && !fleeing && !brain.recover && !brain.healHold && b.stam > 25 && reach < 42
      && Math.abs(angDiff(b.face, angTo(b, tgt))) < .8) {
      tap(0); brain.chainGo = Math.random() < .3 + s * .6; brain.early = Math.random() < (1 - s) * .35;
    }
  } else if (b.state === 'draw') {
    // memanah: tahan tombol 1 sampai cukup kuat & bidikan pas, lalu lepas
    if (tgt) {
      const a = angTo(b, tgt), err = Math.abs(angDiff(b.face, a));
      const ready = b.drawT >= brain.charge || (dist(b, tgt) < 90 && b.drawT >= .3);
      if (!fleeing) move(a, .25); // saat menarik busur, arah gerak = arah bidik
      if (!(ready && err < .25 + (1 - s) * .6)) inp.h[0] = 1;   // kemampuan rendah → lebih asal lepas
    }
  } else if (b.state === 'free' && wantAtk && tgt && !fleeing && !brain.healHold && b.stam > 30 && brain.shotCd <= 0) {
    const d = dist(b, tgt), a = angTo(b, tgt);
    if (Math.abs(angDiff(b.face, a)) < 1.2) {
      tap(0);
      const safe = (d > 170 && tgt.tgt !== b) || (tgt.boss && d > 140);
      brain.charge = safe && Math.random() < .35 + s * .65 ? .95 : rand(.32, .55); // jauh & aman → tembakan penuh
    } else move(a, .3); // putar badan dulu
  }

  // 7) macet di dinding / tertahan tali rekan → belok
  const moved = Math.hypot(b.x - brain.lastX, b.y - brain.lastY); brain.lastX = b.x; brain.lastY = b.y;
  if (b.state === 'free' && Math.hypot(inp.mx, inp.my) > .5 && moved < 10 * dt) brain.stuckT += dt; else brain.stuckT = Math.max(0, brain.stuckT - dt);
  if (brain.stuckT > .6) {
    const a = Math.atan2(inp.my, inp.mx) + brain.strafe * 1.2; move(a, 1);
    if (brain.stuckT > 1.4) { brain.stuckT = 0; brain.strafe *= -1; }
  }
}
