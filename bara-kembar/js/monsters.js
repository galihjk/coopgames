'use strict';
// =====================================================================
//  MONSTER KHAS LEVEL 3–7 (bukan manusia, kecuali Ksatria Penjaga)
//  Huruf di peta:  s = Lendir Arang (L3)   k = Kelelawar Abu, 3 ekor (L4)
//                  d = Anjing Bara, 2 ekor (L5)   p = Ksatria Penjaga (L6)
//                  w = Laba-laba Jelaga (L7)
// =====================================================================
Object.assign(ETYPE, {
  slime: { hp: 60, r: 13, speed: 42, poise: 20, aggro: 220, col: '#6a5a50', sc: 1, lw: 2 },
  bat: { hp: 22, r: 9, speed: 150, poise: 8, aggro: 280, col: '#a8a0b8', sc: 1, lw: 1.8 },
  hound: { hp: 45, r: 11, speed: 135, poise: 15, aggro: 300, col: '#ff8a4a', sc: 1, lw: 2.2 },
  guard: { hp: 120, r: 13, speed: 52, poise: 70, aggro: 230, col: '#c8c0b0', sc: 1.35, lw: 2.8 },
  spider: { hp: 55, r: 12, speed: 75, poise: 25, aggro: 300, col: '#8a7a9a', sc: 1.2, lw: 2 },
});
SPAWN_CHARS.s = 'slime'; SPAWN_CHARS.k = 'bat'; SPAWN_CHARS.d = 'hound'; SPAWN_CHARS.p = 'guard'; SPAWN_CHARS.w = 'spider';
GROUP_SIZE.bat = 3; GROUP_SIZE.hound = 2;

// sentuhan saat menerjang (kelelawar, anjing): kena sekali per serangan, bisa ditangkis
function contactHit(e, a, dmg, o) {
  for (const p of players) if (p.alive && !a.hit.has(p) && dist(e, p) < e.r + p.r + 4) {
    a.hit.add(p); if (hurtPlayer(p, dmg, e, Object.assign({ parryable: true }, o)) === 'parry') { enemyParried(e); return true; }
  }
  return false;
}
const slimeR = e => 34 * e.sc + 6; // radius hantaman lendir

Object.assign(DEF, {
  // lendir: melompat ke dekat sasaran lalu menghantam area kecil (tak bisa dipukul saat melayang)
  sHop: { wind: .6, act: .45, rec: .6, anim: [0, 0, 0], cd: [1.2, 2.0],
    onStart: (e, a) => {
      const g = angTo(e, a.tgt); let d = Math.min(dist(e, a.tgt), 120);
      while (d > 0 && tileSolidW(e.x + Math.cos(g) * d, e.y + Math.sin(g) * d)) d -= 12;
      a.tx = e.x + Math.cos(g) * d; a.ty = e.y + Math.sin(g) * d; Snd.tele();
    },
    onAct: (e, a) => { a.sx = e.x; a.sy = e.y; e.air = true; },
    actUpd: (e, a) => { const k = clamp(a.t / .45, 0, 1); e.x = lerp(a.sx, a.tx, k); e.y = lerp(a.sy, a.ty, k); e.z = Math.sin(k * Math.PI) * 26 * e.sc; },
    onRec: e => {
      e.air = false; e.z = 0; resolveCircle(e); aoe(e.x, e.y, slimeR(e), e.gen ? 8 : 14, { knock: 160 });
      for (let k = 0; k < 10; k++) part(e.x, e.y, rand(-70, 70), rand(-70, 70), rand(.3, .6), '#3a2e28', rand(2, 3.5));
      Snd.hit(); shake(2);
    },
    tele: (e, a, p) => teleCircle(a.tx, a.ty, slimeR(e), p), teleAct: (e, a) => teleCircle(a.tx, a.ty, slimeR(e), 1) },
  // kelelawar: menukik lurus menembus sasaran, lalu menjauh lagi
  batSwoop: { wind: .35, act: .4, rec: .5, anim: [0, 0, 0], cd: [1.4, 2.4],
    windUpd: (e, a) => { if (a.tgt) e.face = angTo(e, a.tgt); },
    onAct: () => Snd.swing(),
    actUpd: (e, a, dt) => {
      const hit = moveCircle(e, Math.cos(e.face) * 330 * dt, Math.sin(e.face) * 330 * dt);
      if (contactHit(e, a, 10, { knock: 120 })) return;
      if (hit) a.t = Math.max(a.t, .4);
    },
    tele: (e, a, p) => teleLine(e.x, e.y, e.face, 140, e.r * 2, p) },
  // anjing: merunduk, lalu menerkam lurus
  hPounce: { wind: .45, act: .32, rec: .65, track: 6, anim: [0, 0, 0], cd: [1.3, 2.2],
    windUpd: (e, a) => { if (a.t > .3) a.lock = true; },
    onAct: () => Snd.swing(),
    actUpd: (e, a, dt) => {
      moveCircle(e, Math.cos(e.face) * 360 * dt, Math.sin(e.face) * 360 * dt);
      e.z = Math.sin(clamp(a.t / .32, 0, 1) * Math.PI) * 10;
      contactHit(e, a, 14, { knock: 180 });
    },
    onRec: e => { e.z = 0; },
    tele: (e, a, p) => teleLine(e.x, e.y, e.face, 120, e.r * 2, p) },
  // ksatria penjaga: tusukan tombak panjang & dorongan tameng
  pThrust: { wind: .6, act: .12, rec: .6, track: 2.5, move: 90, anim: [-.4, 0, 0], cd: [.8, 1.4],
    hitFn: (e, a) => meleeArc(e, a, 70, .7, 18, { parryable: true, knock: 200 }), tele: (e, a, p) => teleLine(e.x, e.y, e.face, 70 + e.r, 14, p) },
  pBash: { wind: .4, act: .12, rec: .5, track: 3, move: 120, anim: [.6, .6, .6], cd: [.8, 1.4],
    hitFn: (e, a) => meleeArc(e, a, 36, 1.6, 10, { parryable: true, knock: 280, stagger: .45 }), tele: (e, a, p) => teleArc(e.x, e.y, e.face, 36 + e.r, 1.6, p) },
  // laba-laba: jaring yang memperlambat, lalu gigitan
  wShot: { wind: .7, act: .05, rec: .5, track: 4, anim: [0, 0, 0], cd: [1.6, 2.6],
    onAct: e => { spawnProj('e', fx(e, 12), fy(e, 12), e.face, 230, 4, { kind: 'web', web: true, life: 1.6, r: 8, src: e }); Snd.bow(); },
    tele: (e, a, p) => teleLine(e.x, e.y, e.face, 200, 4, p) },
  wBite: { wind: .45, act: .12, rec: .55, track: 5, move: 60, anim: [0, 0, 0], cd: [.8, 1.3],
    hitFn: (e, a) => meleeArc(e, a, 34, 1.6, 14, { parryable: true, knock: 140 }), tele: (e, a, p) => teleArc(e.x, e.y, e.face, 34 + e.r, 1.6, p) },
});

