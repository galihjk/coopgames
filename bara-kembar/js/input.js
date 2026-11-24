'use strict';
// =====================================================================
//  INPUT
// =====================================================================
const IN = [0, 1].map(() => ({ mx: 0, my: 0, tb: [0, 0, 0], kb: [0, 0, 0], h: [0, 0, 0], pv: [0, 0, 0], buf: [-1, -1, -1], joy: null, kx: { u: 0, d: 0, l: 0, r: 0 } }));
// Input buffer: tombol yang ditekan sedikit sebelum karakter siap (mis. di akhir guling) tetap diingat
// selama BUFFER_T detik lalu dijalankan begitu bisa. pressed() memakai (mengonsumsi) tekanan itu.
const BUFFER_T = .25;
function bufferInput(i) { const n = IN[i]; for (let k = 0; k < 3; k++) if (n.h[k] && !n.pv[k]) n.buf[k] = G.t; }
function pressed(i, k) { const n = IN[i]; if (n.buf[k] >= 0 && G.t - n.buf[k] <= BUFFER_T) { n.buf[k] = -1; return true; } return false; }
// ketukan saat ini saja (tanpa buffer) — dipakai untuk menyambung kombo, yang memang menguji timing
function tapped(i, k) { const n = IN[i]; if (n.h[k] && !n.pv[k]) { n.buf[k] = -1; return true; } return false; }
const released = (i, k) => !IN[i].h[k] && IN[i].pv[k];
const ctrls = [{}, {}];
function layoutControls() {
  const u = U;
  for (let i = 0; i < 2; i++) {
    const m = (x, y) => i === 0 ? { x, y } : { x: W - x, y: H - y };
    const c = ctrls[i];
    c.joy = Object.assign(m(110 * u, 100 * u), { r: 70 * u });
    // b[0] = aksi 1 (serang/panah), b[1] = aksi 2 (tameng/guling), b[2] = aksi 3 (ganti/ramuan)
    c.b = [Object.assign(m(95 * u, 342 * u), { r: 42 * u }), Object.assign(m(95 * u, 250 * u), { r: 40 * u }), Object.assign(m(170 * u, 296 * u), { r: 29 * u })];
  }
}
const KEYMAP = {
  KeyW: [0, 'u'], KeyS: [0, 'd'], KeyA: [0, 'l'], KeyD: [0, 'r'], KeyF: [0, 0], KeyG: [0, 1], KeyH: [0, 2],
  ArrowUp: [1, 'u'], ArrowDown: [1, 'd'], ArrowLeft: [1, 'l'], ArrowRight: [1, 'r'],
  Numpad1: [1, 0], Numpad2: [1, 1], Numpad3: [1, 2], Comma: [1, 0], Period: [1, 1], Slash: [1, 2],
};
addEventListener('keydown', e => {
  Snd.init();
  if (e.code === 'Escape' || e.code === 'KeyP') { togglePause(); return; }
  if (G.mode === 'title' && (e.code === 'Enter' || e.code === 'Space')) { if (isUnlocked(G.sel)) startGame(G.sel); else Snd.fail(); return; }
  if (G.mode === 'title' && (e.code === 'ArrowLeft' || e.code === 'KeyA')) { pickLevel(-1); return; }
  if (G.mode === 'title' && (e.code === 'ArrowRight' || e.code === 'KeyD')) { pickLevel(1); return; }
  if (G.mode === 'title' && /^Digit[1-9]$/.test(e.code) && +e.code[5] <= LEVELS.length) { if (isUnlocked(+e.code[5] - 1)) startGame(+e.code[5] - 1); else Snd.fail(); return; }
  if (G.mode === 'title' && e.code === 'KeyM') { toggleSolo(); return; }
  if (G.mode === 'win' && e.code === 'Enter') { G.mode = 'title'; return; }
  if (G.mode === 'clear' && e.code === 'Enter') { if (G.clearT > .6 && G.fadeDir === 0) continueAfterClear(); return; }
  if (G.mode === 'title' && e.code === 'KeyK') { toggleDiff(); return; }
  const m = KEYMAP[e.code]; if (!m) return; e.preventDefault();
  const n = IN[G.solo ? 0 : m[0]]; // mode solo: kedua set tombol mengendalikan P1
  if (typeof m[1] === 'number') n.kb[m[1]] = 1; else n.kx[m[1]] = 1;
});
addEventListener('keyup', e => {
  const m = KEYMAP[e.code]; if (!m) return;
  for (const n of G.solo ? [IN[0]] : [IN[m[0]]]) { if (typeof m[1] === 'number') n.kb[m[1]] = 0; else n.kx[m[1]] = 0; }
});
const ptrs = new Map();
// Banyak HP (mis. Oppo/Realme/Xiaomi) memakai gestur tangkapan layar 3 jari: begitu ±3 jari menempel serentak,
// sistem merebut & membatalkan semua sentuhan. Kalau itu terjadi saat bermain, game menjeda & menjelaskan cara mematikannya.
const live = new Set();
function gestureCancelled() {
  if (G.mode !== 'play' || G.gestureWarned) return;
  G.gestureWarned = true; G.gestureWarn = true; togglePause();
}
// Tes sentuh: memperlihatkan semua jari di layar & berapa sentuhan yang dibatalkan sistem (pointercancel),
// untuk membedakan batas jumlah sentuhan HP vs gestur sistem (mis. usap 3 jari = tangkapan layar).
const TT = { pts: new Map(), max: 0, cancels: 0, downs: 0, ups: 0, log: [],
  // jalur kedua: Touch Events (dicatat berdampingan untuk dibandingkan dengan Pointer Events)
  tch: new Map(), tMax: 0, tCancels: 0, tUps: 0, tGhost: 0, tGone: new Set(), blur: 0, hidden: 0 };
