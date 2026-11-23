'use strict';
// =====================================================================
//  LEVEL
// =====================================================================
function loadLevel(idx) {
  G.sel = idx; // layar judul ikut menunjuk level yang sedang/terakhir dimainkan
  const def = LEVELS[idx], rows = def.map;
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const grid = new Uint8Array(w * h);
  const lv = { idx, def, killed: new Set(), stats: newStats(), w, h, grid, spawns: [], bonfires: [], gates: [], start: null, bossSpawn: null, gateState: 'fog', bossState: 'dormant', enemies: [], projectiles: [], hazards: [], particles: [], decals: [], portal: null, fields: [null, null], fieldT: 0, boss: null, gateHintT: 0 };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = rows[y][x] || '#', c = { x: (x + .5) * T, y: (y + .5) * T };
    grid[y * w + x] = ch === '#' ? 1 : ch === 'F' ? 2 : 0;
    if (ch === 'F') lv.gates.push(c);
    if (ch === 'S') lv.start = c;
    if (ch === 'B') lv.bonfires.push(Object.assign(c, { lit: false, r: 14 }));
    if ('gab'.includes(ch)) lv.spawns.push({ type: { g: 'grunt', a: 'archer', b: 'brute' }[ch], x: c.x, y: c.y });
    if (ch === 'X') lv.bossSpawn = c;
  }
  // area arena = flood fill dari X (gerbang & dinding membatasi)
  lv.arena = new Uint8Array(w * h);
  const q = [[Math.floor(lv.bossSpawn.x / T), Math.floor(lv.bossSpawn.y / T)]];
  lv.arena[q[0][1] * w + q[0][0]] = 1; lv.arenaTiles = [];
  while (q.length) {
    const [x, y] = q.shift(); lv.arenaTiles.push({ x: (x + .5) * T, y: (y + .5) * T });
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const k = ny * w + nx; if (grid[k] || lv.arena[k]) continue; lv.arena[k] = 1; q.push([nx, ny]);
    }
  }
  lv.checkpoint = lv.start;
  L = lv;
  L.cv = prerenderLevel();
  populate();
  placePlayers(L.start, true);
  cam.x = L.start.x; cam.y = L.start.y; cam.z = (ZMIN + ZMAX) / 2;
}
function populate() {
  L.enemies = [];
  L.spawns.forEach((s, i) => { if (RULE.keepKills() && L.killed.has(i)) return; const e = makeEnemy(s.type, s.x, s.y); e.spawnIdx = i; L.enemies.push(e); });
  L.bosses = [];
  if (L.bossState !== 'dead') {
    const types = L.def.bosses || [L.def.boss]; // level kembar: beberapa bos berdampingan
    types.forEach((ty, k) => { const b = makeEnemy(ty, L.bossSpawn.x + (k - (types.length - 1) / 2) * 90, L.bossSpawn.y); L.bosses.push(b); L.enemies.push(b); });
    L.boss = L.bosses[0];
  }
  L.projectiles = []; L.hazards = [];
}
function placePlayers(c, full) {
  players.forEach((p, i) => {
    const off = [[-18, -10], [18, 10]][i];
    let x = c.x + off[0], y = c.y + off[1];
    if (tileSolidW(x, y)) { x = c.x; y = c.y; }
    p.spawn(x, y);
  });
}
function tileSolid(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= L.w || ty >= L.h) return true;
  const v = L.grid[ty * L.w + tx];
  return v === 1 || (v === 2 && L.gateState !== 'open');
}
const tileSolidW = (x, y) => tileSolid(Math.floor(x / T), Math.floor(y / T));
const inArena = o => { const tx = Math.floor(o.x / T), ty = Math.floor(o.y / T); return tx >= 0 && ty >= 0 && tx < L.w && ty < L.h && L.arena[ty * L.w + tx] === 1; };

function resolveCircle(o) {
  const r = o.r; let hit = false;
  const x0 = Math.floor((o.x - r) / T), x1 = Math.floor((o.x + r) / T), y0 = Math.floor((o.y - r) / T), y1 = Math.floor((o.y + r) / T);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (!tileSolid(tx, ty)) continue;
    const cx = clamp(o.x, tx * T, tx * T + T), cy = clamp(o.y, ty * T, ty * T + T);
    const dx = o.x - cx, dy = o.y - cy, d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 1e-4) { const d = Math.sqrt(d2), p = r - d; o.x += dx / d * p; o.y += dy / d * p; }
      else {
        const l = o.x - tx * T, rr = tx * T + T - o.x, t = o.y - ty * T, b = ty * T + T - o.y, m = Math.min(l, rr, t, b);
        if (m === l) o.x = tx * T - r; else if (m === rr) o.x = tx * T + T + r; else if (m === t) o.y = ty * T - r; else o.y = ty * T + T + r;
      }
    }
  }
  return hit;
}
function moveCircle(o, dx, dy) {
  let hit = false; const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 8));
  for (let s = 0; s < n; s++) { o.x += dx / n; if (resolveCircle(o)) hit = true; o.y += dy / n; if (resolveCircle(o)) hit = true; }
  return hit;
}
function los(a, b) {
  const d = dist(a, b), n = Math.ceil(d / 14);
  for (let i = 1; i < n; i++) { const t = i / n; if (tileSolidW(lerp(a.x, b.x, t), lerp(a.y, b.y, t))) return false; }
  return true;
}
function computeFields() {
  for (const p of players) {
    const f = new Int16Array(L.w * L.h).fill(-1);
    if (!p.dead) {
      const sx = Math.floor(p.x / T), sy = Math.floor(p.y / T), q = [sx + sy * L.w]; f[q[0]] = 0; let qi = 0;
      while (qi < q.length) {
        const k = q[qi++], x = k % L.w, y = (k / L.w) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy; if (tileSolid(nx, ny)) continue;
          const nk = ny * L.w + nx; if (f[nk] >= 0) continue; f[nk] = f[k] + 1; if (f[nk] < 40) q.push(nk);
        }
      }
    }
    L.fields[p.i] = f;
  }
}

