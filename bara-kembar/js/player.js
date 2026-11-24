'use strict';
// =====================================================================
//  PEMAIN
// =====================================================================
const SPD = 112;
const COMBO = [
  { wind: .20, act: .10, rec: .42, dmg: 20, cost: 20, range: 50, arc: 2.1, lunge: 110, sw: [-1.2, 1.2] },
  { wind: .15, act: .10, rec: .48, dmg: 24, cost: 22, range: 52, arc: 2.1, lunge: 120, sw: [1.2, -1.2] },
  { wind: .32, act: .13, rec: .70, dmg: 38, cost: 28, range: 58, arc: 2.8, lunge: 170, sw: [-1.6, 1.6], heavy: true },
];
const CHAIN_WIN = .24, HEAL_AMT = 45; // jendela tangkis & jumlah ramuan: lihat RULE (world.js)
// Arah hadap langsung mengikuti joystick (tanpa waktu berputar), kecuali saat mengayun pedang,
// berguling, terhuyung, atau tumbang. Saat menahan tameng/busur/ramuan joystick punya dua zona:
// dorongan ringan (< AIM_ONLY) hanya membidik di tempat, dorongan penuh = melangkah pelan (HOLD_SPD).
const AIM_ONLY = .55, HOLD_SPD = .25, VTURN = 28; // VTURN: kecepatan putar gambar badan (rad/s), hanya visual

class Player {
  constructor(i) {
    this.i = i; this.r = 12; this.maxHp = 100; this.maxStam = 100;
    this.col = i ? '#62d6cf' : '#f2ad4e'; this.glow = i ? '98,214,207' : '242,173,78';
    this.weapon = i ? 'bow' : 'sword';
  }
  spawn(x, y) {
    Object.assign(this, {
      x, y, kx: 0, ky: 0, hp: this.maxHp, hpLag: this.maxHp, stam: this.maxStam, stamCd: 0, flasks: RULE.flasks(),
      state: 'free', st: 0, face: this.i ? Math.PI : 0, vface: this.i ? Math.PI : 0, combo: 0, chainLock: false, hitSet: null, blockT: 0, drawT: 0,
      relPending: false, iframe: 1, flash: 0, down: false, dead: false, downT: 0, revT: 0, b3T: -1, healDone: false,
      slowT: 0, rollA: 0, walk: 0, moving: 0, stagDur: 0, msg: null, swapHint: 0, parryFx: 0
    });
  }
  get alive() { return !this.down && !this.dead; }
}
players.push(new Player(0), new Player(1));

// ---------- warna pemain (dipilih di layar judul, tersimpan di SAVE.colors) ----------
const PALETTE = [
  ['#f2ad4e', '242,173,78'],   // jingga bara
  ['#62d6cf', '98,214,207'],   // toska
  ['#ff6b6b', '255,107,107'],  // merah
  ['#86d66a', '134,214,106'],  // hijau
  ['#b98aff', '185,138,255'],  // ungu
  ['#5aa8ff', '90,168,255'],   // biru
  ['#ff8ad0', '255,138,208'],  // merah muda
  ['#eeeeee', '238,238,238'],  // putih
];
function applyColors() {
  const c = SAVE.colors;
  if (c[0] === c[1]) c[1] = (c[0] + 1) % PALETTE.length; // dua pemain tidak boleh berwarna sama
  players.forEach((p, i) => { [p.col, p.glow] = PALETTE[c[i] % PALETTE.length]; });
}
// pilih warna; false kalau warna itu sedang dipakai rekan (di mode solo, bot otomatis mengalah)
function setColor(i, k) {
  const c = SAVE.colors, o = 1 - i;
  if (c[o] === k) { if (!G.solo) return false; c[o] = c[i]; }
  c[i] = k; applyColors(); saveGame(); return true;
}
applyColors();

