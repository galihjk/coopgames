'use strict';
// =====================================================================
//  RENDER: helper telegraf
// =====================================================================
function teleArc(x, y, f, range, arc, p) {
  ctx.fillStyle = 'rgba(255,40,30,.10)'; ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, range, f - arc / 2, f + arc / 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = `rgba(255,60,40,${.12 + .3 * p})`; ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, range * p, f - arc / 2, f + arc / 2); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = `rgba(255,90,60,${.3 + .4 * p})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, range, f - arc / 2, f + arc / 2); ctx.stroke();
}
function teleCircle(x, y, r, p) {
  ctx.fillStyle = 'rgba(255,40,30,.09)'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = `rgba(255,60,40,${.12 + .3 * p})`; ctx.beginPath(); ctx.arc(x, y, r * p, 0, TAU); ctx.fill();
  ctx.strokeStyle = `rgba(255,90,60,${.35 + .4 * p})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
}
function teleLine(x, y, a, len, w, p) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  ctx.fillStyle = 'rgba(255,40,30,.09)'; ctx.fillRect(0, -w / 2, len, w);
  ctx.fillStyle = `rgba(255,60,40,${.15 + .35 * p})`; ctx.fillRect(0, -w / 2, len * p, w);
  ctx.restore();
}

// ---------- stickman top-down ----------
function line(x0, y0, x1, y1) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
function limb(x0, y0, x1, y1, side) {
  const L2 = Math.hypot(x1 - x0, y1 - y0), bend = Math.max(0, 13 - L2) * .55 * side;
  const mx = (x0 + x1) / 2 - 1.5, my = (y0 + y1) / 2 + bend;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, x1, y1); ctx.stroke();
}
// o: x,y,face,col,lw,sc,walk,stride,armL,armR,headFill,alpha,extra(fnLocal),curl
function drawStick(o) {
  ctx.save(); ctx.translate(o.x, o.y - (o.z || 0));
  ctx.rotate(o.face); ctx.scale(o.sc, o.sc);
  ctx.globalAlpha *= o.alpha == null ? 1 : o.alpha;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = o.col; ctx.lineWidth = o.lw;
  if (o.curl != null) { // berguling
    ctx.rotate(o.curl);
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.stroke();
    line(-4, -4, 4, 4); line(-4, 4, 4, -4);
    ctx.fillStyle = o.headFill; ctx.beginPath(); ctx.arc(3, 0, 4, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.restore(); return;
  }
  const sw = Math.sin(o.walk || 0) * (o.stride || 0);
  line(-1, -3.5, sw - 1, -4.5); line(-1, 3.5, -sw - 1, 4.5);
  line(-2, 0, 1, 0);
  const lean = o.lean || 0;
  line(1 + lean * .5, -7, 1 + lean * .5, 7);
  o.under && o.under();
  limb(1 + lean * .5, -7, o.armL[0], o.armL[1], -1);
  limb(1 + lean * .5, 7, o.armR[0], o.armR[1], 1);
  o.extra && o.extra();
  ctx.strokeStyle = o.col; ctx.lineWidth = o.lw;
  ctx.fillStyle = o.headFill || '#0d0b10';
  ctx.beginPath(); ctx.arc(1 + lean, 0, 5.2, 0, TAU); ctx.fill(); ctx.stroke();
  // penanda arah (hidung/visor)
  ctx.beginPath(); ctx.moveTo(4 + lean, -2.2); ctx.lineTo(6.6 + lean, 0); ctx.lineTo(4 + lean, 2.2); ctx.stroke();
  o.top && o.top();
  ctx.restore();
}

function drawPlayer(p) {
  if (p.dead) { // arwah kecil
    ctx.save(); ctx.globalAlpha = .35 + Math.sin(G.t * 3) * .1; ctx.fillStyle = p.col;
    ctx.beginPath(); ctx.arc(p.x, p.y + Math.sin(G.t * 2) * 3, 4, 0, TAU); ctx.fill(); ctx.restore(); return;
  }
  // bayangan
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 13, 11, 0, 0, TAU); ctx.fill();
  // cincin pemain
  ctx.strokeStyle = `rgba(${p.glow},.55)`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, TAU); ctx.stroke();
  const col = p.flash > 0 ? '#ffffff' : p.col;
  const o = { x: p.x, y: p.y, face: p.face, col, lw: 2.4, sc: 1.4, walk: p.walk, stride: 5 * Math.min(1, p.moving * 1.4), headFill: '#141018', alpha: p.iframe > 0 && p.state !== 'roll' && Math.floor(G.t * 20) % 2 ? .55 : 1 };
  if (p.state === 'down') {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.face + Math.PI / 2); ctx.strokeStyle = '#776'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    line(-10, 0, 8, 0); line(8, 0, 14, -5); line(8, 0, 14, 5); line(-4, 0, -8, -8); line(-4, 0, 2, 9);
    ctx.fillStyle = '#141018'; ctx.beginPath(); ctx.arc(-14, 0, 5, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
    // cincin bangkit
    const k = p.revT / 2.2;
    ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, 24, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#fff1c0'; ctx.beginPath(); ctx.arc(p.x, p.y, 24, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke();
    ctx.strokeStyle = `rgba(255,80,60,.8)`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 29, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(p.downT / 25, 0, 1)); ctx.stroke();
    return;
  }
  if (p.state === 'roll') { o.curl = p.st * 18; drawStick(o); return; }
  const sword = p.weapon === 'sword';
  let armL = [7, -8], armR = [6, 9];
  if (sword) {
    let s = null, trail = null;
    if (p.state === 'atk_w' || p.state === 'atk_a' || p.state === 'atk_r') {
      const a = COMBO[p.combo];
      if (p.state === 'atk_w') s = lerp(.6, a.sw[0] * 1.15, easeOut(p.st / a.wind));
      else if (p.state === 'atk_a') { const k = easeOut(clamp(p.st / a.act, 0, 1)); s = lerp(a.sw[0], a.sw[1], k); trail = [a.sw[0], s]; }
      else { const k = clamp(p.st / a.rec, 0, 1); s = lerp(a.sw[1], .6, clamp((k - .55) / .45, 0, 1)); if (p.st < .1) trail = [lerp(a.sw[0], a.sw[1], p.st / .1), a.sw[1]]; }
      armR = [Math.cos(s) * 11, Math.sin(s) * 11];
      o.lean = p.state === 'atk_a' ? 2 : 0;
    }
    const chainOpen = p.state === 'atk_r' && p.combo < 2 && !p.chainLock && p.st >= COMBO[p.combo].rec - CHAIN_WIN;
    const blocking = p.state === 'block';
    if (blocking) armL = [11, -2];
    if (p.state === 'heal') { armR = [4, 3]; }
    if (p.state === 'stag') { armL = [-3, -11]; armR = [-3, 11]; }
    o.armL = armL; o.armR = armR;
    o.extra = () => {
      // pedang
      const ang = s != null ? s : (p.state === 'heal' ? 0 : .25);
      const hx = armR[0], hy = armR[1], len = s != null ? 27 : 19;
      if (trail) {
        ctx.save(); ctx.globalAlpha = .45; ctx.strokeStyle = COMBO[p.combo].heavy ? '#ffcf8a' : '#fff'; ctx.lineWidth = 9;
        ctx.beginPath(); const d = trail[1] - trail[0]; ctx.arc(0, 0, 30, Math.min(trail[0], trail[0] + d), Math.max(trail[0], trail[0] + d)); ctx.stroke(); ctx.restore();
      }
      if (p.state !== 'heal') {
        ctx.strokeStyle = '#ddd8cc'; ctx.lineWidth = 2.2;
        line(hx, hy, hx + Math.cos(ang) * len, hy + Math.sin(ang) * len);
        ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 2.6;
        line(hx - Math.sin(ang) * 3.5, hy + Math.cos(ang) * 3.5, hx + Math.sin(ang) * 3.5, hy - Math.cos(ang) * 3.5);
        if (chainOpen) { ctx.fillStyle = '#fff'; ctx.globalAlpha = .9; const tx = hx + Math.cos(ang) * len, ty = hy + Math.sin(ang) * len; ctx.beginPath(); ctx.arc(tx, ty, 3 + Math.sin(G.t * 40) * 1, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
      } else { // ramuan
        ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(hx + 1, hy, 3, 0, TAU); ctx.fill();
      }
      // tameng
      const par = blocking && p.blockT < PARRY_WIN;
      ctx.strokeStyle = par ? '#fffbe0' : blocking ? '#c9b58a' : '#8a7a5a'; ctx.lineWidth = blocking ? 4.5 : 3.5;
      ctx.beginPath();
      if (blocking) ctx.arc(0, 0, 13, -.85, .85); else ctx.arc(0, 0, 10, -1.75, -.85);
      ctx.stroke();
      if (par) { ctx.globalAlpha = .4; ctx.lineWidth = 9; ctx.stroke(); ctx.globalAlpha = 1; }
    };
  } else {
    let ch = 0, drawing = p.state === 'draw';
    if (drawing) { ch = clamp(p.drawT / .9, 0, 1); armL = [13, 0]; armR = [9 - 8 * ch, 1]; }
    else { armL = [8, -6]; armR = [5, 7]; }
    if (p.state === 'heal') armR = [4, 3];
    if (p.state === 'stag') { armL = [-3, -11]; armR = [-3, 11]; }
    o.armL = armL; o.armR = armR;
    o.extra = () => {
      const bx = armL[0], by = armL[1];
      ctx.strokeStyle = '#9a7448'; ctx.lineWidth = 2.4;
      if (drawing) {
        ctx.beginPath(); ctx.moveTo(bx - 2, by - 10); ctx.quadraticCurveTo(bx + 7, by, bx - 2, by + 10); ctx.stroke();
        ctx.strokeStyle = 'rgba(230,230,220,.8)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(bx - 2, by - 10); ctx.lineTo(armR[0], armR[1]); ctx.lineTo(bx - 2, by + 10); ctx.stroke();
        const full = p.drawT >= .9;
        ctx.strokeStyle = full ? '#fff3b0' : '#ddd'; ctx.lineWidth = 1.6; line(armR[0], armR[1], bx + 9, by);
        if (full) { ctx.globalAlpha = .5 + Math.sin(G.t * 30) * .3; ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(bx + 9, by, 3, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
      } else {
        ctx.beginPath(); ctx.moveTo(bx - 3, by - 8); ctx.quadraticCurveTo(bx + 4, by, bx - 3, by + 8); ctx.stroke();
        ctx.strokeStyle = 'rgba(230,230,220,.6)'; ctx.lineWidth = 1; line(bx - 3, by - 8, bx - 3, by + 8);
      }
      if (p.state === 'heal') { ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(armR[0] + 1, armR[1], 3, 0, TAU); ctx.fill(); }
    };
  }
  if (p.state === 'swap') { o.armL = [2, -5]; o.armR = [2, 5]; o.extra = null; }
  drawStick(o);
  if (p.parryFx > 0) { ctx.strokeStyle = `rgba(255,250,220,${p.parryFx * 2})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 20 + (.4 - p.parryFx) * 80, 0, TAU); ctx.stroke(); }
}

function drawEnemy(e) {
  const fade = e.dead ? clamp(1 - e.deadT / 1.5, 0, 1) : 1;
  ctx.save(); ctx.globalAlpha = fade * e.alpha;
  const sh = e.r * (1 - Math.min(.5, e.z / 140));
  ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(e.x, e.y, sh + 2, sh, 0, 0, TAU); ctx.fill();
  if (e.dead) { // tergeletak
    ctx.translate(e.x, e.y); ctx.rotate(e.face); ctx.scale(e.sc, e.sc); ctx.strokeStyle = '#3a3036'; ctx.lineWidth = e.lw; ctx.lineCap = 'round';
    line(-10, 0, 8, 0); line(-4, 0, 2, -9); line(-4, 0, -9, 8); line(8, 0, 13, 5); line(8, 0, 14, -4);
    ctx.beginPath(); ctx.arc(-14, 0, 5, 0, TAU); ctx.stroke(); ctx.restore(); return;
  }
  const windup = e.atk && e.atk.ph === 'w';
  let col = e.flash > 0 ? '#ffffff' : e.col;
  if (windup && Math.floor(G.t * 14) % 2 === 0 && e.atk.t > (e.atk.def.wind / e.spdMul) * .5) col = '#ff6a50';
  if (e.boss && L.bossState === 'dormant') col = '#6a645c';
  const wa = weaponAngle(e);
  const hand = [Math.cos(wa) * 11, Math.sin(wa) * 11];
  const o = { x: e.x, y: e.y, z: e.z, face: e.face, col, lw: e.lw, sc: e.sc * (1 + e.z / 260), walk: e.walk, stride: e.state === 'chase' ? 4.5 : 0, headFill: '#0d0b10', armL: [7, -8], armR: hand };
  const st = e.state;
  if (st === 'stag' || st === 'parried') { o.armL = [-4, -11]; o.armR = [-4, 11]; o.lean = -2; }
  if (e.type === 'grunt' || e.type === 'shade') {
    const shade = e.type === 'shade';
    o.extra = () => { const [hx, hy] = o.armR, a = st === 'stag' || st === 'parried' ? 2.6 : wa; ctx.strokeStyle = shade ? '#c8b8ff' : '#7d7466'; ctx.lineWidth = 2.6; line(hx, hy, hx + Math.cos(a) * 17, hy + Math.sin(a) * 17); };
    o.top = () => { ctx.fillStyle = shade ? '#e8dcff' : '#ff3a2a'; ctx.beginPath(); ctx.arc(3.5, -1.8, .9, 0, TAU); ctx.arc(3.5, 1.8, .9, 0, TAU); ctx.fill(); };
  } else if (e.type === 'archer') {
    const drawing = e.atk && e.atk.ph === 'w', k = drawing ? clamp(e.atk.t / .9, 0, 1) : 0;
    o.armL = [12, 0]; o.armR = [9 - 8 * k, 1];
    o.extra = () => {
      ctx.strokeStyle = '#6a4a7a'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(10, -9); ctx.quadraticCurveTo(18, 0, 10, 9); ctx.stroke();
      ctx.strokeStyle = 'rgba(220,200,240,.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(10, -9); ctx.lineTo(o.armR[0], 1); ctx.lineTo(10, 9); ctx.stroke();
      if (drawing) { ctx.strokeStyle = '#ddd'; line(o.armR[0], 1, 20, 0); }
    };
    o.top = () => { ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(1, 0, 7, Math.PI * .6, Math.PI * 1.4); ctx.stroke(); }; // tudung
  } else if (e.type === 'brute') {
    o.extra = () => {
      const [hx, hy] = o.armR, a = st === 'stag' || st === 'parried' ? 2.6 : wa;
      ctx.strokeStyle = '#5a3a2a'; ctx.lineWidth = 3.2; const ex = hx + Math.cos(a) * 20, ey = hy + Math.sin(a) * 20; line(hx, hy, ex, ey);
      ctx.fillStyle = '#4a3a34'; ctx.beginPath(); ctx.arc(ex, ey, 5, 0, TAU); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();
    };
    o.top = () => { ctx.strokeStyle = col; ctx.lineWidth = 2; line(-1, -4, -5, -8); line(-1, 4, -5, 8); };
  } else if (e.type === 'warden') {
    o.armL = [10, 3]; // pegang dua tangan
    o.extra = () => {
      const [hx, hy] = o.armR, a = st === 'stag' || st === 'parried' ? 2.6 : wa;
      ctx.strokeStyle = '#b8b0a0'; ctx.lineWidth = 3.4; line(hx, hy, hx + Math.cos(a) * 30, hy + Math.sin(a) * 30);
      ctx.strokeStyle = '#6a5030'; ctx.lineWidth = 3; line(hx - Math.sin(a) * 5, hy + Math.cos(a) * 5, hx + Math.sin(a) * 5, hy - Math.cos(a) * 5);
      // jubah
      ctx.strokeStyle = 'rgba(120,90,60,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(-1, 0, 9, Math.PI * .55, Math.PI * 1.45); ctx.stroke();
    };
    o.top = () => { ctx.strokeStyle = col; ctx.lineWidth = 2; line(1, -5, -2, -9); line(1, 5, -2, 9); line(1, 0, -4, 0); }; // tanduk/jambul helm
  } else if (e.type === 'queen') {
    o.stride = 0; o.armL = [8, -9];
    o.under = () => { // jubah melingkar
      ctx.fillStyle = 'rgba(60,20,20,.75)'; ctx.beginPath(); ctx.arc(-2, 0, 10, 0, TAU); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = e.lw;
    };
    o.extra = () => {
      const [hx, hy] = o.armR; ctx.strokeStyle = '#5a3a2a'; ctx.lineWidth = 2.4; line(hx - 8, hy, hx + 10, hy);
      ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(hx + 11, hy, 3 + Math.sin(G.t * 8) * .8, 0, TAU); ctx.fill();
    };
    o.top = () => { ctx.strokeStyle = '#ffcf70'; ctx.lineWidth = 1.6; for (let k = -1; k <= 1; k++) line(-1, k * 3, -6, k * 4.5); }; // mahkota
    o.z = 6 + Math.sin(G.t * 2.5) * 3;
  } else if (e.type === 'exec') {
    const a = e.atk, spin = a && a.def === DEF.xSpin && a.ph === 'a';
    o.armL = spin ? [9, 4] : [10, 3];
    if (spin) o.armR = [11, 1];
    o.extra = () => {
      const [hx, hy] = o.armR, wa2 = st === 'stag' || st === 'parried' ? 2.6 : wa;
      let bx = hx + Math.cos(wa2) * 22, by = hy + Math.sin(wa2) * 22;           // bola tergantung
      if (spin) { bx = 41; by = 0; }                                              // diputar (badan ikut berputar)
      else if (a && a.def === DEF.xHook && a.len) {                                // dilempar lurus ke depan
        const k = a.ph === 'r' ? 1 - clamp(a.t / .3, 0, 1) : 1; bx = Math.max(hx, a.len * k / e.sc); by = 0;
      }
      ctx.strokeStyle = '#8a8a90'; ctx.lineWidth = 1.4; ctx.setLineDash([2.5, 2]); line(hx, hy, bx, by); ctx.setLineDash([]);
      ctx.strokeStyle = e.p2 ? '#ff7a3a' : '#b0b8c4'; ctx.lineWidth = 1.4;
      for (let k = 0; k < 6; k++) { const s = k / 6 * TAU + G.t * 2; line(bx + Math.cos(s) * 5, by + Math.sin(s) * 5, bx + Math.cos(s) * 8.5, by + Math.sin(s) * 8.5); } // duri
      ctx.fillStyle = '#2e2a30'; ctx.beginPath(); ctx.arc(bx, by, 6, 0, TAU); ctx.fill(); ctx.stroke();
      if (spin) { ctx.globalAlpha = .25; ctx.strokeStyle = e.p2 ? '#ff7a3a' : '#c8d0dc'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(0, 0, 41, -1.4, -.1); ctx.stroke(); ctx.globalAlpha = 1; }
    };
    o.top = () => { // kerudung algojo
      ctx.fillStyle = '#1a1418'; ctx.beginPath(); ctx.arc(.5, 0, 6.2, 0, TAU); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.fillStyle = e.p2 ? '#ff7a3a' : '#ffd36a'; ctx.beginPath(); ctx.arc(3.6, -2, .9, 0, TAU); ctx.arc(3.6, 2, .9, 0, TAU); ctx.fill();
    };
  } else if (e.type === 'knight') {
    const glow = e.p2 ? '#c9a8ff' : '#f0e6c8', dash = e.atk && e.atk.def === DEF.kDash && e.atk.ph === 'a';
    o.lean = dash ? 3 : o.lean;
    o.under = () => { // jubah berkibar
      ctx.fillStyle = e.p2 ? 'rgba(70,40,110,.8)' : 'rgba(60,50,70,.75)'; ctx.beginPath();
      ctx.moveTo(-1, -6); ctx.quadraticCurveTo(-13 - (dash ? 6 : 0), Math.sin(G.t * 6) * 3, -1, 6); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = e.lw;
    };
    o.extra = () => { // pedang panjang ramping
      const [hx, hy] = o.armR, a = st === 'stag' || st === 'parried' ? 2.6 : wa;
      ctx.strokeStyle = glow; ctx.lineWidth = 1.8; line(hx, hy, hx + Math.cos(a) * 26, hy + Math.sin(a) * 26);
      if (e.p2) { ctx.globalAlpha = .35; ctx.lineWidth = 5; line(hx, hy, hx + Math.cos(a) * 26, hy + Math.sin(a) * 26); ctx.globalAlpha = 1; }
      ctx.strokeStyle = '#6a5a3a'; ctx.lineWidth = 2.2; line(hx - Math.sin(a) * 3.5, hy + Math.cos(a) * 3.5, hx + Math.sin(a) * 3.5, hy - Math.cos(a) * 3.5);
    };
    o.top = () => { // helm berjambul
      ctx.strokeStyle = glow; ctx.lineWidth = 1.6; line(3.5, 0, 6, 0);
      ctx.strokeStyle = e.p2 ? '#a070ff' : '#b84a3a'; ctx.lineWidth = 2.2; line(-1, 0, -8, Math.sin(G.t * 5) * 1.5);
    };
  } else if (e.type === 'ember') { // Sang Sulut: dua belati membara, rambut api
    const hot = e.p2 ? '#ffd27a' : '#ff9a4a';
    o.extra = () => {
      const a = st === 'stag' || st === 'parried' ? 2.6 : wa;
      for (const [[hx, hy], g] of [[o.armR, a], [o.armL, -.5]]) {
        ctx.strokeStyle = hot; ctx.lineWidth = 2; line(hx, hy, hx + Math.cos(g) * 13, hy + Math.sin(g) * 13);
        ctx.globalAlpha = .35; ctx.lineWidth = 5; line(hx, hy, hx + Math.cos(g) * 13, hy + Math.sin(g) * 13); ctx.globalAlpha = 1;
      }
    };
    o.top = () => { ctx.strokeStyle = hot; ctx.lineWidth = 1.6; for (let k = -1; k <= 1; k++) line(-1, k * 3, -7 - Math.abs(Math.sin(G.t * 9 + k)) * 3, k * 4); };
  } else if (e.type === 'ash') { // Sang Abu: tongkat, jubah kelabu, melayang rendah
    o.stride = 0; o.armL = [8, -9]; o.z = 4 + Math.sin(G.t * 2.5 + 1) * 2.5;
    o.under = () => { ctx.fillStyle = 'rgba(40,40,48,.8)'; ctx.beginPath(); ctx.arc(-2, 0, 10, 0, TAU); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.stroke(); ctx.lineWidth = e.lw; };
    o.extra = () => {
      const [hx, hy] = o.armR; ctx.strokeStyle = '#6a6470'; ctx.lineWidth = 2.4; line(hx - 8, hy, hx + 11, hy);
      ctx.fillStyle = e.p2 ? '#ffd27a' : '#d8e0ea'; ctx.beginPath(); ctx.arc(hx + 12, hy, 3 + Math.sin(G.t * 8) * .8, 0, TAU); ctx.fill();
    };
    o.top = () => { ctx.fillStyle = '#2a2a32'; ctx.beginPath(); ctx.arc(.5, 0, 6, Math.PI * .5, Math.PI * 1.5); ctx.fill(); }; // tudung
  } else if (e.type === 'snuffer') {
    const beam = e.atk && e.atk.def === DEF.vBeam && e.atk.ph !== 'r';
    o.stride = 0; o.z = 8 + Math.sin(G.t * 2) * 3;              // melayang
    o.armL = beam ? [12, -3] : [6, -11]; o.armR = beam ? [12, 3] : [6, 11];
    o.under = () => { // jubah gelap dengan lingkar asap
      ctx.fillStyle = 'rgba(16,10,30,.85)'; ctx.beginPath(); ctx.arc(-2, 0, 11, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(184,160,255,${.4 + Math.sin(G.t * 3) * .2})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(-2, 0, 13 + Math.sin(G.t * 2) * 1.5, 0, TAU); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = e.lw;
    };
    o.extra = () => { // bara padam di kedua tangan
      for (const [hx, hy] of [o.armL, o.armR]) {
        ctx.fillStyle = '#1a1030'; ctx.beginPath(); ctx.arc(hx + 1.5, hy, 3.4, 0, TAU); ctx.fill();
        ctx.strokeStyle = e.p2 ? '#d8c8ff' : '#9a88e8'; ctx.lineWidth = 1.2; ctx.stroke();
      }
    };
    o.top = () => { // mahkota api hitam
      ctx.strokeStyle = e.p2 ? '#d8c8ff' : '#7a68c8'; ctx.lineWidth = 1.6;
      for (let k = -2; k <= 2; k++) line(-1, k * 2.4, -6 - Math.abs(Math.sin(G.t * 7 + k)) * 3, k * 3.4);
    };
  }
  drawStick(o);
  if (st === 'parried') {
    ctx.strokeStyle = `rgba(255,220,120,${.5 + Math.sin(G.t * 16) * .3})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 8, 0, TAU); ctx.stroke();
    for (let k = 0; k < 3; k++) { const a = G.t * 4 + k * TAU / 3; ctx.fillStyle = '#ffd36a'; ctx.beginPath(); ctx.arc(e.x + Math.cos(a) * (e.r + 8), e.y + Math.sin(a) * (e.r + 8), 2.2, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}

// ---------- latar: api unggun, gerbang, portal ----------
function drawBonfire(b) {
  ctx.save(); ctx.translate(b.x, b.y);
  ctx.fillStyle = 'rgba(40,36,32,.9)'; ctx.beginPath(); ctx.ellipse(0, 0, 14, 12, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#3a3028'; ctx.lineWidth = 2; for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; line(Math.cos(a) * 4, Math.sin(a) * 4, Math.cos(a) * 12, Math.sin(a) * 12); }
  // pedang tertancap
  ctx.strokeStyle = '#8a8478'; ctx.lineWidth = 2.5; line(0, 0, 0, -16); ctx.lineWidth = 2; line(-5, -12, 5, -12);
  if (b.lit) {
    for (let k = 0; k < 3; k++) {
      const f = Math.sin(G.t * 9 + k * 2) * 2;
      ctx.fillStyle = ['rgba(255,90,30,.8)', 'rgba(255,170,60,.8)', 'rgba(255,240,170,.9)'][k];
      ctx.beginPath(); ctx.ellipse(0, -2 - k * 2, 8 - k * 2.5 + f * .3, 10 - k * 2.5 + f, 0, 0, TAU); ctx.fill();
    }
    if (Math.random() < .3) part(b.x + rand(-6, 6), b.y - 6, rand(-10, 10), rand(-60, -30), rand(.6, 1.2), '#ffb35c', 2, true);
  } else { ctx.fillStyle = 'rgba(255,120,60,' + (.15 + Math.sin(G.t * 2) * .1) + ')'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill(); }
  ctx.restore();
}
function drawGates() {
  if (L.gateState === 'open') return;
  const sealed = L.gateState === 'sealed', c = sealed ? '255,90,60' : L.def.fog;
  for (const g of L.gates) {
    for (let k = 0; k < 6; k++) {
      const a = G.t * .8 + k * 1.3 + g.x * .01;
      ctx.fillStyle = `rgba(${c},${sealed ? .1 : .12})`;
      ctx.beginPath(); ctx.arc(g.x + Math.cos(a) * 12, g.y + Math.sin(a * 1.3) * 12, 16 + Math.sin(a * 2) * 4, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = `rgba(${c},.14)`; ctx.fillRect(g.x - T / 2, g.y - T / 2, T, T);
  }
}
function drawPortal(pt) {
  const k = Math.min(1, pt.t / 1.2);
  ctx.save(); ctx.translate(pt.x, pt.y);
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = `rgba(255,${220 - i * 20},${150 + i * 25},${(.7 - i * .12) * k})`; ctx.lineWidth = 3 - i * .5;
    ctx.beginPath(); ctx.arc(0, 0, Math.max(1, (22 + i * 9) * k + Math.sin(G.t * 3 + i) * 2),G.t * (1 + i * .4), G.t * (1 + i * .4) + Math.PI * 1.4); ctx.stroke();
  }
  ctx.fillStyle = `rgba(255,240,200,${.25 * k})`; ctx.beginPath(); ctx.arc(0, 0, 20 * k, 0, TAU); ctx.fill();
  ctx.restore();
  if (Math.random() < .4) part(pt.x + rand(-30, 30), pt.y + rand(-30, 30), 0, -30, 1, '#fff1c0', 2, true);
}

// =====================================================================
//  RENDER UTAMA
// =====================================================================
function worldT(sx = 0, sy = 0) {
  baseT(); ctx.translate(W / 2 + sx, H / 2 + sy); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
}
function render() {
  baseT(); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  if (G.mode === 'title') { drawTitle(); drawFade(); return; }
  if (G.mode === 'win') { drawWin(); drawFade(); return; }
  const shx = (Math.random() - .5) * G.shake * 2, shy = (Math.random() - .5) * G.shake * 2;
  worldT(shx, shy);
  ctx.drawImage(L.cv, 0, 0);
  for (const d of L.decals) { ctx.fillStyle = d.col; ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r, d.r * .7, d.rot, 0, TAU); ctx.fill(); }
  drawGates();
  for (const b of L.bonfires) drawBonfire(b);
  if (L.portal) drawPortal(L.portal);
  // hazard di tanah
  for (const h of L.hazards) {
    if (h.kind === 'pillar') {
      if (!h.done) teleCircle(h.x, h.y, h.r, clamp(h.t / h.delay, 0, 1));
      else { const k = (h.t - h.delay) / .45; ctx.fillStyle = `rgba(255,140,50,${.6 * (1 - k)})`; ctx.beginPath(); ctx.arc(h.x, h.y, h.r * (1 + k * .2), 0, TAU); ctx.fill(); }
    }
  }
  const ents = [...L.enemies, ...players].sort((a, b) => (a.dead ? -1 : 0) - (b.dead ? -1 : 0) || a.y - b.y);
  for (const e of ents) e instanceof Player ? drawPlayer(e) : drawEnemy(e);
  // proyektil
  for (const pr of L.projectiles) {
    if (pr.kind === 'arrow') {
      const a = Math.atan2(pr.vy, pr.vx); ctx.strokeStyle = pr.owner === 'p' ? (pr.full ? '#fff3b0' : '#e8e0d0') : '#d8a0ff'; ctx.lineWidth = 2;
      line(pr.x - Math.cos(a) * 12, pr.y - Math.sin(a) * 12, pr.x + Math.cos(a) * 3, pr.y + Math.sin(a) * 3);
    } else {
      ctx.fillStyle = pr.owner === 'p' ? '#bff' : (pr.col || '#ffb04a'); ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff6d0'; ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r * .45, 0, TAU); ctx.fill();
    }
  }
  // partikel
  for (const p of L.particles) {
    const k = p.life / p.max;
    ctx.globalAlpha = Math.min(1, k * 1.5); ctx.fillStyle = p.col;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (p.glow ? k : 1), 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // gelombang kejut
  for (const f of G.fx) { const k = f.t / .4; ctx.strokeStyle = `rgba(255,230,190,${.6 * (1 - k)})`; ctx.lineWidth = 4 * (1 - k) + 1; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (.6 + k * .6), 0, TAU); ctx.stroke(); }
  for (const h of L.hazards) if (h.kind === 'ring') { ctx.strokeStyle = 'rgba(255,200,140,.8)'; ctx.lineWidth = h.w * .6; ctx.beginPath(); ctx.arc(h.x, h.y, h.rad, 0, TAU); ctx.stroke(); }

  drawLighting();

  // lapisan pasca-cahaya: telegraf & bar HP (supaya selalu terbaca)
  worldT(shx, shy);
  for (const e of L.enemies) {
    if (e.dead) continue;
    if (e.state === 'atk' && e.atk.def.tele) {
      const a = e.atk;
      if (a.ph === 'w') a.def.tele(e, a, clamp(a.t / (a.def.wind / e.spdMul), 0, 1));
      else if (a.ph === 'a' && a.def.teleAct) a.def.teleAct(e, a);
    }
    if (!e.boss && e.showHp > 0 && e.hp < e.maxHp) {
      const w = 30, x = e.x - w / 2, y = e.y - e.r * 1.4 - 12;
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - 1, y - 1, w + 2, 5);
      ctx.fillStyle = '#e8d0a0'; ctx.fillRect(x, y, w * e.hpLag / e.maxHp, 3);
      ctx.fillStyle = '#b3261e'; ctx.fillRect(x, y, w * e.hp / e.maxHp, 3);
    }
  }
  for (const pr of L.projectiles) if (pr.kind === 'orb') { ctx.fillStyle = pr.owner === 'p' ? 'rgba(160,255,255,.35)' : pr.col ? 'rgba(200,170,255,.35)' : 'rgba(255,150,60,.35)'; ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r * 2, 0, TAU); ctx.fill(); }
  // penanda pemain di atas gelap
  for (const p of players) if (p.alive) { ctx.fillStyle = `rgba(${p.glow},.9)`; ctx.beginPath(); const a = p.face; ctx.moveTo(p.x + Math.cos(a) * 24, p.y + Math.sin(a) * 24); ctx.lineTo(p.x + Math.cos(a + .25) * 19, p.y + Math.sin(a + .25) * 19); ctx.lineTo(p.x + Math.cos(a - .25) * 19, p.y + Math.sin(a - .25) * 19); ctx.fill(); }

  baseT();
  drawVignette();
  drawControls();
  for (const i of frames()) inFrame(i, (LW, LH) => drawHUD(players[i], LW, LH));
  drawPauseBtn();
  if (G.mode === 'over') drawOver();
  if (G.mode === 'pause') drawPause();
  drawFade();
}
function drawLighting() {
  const lw = lightCv.width, lh = lightCv.height, s = .5;
  lctx.globalCompositeOperation = 'source-over';
  lctx.clearRect(0, 0, lw, lh);
  lctx.fillStyle = `rgba(4,2,8,${Math.min(.95, L.def.dark + (L.eclipse || 0))})`; lctx.fillRect(0, 0, lw, lh);
  lctx.globalCompositeOperation = 'destination-out';
  const toS = (x, y) => [((x - cam.x) * cam.z + W / 2) * s, ((y - cam.y) * cam.z + H / 2) * s];
  const light = (x, y, r, a = 1) => {
    const [sx, sy] = toS(x, y), rr = r * cam.z * s;
    if (sx < -rr || sy < -rr || sx > lw + rr || sy > lh + rr) return;
    const g = lctx.createRadialGradient(sx, sy, 0, sx, sy, rr);
    g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(.55, `rgba(0,0,0,${a * .7})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.fillStyle = g; lctx.beginPath(); lctx.arc(sx, sy, rr, 0, TAU); lctx.fill();
  };
  for (const p of players) if (!p.dead) light(p.x, p.y, p.alive ? 230 : 120);
  for (const b of L.bonfires) light(b.x, b.y, b.lit ? 260 + Math.sin(G.t * 7) * 8 : 70, b.lit ? 1 : .5);
  for (const pr of L.projectiles) if (pr.kind === 'orb') light(pr.x, pr.y, 70, .8);
  for (const h of L.hazards) if (h.kind === 'pillar') light(h.x, h.y, h.done ? 140 : 60, h.done ? 1 : .4);
  if (L.portal) light(L.portal.x, L.portal.y, 200);
  if (L.bossState === 'active') { light(L.bossSpawn.x, L.bossSpawn.y, 520, .55); for (const b of aliveBosses()) light(b.x, b.y, 160, .6); }
  if (L.gateState !== 'open') for (const g of L.gates) light(g.x, g.y, 70, .5);
  baseT(); ctx.drawImage(lightCv, 0, 0, W, H);
  // cahaya hangat aditif
  ctx.globalCompositeOperation = 'lighter';
  worldT();
  const warm = (x, y, r, c) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
  for (const b of L.bonfires) if (b.lit) warm(b.x, b.y, 120, 'rgba(255,120,40,.22)');
  for (const h of L.hazards) if (h.kind === 'pillar' && h.done) warm(h.x, h.y, 80, 'rgba(255,120,40,.35)');
  ctx.globalCompositeOperation = 'source-over';
}
let vigCache = null, vigKey = '';
function drawVignette() {
  const key = W + 'x' + H;
  if (vigKey !== key) {
    vigKey = key; vigCache = document.createElement('canvas'); vigCache.width = W; vigCache.height = H;
    const g = vigCache.getContext('2d'), gr = g.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, W * .62);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.6)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }
  ctx.drawImage(vigCache, 0, 0);
}