Object.assign(AI, {
  slime(e, t, dt) {
    if (dist(e, t) < 130 && e.cd <= 0 && los(e, t)) { startAtk(e, DEF.sHop, t); return; }
    pathMove(e, t, e.speed * (e.gen ? 1.3 : 1), dt);
  },
  bat(e, t, dt) { // terbang memutari sasaran, sesekali menukik
    const d = dist(e, t);
    if (d < 190 && e.cd <= 0 && los(e, t)) { startAtk(e, DEF.batSwoop, t); return; }
    if (!los(e, t)) { pathMove(e, t, e.speed, dt); return; }
    const orbit = angTo(t, e) + e.strafe * 1.8 * dt, gx = t.x + Math.cos(orbit) * 110, gy = t.y + Math.sin(orbit) * 110, g = Math.atan2(gy - e.y, gx - e.x);
    if (moveCircle(e, Math.cos(g) * e.speed * dt, Math.sin(g) * e.speed * dt)) e.strafe *= -1;
    e.face = turnTo(e.face, angTo(e, t), 8 * dt);
    if (Math.random() < .004) e.strafe *= -1;
  },
  hound(e, t, dt) { // mendekat, memutar, lalu menerkam
    const d = dist(e, t), a = angTo(e, t);
    if (d < 150 && e.cd <= 0 && los(e, t)) { e.face = a; startAtk(e, DEF.hPounce, t); return; }
    if (d > 120 || !los(e, t)) { pathMove(e, t, e.speed, dt); return; }
    const mvA = a + e.strafe * Math.PI / 2;
    if (moveCircle(e, Math.cos(mvA) * e.speed * .7 * dt, Math.sin(mvA) * e.speed * .7 * dt)) e.strafe *= -1;
    e.face = turnTo(e.face, a, 10 * dt); e.walk += e.speed * dt * .12;
  },
  guard(e, t, dt) { // lambat berputar → bisa diserang dari samping/belakang
    const d = dist(e, t), a = angTo(e, t);
    e.face = turnTo(e.face, a, 2.2 * dt);
    if (d < 80 + t.r && e.cd <= 0 && Math.abs(angDiff(e.face, a)) < .6 && los(e, t)) { startAtk(e, d < 50 ? DEF.pBash : DEF.pThrust, t); return; }
    if (d > 60) { pathMove(e, t, e.speed, dt); e.face = turnTo(e.face, a, 2.2 * dt); }
  },
  spider(e, t, dt) { // menjerat dari jauh, menyerbu saat sasaran terjerat
    const d = dist(e, t), a = angTo(e, t), see = los(e, t);
    if (d < 55 && e.cd <= 0) { startAtk(e, DEF.wBite, t); return; }
    if (see && d > 90 && d < 300 && e.cd <= 0 && !(t.slowT > 0)) { e.face = a; startAtk(e, DEF.wShot, t); return; }
    if (!see || t.slowT > 0 || d > 170) { pathMove(e, t, e.speed * (t.slowT > 0 ? 1.4 : 1), dt); return; }
    const mvA = a + e.strafe * Math.PI / 2;
    if (moveCircle(e, Math.cos(mvA) * e.speed * dt, Math.sin(mvA) * e.speed * dt)) e.strafe *= -1;
    e.face = turnTo(e.face, a, 6 * dt); e.walk += e.speed * dt * .14;
  },
});

