'use strict';
// ---------- kontrol ----------
function drawIcon(kind, x, y, s, rot, col) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (kind === 'sword') { line(-8, 8, 8, -8); line(-6, 2, -2, 6); line(-9, 9, -6, 6); }
  else if (kind === 'shield') { ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(8, -6); ctx.quadraticCurveTo(8, 6, 0, 10); ctx.quadraticCurveTo(-8, 6, -8, -6); ctx.closePath(); ctx.stroke(); line(0, -6, 0, 6); }
  else if (kind === 'bow') { ctx.beginPath(); ctx.moveTo(-4, -10); ctx.quadraticCurveTo(8, 0, -4, 10); ctx.stroke(); ctx.lineWidth = 1; line(-4, -10, -4, 10); ctx.lineWidth = 2; line(-8, 0, 10, 0); line(10, 0, 6, -3); line(10, 0, 6, 3); }
  else if (kind === 'roll') { ctx.beginPath(); ctx.arc(0, 2, 7, Math.PI * .9, Math.PI * 2.3); ctx.stroke(); line(6, 6, 8, 1); line(6, 6, 1, 6); ctx.beginPath(); ctx.arc(-1, -7, 2.5, 0, TAU); ctx.fill(); }
  else if (kind === 'swap') { ctx.beginPath(); ctx.arc(0, 0, 7, -.3, Math.PI * .8); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 7, Math.PI * .7, Math.PI * 1.8); ctx.stroke(); line(6.5, -2.5, 8, 2); }
  ctx.restore();
}
function drawControls() {
  if (G.mode !== 'play' && G.mode !== 'over') return;
  for (const i of frames()) {
    const c = ctrls[i], p = players[i], n = IN[i], rot = i === 0 ? Math.PI / 2 : -Math.PI / 2;
    // joystick
    const j = n.joy, bx = j ? j.bx : c.joy.x, by = j ? j.by : c.joy.y;
    ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.strokeStyle = `rgba(${p.glow},.35)`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(bx, by, c.joy.r, 0, TAU); ctx.fill(); ctx.stroke();
    const kx = bx + (j ? j.dx : 0) * c.joy.r * .7, ky = by + (j ? j.dy : 0) * c.joy.r * .7;
    ctx.fillStyle = `rgba(${p.glow},${j ? .55 : .25})`; ctx.beginPath(); ctx.arc(kx, ky, c.joy.r * .42, 0, TAU); ctx.fill();
    // tombol
    const sword = p.weapon === 'sword';
    const busy = !p.alive;
    const chainOpen = p.state === 'atk_r' && p.combo < 2 && !p.chainLock && p.st >= COMBO[p.combo].rec - CHAIN_WIN;
    const icons = [sword ? 'sword' : 'bow', sword ? 'shield' : 'roll', 'swap'];
    for (let k = 0; k < 3; k++) {
      const b = c.b[k], held = n.h[k];
      ctx.fillStyle = held ? `rgba(${p.glow},.45)` : 'rgba(255,255,255,.07)';
      ctx.strokeStyle = (k === 0 && chainOpen) ? '#ffffff' : `rgba(${p.glow},${busy ? .15 : .5})`; ctx.lineWidth = (k === 0 && chainOpen) ? 4 : 2;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill(); ctx.stroke();
      drawIcon(icons[k], b.x, b.y, b.r / 15, rot, busy ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.85)');
    }
    // tahan tombol 3 → progres minum ramuan
    if (p.b3T > 0) { const b = c.b[2]; ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 4, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(p.b3T / .38, 0, 1)); ctx.stroke(); }
    // stamina ring di tombol 1/2 kalau habis
    if (p.stam <= 1 && p.alive) for (const k of [0, 1]) { const b = c.b[k]; ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill(); }
  }
}
function drawPauseBtn() {
  if (G.mode !== 'play') return;
  const x = W / 2, y = 20 * U, r = 15 * U;
  ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(x - 5 * U, y - 6 * U, 3.5 * U, 12 * U); ctx.fillRect(x + 1.5 * U, y - 6 * U, 3.5 * U, 12 * U);
}