function resetTouchTest() { TT.pts.clear(); Object.assign(TT, { max: 0, cancels: 0, downs: 0, ups: 0, log: [], tMax: 0, tCancels: 0, tUps: 0, tGhost: 0, blur: 0, hidden: 0 }); TT.tch.clear(); TT.tGone.clear(); }
function ttLog(s) { TT.log.unshift(s); TT.log.length = Math.min(TT.log.length, 4); }
cv.addEventListener('touchstart', e => { if (G.mode !== 'touchtest') return; for (const t of e.changedTouches) TT.tch.set(t.identifier, 1); TT.tMax = Math.max(TT.tMax, TT.tch.size); }, { passive: true });
cv.addEventListener('touchmove', e => { if (G.mode !== 'touchtest') return; for (const t of e.changedTouches) if (TT.tGone.has(t.identifier)) { TT.tGhost++; TT.tGone.delete(t.identifier); ttLog('Touch: jari tetap terbaca SETELAH dibatalkan'); } }, { passive: true });
cv.addEventListener('touchend', e => { if (G.mode !== 'touchtest') return; for (const t of e.changedTouches) { TT.tch.delete(t.identifier); TT.tUps++; } }, { passive: true });
cv.addEventListener('touchcancel', e => { if (G.mode !== 'touchtest') return; for (const t of e.changedTouches) { TT.tch.delete(t.identifier); TT.tGone.add(t.identifier); TT.tCancels++; } }, { passive: true });
addEventListener('blur', () => { if (G.mode === 'touchtest') { TT.blur++; ttLog('halaman KEHILANGAN FOKUS (blur)'); } });
document.addEventListener('visibilitychange', () => { if (G.mode === 'touchtest' && document.hidden) { TT.hidden++; ttLog('halaman TERSEMBUNYI'); } });
cv.addEventListener('pointerdown', e => {
  e.preventDefault(); Snd.init(); live.add(e.pointerId);
  const q = toL(e.clientX, e.clientY);
  if (G.mode === 'touchtest') {
    if (uiTap(q)) return;
    TT.pts.set(e.pointerId, { x: e.clientX, y: e.clientY, n: ++TT.downs }); TT.max = Math.max(TT.max, TT.pts.size);
    try { cv.setPointerCapture(e.pointerId); } catch (er) { }
    return;
  }
  if (G.mode !== 'play') { uiTap(q); return; }
  if (Math.hypot(q.x - W / 2, q.y - 20 * U) < 26 * U) { togglePause(); return; }
  const a = assignTouch(q);
  if (a) { ptrs.set(e.pointerId, a); try { cv.setPointerCapture(e.pointerId); } catch (er) { } }
}, { passive: false });
cv.addEventListener('pointermove', e => {
  const tp = TT.pts.get(e.pointerId); if (tp) { tp.x = e.clientX; tp.y = e.clientY; return; }
  const a = ptrs.get(e.pointerId); if (!a || a.kind !== 'joy') return;
  const q = toL(e.clientX, e.clientY), j = IN[a.i].joy; if (!j) return;
  j.x = q.x; j.y = q.y;
  const r = ctrls[a.i].joy.r;
  let dx = (j.x - j.bx) / r, dy = (j.y - j.by) / r; const l = Math.hypot(dx, dy);
  if (l > 1) { // base ikut terseret supaya tidak "mentok"
    j.bx += (dx / l) * (l - 1) * r; j.by += (dy / l) * (l - 1) * r; dx /= l; dy /= l;
  }
  j.dx = dx; j.dy = dy;
}, { passive: false });
function endPtr(e) {
  const fingers = live.size; live.delete(e.pointerId);
  if (e.type === 'pointercancel' && fingers >= 3) gestureCancelled();
  if (TT.pts.has(e.pointerId)) {
    const p = TT.pts.get(e.pointerId); TT.pts.delete(e.pointerId);
    if (e.type === 'pointercancel') { TT.cancels++; ttLog('Pointer: jari #' + p.n + ' dibatalkan (' + (TT.pts.size + 1) + ' jari di layar)'); } else TT.ups++;
    return;
  }
  const a = ptrs.get(e.pointerId); if (!a) return; ptrs.delete(e.pointerId);
  if (a.kind === 'joy') IN[a.i].joy = null; else IN[a.i].tb[a.k] = 0;
}
cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr);
cv.addEventListener('contextmenu', e => e.preventDefault());
function assignTouch(q) {
  let best = null, bd = 1e9;
  for (const i of frames()) for (let k = 0; k < 3; k++) {
    const b = ctrls[i].b[k], d = Math.hypot(q.x - b.x, q.y - b.y);
    if (d < b.r * 1.45 && d / b.r < bd) { bd = d / b.r; best = { i, kind: 'b', k }; }
  }
  if (best) { IN[best.i].tb[best.k] = 1; return best; }
  for (const i of frames()) {
    // mode solo: area joystick P1 lebih lega karena tidak berbagi layar
    const inZone = i === 0 ? (G.solo ? q.x < W * .45 && q.y < H * .6 : q.x < W * .33 && q.y < H * .58) : (q.x > W * .67 && q.y > H * .42);
    if (inZone && !IN[i].joy) { IN[i].joy = { bx: q.x, by: q.y, x: q.x, y: q.y, dx: 0, dy: 0 }; return { i, kind: 'joy' }; }
  }
  return null;
}
function pollInput() {
  for (const n of IN) {
    for (let k = 0; k < 3; k++) n.h[k] = n.tb[k] || n.kb[k] ? 1 : 0;
    let mx = n.kx.r - n.kx.l, my = n.kx.d - n.kx.u;
    if (mx || my) { const l = Math.hypot(mx, my); mx /= l; my /= l; }
    if (n.joy) { mx = n.joy.dx; my = n.joy.dy; }
    n.mx = mx; n.my = my;
  }
}
function endInput() { for (const n of IN) for (let k = 0; k < 3; k++) n.pv[k] = n.h[k]; }