// tameng ksatria penjaga: serangan dari depan ditahan (kecuali saat ia menyerang/terhuyung)
function guardBlocks(e, src) {
  if (e.type !== 'guard' || e.state === 'stag' || e.state === 'parried' || (e.atk && e.atk.ph === 'a')) return false;
  return Math.abs(angDiff(e.face, angTo(e, src))) < 1.1;
}
// lendir besar pecah jadi dua lendir kecil saat mati
function slimeSplit(e) {
  if (e.type !== 'slime' || e.gen) return;
  for (const s of [-1, 1]) {
    const g = e.face + s * Math.PI / 2, c = makeEnemy('slime', e.x + Math.cos(g) * 14, e.y + Math.sin(g) * 14);
    Object.assign(c, { gen: 1, sc: .65, r: 9, maxHp: Math.round(c.maxHp * .4), state: 'chase', cd: rand(.6, 1.2) }); c.hp = c.hpLag = c.maxHp;
    c.kx = Math.cos(g) * 160; c.ky = Math.sin(g) * 160; L.enemies.push(c);
  }
}

// ---------- gambar monster (koordinat dunia; dipanggil dari drawEnemy) ----------
const BEAST_DRAW = {
  slime(e) {
    const k = e.dead ? clamp(e.deadT / .6, 0, 1) : 0, wob = Math.sin(G.t * 6 + e.x) * .08;
    const hop = e.atk && e.atk.def === DEF.sHop, sq = hop && e.atk.ph === 'w' ? clamp(e.atk.t / .6, 0, 1) * .25 : 0;
    ctx.save(); ctx.translate(e.x, e.y - (e.z || 0)); ctx.scale(e.sc, e.sc);
    ctx.globalAlpha *= 1 - k;
    ctx.fillStyle = e.flash > 0 ? '#fff' : '#2a2220'; ctx.strokeStyle = e.col; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 0, 13 * (1 + wob + sq), 11 * (1 - wob - sq * .6), 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff8a3a'; ctx.globalAlpha *= .7 + Math.sin(G.t * 3 + e.y) * .3; // bara di dalam lendir
    ctx.beginPath(); ctx.arc(-3, 2, 3, 0, TAU); ctx.arc(4, -2, 2, 0, TAU); ctx.fill();
    ctx.restore();
  },
  bat(e) {
    if (e.dead) return;
    const flap = Math.sin(G.t * 26 + e.x) * .6, swoop = e.atk && e.atk.ph === 'a';
    ctx.save(); ctx.translate(e.x, e.y - 10); ctx.rotate(e.face); ctx.lineCap = 'round';
    ctx.strokeStyle = e.flash > 0 ? '#fff' : e.col; ctx.lineWidth = 1.8;
    for (const s of [-1, 1]) { // sayap
      const sp = swoop ? .35 : 1;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-4, s * 9 * sp, -2 - 6 * sp, s * (13 + flap * 5) * sp); ctx.quadraticCurveTo(-5, s * 6 * sp, -7, s * 3 * sp); ctx.stroke();
    }
    ctx.fillStyle = '#1a1620'; ctx.beginPath(); ctx.ellipse(0, 0, 5, 3.5, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff5a3a'; ctx.beginPath(); ctx.arc(3, -1.3, .8, 0, TAU); ctx.arc(3, 1.3, .8, 0, TAU); ctx.fill();
    ctx.restore();
  },
  hound(e) {
    const k = e.dead ? clamp(e.deadT / 1, 0, 1) : 0, run = Math.sin(e.walk * 1.6) * 3;
    const crouch = e.atk && e.atk.def === DEF.hPounce && e.atk.ph === 'w';
    ctx.save(); ctx.translate(e.x, e.y - (e.z || 0)); ctx.rotate(e.face); ctx.globalAlpha *= 1 - k * .8; ctx.lineCap = 'round';
    const col = e.flash > 0 ? '#fff' : e.dead ? '#3a2a24' : e.col; ctx.strokeStyle = col; ctx.lineWidth = 2.2;
    const L0 = crouch ? 9 : 11;
    line(-L0, 0, L0 - 3, 0);                                                     // punggung
    for (const [x, s, ph] of [[7, 1, 0], [7, -1, Math.PI], [-8, 1, Math.PI], [-8, -1, 0]]) line(x, 0, x + Math.sin(e.walk * 1.6 + ph) * 3, s * 6); // kaki
    line(-L0, 0, -L0 - 6, Math.sin(G.t * 8) * 3);                                // ekor
    ctx.fillStyle = '#1a1210'; ctx.beginPath(); ctx.ellipse(L0, 0, 5, 4, 0, 0, TAU); ctx.fill(); ctx.stroke(); // kepala
    line(L0 + 1, -3, L0 - 2, -6); line(L0 + 1, 3, L0 - 2, 6);                    // telinga
    if (!e.dead) { ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.arc(L0 + 2.5, -1.5, .9, 0, TAU); ctx.arc(L0 + 2.5, 1.5, .9, 0, TAU); ctx.fill(); }
    ctx.restore();
  },
  spider(e) {
    const k = e.dead ? clamp(e.deadT / 1, 0, 1) : 0;
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.face); ctx.scale(e.sc, e.sc); ctx.globalAlpha *= 1 - k * .8; ctx.lineCap = 'round';
    ctx.strokeStyle = e.flash > 0 ? '#fff' : e.dead ? '#3a3036' : e.col; ctx.lineWidth = 1.6;
    for (const s of [-1, 1]) for (let j = 0; j < 4; j++) { // 8 kaki berbuku
      const base = -3 + j * 2.5, ph = Math.sin(e.walk * 2 + j * 1.3 + (s > 0 ? 0 : Math.PI)) * 2.5 * (e.dead ? 0 : 1);
      const kx = base + (j - 1.5) * 3 + ph, ky = s * 9, fx2 = base + (j - 1.5) * 5.5 + ph, fy2 = s * (e.dead ? 7 : 14);
      line(base, s * 3, kx, ky); line(kx, ky, fx2, fy2);
    }
    ctx.fillStyle = '#16121a'; ctx.beginPath(); ctx.ellipse(-4, 0, 7, 6, 0, 0, TAU); ctx.fill(); ctx.stroke(); // perut
    ctx.beginPath(); ctx.ellipse(4, 0, 4, 3.5, 0, 0, TAU); ctx.fill(); ctx.stroke();                      // kepala
    if (!e.dead) { ctx.fillStyle = '#ff5a8a'; for (const [x, y] of [[6, -1.5], [6, 1.5], [5, -2.6], [5, 2.6]]) { ctx.beginPath(); ctx.arc(x, y, .7, 0, TAU); ctx.fill(); } }
    ctx.restore();
  },
};
// hiasan ksatria penjaga (stickman): tameng besar di depan + tombak
function decorateGuard(e, o, st, wa, col) {
  const thrust = e.atk && e.atk.def === DEF.pThrust, bash = e.atk && e.atk.def === DEF.pBash;
  o.armL = bash && e.atk.ph !== 'w' ? [13, -2] : [10, -5];
  o.armR = thrust ? [thrust && e.atk.ph === 'a' ? 12 : 4, 6] : [5, 8];
  o.extra = () => {
    const [hx, hy] = o.armR; ctx.strokeStyle = '#8a7a5a'; ctx.lineWidth = 1.8; line(hx - 10, hy, hx + 20, hy);       // tombak
    ctx.fillStyle = '#d8d0c0'; ctx.beginPath(); ctx.moveTo(hx + 20, hy - 2); ctx.lineTo(hx + 26, hy); ctx.lineTo(hx + 20, hy + 2); ctx.fill();
    const [sx, sy] = o.armL, up = st !== 'stag' && st !== 'parried';
    ctx.strokeStyle = up ? '#e8dcc0' : '#6a6050'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(sx - 8, sy + 3, 11, -1.1, 1.1); ctx.stroke(); // tameng
    if (up) { ctx.globalAlpha *= .3; ctx.lineWidth = 8; ctx.stroke(); ctx.globalAlpha /= .3; }
  };
  o.top = () => { ctx.strokeStyle = col; ctx.lineWidth = 1.6; line(1, -5, 1, 5); }; // helm
}