// "tali" menjaga kedua pemain tetap terlihat di satu layar (mode 2 pemain). Saat bertarung dengan bos
// talinya dilonggarkan (BOSS_SLACK) dan kamera boleh menjauh lebih lebar, karena arena bos lebar.
const BOSS_SLACK = 1.35;
const bossFight = () => L && L.bossState === 'active';
function sepVal(a, b) { const s = bossFight() ? BOSS_SLACK : 1, dx = (a.x - b.x) / (LEASH.x * s), dy = (a.y - b.y) / (LEASH.y * s); return dx * dx + dy * dy; }
function movePlayer(p, dx, dy) {
  const q = players[1 - p.i];
  // bot (mode solo) tidak terikat tali: ia kadang harus menjauh dulu (mis. memutar lewat tangga) untuk menyusul
  // mode solo tanpa tali: kamera mengikuti pemain, bot menyusul sendiri (atau berteleportasi)
  if (q.dead || G.solo) { moveCircle(p, dx, dy); return; }
  const before = sepVal(p, q);
  const ox = p.x, oy = p.y;
  moveCircle(p, dx, dy);
  const after = sepVal(p, q);
  if (after > 1 && after > before) {
    p.x = ox; p.y = oy; moveCircle(p, dx, 0);
    let v = sepVal(p, q); if (v > 1 && v > before) { p.x = ox; p.y = oy; }
    const mx = p.x, my = p.y; moveCircle(p, 0, dy);
    v = sepVal(p, q); if (v > 1 && v > before) { p.x = mx; p.y = my; }
    if (!p.msg || p.msg.t > 1) msg(p, 'Jangan terlalu jauh dari rekanmu', 1.2);
  }
}
function targetables() { return L.enemies.filter(e => !e.dead && !(e.boss && L.bossState !== 'active') && !e.inv); }
function aimAssist(p, ang, cone, range) {
  let best = null, bs = 1e9;
  for (const e of targetables()) {
    const d = dist(p, e); if (d > range) continue;
    const da = Math.abs(angDiff(ang, angTo(p, e))); if (da > cone) continue;
    if (!los(p, e)) continue;
    const s = da * 220 + d; if (s < bs) { bs = s; best = e; }
  }
  return best ? angTo(p, best) : ang;
}
function startAttack(p, c) {
  if (p.stam <= 0) { Snd.fail(); msg(p, 'Stamina habis', .8); return false; }
  const a = COMBO[c]; p.combo = c; p.state = 'atk_w'; p.st = 0; p.stam -= a.cost; p.stamCd = .65;
  p.face = aimAssist(p, p.face, 1.0, 110); p.hitSet = new Set(); p.chainLock = false;
  if (p.stam < 0) p.stam = 0;
  return true;
}
function startRoll(p, mx, my, m) {
  if (p.stam <= 0) { Snd.fail(); msg(p, 'Stamina habis', .8); return; }
  p.stam = Math.max(0, p.stam - 22); p.stamCd = .6;
  p.rollA = m > .3 ? Math.atan2(my, mx) : p.face; p.face = p.vface = p.rollA;
  p.state = 'roll'; p.st = 0; Snd.roll();
}
function fireArrow(p) {
  const ch = clamp((p.drawT - .28) / .62, 0, 1), full = ch >= 1;
  const ang = aimAssist(p, p.face, .45, 460); p.face = ang;
  p.stam = Math.max(0, p.stam - (8 + 8 * ch)); p.stamCd = .55; L.stats.shots[p.i]++;
  spawnProj('p', p.x + Math.cos(ang) * 16, p.y + Math.sin(ang) * 16, ang, full ? 720 : 470 + 150 * ch, 10 + 20 * ch, { kind: 'arrow', pierce: full ? 3 : 0, life: 1.1, r: 4, full, src: p });
  full ? Snd.bowFull() : Snd.bow();
  p.state = 'shoot_r'; p.st = 0;
}

