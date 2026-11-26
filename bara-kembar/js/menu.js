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
  pad: { solo: null, ico: '🖥️📱', name: 'Layar + HP sebagai stik', desc: 'Game tampil di laptop/TV, tiap pemain memakai HP-nya sebagai kontroler', ready: false },
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
  if (b.dataset.go) {
    const solo = b.dataset.mode != null ? b.dataset.mode === '1' : !!SAVE.solo;
    pickCtrl(b.dataset.go, solo);
  }
});
function pickCtrl(id, solo) {
  G.solo = solo; SAVE.solo = solo; SAVE.ctrl = id; saveGame();
  MENU.hidden = true; G.mode = 'title'; Snd.swap();
  if (CTRL[id].touch) tryFullscreen(); // sentuh: layar penuh + kunci tegak (butuh ketukan pengguna, ini salah satunya)
}
showMenu();