// =====================================================================
//  LEVEL 8 — HUTAN ARANG:  v = Serigala Abu (3 ekor)   n = Ent Hangus
//  Bos: Serigala Kembar = Taring Kelabu (dekat) + Taring Bara (api)
// =====================================================================
Object.assign(ETYPE, {
  wolf: { hp: 50, r: 11, speed: 145, poise: 16, aggro: 320, col: '#a8a8a0', sc: 1.1, lw: 2.2 },
  ent: { hp: 200, r: 18, speed: 30, poise: 140, aggro: 240, col: '#6a5a40', sc: 1.6, lw: 3 },
  wolfA: { hp: 800, r: 20, speed: 120, poise: 120, aggro: 999, col: '#c8c8c0', sc: 2.1, lw: 3, boss: true },
  wolfB: { hp: 720, r: 20, speed: 105, poise: 110, aggro: 999, col: '#ff8a4a', sc: 2.1, lw: 3, boss: true },
});
SPAWN_CHARS.v = 'wolf'; SPAWN_CHARS.n = 'ent'; GROUP_SIZE.wolf = 3;

Object.assign(DEF, {
  // ent: sabetan dahan lebar (lambat tapi berat) & akar yang mencuat berderet ke arah sasaran
  eSweep: { wind: .9, act: .18, rec: .8, track: 2, anim: [.5, -2.6, 2.4], cd: [1, 1.6],
    hitFn: (e, a) => meleeArc(e, a, 72, 2.6, 22, { parryable: true, knock: 260 }), tele: (e, a, p) => teleArc(e.x, e.y, e.face, 72 + e.r, 2.6, p) },
  eRoots: { wind: .7, act: .05, rec: .9, track: 3, anim: [-2.8, -2.8, -2.8], cd: [1.4, 2.2],
    onAct: e => { for (let k = 1; k <= 6; k++) { const x = fx(e, 20 + k * 40), y = fy(e, 20 + k * 40); if (tileSolidW(x, y)) break; L.hazards.push({ kind: 'root', x, y, r: 26, t: 0, delay: .45 + k * .09 }); } Snd.bossTele(); },
    tele: (e, a, p) => teleLine(e.x, e.y, e.face, 260, 22, p) },
  // serigala kembar
  fBite: { wind: .5, act: .14, rec: .55, track: 6, move: 160, anim: [0, 0, 0], cd: [.5, .9],
    hitFn: (e, a) => meleeArc(e, a, 58, 2.0, 28, { parryable: true, knock: 220 }), tele: (e, a, p) => teleArc(e.x, e.y, e.face, 58 + e.r, 2.0, p),
    next: e => e.p2 && Math.random() < .5 ? DEF.fBite : null },
  fHowl: { wind: 1.0, act: .1, rec: .5, anim: [0, 0, 0], cd: [.5, .8],
    onStart: e => { Snd.roar(); shake(6); },
    onAct: e => {
      for (let k = 0; k < (e.p2 ? 3 : 2); k++) {
        const t = L.arenaTiles.filter(t => players.every(p => dist(t, p) > 160))[(Math.random() * 40) | 0] || L.arenaTiles[0];
        const w = makeEnemy('wolf', t.x, t.y); w.summon = true; w.state = 'chase'; w.cd = rand(.8, 1.5); L.enemies.push(w);
        for (let j = 0; j < 12; j++) part(t.x, t.y, rand(-40, 40), rand(-60, -10), rand(.4, .8), '#c8c8c0', 2, true);
      }
    },
    tele: (e, a, p) => teleCircle(e.x, e.y, 50, p * .4) },
  // semburan api: kerucut pendek berisi bola api kecil yang cepat padam
  fBreath: { wind: .7, act: 1.0, rec: .7, track: 4, anim: [0, 0, 0], cd: [.7, 1.1],
    onAct: (e, a) => { a.emit = 0; Snd.fire(); },
    actUpd: (e, a, dt) => {
      if (a.tgt && a.tgt.alive) e.face = turnTo(e.face, angTo(e, a.tgt), 1.2 * dt); // menyapu pelan mengikuti sasaran
      a.emit -= dt; if (a.emit <= 0) { a.emit = .07; spawnProj('e', fx(e, 22), fy(e, 22), e.face + rand(-.32, .32), 280, 11, { kind: 'orb', life: .62, r: 6, src: e }); if (Math.random() < .3) Snd.fire(); }
    },
    tele: (e, a, p) => teleArc(e.x, e.y, e.face, 190, .7, p) },
});

