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
function vib(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { } }

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
// HP tegak: mode 2 pemain → sisi P1 di atas layar (P2 tegak menghadap pemegang HP);
// mode solo → diputar sebaliknya supaya sisi P1 (pemain manusia) di bawah dan tegak.
function baseT() {
  if (portrait && G.solo) ctx.setTransform(0, -DPR, DPR, 0, 0, SH * DPR);
  else if (portrait) ctx.setTransform(0, DPR, -DPR, 0, SW * DPR, 0);
  else ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
function toL(cx, cy) {
  if (!portrait) return { x: cx, y: cy };
  return G.solo ? { x: SH - cy, y: cx } : { x: cy, y: SW - cx };
}
// bingkai baca per pemain: P1 duduk di sisi kiri layar, P2 di sisi kanan (berhadapan)
function inFrame(i, fn) {
  ctx.save();
  if (i === 0) { ctx.translate(W, 0); ctx.rotate(Math.PI / 2); }
  else { ctx.translate(0, H); ctx.rotate(-Math.PI / 2); }
  fn(H, W);
  ctx.restore();
}
function screenToFrame(i, q) { return i === 0 ? { x: q.y, y: W - q.x } : { x: H - q.y, y: q.x }; }