// ---------- HUD (dalam bingkai baca pemain) ----------
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function txt(s, x, y, size, col, align = 'center', font = 'sans-serif', weight = '600') {
  ctx.font = `${weight} ${size}px ${font}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillText(s, x + 1, y + 1.5); ctx.fillStyle = col; ctx.fillText(s, x, y);
}
const SERIF = 'Georgia, "Times New Roman", serif';
function drawHUD(p, LW, LH) {
  const u = U, base = LH - 226 * u, bw = Math.min(230 * u, LW * .62), x = LW / 2 - bw / 2;
  // HP
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - 2, base - 2, bw + 4, 12 * u);
  ctx.fillStyle = '#e8d0a0'; ctx.fillRect(x, base, bw * clamp(p.hpLag / p.maxHp, 0, 1), 8 * u);
  ctx.fillStyle = p.hp / p.maxHp < .3 ? '#e0372c' : '#b3261e'; ctx.fillRect(x, base, bw * clamp(p.hp / p.maxHp, 0, 1), 8 * u);
  // stamina
  const sw = bw * .8;
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - 2, base + 12 * u, sw + 4, 8 * u);
  ctx.fillStyle = p.stamCd > 0 && p.stam < 25 ? '#6a8a3a' : '#5fae4a'; ctx.fillRect(x, base + 14 * u, sw * clamp(p.stam / p.maxStam, 0, 1), 4 * u);
  // label & ramuan
  txt(p.i === 0 ? 'P1' : 'P2', x - 16 * u, base + 7 * u, 12 * u, p.col);
  for (let k = 0; k < RULE.flasks(); k++) {
    const fx2 = x + sw + 16 * u + k * 13 * u, fy2 = base + 16 * u;
    ctx.fillStyle = k < p.flasks ? '#ffb347' : 'rgba(255,255,255,.15)';
    ctx.beginPath(); ctx.arc(fx2, fy2, 4.2 * u, 0, TAU); ctx.fill(); ctx.fillRect(fx2 - 1.5 * u, fy2 - 8 * u, 3 * u, 4 * u);
  }
  txt(p.weapon === 'sword' ? 'Pedang & Tameng' : 'Busur', x, base - 10 * u, 10 * u, 'rgba(230,220,200,.75)', 'left');
  // mode solo: bar HP bot (oranye = sisa waktu sebelum gugur saat tumbang)
  if (G.solo) {
    const q = players[1], qx = x + bw * .52, qw = bw * .48, qy = base - 13 * u;
    txt('BOT', qx - 4 * u, qy + 2.5 * u, 9 * u, q.col, 'right');
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(qx - 1, qy - 1, qw + 2, 5 * u + 2);
    ctx.fillStyle = q.alive ? '#3fb8b0' : '#ff8a70';
    ctx.fillRect(qx, qy, qw * clamp(q.alive ? q.hp / q.maxHp : q.down ? q.downT / RULE.downT() : 0, 0, 1), 5 * u);
  }
  // bar bos (level kembar: ditumpuk, satu bar per bos yang masih hidup)
  const bosses = L.bossState === 'active' ? aliveBosses() : [];
  bosses.forEach((b, k) => {
    const by = base - (46 + k * 28) * u, bbw = Math.min(300 * u, LW * .82), bx = LW / 2 - bbw / 2;
    txt(BOSS_NAMES[b.type] + (b.shield ? '  ·  terlindung perisai' : ''), bx, by - 9 * u, 12 * u, b.p2 && L.bosses.length > 1 ? '#ff9a6a' : '#e8d9b0', 'left', SERIF, '400');
    ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(bx - 2, by - 2, bbw + 4, 9 * u);
    ctx.fillStyle = '#e8d0a0'; ctx.fillRect(bx, by, bbw * b.hpLag / b.maxHp, 5 * u);
    ctx.fillStyle = '#9a1c16'; ctx.fillRect(bx, by, bbw * b.hp / b.maxHp, 5 * u);
  });
  // pesan & tutorial
  let my = base - (bosses.length ? 80 + (bosses.length - 1) * 28 : 34) * u;
  if (p.msg) { const a = clamp(Math.min(p.msg.t * 6, (p.msg.dur - p.msg.t) * 3), 0, 1); ctx.globalAlpha = a; txt(p.msg.text, LW / 2, my, 13 * u, '#fff1d0'); ctx.globalAlpha = 1; my -= 20 * u; }
  if (p.state === 'down') { txt('TUMBANG — tunggu rekanmu (' + Math.ceil(p.downT) + ')', LW / 2, my, 13 * u, '#ff8a70'); my -= 20 * u; }
  if (p.dead) { txt('Gugur — rekanmu bisa membangkitkanmu di api unggun', LW / 2, my, 12 * u, '#c8b8a8'); my -= 20 * u; }
  const hintA = G.hintT > 0 ? clamp(G.hintT, 0, 1) : p.swapHint > 0 ? clamp(p.swapHint, 0, 1) : 0;
  if (hintA > 0 && p.alive) drawCallouts(p, LW, base, hintA, G.hintT > 0);
  // banner
  for (const b of G.banners) {
    const a = clamp(Math.min(b.t * 2, (b.dur - b.t) * 1.5), 0, 1); if (a <= 0) continue;
    ctx.globalAlpha = a;
    const cy = LH * .56;
    if (b.text) {
      const g = ctx.createLinearGradient(0, 0, LW, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.5, 'rgba(0,0,0,.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, cy - 26 * u, LW, 52 * u);
      txt(b.text, LW / 2, cy - (b.sub ? 6 : 0) * u, (b.text.length > 22 ? 19 : 24) * u, b.color, 'center', SERIF, '400');
      if (b.sub) txt(b.sub, LW / 2, cy + 15 * u, 12 * u, '#cfc3a8', 'center', SERIF, '400');
    } else if (b.sub) txt(b.sub, LW / 2, cy, 15 * u, b.color, 'center', SERIF, 'italic 400');
    ctx.globalAlpha = 1;
  }
}
// ---------- petunjuk tombol: label + garis panah langsung ke tiap tombol ----------
// Label disusun bertingkat (tombol paling kiri paling bawah) supaya garisnya tidak menembus label lain.
const CALLOUTS = {
  sword: [['Tebas', 'tekan lagi saat pedang berkilau = kombo'], ['Tahan: Tameng', 'hadapkan ke musuh, tepat sebelum kena = TANGKIS']],
  bow: [['Tahan & lepas: Panah', 'tahan lebih lama = tembakan kuat'], ['Guling', 'kebal sesaat']],
  swap: ['Ketuk: Ganti senjata', 'tahan: minum ramuan'],
};
function drawCallouts(p, LW, base, alpha, withJoy) {
  const u = U, c = ctrls[p.i], list = CALLOUTS[p.weapon].concat([CALLOUTS.swap]);
  const pulse = .5 + Math.sin(G.t * 6) * .5;
  const items = [0, 1, 2].map(k => ({ k, b: c.b[k], f: screenToFrame(p.i, c.b[k]), text: list[k] })).sort((a, b) => a.f.x - b.f.x);
  ctx.save(); ctx.globalAlpha = alpha;
  const label = (x, y, align, [title, sub]) => {
    ctx.font = `700 ${11 * u}px sans-serif`; const w1 = ctx.measureText(title).width;
    ctx.font = `500 ${9 * u}px sans-serif`; const w2 = ctx.measureText(sub).width;
    const w = Math.max(w1, w2) + 12 * u, x0 = align === 'right' ? x - w : x;
    rr(x0, y - 9 * u, w, 25 * u, 5 * u); ctx.fillStyle = 'rgba(12,9,14,.78)'; ctx.fill();
    ctx.strokeStyle = `rgba(${p.glow},.5)`; ctx.lineWidth = 1; ctx.stroke();
    const tx = align === 'right' ? x - 6 * u : x + 6 * u;
    txt(title, tx, y - 1 * u, 11 * u, '#fff1d0', align, 'sans-serif', '700');
    txt(sub, tx, y + 10 * u, 9 * u, '#d8ccb0', align, 'sans-serif', '500');
  };
  const arrow = (x0, y0, x1, y1) => {
    ctx.strokeStyle = `rgba(${p.glow},.9)`; ctx.lineWidth = 1.6; ctx.setLineDash([4 * u, 3 * u]); line(x0, y0, x1, y1); ctx.setLineDash([]);
    const a = Math.atan2(y1 - y0, x1 - x0), s = 6 * u; ctx.fillStyle = `rgba(${p.glow},.95)`;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - Math.cos(a - .45) * s, y1 - Math.sin(a - .45) * s); ctx.lineTo(x1 - Math.cos(a + .45) * s, y1 - Math.sin(a + .45) * s); ctx.fill();
  };
  items.forEach((it, n) => {
    const y = base - (30 + n * 32) * u, xr = Math.min(it.f.x + it.b.r, LW - 6 * u);
    label(xr, y, 'right', it.text);
    arrow(it.f.x, y + 17 * u, it.f.x, it.f.y - it.b.r - 5 * u);
    ctx.strokeStyle = `rgba(255,241,208,${.35 + pulse * .5})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(it.f.x, it.f.y, it.b.r + 4 * u, 0, TAU); ctx.stroke();
  });
  if (withJoy) { // joystick hanya dijelaskan di awal level
    const j = screenToFrame(p.i, c.joy), y = base - 62 * u;
    label(10 * u, y, 'left', ['Geser: bergerak & menghadap', 'sambil tahan tombol: geser pelan = membidik']);
    arrow(j.x, y + 17 * u, j.x, j.y - c.joy.r - 5 * u);
  }
  ctx.restore();
}
function drawOver() {
  const k = clamp(G.overT / 1.2, 0, 1);
  baseT(); ctx.fillStyle = `rgba(0,0,0,${k * .55})`; ctx.fillRect(0, 0, W, H);
  for (const i of frames()) inFrame(i, (LW, LH) => {
    ctx.globalAlpha = k;
    const g = ctx.createLinearGradient(0, 0, LW, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.5, 'rgba(0,0,0,.8)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, LH * .7 - 34 * U, LW, 68 * U);
    txt('TUMBANG', LW / 2, LH * .7, 40 * U * (1 + (1 - k) * .1), '#a8201a', 'center', SERIF, '400');
    ctx.globalAlpha = 1;
  });
}
function drawFade() { if (G.fade > 0) { baseT(); ctx.fillStyle = `rgba(0,0,0,${G.fade})`; ctx.fillRect(0, 0, W, H); } }

// ---------- menu (judul, jeda, menang) ----------
let embers = [];
function emberBg(dt) {
  if (embers.length < 70) embers.push({ x: Math.random() * W, y: H + 10, vx: rand(-10, 10), vy: rand(-50, -15), life: rand(3, 8), t: 0, s: rand(1, 2.6) });
  ctx.fillStyle = '#07050a'; ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * .55); g.addColorStop(0, 'rgba(120,50,20,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (const e of embers) {
    e.t += dt; e.x += (e.vx + Math.sin(e.t * 2 + e.s) * 12) * dt; e.y += e.vy * dt;
    ctx.globalAlpha = clamp(Math.min(e.t, e.life - e.t), 0, 1) * .8; ctx.fillStyle = '#ff9a4a'; ctx.beginPath(); ctx.arc(e.x, e.y, e.s, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1; embers = embers.filter(e => e.t < e.life);
}
// Tombol menu per bingkai pemain. Hanya P1 (bingkai 0) yang memegang kontrol permainan;
// P2 hanya memilih warna dan melihat keterangan menunggu.
const TITLE_Y = LH => LH * .55;
const titleY0 = LH => TITLE_Y(LH) + 52 * U;
function swatchRow(i, cy) {
  const r = 11 * U, gap = 30 * U, n = PALETTE.length, cx0 = H / 2 - (n - 1) / 2 * gap;
  return PALETTE.map((_, k) => ({ id: 'color', k, pi: i, swatch: true, x: cx0 + k * gap - r, y: cy - r, w: r * 2, h: r * 2 }));
}
function levelLockText(k) { const n = k + 1 - OPEN_LEVELS - SAVE.cleared.length; return '🔒 tamatkan ' + n + ' level lagi'; }
function menuButtons(i) {
  const u = U, LW = H, LH = W, host = i === 0;
  if (G.mode === 'title') {
    if (!host) return swatchRow(i, titleY0(LH) + 70 * u);
    // pemilih level: ◂ [LEVEL n · nama] ▸, titik progres, MULAI, lalu warna
    const bw = Math.min(300 * u, LW * .86), x0 = LW / 2 - bw / 2, y0 = titleY0(LH), aw = 46 * u, open = isUnlocked(G.sel);
    return [
      { id: 'mode', x: x0, y: y0, w: bw / 2 - 4 * u, h: 38 * u, cap: 'MODE  ⇄', label: G.solo ? 'SOLO + BOT' : '2 PEMAIN' },
      { id: 'diff', x: x0 + bw / 2 + 4 * u, y: y0, w: bw / 2 - 4 * u, h: 38 * u, cap: 'KESULITAN  ⇄', label: isEasy() ? 'SANTAI' : 'NORMAL' },
      { id: 'prev', x: x0, y: y0 + 46 * u, w: aw, h: 50 * u, label: '◂' },
      { id: 'lvl', x: x0 + aw + 8 * u, y: y0 + 46 * u, w: bw - 2 * aw - 16 * u, h: 50 * u, label: 'LEVEL ' + (G.sel + 1), sub: open ? LEVELS[G.sel].name : levelLockText(G.sel), done: SAVE.cleared.includes(G.sel), off: !open },
      { id: 'next', x: x0 + bw - aw, y: y0 + 46 * u, w: aw, h: 50 * u, label: '▸' },
      { id: 'start', x: x0 + bw * .2, y: y0 + 116 * u, w: bw * .6, h: 44 * u, label: open ? 'MULAI' : 'TERKUNCI', hl: open, off: !open },
      ...swatchRow(i, y0 + 198 * u),
      // reset progres: ketuk sekali untuk bersiap, ketuk lagi dalam 3 detik untuk menghapus
      { id: 'ttest', tiny: true, x: LW / 2 - 154 * u, y: LH - 56 * u, w: 148 * u, h: 24 * u, label: 'Tes sentuh layar' },
      ...(SAVE.cleared.length ? [{ id: 'reset', tiny: true, x: LW / 2 + 6 * u, y: LH - 56 * u, w: 148 * u, h: 24 * u, label: resetArmed() ? 'Ketuk lagi untuk mereset' : 'Reset progres level', warn: resetArmed() }] : []),
    ];
  }
  if (!host) return [];
  if (G.mode === 'touchtest') return [{ id: 'ttexit', x: LW / 2 - 60 * u, y: LH * .5 + 20 * u, w: 120 * u, h: 40 * u, label: 'SELESAI' }];
  if (G.mode === 'pause') {
    if (G.solo) { // satu pemain: separuh atas layar kosong
      const bw = 120 * u, bh = 44 * u, y = LH * .3 + 30 * u;
      return [{ id: 'resume', x: LW / 2 - bw - 8 * u, y, w: bw, h: bh, label: 'LANJUT' }, { id: 'quit', x: LW / 2 + 8 * u, y, w: bw, h: bh, label: 'KE JUDUL' }];
    }
    // dua pemain: kolom kiri, supaya tidak menutupi petunjuk tombol di kanan
    const bw = 96 * u, bh = 40 * u, x = 12 * u, y = LH / 2 + 44 * u;
    return [{ id: 'resume', x, y, w: bw, h: bh, label: 'LANJUT' }, { id: 'quit', x, y: y + bh + 8 * u, w: bw, h: bh, label: 'KE JUDUL' }];
  }
  if (G.mode === 'clear' && G.clearT > .6) {
    const bw = 120 * u, y = clearTop(LH) + 268 * u, last = G.clear.idx + 1 >= LEVELS.length;
    return [{ id: 'title', x: LW / 2 - bw - 8 * u, y, w: bw, h: 42 * u, label: 'KE JUDUL' }, { id: 'cont', x: LW / 2 + 8 * u, y, w: bw, h: 42 * u, label: last ? 'SELESAI ▸' : 'LANJUT ▸', hl: true }];
  }
  if (G.mode === 'win' && G.winT > WIN_BTN_T) return [{ id: 'title', x: LW / 2 - 70 * u, y: winTop(LH) + 262 * u, w: 140 * u, h: 44 * u, label: 'KE JUDUL' }];
  return [];
}
function drawSwatch(b) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = b.w / 2, mine = SAVE.colors[b.pi] === b.k, other = SAVE.colors[1 - b.pi] === b.k;
  ctx.globalAlpha = other && !mine ? .35 : 1;
  ctx.fillStyle = PALETTE[b.k][0]; ctx.beginPath(); ctx.arc(cx, cy, r * (mine ? 1 : .8), 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
  if (mine) { ctx.strokeStyle = '#fff1d0'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, r + 4 * U, 0, TAU); ctx.stroke(); }
  if (other) txt(G.solo ? 'BOT' : b.pi ? 'P1' : 'P2', cx, cy + r + 9 * U, 8 * U, 'rgba(232,217,176,.7)', 'center', 'sans-serif', '600');
}
function drawMenuButtons() {
  for (const i of frames()) inFrame(i, () => {
    for (const b of menuButtons(i)) {
      if (b.swatch) { drawSwatch(b); continue; }
      if (b.tiny) {
        rr(b.x, b.y, b.w, b.h, 5 * U); ctx.fillStyle = b.warn ? 'rgba(120,24,16,.9)' : 'rgba(30,20,16,.6)'; ctx.fill();
        ctx.strokeStyle = b.warn ? '#ff7a5a' : 'rgba(232,217,176,.3)'; ctx.lineWidth = 1; ctx.stroke();
        txt(b.label, b.x + b.w / 2, b.y + b.h / 2, 10 * U, b.warn ? '#ffd0c0' : 'rgba(232,217,176,.65)', 'center', 'sans-serif', '600');
        continue;
      }
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      ctx.globalAlpha = b.off ? .55 : 1;
      rr(b.x, b.y, b.w, b.h, 6 * U); ctx.fillStyle = b.hl ? 'rgba(96,42,14,.92)' : 'rgba(30,20,16,.85)'; ctx.fill();
      ctx.strokeStyle = b.hl ? '#ffb347' : 'rgba(232,217,176,.6)'; ctx.lineWidth = b.hl ? 2 : 1.5; ctx.stroke();
      if (b.cap) { txt(b.cap, cx, b.y + 10 * U, 8.5 * U, 'rgba(232,217,176,.55)', 'center', 'sans-serif', '600'); txt(b.label, cx, cy + 5 * U, 13 * U, '#e8d9b0', 'center', 'sans-serif', '700'); }
      else if (b.sub) { txt(b.label, cx, cy - 8 * U, 16 * U, '#e8d9b0', 'center', SERIF, '400'); txt(b.sub, cx, cy + 11 * U, 10.5 * U, '#cfc3a8', 'center', SERIF, 'italic 400'); }
      else txt(b.label, cx, cy, (b.small ? 13 : 15) * U, b.hl ? '#ffe2b0' : '#e8d9b0', 'center', b.small ? 'sans-serif' : SERIF, b.small ? '600' : '400');
      ctx.globalAlpha = 1;
      if (b.done) txt(b.id === 'lvl' && SAVE.clearedNormal.includes(G.sel) ? '✦' : '✓', b.x + b.w - 12 * U, b.y + 12 * U, 11 * U, '#ffb347'); // ✦ = tamat di Normal
      if (b.id === 'lvl') { // titik progres: terisi = tamat, redup = terkunci, cincin = sedang dipilih
        const n = LEVELS.length, gap = 14 * U, y = b.y + b.h + 10 * U;
        for (let k = 0; k < n; k++) {
          const x = cx + (k - (n - 1) / 2) * gap;
          if (isUnlocked(k)) { ctx.fillStyle = SAVE.cleared.includes(k) ? '#ffb347' : 'rgba(232,217,176,.35)'; ctx.beginPath(); ctx.arc(x, y, 3 * U, 0, TAU); ctx.fill(); }
          else { ctx.strokeStyle = 'rgba(232,217,176,.3)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 2.6 * U, 0, TAU); ctx.stroke(); }
          if (k === G.sel) { ctx.strokeStyle = '#fff1d0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 5.5 * U, 0, TAU); ctx.stroke(); }
        }
      }
    }
  });
}
const resetArmed = () => G.resetArm != null && G.t - G.resetArm < 3;
function resetProgress() {
  if (!resetArmed()) { G.resetArm = G.t; return; }
  G.resetArm = null; SAVE.cleared = []; saveGame(); G.sel = 0; G.resetDone = G.t; // warna & mode tetap
}
function toggleDiff() { SAVE.diff = isEasy() ? 'normal' : 'easy'; saveGame(); }
function pickLevel(d) { G.sel = (G.sel + d + LEVELS.length) % LEVELS.length; }
function uiTap(q) {
  for (const i of frames()) {
    const f = screenToFrame(i, q);
    for (const b of menuButtons(i)) {
      if (f.x >= b.x && f.x <= b.x + b.w && f.y >= b.y && f.y <= b.y + b.h) {
        if (b.off || (b.swatch && !setColor(b.pi, b.k))) { Snd.fail(); return; }
        Snd.swap();
        if (b.id === 'mode') toggleSolo();
        else if (b.id === 'reset') resetProgress();
        else if (b.id === 'ttest') { resetTouchTest(); G.mode = 'touchtest'; }
        else if (b.id === 'ttexit') { resetTouchTest(); G.mode = 'title'; }
        else if (b.id === 'diff') toggleDiff();
        else if (b.id === 'cont') { if (G.fadeDir === 0) continueAfterClear(); }
        else if (b.id === 'prev') pickLevel(-1);
        else if (b.id === 'next') pickLevel(1);
        else if (b.id === 'lvl' || b.id === 'start') startGame(G.sel);
        else if (b.id === 'resume') G.mode = 'play';
        else if (b.id === 'quit' || b.id === 'title') { G.mode = 'title'; Snd.music(false); }
        return true;
      }
    }
  }
  return false;
}
function togglePause() {
  if (G.mode === 'play') { G.mode = 'pause'; for (const n of IN) { n.tb = [0, 0, 0]; n.joy = null; n.buf = [-1, -1, -1]; } ptrs.clear(); }
  else if (G.mode === 'pause') G.mode = 'play';
}
function drawTitle() {
  emberBg(1 / 60);
  // garis pembatas tengah (hanya mode 2 pemain)
  if (!G.solo) { ctx.strokeStyle = 'rgba(255,154,74,.15)'; ctx.lineWidth = 1; line(W / 2, H * .1, W / 2, H * .9); }
  for (const i of frames()) inFrame(i, (LW, LH) => {
    txt('BARA KEMBAR', LW / 2, TITLE_Y(LH), 34 * U, '#e8d9b0', 'center', SERIF, '400');
    txt(G.solo ? 'satu jiwa, satu bara pendamping' : 'dua jiwa, satu nyala', LW / 2, TITLE_Y(LH) + 28 * U, 13 * U, '#b8a888', 'center', SERIF, 'italic 400');
    txt(G.solo ? 'Pegang HP tegak • Bot menjadi rekanmu' : i === 0 ? 'Letakkan HP mendatar • kamu P1, rekanmu (P2) di seberang' : 'Kamu P2 • P1 di seberang yang memilih mode & level', LW / 2, LH - 16 * U, 10.5 * U, 'rgba(220,210,190,.6)', 'center', 'sans-serif', '500');
    const y0 = titleY0(LH);
    if (i === 0) {
      txt('Warnamu', LW / 2, y0 + 176 * U, 10 * U, 'rgba(232,217,176,.7)', 'center', 'sans-serif', '600');
      if (G.resetDone != null && G.t - G.resetDone < 2.5) txt('Progres direset — level 1–' + OPEN_LEVELS + ' terbuka', LW / 2, LH - 44 * U, 11 * U, '#ffb347', 'center', 'sans-serif', '600');
    }
    else { // P2: hanya pilih warna & menunggu P1
      ctx.globalAlpha = .6 + Math.sin(G.t * 3) * .3;
      txt('Menunggu P1 memilih level…', LW / 2, y0 + 14 * U, 14 * U, '#e8d9b0', 'center', SERIF, 'italic 400');
      ctx.globalAlpha = 1;
      txt('Pilih warnamu', LW / 2, y0 + 48 * U, 10 * U, 'rgba(232,217,176,.7)', 'center', 'sans-serif', '600');
    }
  });
  drawMenuButtons();
}
const waitP1 = (LW, LH) => { ctx.globalAlpha = .6 + Math.sin(G.t * 3) * .3; txt('Menunggu P1…', 12 * U + 48 * U, LH / 2 + 64 * U, 13 * U, '#e8d9b0', 'center', SERIF, 'italic 400'); ctx.globalAlpha = 1; };
function drawPause() {
  baseT(); ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, H);
  for (const i of frames()) inFrame(i, (LW, LH) => {
    if (G.solo) txt('JEDA', LW / 2, LH * .3, 30 * U, '#e8d9b0', 'center', SERIF, '400');
    else txt('JEDA', 12 * U + 48 * U, LH / 2 + 22 * U, 24 * U, '#e8d9b0', 'center', SERIF, '400');
    drawCallouts(players[i], LW, LH - 226 * U, 1, G.solo); // petunjuk tombol tetap terbaca saat jeda
    if (i === 1) waitP1(LW, LH); // tombol LANJUT/KE JUDUL hanya di P1
  });
  drawMenuButtons();
}
// ---------- layar tamat: epilog muncul baris demi baris ----------
const EPILOG = [
  'Naga Bara Purba tumbang.',
  'Dari dadanya, jantung api yang dirampas',
  'Sang Pemadam kembali berdenyut.',
  'Dua bara kembar menyentuhnya —',
  'dan kawah menyala, menerangi dunia',
  'yang lama padam.',
];
const WIN_BTN_T = 11; // detik sampai tombol KE JUDUL muncul
const winTop = LH => G.solo ? LH * .25 : LH / 2 + 20 * U;
function drawWin() {
  G.winT += 1 / 60;
  emberBg(1 / 60);
  const t = G.winT, fade = (t0, d = 1.2) => clamp((t - t0) / d, 0, 1), u = U;
  const best = Object.values(SAVE.best).reduce((a, b) => a + b, 0);
  for (const i of frames()) inFrame(i, (LW, LH) => {
    const top = winTop(LH);
    EPILOG.forEach((s, k) => { ctx.globalAlpha = fade(.8 + k * 1.1); txt(s, LW / 2, top + k * 20 * u, 13 * u, k === 0 ? '#ffd27a' : '#e8dcc0', 'center', SERIF, k === 0 ? '400' : 'italic 400'); });
    ctx.globalAlpha = fade(8, 1.6);
    txt('NYALA BERTAHAN', LW / 2, top + 152 * u, 30 * u * (1 + (1 - fade(8, 1.6)) * .15), '#ffd27a', 'center', SERIF, '400');
    ctx.globalAlpha = fade(9.2);
    txt(SAVE.cleared.length + ' dari ' + LEVELS.length + ' level tamat' + (SAVE.clearedNormal.length === LEVELS.length ? '  ·  semua di Normal ✦' : ''), LW / 2, top + 186 * u, 11 * u, '#cfc3a8', 'center', 'sans-serif', '500');
    if (best) txt('Total rekor waktu: ' + fmtTime(best), LW / 2, top + 205 * u, 11 * u, '#cfc3a8', 'center', 'sans-serif', '500');
    txt('TAMAT  ·  Terima kasih telah bermain!', LW / 2, top + 234 * u, 12 * u, '#e8d9b0', 'center', SERIF, 'italic 400');
    ctx.globalAlpha = 1;
    if (i === 1 && t > WIN_BTN_T) txt('Menunggu P1…', LW / 2, top + 284 * u, 13 * u, 'rgba(232,217,176,.7)', 'center', SERIF, 'italic 400');
  });
  drawMenuButtons();
}

// ---------- ringkasan level tamat ----------
const clearTop = LH => G.solo ? LH * .3 : LH / 2 + 24 * U;
const fmtTime = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
function drawClear() {
  G.clearT += 1 / 60; emberBg(1 / 60);
  const c = G.clear, s = c.s, u = U;
  const rows = [ // [label, nilai P1, nilai P2, lebih kecil lebih baik?]
    ['Tumbang', s.downs[0], s.downs[1], true],
    ['Tangkisan', s.parries[0], s.parries[1]],
    ['Musuh tumbang', s.kills[0], s.kills[1]],
    ['Damage', Math.round(s.dmg[0]), Math.round(s.dmg[1])],
    ['Akurasi panah', s.shots[0] ? Math.round(100 * s.hits[0] / s.shots[0]) : null, s.shots[1] ? Math.round(100 * s.hits[1] / s.shots[1]) : null],
  ];
  for (const i of frames()) inFrame(i, (LW, LH) => {
    ctx.globalAlpha = clamp(G.clearT / .8, 0, 1);
    const top = clearTop(LH);
    txt('LEVEL ' + (c.idx + 1) + ' TAMAT', LW / 2, top, 22 * u, '#ffd27a', 'center', SERIF, '400');
    txt(LEVELS[c.idx].name + (c.easy ? '  ·  Santai' : ''), LW / 2, top + 24 * u, 12 * u, '#cfc3a8', 'center', SERIF, 'italic 400');
    txt('Waktu ' + fmtTime(s.t) + '   ·   Mengulang ' + s.overs + '×   ·   Api unggun ' + s.bonfires, LW / 2, top + 48 * u, 10.5 * u, '#e8dcc0', 'center', 'sans-serif', '500');
    const xL = LW * .1, x1 = LW * .62, x2 = LW * .86; let y = top + 80 * u;
    txt('P1', x1, y, 12 * u, players[0].col, 'center', 'sans-serif', '700'); txt(G.solo ? 'BOT' : 'P2', x2, y, 12 * u, players[1].col, 'center', 'sans-serif', '700');
    ctx.fillStyle = 'rgba(232,217,176,.2)'; ctx.fillRect(xL, y + 10 * u, LW * .8, 1);
    for (const [label, a, b, low] of rows) {
      y += 22 * u;
      txt(label, xL, y, 11 * u, '#d8ccb0', 'left', 'sans-serif', '500');
      const best = a == null || b == null || a === b ? -1 : (low ? a < b : a > b) ? 0 : 1; // sorot yang lebih baik
      [[a, x1], [b, x2]].forEach(([v, x], k) => txt(v == null ? '—' : v + (label === 'Akurasi panah' ? '%' : ''), x, y, 12 * u, best === k ? '#ffd27a' : '#e8e0d0', 'center', 'sans-serif', best === k ? '700' : '500'));
    }
    y += 32 * u;
    if (c.record) txt(c.prev == null ? '✦ Rekor waktu pertama tercatat' : '✦ Rekor waktu baru!  (sebelumnya ' + fmtTime(c.prev) + ')', LW / 2, y, 11.5 * u, '#ffb347', 'center', 'sans-serif', '700');
    else txt('Rekor waktu level ini: ' + fmtTime(c.prev), LW / 2, y, 11 * u, 'rgba(232,217,176,.7)', 'center', 'sans-serif', '500');
    if (c.newUnlock >= 0) txt('🔓 Level ' + (c.newUnlock + 1) + ' terbuka!', LW / 2, y + 20 * u, 11.5 * u, '#ffd27a', 'center', 'sans-serif', '700');
    if (i === 1 && G.clearT > .6) txt('Menunggu P1…', LW / 2, top + 289 * u, 13 * u, 'rgba(232,217,176,.7)', 'center', SERIF, 'italic 400');
    ctx.globalAlpha = 1;
  });
  drawMenuButtons();
}

// ---------- layar tes sentuh ----------
function drawTouchTest() {
  baseT(); ctx.fillStyle = '#0a0810'; ctx.fillRect(0, 0, W, H);
  const cols = ['#f2ad4e', '#62d6cf', '#ff6b6b', '#86d66a', '#b98aff', '#5aa8ff', '#ff8ad0', '#eeeeee'];
  for (const p of TT.pts.values()) { // tiap jari: lingkaran bernomor
    const q = toL(p.x, p.y), c = cols[(p.n - 1) % cols.length];
    ctx.strokeStyle = c; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(q.x, q.y, 36 * U, 0, TAU); ctx.stroke();
    ctx.fillStyle = c; ctx.font = `700 ${22 * U}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.n, q.x, q.y);
  }
  for (const i of frames()) inFrame(i, (LW, LH) => {
    const y0 = LH * .5 + 80 * U, u = U;
    txt('TES SENTUH', LW / 2, y0, 20 * u, '#ffd27a', 'center', SERIF, '400');
    txt('Taruh 4 jari sekaligus (2 per pemain) lalu geser-geser.', LW / 2, y0 + 26 * u, 10.5 * u, '#cfc3a8', 'center', 'sans-serif', '500');
    txt('Jari aktif: ' + TT.pts.size + '    ·    maks bersamaan: ' + TT.max, LW / 2, y0 + 54 * u, 13 * u, '#e8dcc0', 'center', 'sans-serif', '700');
    txt('Dibatalkan sistem: ' + TT.cancels, LW / 2, y0 + 76 * u, 13 * u, TT.cancels ? '#ff8a70' : '#86d66a', 'center', 'sans-serif', '700');
    TT.log.forEach((s, k) => txt(s, LW / 2, y0 + 100 * u + k * 15 * u, 9.5 * u, '#ff9a80', 'center', 'sans-serif', '500'));
    txt(TT.cancels ? 'Ada sentuhan direbut sistem → matikan gestur 3 jari (mis. tangkapan layar) di pengaturan HP.' : 'Kalau semua jari tampil & tidak ada yang dibatalkan, HP sanggup 4 jari.', LW / 2, y0 + 168 * u, 9.5 * u, 'rgba(232,217,176,.75)', 'center', 'sans-serif', '500');
  });
  drawMenuButtons();
}