function updatePlayer(p, dt) {
  if (p.dead) return;
  const inp = IN[p.i];
  p.flash = Math.max(0, p.flash - dt); p.iframe = Math.max(0, p.iframe - dt); p.parryFx = Math.max(0, p.parryFx - dt);
  p.hpLag = p.hpLag > p.hp ? Math.max(p.hp, p.hpLag - 30 * dt) : p.hp;
  if (p.msg) { p.msg.t += dt; if (p.msg.t > p.msg.dur) p.msg = null; }
  if (p.swapHint > 0) p.swapHint -= dt;
  if (p.kx || p.ky) {
    moveCircle(p, p.kx * dt, p.ky * dt); const f = Math.pow(.0015, dt); p.kx *= f; p.ky *= f;
    if (Math.hypot(p.kx, p.ky) < 6) p.kx = p.ky = 0;
  }
  if (p.slowT > 0) p.slowT -= dt; // terjerat jaring laba-laba
  if (p.lavaCd > 0) p.lavaCd -= dt;
  p.vface = turnTo(p.vface == null ? p.face : p.vface, p.face, VTURN * dt);
  if (p.state === 'down') return;
  // stamina
  if (p.stamCd > 0) p.stamCd -= dt;
  else if (p.stam < p.maxStam) {
    const rate = p.state === 'block' ? 14 : p.state === 'draw' ? 22 : 44;
    p.stam = Math.min(p.maxStam, p.stam + rate * dt);
  }
  const mag = Math.hypot(inp.mx, inp.my), m = mag > .2 ? Math.min(1, mag) : 0;
  const mAng = Math.atan2(inp.my, inp.mx);
  p.st += dt; p.moving = 0;
  const slow = p.slowT > 0 ? .5 : 1;
  const walk = spd => { // jalan biasa: arah langsung mengikuti joystick
    spd *= slow;
    if (m > 0) {
      p.face = mAng;
      movePlayer(p, Math.cos(mAng) * spd * m * dt, Math.sin(mAng) * spd * m * dt);
      p.walk += spd * m * dt * .11; p.moving = m;
    }
  };
  const aimWalk = spd => { // sambil menahan tombol: dorongan ringan = membidik saja, dorongan penuh = melangkah pelan
    spd *= slow;
    if (m <= 0) return;
    p.face = mAng;
    if (mag < AIM_ONLY) return;
    const k = (Math.min(1, mag) - AIM_ONLY) / (1 - AIM_ONLY);
    movePlayer(p, Math.cos(mAng) * spd * k * dt, Math.sin(mAng) * spd * k * dt);
    p.walk += spd * k * dt * .11; p.moving = k * .5;
  };
  bufferInput(p.i);
  switch (p.state) {
    case 'free': {
      walk(SPD);
      const fresh = pressed(p.i, 0);
      if (p.weapon === 'sword' && fresh) startAttack(p, 0);
      // busur: tombol panah yang masih DITAHAN (mis. sejak berguling) langsung membidik begitu bebas,
      // seperti tameng; tanpa stamina → menunggu diam-diam, peringatan hanya untuk tekanan baru
      else if (p.weapon === 'bow' && (fresh || inp.h[0])) {
        if (p.stam > 0) { p.state = 'draw'; p.st = 0; p.drawT = 0; p.relPending = false; }
        else if (fresh) { Snd.fail(); msg(p, 'Stamina habis', .8); }
      }
      else if (p.weapon === 'sword' && inp.h[1]) { p.state = 'block'; p.st = 0; p.blockT = 0; }
      else if (p.weapon === 'bow' && pressed(p.i, 1)) startRoll(p, inp.mx, inp.my, m);
      // tombol 3: ketuk = ganti senjata, tahan = minum ramuan
      if (p.state === 'free') {
        if (pressed(p.i, 2)) p.b3T = 0;
        if (p.b3T >= 0) {
          if (inp.h[2]) {
            p.b3T += dt;
            if (p.b3T >= .38) {
              p.b3T = -1;
              if (p.flasks > 0) { p.flasks--; p.state = 'heal'; p.st = 0; p.healDone = false; }
              else { Snd.fail(); msg(p, 'Ramuan habis', 1.2); }
            }
          } else { p.b3T = -1; p.state = 'swap'; p.st = 0; Snd.swap(); }
        }
      } else p.b3T = -1;
      break;
    }
    case 'atk_w': {
      const a = COMBO[p.combo];
      if (p.st >= a.wind) { p.state = 'atk_a'; p.st = 0; a.heavy ? Snd.swingHeavy() : Snd.swing(); }
      break;
    }
    case 'atk_a': {
      const a = COMBO[p.combo];
      movePlayer(p, Math.cos(p.face) * a.lunge * dt, Math.sin(p.face) * a.lunge * dt);
      for (const e of targetables()) {
        if (p.hitSet.has(e) || e.air) continue;
        if (dist(p, e) - e.r <= a.range && Math.abs(angDiff(p.face, angTo(p, e))) <= a.arc / 2) {
          p.hitSet.add(e); hurtEnemy(e, a.dmg, p, { melee: true, poise: a.heavy ? 1.6 : 1 });
        }
      }
      if (p.st >= a.act) { p.state = 'atk_r'; p.st = 0; }
      break;
    }
    case 'atk_r': {
      const a = COMBO[p.combo];
      const open = p.combo < 2 && !p.chainLock && p.st >= a.rec - CHAIN_WIN;
      if (tapped(p.i, 0)) {
        if (open) { startAttack(p, p.combo + 1); break; }
        else if (p.combo < 2) p.chainLock = true; // terlalu cepat → kombo putus
      }
      if (p.st >= a.rec) { p.state = 'free'; p.st = 0; }
      break;
    }
    case 'block': {
      p.blockT += dt;
      aimWalk(SPD * HOLD_SPD);
      if (pressed(p.i, 0)) { startAttack(p, 0); break; }
      if (!inp.h[1]) { p.state = 'free'; p.st = 0; }
      break;
    }
    case 'draw': {
      p.drawT += dt;
      aimWalk(SPD * HOLD_SPD);
      if (!inp.h[0]) p.relPending = true;
      if (pressed(p.i, 1)) { startRoll(p, inp.mx, inp.my, m); break; }
      if (p.relPending && p.drawT >= .28) fireArrow(p);
      break;
    }
    case 'shoot_r': if (p.st >= .34) { p.state = 'free'; p.st = 0; } break;
    case 'roll': {
      const D = .48, k = p.st / D;
      const sp = 300 * Math.pow(Math.max(0, 1 - k), .6) + 30;
      movePlayer(p, Math.cos(p.rollA) * sp * dt, Math.sin(p.rollA) * sp * dt);
      if (p.st > .03 && p.st < .38) p.iframe = Math.max(p.iframe, .02);
      if (Math.random() < .5) puff(p.x, p.y, 'rgba(150,140,130,', 1);
      if (p.st >= D) { p.state = 'roll_r'; p.st = 0; }
      break;
    }
    case 'roll_r': if (p.st >= .10) { p.state = 'free'; p.st = 0; } break;
    case 'heal': {
      aimWalk(SPD * HOLD_SPD);
      if (!p.healDone && p.st >= .65) {
        p.healDone = true; p.hp = Math.min(p.maxHp, p.hp + HEAL_AMT); Snd.heal();
        for (let k = 0; k < 18; k++) part(p.x + rand(-10, 10), p.y + rand(-10, 10), rand(-20, 20), rand(-60, -10), rand(.5, 1), '#ffd27a', 2.5, true);
      }
      if (p.st >= 1.0) { p.state = 'free'; p.st = 0; }
      break;
    }
    case 'swap': {
      if (p.st >= .2 && !p.swapped) { p.swapped = true; p.weapon = p.weapon === 'sword' ? 'bow' : 'sword'; p.swapHint = 4; }
      if (p.st >= .42) { p.state = 'free'; p.st = 0; p.swapped = false; }
      break;
    }
    case 'stag': if (p.st >= p.stagDur) { p.state = 'free'; p.st = 0; } break;
  }
}