// ---------- prerender peta ----------
function prerenderLevel() {
  const c = document.createElement('canvas'); c.width = L.w * T; c.height = L.h * T;
  const g = c.getContext('2d');
  let seed = 1337 + L.idx * 99; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const [fr, fg, fb] = L.def.floor, [wr, wg, wb] = L.def.wall;
  const solid = (x, y) => x < 0 || y < 0 || x >= L.w || y >= L.h || L.grid[y * L.w + x] === 1;
  for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
    const px = x * T, py = y * T;
    if (!solid(x, y)) {
      const v = rnd() * 10 - 5;
      g.fillStyle = `rgb(${fr + v},${fg + v},${fb + v})`; g.fillRect(px, py, T, T);
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.5;
      g.strokeRect(px + .75, py + .75, T - 1.5, T - 1.5);
      if (rnd() < .5) { g.beginPath(); if (rnd() < .5) { g.moveTo(px + T / 2, py); g.lineTo(px + T / 2, py + T); } else { g.moveTo(px, py + T / 2); g.lineTo(px + T, py + T / 2); } g.stroke(); }
      if (rnd() < .25) { // retakan
        g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1; g.beginPath();
        let cx = px + rnd() * T, cy = py + rnd() * T; g.moveTo(cx, cy);
        for (let k = 0; k < 4; k++) { cx += rnd() * 14 - 7; cy += rnd() * 14 - 7; g.lineTo(cx, cy); } g.stroke();
      }
      if (rnd() < .07) { // tulang/puing
        g.strokeStyle = 'rgba(200,190,170,.25)'; g.lineWidth = 2; g.beginPath();
        const cx = px + 10 + rnd() * 28, cy = py + 10 + rnd() * 28, a = rnd() * TAU;
        g.moveTo(cx - Math.cos(a) * 6, cy - Math.sin(a) * 6); g.lineTo(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6); g.stroke();
      }
      // AO di tepi dinding
      const ao = (x0, y0, x1, y1) => { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; };
      const A = 16;
      if (solid(x, y - 1)) { ao(0, py, 0, py + A); g.fillRect(px, py, T, A); }
      if (solid(x, y + 1)) { ao(0, py + T, 0, py + T - A); g.fillRect(px, py + T - A, T, A); }
      if (solid(x - 1, y)) { ao(px, 0, px + A, 0); g.fillRect(px, py, A, T); }
      if (solid(x + 1, y)) { ao(px + T, 0, px + T - A, 0); g.fillRect(px + T - A, py, A, T); }
    } else {
      const v = rnd() * 8 - 4;
      g.fillStyle = `rgb(${wr + v},${wg + v},${wb + v})`; g.fillRect(px, py, T, T);
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.5;
      for (let r = 0; r < 3; r++) { // bata
        const yy = py + r * 16; g.beginPath(); g.moveTo(px, yy); g.lineTo(px + T, yy); g.stroke();
        const off = (r % 2) * 12; for (let k = off; k < T; k += 24) { g.beginPath(); g.moveTo(px + k, yy); g.lineTo(px + k, yy + 16); g.stroke(); }
      }
      g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.75)';
      if (!solid(x, y - 1)) { g.beginPath(); g.moveTo(px, py + 2); g.lineTo(px + T, py + 2); g.stroke(); }
      if (!solid(x, y + 1)) { g.beginPath(); g.moveTo(px, py + T - 2); g.lineTo(px + T, py + T - 2); g.stroke(); }
      if (!solid(x - 1, y)) { g.beginPath(); g.moveTo(px + 2, py); g.lineTo(px + 2, py + T); g.stroke(); }
      if (!solid(x + 1, y)) { g.beginPath(); g.moveTo(px + T - 2, py); g.lineTo(px + T - 2, py + T); g.stroke(); }
    }
  }
  // lingkaran ritual di arena bos
  const b = L.bossSpawn; g.strokeStyle = 'rgba(160,40,30,.22)'; g.lineWidth = 3;
  for (const r of [70, 130]) { g.beginPath(); g.arc(b.x, b.y, r, 0, TAU); g.stroke(); }
  for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; g.beginPath(); g.moveTo(b.x + Math.cos(a) * 70, b.y + Math.sin(a) * 70); g.lineTo(b.x + Math.cos(a) * 130, b.y + Math.sin(a) * 130); g.stroke(); }
  return c;
}
