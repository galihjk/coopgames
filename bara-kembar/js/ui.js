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
  for (let k = 0; k < MAX_FLASK; k++) {
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
    ctx.fillRect(qx, qy, qw * clamp(q.alive ? q.hp / q.maxHp : q.down ? q.downT / 25 : 0, 0, 1), 5 * u);
  }
  // bar bos
  if (L.bossState === 'active' && L.boss && !L.boss.dead) {
    const b = L.boss, by = base - 46 * u, bbw = Math.min(300 * u, LW * .82), bx = LW / 2 - bbw / 2;
    txt(BOSS_NAMES[b.type], bx, by - 9 * u, 12 * u, '#e8d9b0', 'left', SERIF, '400');
    ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(bx - 2, by - 2, bbw + 4, 9 * u);
    ctx.fillStyle = '#e8d0a0'; ctx.fillRect(bx, by, bbw * b.hpLag / b.maxHp, 5 * u);
    ctx.fillStyle = '#9a1c16'; ctx.fillRect(bx, by, bbw * b.hp / b.maxHp, 5 * u);
  }
  // pesan & tutorial
  let my = base - (L.bossState === 'active' ? 80 : 34) * u;
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
  sword: [['Tebas', 'tekan lagi saat pedang berkilau = kombo'], ['Tahan: Tameng', 'angkat tepat sebelum kena = TANGKIS']],
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
    label(10 * u, y, 'left', ['Geser: bergerak', 'sentuh & geser di sisi kiri']);
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
function menuButtons() {
  const u = U, LW = H, LH = W;
  if (G.mode === 'title') {
    const n = LEVELS.length, gap = 10 * u, bw = Math.min(120 * u, (LW * .92 - gap * (n - 1)) / n), bh = 44 * u, y = LH * .79;
    const tw = bw * n + gap * (n - 1), x0 = LW / 2 - tw / 2;
    return [{ id: 'mode', x: x0, y: y - 50 * u, w: tw, h: 38 * u, label: G.solo ? '◂  SOLO + BOT  ▸' : '◂  2 PEMAIN  ▸' },
      ...LEVELS.map((_, k) => ({ id: 'lv', lv: k, x: x0 + k * (bw + gap), y, w: bw, h: bh, label: 'LEVEL ' + (k + 1), done: SAVE.cleared.includes(k) }))];
  }
  if (G.mode === 'pause') {
    const bw = 120 * u, bh = 44 * u, y = LH * .77;
    return [{ id: 'resume', x: LW / 2 - bw - 8 * u, y, w: bw, h: bh, label: 'LANJUT' }, { id: 'quit', x: LW / 2 + 8 * u, y, w: bw, h: bh, label: 'KE JUDUL' }];
  }
  if (G.mode === 'win' && G.winT > 2) return [{ id: 'title', x: LW / 2 - 70 * u, y: LH * .82, w: 140 * u, h: 44 * u, label: 'KE JUDUL' }];
  return [];
}
function drawMenuButtons() {
  for (const i of frames()) inFrame(i, () => {
    for (const b of menuButtons()) {
      rr(b.x, b.y, b.w, b.h, 6 * U); ctx.fillStyle = 'rgba(30,20,16,.85)'; ctx.fill();
      ctx.strokeStyle = 'rgba(232,217,176,.6)'; ctx.lineWidth = 1.5; ctx.stroke();
      txt(b.label, b.x + b.w / 2, b.y + b.h / 2, 15 * U, '#e8d9b0', 'center', SERIF, '400');
      if (b.done) txt('✓', b.x + b.w - 12 * U, b.y + 12 * U, 11 * U, '#ffb347');
    }
  });
}
function uiTap(q) {
  for (const i of frames()) {
    const f = screenToFrame(i, q);
    for (const b of menuButtons()) {
      if (f.x >= b.x && f.x <= b.x + b.w && f.y >= b.y && f.y <= b.y + b.h) {
        Snd.swap();
        if (b.id === 'mode') toggleSolo();
        else if (b.id === 'lv') startGame(b.lv);
        else if (b.id === 'resume') G.mode = 'play';
        else if (b.id === 'quit' || b.id === 'title') { G.mode = 'title'; Snd.music(false); }
        return;
      }
    }
  }
}
function togglePause() {
  if (G.mode === 'play') { G.mode = 'pause'; for (const n of IN) { n.tb = [0, 0, 0]; n.joy = null; } ptrs.clear(); }
  else if (G.mode === 'pause') G.mode = 'play';
}
function drawTitle() {
  emberBg(1 / 60);
  // garis pembatas tengah (hanya mode 2 pemain)
  if (!G.solo) { ctx.strokeStyle = 'rgba(255,154,74,.15)'; ctx.lineWidth = 1; line(W / 2, H * .1, W / 2, H * .9); }
  for (const i of frames()) inFrame(i, (LW, LH) => {
    txt('BARA KEMBAR', LW / 2, LH * .55, 34 * U, '#e8d9b0', 'center', SERIF, '400');
    txt(G.solo ? 'satu jiwa, satu bara pendamping' : 'dua jiwa, satu nyala', LW / 2, LH * .55 + 28 * U, 13 * U, '#b8a888', 'center', SERIF, 'italic 400');
    txt(G.solo ? 'Pegang HP tegak • Bot pemanah menjadi rekanmu' : 'Letakkan HP mendatar • P1 & P2 duduk berhadapan', LW / 2, LH * .94, 10.5 * U, 'rgba(220,210,190,.6)', 'center', 'sans-serif', '500');
  });
  drawMenuButtons();
}
function drawPause() {
  baseT(); ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, H);
  for (const i of frames()) inFrame(i, (LW, LH) => {
    txt('JEDA', LW / 2, LH * .66, 30 * U, '#e8d9b0', 'center', SERIF, '400');
  });
  drawMenuButtons();
}
function drawWin() {
  G.winT += 1 / 60;
  emberBg(1 / 60);
  for (const i of frames()) inFrame(i, (LW, LH) => {
    const a = clamp(G.winT / 1.5, 0, 1); ctx.globalAlpha = a;
    txt('NYALA BERTAHAN', LW / 2, LH * .62, 30 * U, '#ffd27a', 'center', SERIF, '400');
    txt('Kalian menaklukkan semua level. Terima kasih telah bermain!', LW / 2, LH * .62 + 30 * U, 12 * U, '#cfc3a8', 'center', SERIF, 'italic 400');
    ctx.globalAlpha = 1;
  });
  drawMenuButtons();
}
