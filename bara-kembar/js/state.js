'use strict';
// =====================================================================
//  STATE GLOBAL
// =====================================================================
// solo: P1 dimainkan manusia, P2 dimainkan bot (lihat bot.js)
const G = { mode: 'title', t: 0, banners: [], hitStop: 0, slowT: 0, shake: 0, fade: 0, fadeDir: 0, fadeCb: null, overT: 0, hintT: 0, beatT: 0, beatN: 0, winT: 0, fx: [], solo: !!SAVE.solo };
// bingkai baca yang ditampilkan (HUD, kontrol, menu): mode solo hanya P1
function frames() { return G.solo ? [0] : [0, 1]; }
function toggleSolo() { G.solo = !G.solo; SAVE.solo = G.solo; saveGame(); }
let L = null;
const cam = { x: 0, y: 0, z: 1 };
const players = [];

function banner(text, sub, dur = 3, color = '#e8d9b0', big = true) { G.banners.push({ text, sub, t: 0, dur, color, big }); }
function msg(p, text, dur = 2.5) { p.msg = { text, t: 0, dur }; }
function hitStop(s) { G.hitStop = Math.max(G.hitStop, s); }
function shake(s) { G.shake = Math.max(G.shake, s); }
