'use strict';
// =====================================================================
//  MENU AWAL (HTML biasa, bukan canvas): jumlah pemain → kontroler.
//  Arah layar & layar penuh baru diatur setelah kontroler dipilih, karena tiap kontroler
//  butuh arah berbeda (sentuh tegak = portrait, layar komputer = landscape).
// =====================================================================
// ready:false = belum dibuat (tampil redup dengan tanda "Segera").
const CTRL = {
  touchP: { solo: true, ico: '📱', name: 'Layar sentuh (tegak)', desc: 'Pegang HP tegak, satu tangan untuk joystick, satu untuk tombol', ready: true, touch: true },
  touchL: { solo: true, ico: '📱', name: 'Layar sentuh (mendatar)', desc: 'Pegang HP mendatar seperti konsol genggam', ready: false, touch: true },
  kb: { solo: true, ico: '⌨️', name: 'Keyboard', desc: 'WASD bergerak, F/G/H untuk aksi', ready: true },
  mouse: { solo: true, ico: '🖱️', name: 'Mouse', desc: 'Karakter mengikuti penunjuk, klik kiri/kanan untuk aksi', ready: true },
  mousekb: { solo: true, ico: '⌨️🖱️', name: 'Mouse + keyboard', desc: 'WASD bergerak, mouse membidik', ready: true },
  touch2: { solo: false, ico: '📱', name: 'Satu HP berdua', desc: 'HP diletakkan mendatar di meja, kalian duduk berhadapan', note: 'Matikan dulu gestur "usap 3 jari" (tangkapan layar) di HP', ready: true, touch: true },
  kb2: { solo: false, ico: '⌨️', name: 'Satu keyboard berdua', desc: 'P1: WASD + F/G/H · P2: panah + , . /', ready: true },
  mkb2: { solo: false, ico: '🖱️ ⌨️', name: 'Mouse + keyboard', desc: 'P1 memakai mouse, P2 memakai keyboard', ready: true },
  pad: { solo: null, ico: '🖥️📱', name: 'Layar + HP sebagai stik', desc: 'Game tampil di laptop/TV, tiap pemain memakai HP-nya sebagai stik (WiFi yang sama)', ready: true },
};
const CTRL_ORDER = { solo: ['touchP', 'touchL', 'kb', 'mouse', 'mousekb', 'pad'], duo: ['touch2', 'kb2', 'mkb2', 'pad'] };
const ctrlOk = (id, solo) => { const c = CTRL[id]; return c && c.ready && (c.solo === null || c.solo === solo); };
const isTouchCtrl = () => !!(CTRL[SAVE.ctrl] && CTRL[SAVE.ctrl].touch);
// layar komputer: kontroler bukan sentuh. Simpanan lama tanpa SAVE.ctrl dianggap sentuh (perilaku lama).
const sharedScreen = () => !!(CTRL[SAVE.ctrl] && !CTRL[SAVE.ctrl].touch);

