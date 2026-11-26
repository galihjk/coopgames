'use strict';
// =====================================================================
//  STATE GLOBAL
// =====================================================================
// solo: P1 dimainkan manusia, P2 dimainkan bot (lihat bot.js)
const G = { mode: 'title', t: 0, banners: [], hitStop: 0, slowT: 0, shake: 0, fade: 0, fadeDir: 0, fadeCb: null, overT: 0, introSeen: {}, introOk: [false, false], beatT: 0, beatN: 0, winT: 0, fx: [], solo: !!SAVE.solo };
// bingkai baca yang ditampilkan (HUD, kontrol, menu): mode solo hanya P1
// level terpilih di layar judul: level pertama yang belum tamat
G.sel = Math.max(0, LEVELS.findIndex((_, k) => !SAVE.cleared.includes(k) && isUnlocked(k)));
// statistik level berjalan, per pemain [P1, P2/bot]
function newStats() { return { t: 0, overs: 0, bonfires: 0, downs: [0, 0], parries: [0, 0], dmg: [0, 0], kills: [0, 0], shots: [0, 0], hits: [0, 0] }; }
const oneFrame = () => frames().length === 1; // tata letak satu bingkai (solo, atau layar bersama di layar komputer)
function frames() {
  if (G.solo) return [0];
  // layar komputer: layar ringkasan/catatan/epilog cukup satu (semua pemain melihat layar yang sama)
  if (sharedScreen() && ['clear', 'records', 'win', 'touchtest', 'menu'].includes(G.mode)) return [0];
  return [0, 1];
}
let L = null;
const cam = { x: 0, y: 0, z: 1 };
const players = [];

function banner(text, sub, dur = 3, color = '#e8d9b0', big = true) { G.banners.push({ text, sub, t: 0, dur, color, big }); }
function msg(p, text, dur = 2.5) { p.msg = { text, t: 0, dur }; }
function hitStop(s) { G.hitStop = Math.max(G.hitStop, s); }
function shake(s) { G.shake = Math.max(G.shake, s); }