Object.assign(AI, {
  wolf(e, t, dt) { // kawanan: tiap serigala berusaha ke sisi/belakang sasaran sebelum menerkam
    const d = dist(e, t), a = angTo(e, t), see = los(e, t);
    if (!see || d > 260) { pathMove(e, t, e.speed, dt); return; }
    if (e.slot == null) e.slot = rand(-1, 1);
    const behind = Math.abs(angDiff(t.face + Math.PI, angTo(t, e))) < 1.3;
    if (d < 150 && e.cd <= 0 && (behind || e.cd < -1.5)) { e.face = a; startAtk(e, DEF.hPounce, t); return; }
    const goal = t.face + Math.PI + e.slot * 1.1, gx = t.x + Math.cos(goal) * 110, gy = t.y + Math.sin(goal) * 110, g = Math.atan2(gy - e.y, gx - e.x);
    moveCircle(e, Math.cos(g) * e.speed * dt, Math.sin(g) * e.speed * dt);
    e.face = turnTo(e.face, a, 8 * dt); e.walk += e.speed * dt * .12;
  },
  ent(e, t, dt) {
    const d = dist(e, t), a = angTo(e, t);
    e.face = turnTo(e.face, a, 1.8 * dt);
    if (e.cd <= 0 && los(e, t)) {
      if (d < 85 + t.r) { startAtk(e, DEF.eSweep, t); return; }
      if (d < 280) { e.face = a; startAtk(e, DEF.eRoots, t); return; }
    }
    if (d > 70) pathMove(e, t, e.speed, dt);
  },
  wolfA(e, t, dt) { // Taring Kelabu: menggigit beruntun, melompat, memanggil kawanan
    const d = dist(e, t), a = angTo(e, t);
    e.face = turnTo(e.face, a, 6 * dt);
    if (e.cd <= 0) {
      const r = Math.random(), pack = L.enemies.filter(o => o.summon && !o.dead).length;
      if (r < .14 && pack < 2) { startAtk(e, DEF.fHowl, t); return; }
      if (d < 100) { startAtk(e, r < .75 ? DEF.fBite : DEF.wLeap, t); return; }
      startAtk(e, r < .55 ? DEF.wLeap : DEF.hPounce, t); return;
    }
    if (d > 80) { moveCircle(e, Math.cos(a) * e.speed * e.spdMul * dt, Math.sin(a) * e.speed * e.spdMul * dt); e.walk += e.speed * dt * .1; }
  },
  wolfB(e, t, dt) { // Taring Bara: menjaga jarak menengah, menyembur api, menerjang berjejak bara
    const d = dist(e, t), a = angTo(e, t);
    e.face = turnTo(e.face, a, 5 * dt);
    if (e.cd <= 0) {
      const r = Math.random();
      if (d < 200) { startAtk(e, r < .65 ? DEF.fBreath : DEF.fBite, t); return; }
      startAtk(e, r < .6 ? DEF.kDash : DEF.fBreath, t); return;
    }
    const mvA = d < 140 ? a + Math.PI : d > 230 ? a : a + e.strafe * Math.PI / 2;
    if (moveCircle(e, Math.cos(mvA) * e.speed * e.spdMul * dt, Math.sin(mvA) * e.speed * e.spdMul * dt)) e.strafe *= -1;
    if (Math.random() < .006) e.strafe *= -1;
    e.walk += e.speed * dt * .1;
  },
});

