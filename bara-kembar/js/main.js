'use strict';
// =====================================================================
//  UPDATE
// =====================================================================
function update(dt) {
  if (G.mode === 'play') {
    L.stats.t += dt; REC().time[L.idx] = (REC().time[L.idx] || 0) + dt;
    G.saveT = (G.saveT || 0) + dt; if (G.saveT > 15) { G.saveT = 0; saveGame(); } // simpan waktu bermain berkala
  }
  L.fieldT -= dt; if (L.fieldT <= 0) { computeFields(); L.fieldT = .3; }
  if (G.solo) botUpdate(players[1], players[0], dt); // bot mengisi IN[1] sebelum pemain diproses
  for (const p of players) updatePlayer(p, dt);
  for (const e of L.enemies) updateEnemy(e, dt);
  L.enemies = L.enemies.filter(e => !e.dead || e.deadT < 1.5);
  separate();
  updateProj(dt);
  updateParticles(dt);
  updateFlow(dt);
  if (L.bossState === 'active') { G.beatT -= dt; if (G.beatT <= 0) { G.beatT = .5; Snd.beat(G.beatN++); } }
  if (G.mode === 'over') { G.overT += dt; if (G.overT > 3.6) respawnAll(); }
}
function updateCam(dt) {
  let list = players.filter(p => !p.dead); if (!list.length) list = players;
  // solo: kamera berpusat pada pemain; bot hanya ikut dibingkai kalau cukup dekat (kalau jauh, ada panah penunjuk)
  if (G.solo && players[0].alive && dist(players[0], players[1]) > 480) list = [players[0]];
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const p of list) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
  let tx = (x0 + x1) / 2, ty = (y0 + y1) / 2;
  for (const b of L.bossState === 'active' ? aliveBosses() : []) { tx = lerp(tx, b.x, .18 / aliveBosses().length); ty = lerp(ty, b.y, .18 / aliveBosses().length); }
  const tz = clamp(Math.min(W * .6 / (x1 - x0 + 170), H * .8 / (y1 - y0 + 150)), ZMIN / (bossFight() && !G.solo ? BOSS_SLACK : 1), ZMAX);
  const k = 1 - Math.pow(.02, dt);
  cam.x = lerp(cam.x, tx, k); cam.y = lerp(cam.y, ty, k); cam.z = lerp(cam.z, tz, 1 - Math.pow(.1, dt));
}

// kunci tegak di kedua mode: P1 di sisi bawah HP, P2 di sisi atas (solo: HP dipegang tegak)
function lockOrientation() {
  try { screen.orientation && screen.orientation.lock && screen.orientation.lock('portrait').catch(() => { }); } catch (e) { }
}
function tryFullscreen() {
  try {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).then(lockOrientation).catch(() => { });
    else lockOrientation();
  } catch (e) { }
}
function startGame(idx) {
  Snd.init(); tryFullscreen();
  players[0].weapon = 'sword'; players[1].weapon = 'bow';
  resetBot();
  for (const n of IN) { n.tb = [0, 0, 0]; n.joy = null; n.pv = [1, 1, 1]; n.buf = [-1, -1, -1]; }
  ptrs.clear();
  G.banners = []; G.fx = []; G.slowT = 0;
  loadLevel(idx); G.mode = 'play'; G.fade = 1; G.fadeDir = -1;
  levelIntro();
  G.hintT = idx === 0 ? 14 : 6;
}

// =====================================================================
//  LOOP
// =====================================================================
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  try { step(now); } catch (err) { console.error(err); }
}
function step(now) {
  let dt = Math.min(.05, (now - last) / 1000); last = now; G.t += dt;
  pollInput();
  if (G.mode === 'play' || G.mode === 'over') {
    let ran = false;
    if (G.hitStop > 0) G.hitStop -= dt;
    else {
      if (G.slowT > 0) G.slowT -= dt;
      update(dt * (G.slowT > 0 ? .3 : 1)); ran = true;
    }
    updateCam(dt);
    G.shake = Math.max(0, G.shake - dt * 30);
    if (G.hintT > 0) G.hintT -= dt;
    for (const b of G.banners) b.t += dt;
    G.banners = G.banners.filter(b => b.t < b.dur);
    if (ran) endInput();
  } else endInput();
  // fade
  if (G.fadeDir === 1) { G.fade += dt * 1.8; if (G.fade >= 1) { G.fade = 1; G.fadeDir = -1; const cb = G.fadeCb; G.fadeCb = null; cb && cb(); } }
  else if (G.fadeDir === -1) { G.fade -= dt * 1.4; if (G.fade <= 0) { G.fade = 0; G.fadeDir = 0; } }
  render();
}
addEventListener('resize', resize);
document.addEventListener('visibilitychange', () => { if (document.hidden && G.mode === 'play') togglePause(); });
resize();
requestAnimationFrame(frame);