function hurtPlayer(p, dmg, src, o = {}) {
  if (!p.alive || p.iframe > 0) return 'miss';
  if (o.dot) { p.hp -= dmg * RULE.dmgTaken(); p.flash = .08; if (p.hp <= 0) downPlayer(p); return 'hit'; } // lava: damage berkala
  const by = src && (src.src || src); if (by && by.maxHp && !by.boss) dmg *= lvlMul(); // musuh biasa: +6%/level
  dmg *= RULE.dmgTaken();
  const a = Math.atan2(src.y - p.y, src.x - p.x);
  const front = o.omni || Math.abs(angDiff(p.face, a)) < 1.3; // omni: serangan melingkar (cincin) tak punya arah
  if (p.state === 'block' && front && !o.unblockable) {
    if (p.blockT < RULE.parryWin() && o.parryable) {
      Snd.parry(); hitStop(.13); shake(6); vib(30); p.parryFx = .4;
      sparks(p.x + Math.cos(a) * 14, p.y + Math.sin(a) * 14, 22, '#fff6c8');
      p.stam = Math.min(p.maxStam, p.stam + 10);
      L.stats.parries[p.i]++;
      return 'parry';
    }
    Snd.block(); p.stam -= dmg * (o.guard || 1.3); p.stamCd = .8; p.hp -= dmg * .08;
    p.kx = -Math.cos(a) * 170; p.ky = -Math.sin(a) * 170;
    sparks(p.x + Math.cos(a) * 14, p.y + Math.sin(a) * 14, 8, '#ffd9a0');
    hitStop(.04); shake(2);
    if (p.stam <= 0) { p.stam = 0; p.state = 'stag'; p.st = 0; p.stagDur = 1.0; Snd.guardBreak(); msg(p, 'Tameng jebol!', 1.2); shake(6); }
    if (p.hp <= 0) downPlayer(p);
    return 'block';
  }
  p.hp -= dmg; p.flash = .2; p.iframe = .4;
  const kn = o.knock || 150; p.kx = -Math.cos(a) * kn; p.ky = -Math.sin(a) * kn;
  p.state = 'stag'; p.st = 0; p.stagDur = o.stagger || .34; p.b3T = -1; p.swapped = false;
  Snd.hurt(); hitStop(.07); shake(5); vib(45);
  blood(p.x, p.y, a + Math.PI, 10, '#8a1010');
  if (p.hp <= 0) downPlayer(p);
  return 'hit';
}
function downPlayer(p) {
  p.hp = 0; Snd.die(); L.stats.downs[p.i]++;
  const q = players[1 - p.i];
  if (q.alive) { p.state = 'down'; p.down = true; p.downT = RULE.downT(); p.revT = 0; msg(q, 'Rekanmu tumbang! Dekati untuk membangkitkan', 3); }
  else { p.state = 'down'; p.down = true; p.downT = 0; gameOver(); }
}
function revivePlayer(p, hpFrac) {
  p.down = false; p.dead = false; p.state = 'free'; p.st = 0; p.hp = Math.round(p.maxHp * hpFrac); p.hpLag = p.hp; p.iframe = 1.5; p.revT = 0;
  for (let k = 0; k < 20; k++) part(p.x, p.y, rand(-60, 60), rand(-60, 60), rand(.4, .9), '#fff1c0', 2, true);
  Snd.heal();
}
function gameOver() {
  if (G.mode === 'over') return;
  G.mode = 'over'; G.overT = 0; L.stats.overs++; SAVE.losses[L.idx] = (SAVE.losses[L.idx] || 0) + 1; saveGame(); Snd.over(); Snd.music(false);
}