// serigala (biasa & bos) memakai gambar anjing yang diperbesar, dengan surai
BEAST_DRAW.wolf = e => BEAST_DRAW.hound(e);
BEAST_DRAW.wolfA = e => drawBigWolf(e, '#e8e8e0');
BEAST_DRAW.wolfB = e => drawBigWolf(e, '#ffd27a');
function drawBigWolf(e, mane) {
  const dormant = L.bossState === 'dormant', col = e.col;
  if (dormant) e.col = '#6a645c';
  ctx.save(); ctx.translate(e.x, e.y); ctx.scale(e.sc / 1.1, e.sc / 1.1); ctx.translate(-e.x, -e.y);
  BEAST_DRAW.hound(e);
  if (!e.dead) { // surai di tengkuk
    ctx.translate(e.x, e.y); ctx.rotate(e.face); ctx.strokeStyle = dormant ? '#5a544c' : e.p2 ? '#ff6a3a' : mane; ctx.lineWidth = 1.6;
    for (let k = -2; k <= 2; k++) line(5, k * 1.8, 1 - Math.abs(Math.sin(G.t * 6 + k)) * 2.5, k * 3);
  }
  ctx.restore(); e.col = col;
}
BEAST_DRAW.ent = e => {
  const k = e.dead ? clamp(e.deadT / 1.2, 0, 1) : 0, sway = Math.sin(G.t * 1.5 + e.x) * .06;
  const swing = e.atk && e.atk.def === DEF.eSweep ? weaponAngle(e) : .4;
  ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.face); ctx.scale(e.sc, e.sc); ctx.globalAlpha *= 1 - k * .7; ctx.lineCap = 'round';
  const col = e.flash > 0 ? '#fff' : e.dead ? '#3a3028' : e.col;
  ctx.strokeStyle = col; ctx.lineWidth = 2.4;
  for (const s of [-1, 1]) { const g = s * (1.2 + sway) + (s > 0 ? swing * .5 : 0); line(0, 0, Math.cos(g) * 15, Math.sin(g) * 15); line(Math.cos(g) * 10, Math.sin(g) * 10, Math.cos(g + s * .6) * 16, Math.sin(g + s * .6) * 16); } // dahan
  ctx.fillStyle = '#1e1812'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill(); ctx.stroke();                         // batang
  ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, TAU); ctx.stroke();        // lingkar kayu
  if (!e.dead) { ctx.fillStyle = '#ff8a3a'; ctx.globalAlpha *= .6 + Math.sin(G.t * 4 + e.y) * .3; ctx.beginPath(); ctx.arc(4, -2, 1.4, 0, TAU); ctx.arc(4, 2, 1.4, 0, TAU); ctx.fill(); } // mata bara
  ctx.restore();
};

// =====================================================================
//  LEVEL 9 — SARANG WYVERN:  y = Wyvern Muda (2 ekor)   o = Telur Bara
//  Bos: Induk Wyvern (darat + terbang menyambar)
// =====================================================================
Object.assign(ETYPE, {
  wyvernling: { hp: 40, r: 11, speed: 110, poise: 14, aggro: 300, col: '#d86a3a', sc: .62, lw: 2 },
  egg: { hp: 30, r: 10, speed: 0, poise: 999, aggro: 210, col: '#c86a3a', sc: 1, lw: 2, anchored: true },
  wyvern: { hp: 1850, r: 24, speed: 95, poise: 220, aggro: 999, col: '#e07a40', sc: 2.4, lw: 3, boss: true },
});
SPAWN_CHARS.y = 'wyvernling'; SPAWN_CHARS.o = 'egg'; GROUP_SIZE.wyvernling = 2;
const HATCH_T = 6; // detik pemain berada dekat telur sebelum menetas

// panggil makhluk (anak wyvern / telur) di petak arena yang jauh dari pemain
function summonAt(type, n, o = {}) {
  for (let k = 0; k < n; k++) {
    const t = L.arenaTiles.filter(t => players.every(p => dist(t, p) > 150) && !tileSolidW(t.x, t.y))[(Math.random() * 60) | 0] || L.arenaTiles[0];
    const m = makeEnemy(type, t.x, t.y); Object.assign(m, { summon: true, state: 'chase', cd: rand(.8, 1.6) }, o); L.enemies.push(m);
    for (let j = 0; j < 12; j++) part(t.x, t.y, rand(-40, 40), rand(-70, -10), rand(.4, .8), '#ff9a5c', 2.2, true);
  }
}

