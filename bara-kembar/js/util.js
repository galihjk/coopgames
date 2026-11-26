'use strict';
// =====================================================================
//  BARA KEMBAR — co-op souls-like, 2 pemain 1 perangkat, tampilan atas
//  Semua grafis prosedural (stickman), tanpa sprite.
// =====================================================================

// ---------- util ----------
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const turnTo = (c, t, m) => c + clamp(angDiff(c, t), -m, m);
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
// getar: HP yang dipakai bermain; mode Layar + HP: getarkan HP milik pemain i (bukan perangkat layar)
function vib(ms, i) { if (i != null && typeof padOn === 'function' && padOn()) { padVib(i, ms); return; } try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { } }

// ---------- canvas / orientasi ----------
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const lightCv = document.createElement('canvas');
const lctx = lightCv.getContext('2d');
let SW, SH, DPR, W, H, portrait, U;
const LEASH = { x: 600, y: 340 };
let ZMIN = .6, ZMAX = 1.2;

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  SW = innerWidth; SH = innerHeight;
  cv.width = Math.round(SW * DPR); cv.height = Math.round(SH * DPR);
  cv.style.width = SW + 'px'; cv.style.height = SH + 'px';
  portrait = SH > SW;
  W = portrait ? SH : SW; H = portrait ? SW : SH;
  U = Math.min(H / 400, W / 750);
  lightCv.width = Math.ceil(W / 2); lightCv.height = Math.ceil(H / 2);
  ZMAX = H / (T * 5.8); ZMIN = H / (T * 10.5);
  LEASH.x = W * .6 / ZMIN - 170; LEASH.y = H * .8 / ZMIN - 150;
  layoutControls();
}
// HP tegak (portrait): sisi P1 selalu di BAWAH layar dan tegak, P2 di atas (berhadapan).
// Layar mendatar (landscape, mis. desktop): P1 di sisi kiri, P2 di sisi kanan.
function baseT() {
  if (portrait) ctx.setTransform(0, -DPR, DPR, 0, 0, SH * DPR);
  else ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
function toL(cx, cy) { return portrait ? { x: SH - cy, y: cx } : { x: cx, y: cy }; }
// bingkai baca per pemain: P1 duduk di sisi kiri layar, P2 di sisi kanan (berhadapan)
// Layar komputer (kontroler bukan sentuh, `sharedScreen()`): semua pemain menghadap layar yang sama, jadi bingkai TEGAK,
// berdampingan (satu kolom per pemain). Menu dirancang untuk bingkai tinggi (HP tegak ±800 satuan U), jadi di layar
// komputer kolom menu diperkecil (skala k) agar setinggi itu; HUD (hud=true) tidak diperkecil.
const FRAME_UNITS = 600; // cukup untuk menu terpanjang (jeda + daftar tombol) dengan judul di 30% tinggi
function sharedFrame(i, hud) {
  const n = frames().length, cw = W / n, k = hud ? 1 : Math.min(1, H / (FRAME_UNITS * U));
  return { x0: i * cw, k, LW: cw / k, LH: H / k };
}
const frameSize = i => sharedScreen() ? sharedFrame(i) : { LW: H, LH: W };
function inFrame(i, fn, hud) {
  ctx.save();
  if (sharedScreen()) { const f = sharedFrame(i, hud); ctx.translate(f.x0, 0); ctx.scale(f.k, f.k); fn(f.LW, f.LH); ctx.restore(); return; }
  if (i === 0) { ctx.translate(W, 0); ctx.rotate(Math.PI / 2); }
  else { ctx.translate(0, H); ctx.rotate(-Math.PI / 2); }
  fn(H, W);
  ctx.restore();
}
function screenToFrame(i, q) {
  if (sharedScreen()) { const f = sharedFrame(i); return { x: (q.x - f.x0) / f.k, y: q.y / f.k }; }
  return i === 0 ? { x: q.y, y: W - q.x } : { x: H - q.y, y: q.x };
}
