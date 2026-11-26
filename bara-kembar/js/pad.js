'use strict';
// =====================================================================
//  KONTROLER "LAYAR + HP" (../pad/): game tampil di laptop/TV, tiap pemain memakai HP-nya sebagai stik.
//  Pustakanya (PeerJS, QR, koneksi.js, kontrol.js) baru dimuat saat kontroler ini dipilih.
//  Sama seperti kontroler lain, HP hanya mengisi IN[i] (lihat pollPad), jadi logika game tidak berubah.
//
//  Susunan HP (tata letak "aksi" milik pad/):
//    kiri = gerak · kanan atas (berarah) = serang · kanan bawah (berarah) = tameng/guling
//    pinggir atas = ganti senjata · pinggir bawah = minum ramuan
//  HP bernomor 1 = P1, nomor 2 = P2 (mode solo: hanya nomor 1; P2 = bot). HP lain diabaikan.
// =====================================================================
const PAD_LIBS = [
  'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js',
  'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js',
  '../pad/koneksi.js', '../pad/kontrol.js',
];
const PADS = { host: null, kode: null, url: null, galat: null, memuat: false };
// ketukan sangat singkat bisa selesai di antara dua paket; kontrol.js tetap melaporkannya sebagai penghitung,
// jadi tiap tekanan dijadikan "denyut" tombol beberapa saat agar pressed()/released() di game melihatnya.
const PAD_PULSE = [0, 1].map(() => ({ serang: -9, tameng: -9, ganti: -9, ramuan: -9 }));
const padOn = () => SAVE.ctrl === 'pad' && !!PADS.host;
const padSlot = p => p.nomor - 1 < (G.solo ? 1 : 2) ? p.nomor - 1 : -1;
const padPlayer = i => PADS.host ? [...PADS.host.pemain.values()].find(p => padSlot(p) === i) : null;

function padStart(onUpdate) {
  if (PADS.host || PADS.memuat) return;
  PADS.memuat = true;
  const next = k => {
    if (k >= PAD_LIBS.length) { PADS.memuat = false; padHost(onUpdate); return; }
    const s = document.createElement('script'); s.src = PAD_LIBS[k];
    s.onload = () => next(k + 1);
    s.onerror = () => { PADS.memuat = false; PADS.galat = 'Gagal memuat pustaka koneksi. Periksa internet, lalu muat ulang halaman.'; onUpdate(); };
    document.head.appendChild(s);
  };
  next(0);
}
function padHost(onUpdate) {
  const warnai = p => { const i = padSlot(p); if (i >= 0) p.warna = PALETTE[SAVE.colors[i] % PALETTE.length][0]; }; // HP menampilkan warna karakternya
  const putus = p => { // HP pemain aktif terputus/diam di tengah permainan → jeda
    if (padSlot(p) >= 0 && G.mode === 'play') togglePause(); // status tiap HP tampil di layar jeda
    onUpdate();
  };
  PADS.host = CoopPad.host({
    susunan: CoopPad.TATA.aksi({
      nama: 'barakembar',
      gerak: { id: 'gerak', label: 'GERAK' },
      arahAtas: { id: 'serang', label: 'SERANG', warna: '#ffb347', petunjuk: 'pedang: ketuk · busur: tahan & lepas · geser = bidik' },
      arahBawah: { id: 'tameng', label: 'TAMENG / GULING', warna: '#62d6cf', petunjuk: 'pedang: tahan · busur: ketuk · geser = arah' },
      tombolAtas: { id: 'ganti', label: 'GANTI', warna: '#e8d9b0' },
      tombolBawah: { id: 'ramuan', label: 'RAMUAN', warna: '#ff8a70' },
    }),
    onSiap(kode, url) { PADS.kode = kode; PADS.url = url; onUpdate(); },
    onMasuk(p) { warnai(p); onUpdate(); },
    onKembali(p) { warnai(p); onUpdate(); },
    onKeluar: putus, onDiam: putus,
    onAktif: onUpdate,
    onTekan(p, id) {
      const i = padSlot(p); if (i < 0 || !(id in PAD_PULSE[i])) return;
      PAD_PULSE[i][id] = G.t;
      if (G.mode === 'intro' && id === 'serang') introOk(i); // serang = OK di layar Cara main
    },
    onGalat(err) { PADS.galat = 'Galat koneksi: ' + (err && err.type || err) + '. Muat ulang halaman.'; onUpdate(); },
  });
}
// HP → IN[i]. Dipanggil di akhir pollInput (setiap frame).
function pollPad() {
  if (!padOn()) return;
  for (const p of PADS.host.pemain.values()) {
    const i = padSlot(p); if (i < 0) continue;
    const n = IN[i], g = p.input.gerak, s = p.input.serang, t = p.input.tameng, q = PAD_PULSE[i], since = k => G.t - q[k];
    n.mx = g.x; n.my = g.y;
    n.h[0] = s.tahan || since('serang') < .07 ? 1 : 0;
    n.h[1] = t.tahan || since('tameng') < .07 ? 1 : 0;
    // tombol 3 di game: ketuk = ganti, tahan ≥0,38 dtk = ramuan. Di HP keduanya tombol terpisah,
    // jadi GANTI = denyut singkat, RAMUAN = denyut cukup panjang untuk memicu minum.
    n.h[2] = since('ganti') < .1 || since('ramuan') < .45 ? 1 : 0;
    // zona berarah yang digeser = arah bidik/arah tameng (terpisah dari arah gerak)
    n.aim = s.tahan && (s.x || s.y) ? Math.atan2(s.y, s.x) : t.tahan && (t.x || t.y) ? Math.atan2(t.y, t.x) : null;
  }
}
function padVib(i, ms) { const p = padPlayer(i); if (p && p.tersambung) PADS.host.getar(p, ms); }
// status sambungan per slot, untuk lobi & layar jeda
function padStatus(i) {
  const p = padPlayer(i);
  return !p ? 'belum ada HP' : !p.tersambung ? 'terputus' : !p.aktif ? 'diam (layar HP mati?)' : 'tersambung';
}
const padReady = () => [0, 1].slice(0, G.solo ? 1 : 2).every(i => { const p = padPlayer(i); return p && p.tersambung && p.aktif; });