const MENU = document.getElementById('menu');
function showMenu() {
  G.mode = 'menu';
  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => { });
  menuStep(null);
  MENU.hidden = false;
}
// step null = pilih jumlah pemain; true/false = daftar kontroler mode solo/berdua
function menuStep(solo) {
  MENU.dataset.step = 'pilih'; lobbyHTML = '';
  const h = [];
  if (solo === null) {
    if (ctrlOk(SAVE.ctrl, !!SAVE.solo)) h.push(`<button class="quick" data-go="${SAVE.ctrl}">▶ Main lagi<small>${SAVE.solo ? '1 pemain + bot' : '2 pemain'} · ${CTRL[SAVE.ctrl].name}</small></button>`);
    h.push('<h2>Berapa pemain?</h2><div class="cards">',
      '<button data-solo="1"><b>1 Pemain</b><small>Bot menjadi rekanmu</small></button>',
      '<button data-solo="0"><b>2 Pemain</b><small>Co-op berdua</small></button></div>');
  } else {
    h.push(`<button class="back">‹ Kembali</button><h2>${solo ? '1 pemain + bot' : '2 pemain'}: pilih kontroler</h2><div class="list">`);
    for (const id of CTRL_ORDER[solo ? 'solo' : 'duo']) {
      const c = CTRL[id];
      h.push(`<button data-go="${id}" data-mode="${solo ? 1 : 0}"${c.ready ? '' : ' disabled'}><span class="ico">${c.ico}</span><span><b>${c.name}${c.ready ? '' : '<em>Segera</em>'}</b><small>${c.desc}</small>${c.note && c.ready ? `<small class="warn">⚠ ${c.note}</small>` : ''}</span></button>`);
    }
    h.push('</div>');
  }
  MENU.querySelector('.step').innerHTML = '<div class="inner">' + h.join('') + '</div>';
}
MENU.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  Snd.init();
  if (b.classList.contains('back')) return menuStep(null);
  if (b.dataset.solo != null) return menuStep(b.dataset.solo === '1');
  if (b.dataset.lobby) { MENU.hidden = true; G.mode = 'title'; Snd.swap(); return; }
  if (b.dataset.go) {
    const solo = b.dataset.mode != null ? b.dataset.mode === '1' : !!SAVE.solo;
    pickCtrl(b.dataset.go, solo);
  }
});
function pickCtrl(id, solo) {
  G.solo = solo; SAVE.solo = solo; SAVE.ctrl = id; saveGame();
  if (id === 'pad') { menuLobby(); return; } // HP harus tersambung dulu
  MENU.hidden = true; G.mode = 'title'; Snd.swap();
  if (CTRL[id].touch) tryFullscreen(); // sentuh: layar penuh + kunci tegak (butuh ketukan pengguna, ini salah satunya)
}
// ---------- lobi Layar + HP: QR, kode ruang, status tiap HP ----------
let lobbyQR = '';
function menuLobby() {
  MENU.dataset.step = 'lobby';
  padStart(() => { if (!MENU.hidden && MENU.dataset.step === 'lobby') renderLobby(); });
  renderLobby();
}
let lobbyHTML = '';
function renderLobby() {
  if (PADS.url && !lobbyQR && typeof qrcode === 'function') { const q = qrcode(0, 'M'); q.addData(PADS.url); q.make(); lobbyQR = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); }
  const n = G.solo ? 1 : 2, ready = padReady();
  const slots = [0, 1].slice(0, n).map(i => { const st = padStatus(i); return `<div class="slot">P${i + 1}: <b class="${st === 'tersambung' ? 'ok' : 'no'}">${st}</b></div>`; }).join('');
  const html = `<div class="inner"><button class="back">‹ Ganti kontroler</button>
    <h2>${G.solo ? '1 pemain + bot' : '2 pemain'}: sambungkan HP</h2>
    <div class="lobby"><div class="qr">${lobbyQR || (PADS.galat ? '⚠' : 'Membuat ruang…')}</div>
      <div><div class="kode">${PADS.kode || '····'}</div><small>${PADS.url ? PADS.url.replace(/^https?:\/\//, '') : ''}</small>${slots}</div></div>
    <p class="note">${PADS.galat ? '⚠ ' + PADS.galat : `Pindai QR dengan kamera HP${n > 1 ? ' (HP pertama = P1, kedua = P2)' : ''}, atau buka alamat di atas lalu masukkan kodenya. HP dan laptop harus tersambung ke WiFi yang sama (hotspot HP tidak bisa). Pegang HP mendatar.`}</p>
    <button class="quick" data-lobby="1"${ready ? '' : ' disabled'}>${ready ? '▶ Lanjut' : 'Menunggu HP…'}</button></div>`;
  if (html !== lobbyHTML) MENU.querySelector('.step').innerHTML = lobbyHTML = html; // tulis ulang hanya bila berubah (klik tidak hilang)
}
setInterval(() => { if (!MENU.hidden && MENU.dataset.step === 'lobby') renderLobby(); }, 500);
showMenu();