Object.assign(DEF, {
  ySpit: { wind: .6, act: .05, rec: .5, track: 4, anim: [0, 0, 0], cd: [1.4, 2.2],
    onAct: e => { spawnProj('e', fx(e, 12), fy(e, 12), e.face, 240, 12, { kind: 'orb', parryable: true, life: 1.8, r: 7, src: e }); Snd.fire(); },
    tele: (e, a, p) => teleLine(e.x, e.y, e.face, 180, 3, p) },
  // ---- Induk Wyvern ----
  wvBite: { wind: .55, act: .14, rec: .55, track: 5, move: 120, anim: [0, 0, 0], cd: [.5, .9],
    hitFn: (e, a) => meleeArc(e, a, 70, 1.6, 33, { parryable: true, knock: 240 }), tele: (e, a, p) => teleArc(e.x, e.y, e.face, 70 + e.r, 1.6, p) },
  // sabetan ekor ke BELAKANG (tidak bisa ditangkis): jangan berdiri di belakang wyvern
  wvTail: { wind: .6, act: .2, rec: .6, anim: [0, 0, 0], cd: [.5, .9],
    hitFn: (e, a) => { const f = e.face; e.face = f + Math.PI; meleeArc(e, a, 84, 2.4, 22, { unblockable: true, knock: 320, stagger: .5 }); e.face = f; return false; },
    tele: (e, a, p) => teleArc(e.x, e.y, e.face + Math.PI, 84 + e.r, 2.4, p) },
  wvSpit: { wind: .7, act: .05, rec: .6, track: 4, anim: [0, 0, 0], cd: [.6, 1],
    onAct: e => { const n = e.p2 ? 5 : 3; for (let k = 0; k < n; k++) spawnProj('e', fx(e, 30), fy(e, 30), e.face + (k - (n - 1) / 2) * .22, 230, 21, { kind: 'orb', parryable: true, life: 2, r: 10, src: e }); Snd.fire(); },
    tele: (e, a, p) => { const n = e.p2 ? 5 : 3; for (let k = 0; k < n; k++) teleLine(e.x, e.y, e.face + (k - (n - 1) / 2) * .22, 200, 3, p); } },
  // terbang menyambar: melintas di atas sasaran sambil menjatuhkan bara, lalu mendarat menghantam
  wvFlight: { wind: .8, act: 1.6, rec: .8, anim: [0, 0, 0], cd: [.6, 1],
    onStart: (e, a) => {
      const g = angTo(e, a.tgt); let len = dist(e, a.tgt) + 170;
      while (len > 60 && !inArena({ x: e.x + Math.cos(g) * len, y: e.y + Math.sin(g) * len })) len -= 20;
      Object.assign(a, { sx: e.x, sy: e.y, ex: e.x + Math.cos(g) * len, ey: e.y + Math.sin(g) * len, g, len, drop: 0 });
      e.face = g; Snd.roar(); shake(5);
    },
    windUpd: e => { e.flapFast = true; },
    onAct: e => { e.air = true; Snd.swingHeavy(); },
    actUpd: (e, a, dt) => {
      const k = clamp(a.t / 1.6, 0, 1); e.x = lerp(a.sx, a.ex, ease(k)); e.y = lerp(a.sy, a.ey, ease(k)); e.z = 20 + Math.sin(k * Math.PI) * 55;
      a.drop -= dt; if (a.drop <= 0 && k > .08 && k < .92) { a.drop = .1; L.hazards.push({ kind: 'pillar', x: e.x, y: e.y, r: 30, t: 0, delay: .45 }); }
    },
    onRec: e => { e.air = false; e.z = 0; e.flapFast = false; resolveCircle(e); aoe(e.x, e.y, 70, 24, { knock: 300, guard: 2, stagger: .5 }); slamFx(e.x, e.y, 70, '#ff9a5c'); },
    tele: (e, a, p) => { teleLine(a.sx, a.sy, a.g, a.len, e.r * 2, p); teleCircle(a.ex, a.ey, 70, p); },
    teleAct: (e, a) => teleCircle(a.ex, a.ey, 70, 1) },
  wvBrood: { wind: 1.1, act: .1, rec: .6, anim: [0, 0, 0], cd: [.5, .8],
    onStart: e => { Snd.roar(); shake(8); e.flapFast = true; },
    onAct: e => { e.flapFast = false; summonAt('wyvernling', 2); summonAt('egg', 2, { hatchT: 2 }); },
    tele: (e, a, p) => teleCircle(e.x, e.y, 60, p * .4) },
});

Object.assign(AI, {
  wyvernling(e, t, dt) { // melayang menjaga jarak, meludah api, sesekali menukik
    const d = dist(e, t), a = angTo(e, t), see = los(e, t);
    if (!see) { pathMove(e, t, e.speed, dt); return; }
    if (e.cd <= 0) { startAtk(e, d < 140 && Math.random() < .4 ? DEF.batSwoop : DEF.ySpit, t); return; }
    const mvA = d < 150 ? a + Math.PI : d > 230 ? a : a + e.strafe * Math.PI / 2;
    if (moveCircle(e, Math.cos(mvA) * e.speed * dt, Math.sin(mvA) * e.speed * dt)) e.strafe *= -1;
    if (Math.random() < .006) e.strafe *= -1;
    e.face = turnTo(e.face, a, 6 * dt);
  },
  egg(e, t, dt) { // menetas kalau pemain terlalu lama di dekatnya
    e.hatchT = (e.hatchT || 0) + dt;
    if (e.hatchT >= HATCH_T) {
      e.dead = true; e.deadT = 0; e.hatched = true; // menetas: bukan "dibunuh"
      if (e.spawnIdx != null) L.killed.add(e.spawnIdx);
      const w = makeEnemy('wyvernling', e.x, e.y); Object.assign(w, { state: 'chase', cd: 1, summon: e.summon }); L.enemies.push(w);
      for (let k = 0; k < 16; k++) part(e.x, e.y, rand(-60, 60), rand(-80, -10), rand(.4, .8), k % 2 ? '#ffb347' : '#e8dcc0', 2.2, true);
      Snd.fire();
    }
  },
  wyvern(e, t, dt) {
    if (!e.p2 && e.hp < e.maxHp * .5) { e.p2 = true; e.spdMul = 1.15; startAtk(e, DEF.wvBrood, t); banner('', 'Induk Wyvern memanggil anak-anaknya!', 2.2, '#ff9a5c', false); return; }
    const d = dist(e, t), a = angTo(e, t), behind = Math.abs(angDiff(e.face, a)) > 2.1;
    if (e.cd <= 0) {
      const r = Math.random();
      if (d < 110) { startAtk(e, r < (e.p2 ? .26 : .18) ? DEF.wvFlight : behind ? DEF.wvTail : r < .75 ? DEF.wvBite : DEF.wvTail, t); return; } // kadang lepas landas walau didesak
      if (e.p2 && r < .1 && L.enemies.filter(o => o.summon && !o.dead).length < 3) { startAtk(e, DEF.wvBrood, t); return; }
      startAtk(e, r < (e.p2 ? .45 : .32) ? DEF.wvFlight : DEF.wvSpit, t); return;
    }
    e.face = turnTo(e.face, a, 3.5 * dt);
    if (d > 90) { moveCircle(e, Math.cos(e.face) * e.speed * e.spdMul * dt, Math.sin(e.face) * e.speed * e.spdMul * dt); e.walk += e.speed * dt * .08; }
  },
});

// ---------- gambar: wyvern (induk & muda) dan telur ----------
function drawWyvern(e) {
  const k = e.dead ? clamp(e.deadT / 1.2, 0, 1) : 0, dormant = e.boss && L.bossState === 'dormant';
  const col = e.flash > 0 ? '#fff' : dormant ? '#6a645c' : e.dead ? '#3a2a24' : e.col;
  const z = e.type === 'wyvernling' ? 14 + Math.sin(G.t * 4 + e.x) * 3 : (e.z || 0);
  const flap = Math.sin(G.t * (e.air || e.flapFast || e.type === 'wyvernling' ? 13 : 3) + e.x) * (dormant ? .2 : 1);
  ctx.save(); ctx.translate(e.x, e.y - z); ctx.rotate(e.face); ctx.scale(e.sc, e.sc); ctx.globalAlpha *= 1 - k * .8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = col; ctx.lineWidth = 1.8;
  for (const s of [-1, 1]) { // sayap berselaput
    const tip = 19 + flap * 5;
    ctx.fillStyle = dormant ? 'rgba(40,36,32,.8)' : 'rgba(60,24,16,.75)';
    ctx.beginPath(); ctx.moveTo(3, s * 3); ctx.lineTo(-3, s * tip); ctx.quadraticCurveTo(-7, s * (tip * .6), -12, s * 6); ctx.quadraticCurveTo(-6, s * 6, -4, s * 3); ctx.closePath(); ctx.fill(); ctx.stroke();
    line(3, s * 3, -3, s * tip); line(-1, s * 5, -8, s * tip * .7); // tulang sayap
  }
  const sw = Math.sin(G.t * 3 + e.y) * 3;
  ctx.beginPath(); ctx.moveTo(-8, 0); ctx.quadraticCurveTo(-16, sw, -24, sw * 1.6); ctx.stroke(); // ekor
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-24, sw * 1.6); ctx.lineTo(-29, sw * 1.6 - 3); ctx.lineTo(-29, sw * 1.6 + 3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1e1410'; ctx.beginPath(); ctx.ellipse(-1, 0, 9, 5, 0, 0, TAU); ctx.fill(); ctx.stroke();   // badan
  line(7, 0, 11, 0);                                                                                            // leher
  ctx.beginPath(); ctx.ellipse(14, 0, 4.5, 3.2, 0, 0, TAU); ctx.fill(); ctx.stroke();                            // kepala
  line(12, -2.5, 9, -5.5); line(12, 2.5, 9, 5.5);                                                               // tanduk
  if (!e.dead && !dormant) { ctx.fillStyle = e.p2 ? '#fff1c0' : '#ffd27a'; ctx.beginPath(); ctx.arc(16, -1.4, .8, 0, TAU); ctx.arc(16, 1.4, .8, 0, TAU); ctx.fill(); }
  ctx.restore();
}
BEAST_DRAW.wyvern = drawWyvern;
BEAST_DRAW.wyvernling = drawWyvern;
BEAST_DRAW.egg = e => {
  const k = e.dead ? clamp(e.deadT / .5, 0, 1) : 0, h = clamp((e.hatchT || 0) / HATCH_T, 0, 1);
  const wob = h > .6 ? Math.sin(G.t * 30) * (h - .6) * 4 : 0;
  ctx.save(); ctx.translate(e.x + wob, e.y); ctx.globalAlpha *= 1 - k;
  ctx.fillStyle = e.flash > 0 ? '#fff' : '#2a201c'; ctx.strokeStyle = e.col; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.ellipse(0, -2, 8, 10.5, 0, 0, TAU); ctx.fill(); ctx.stroke();
  if (h > 0) { // retakan bercahaya makin banyak menjelang menetas
    ctx.strokeStyle = `rgba(255,${180 - h * 80},80,${.4 + h * .6})`; ctx.lineWidth = 1.2;
    const n = 1 + Math.floor(h * 4);
    for (let j = 0; j < n; j++) { const y0 = -9 + j * 4.5; ctx.beginPath(); ctx.moveTo(-6 + j, y0); ctx.lineTo(-1, y0 + 2); ctx.lineTo(2, y0 - 1); ctx.lineTo(6 - j, y0 + 1.5); ctx.stroke(); }
  }
  ctx.restore();
};
