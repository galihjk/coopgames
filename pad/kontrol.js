'use strict';
// =====================================================================
//  LAPISAN KONTROL "LAYAR + HP" (sisi layar) — dipakai oleh setiap game format ini
//
//  Di atas CoopNet (koneksi.js). Game TIDAK perlu tahu format pesan; cukup:
//
//    const pad = CoopPad.host({
//      susunan: CoopPad.TATA.aksi({...}),    // susunan kontrol yang dikirim ke setiap HP (isi slot sesuai game)
//      onSiap(kode, urlPad) {},              // ruang siap; tampilkan QR berisi urlPad
//      onMasuk(p) {},  onKembali(p) {},      // pemain baru / pemain lama tersambung lagi
//      onKeluar(p) {},                       // sambungan ditutup
//      onDiam(p) {},   onAktif(p) {},        // tak ada data >0,4 dtk (input dinetralkan) / data datang lagi
//      onTekan(p, id) {},                    // zona 'arah' atau tombol MULAI ditekan (mis. animasi isi tenaga)
//      onAksi(p, id, arah, info) {},         // tombol DITEKAN, atau zona 'arah' DILEPAS
//      onLepas(p, id, info) {},              // tombol dilepas (mis. akhir tahan)
//      onMencoba(idPerangkat, iceState) {},  onGalat(err) {},
//    });
//    // tiap frame: baca p.input untuk setiap p di pad.pemain (Map)
//    //   zona 'stik' → p.input[id] = {x, y}                  (panjang 0..1)
//    //   zona 'arah' → p.input[id] = {tahan, x, y, lama}     (x,y = arah bidik selama ditahan, 0 bila belum digeser)
//    //   tombol      → p.input[id] = {tahan, lama}
//    //   lama = ms sejak mulai ditekan (diukur HP, diperbarui ±10×/dtk), 0 bila tidak ditahan
//    pad.getar(p, pola); pad.getarSemua(pola); pad.gantiSusunan(susunanBaru);
//
//  Data pemain p: {id, nomor, warna, tersambung, aktif, input, ping:{akhir,rata,maks,lonjakan,n}, paketPerDetik, telat}
//  - nomor & warna tetap untuk HP yang sama (ID perangkat), juga setelah browser HP ditutup lalu
//    QR dipindai lagi. Slot tidak pernah dihapus; game yang memutuskan apa arti pemain terputus.
//  - onAksi: arah = {x,y} vektor satuan, atau null ("pakai arah hadap karakter").
//    info = {arah, durasi, geser}. durasi = lama ditekan (ms, DIUKUR DI HP sehingga tidak terpengaruh
//    jaringan); geser = jarak geser terjauh jempol (relatif sisi pendek layar HP, 0..±1).
//    Untuk tombol, onAksi datang saat ditekan (durasi 0); durasinya ada di onLepas.
//  - CoopPad.jenis(info, batasMs=250) → 'tap' | 'tahan' | 'cepat-berarah' | 'bidik'. Ambangnya
//    ditentukan game. Game bebas memakai info mentahnya sendiri (mis. tenaga = durasi).
//
//  SUSUNAN (dikirim ke HP saat bergabung; HP menggambar kontrol sesuai susunan ini):
//    { nama, orientasi:'mendatar',
//      zona:   [ {id, jenis:'stik'|'arah', area:[x0,y0,x1,y1], label, warna, petunjuk?} ],
//      tombol: [ {id, label, warna, area:[x0,y0,x1,y1] atau [[...],[...]] } ] }
//    area = kotak relatif 0..1 dari bidang kontrol HP (di bawah bilah status); tombol boleh
//    terdiri dari beberapa kotak (mis. bentuk L). Sentuhan dicek ke tombol dulu, lalu ke zona.
//    Zona MENGAMBANG: titik jempol mendarat di dalam area menjadi pusat lingkaran.
//    Tombol tanpa arah: mengirim tekan, tahan, lepas. Buat tombol sebagai area BESAR di pinggir,
//    bukan titik kecil, karena pemain menatap layar komputer, bukan HP.
//
//  Format pesan HP → layar (diurus file ini & pad/index.html, game tidak perlu tahu):
//    {t:'s', v:versiSusunan, q:nomorUrut, z:[...per zona], b:[...per tombol]}
//      zona stik: [x, y]
//      zona arah: [tahan, bidikX, bidikY, jumlahLepas, lepasX, lepasY, jumlahTekan, durasiLepas, geserLepas, lama]
//      tombol   : [tahan, jumlahTekan, jumlahLepas, durasiLepas, lama]
//    Aksi dibawa sebagai PENGHITUNG, jadi tidak hilang walau ada paket jatuh. Paket dengan nomor
//    urut lebih kecil dari yang sudah diterima dibuang (kanal tanpa urutan).
//  Layar → HP: {t:'tata', v, susunan}, {t:'i', nomor, warna, rtt}, {t:'v', pola}.
// =====================================================================
const CoopPad = (() => {
  const WARNA = ['#4fc3ff', '#ff6fa8', '#7ee07a', '#ffc34d', '#b48cff', '#ff8a4d', '#4de0d0', '#f0f0f0'];
  const BATAS_DIAM = 400;  // ms tanpa data → input dinetralkan (HP mengirim minimal tiap 100 ms)
  const JENDELA_PING = 30000;

  // TATA LETAK (bentuk area) terpisah dari ISI (id, label, warna) yang ditentukan tiap game.
  const TATA = {
    // Tata letak "aksi" (rancangan pemilik, 25-11-2026), HP mendatar:
    //   ┌──────────────────┬──────────────────────┬───────────┐
    //   │                  │      arahAtas        │ tombolAtas│   gerak = joystick mengambang
    //   │      gerak       ├──────────────────────┼───────────┤   arahAtas/arahBawah = zona berarah mengambang
    //   │                  │      arahBawah       │tombolBawah│   tombolAtas/tombolBawah = tanpa arah
    //   └──────────────────┴──────────────────────┴───────────┘   (tekan/tahan/lepas)
    // Isi tiap slot: {id, label, warna, petunjuk?}. Slot yang tidak diisi dibiarkan kosong.
    //   CoopPad.TATA.aksi({ gerak:{id:'gerak',label:'GERAK'}, arahAtas:{id:'tembak',label:'TEMBAK'},
    //                       tombolBawah:{id:'lompat',label:'LOMPAT'} })
    aksi(isi) {
      const ZONA = { arahAtas: [.5, 0, .9, .5], arahBawah: [.5, .5, .9, 1] };
      const TOMBOL = { tombolAtas: [.9, 0, 1, .5], tombolBawah: [.9, .5, 1, 1] };
      const zona = [{ jenis: 'stik', area: [0, 0, .5, 1], warna: '#9aa3c7', ...isi.gerak }];
      for (const k of Object.keys(ZONA)) if (isi[k]) zona.push({ jenis: 'arah', warna: '#ff7a5c', ...isi[k], area: ZONA[k] });
      const tombol = Object.keys(TOMBOL).filter(k => isi[k]).map(k => ({ warna: '#9aa3c7', ...isi[k], area: TOMBOL[k] }));
      return { nama: isi.nama || 'aksi', orientasi: 'mendatar', zona, tombol };
    },
  };

  // CONTOH pengisian (dipakai halaman uji-koneksi). Nama aksinya hanya contoh; tiap game mengisi sendiri.
  const SUSUNAN = {
    aksi: TATA.aksi({
      gerak: { id: 'gerak', label: 'GERAK' },
      arahAtas: { id: 'ranged', label: 'RANGED', warna: '#ff7a5c', petunjuk: 'ketuk · tahan = isi · geser = bidik' },
      arahBawah: { id: 'shield', label: 'SHIELD', warna: '#4fc3ff', petunjuk: 'tahan · geser = arah perisai' },
      tombolAtas: { id: 'melee', label: 'MELEE', warna: '#ffc34d' },
      tombolBawah: { id: 'dash', label: 'DASH', warna: '#7ee0a8' },
    }),
  };

  // Penggolongan bantu. Game boleh memakai ambang sendiri atau langsung membaca info.durasi/geser.
  function jenis(info, batasMs = 250) {
    if (!info) return 'tap';
    const pendek = info.durasi < batasMs;
    if (info.arah) return pendek ? 'cepat-berarah' : 'bidik';
    return pendek ? 'tap' : 'tahan';
  }

  function inputNetral(s) {
    const inp = {};
    for (const z of s.zona) inp[z.id] = z.jenis === 'stik' ? { x: 0, y: 0 } : { tahan: false, x: 0, y: 0, lama: 0 };
    for (const t of s.tombol) inp[t.id] = { tahan: false, lama: 0 };
    return inp;
  }

  function host(op = {}) {
    let susunan = op.susunan || SUSUNAN.aksi, versi = 1;
    const pemain = new Map();
    const panggil = (nama, ...a) => { if (op[nama]) op[nama](...a); };

    const kirimInfo = p => net.kirim(p.id, { t: 'i', nomor: p.nomor, warna: p.warna, rtt: p.ping.akhir });
    const kirimTata = p => net.kirim(p.id, { t: 'tata', v: versi, susunan });

    const net = CoopNet.host({
      onSiap(kode) {
        const url = new URL('../pad/', document.querySelector('script[src*="kontrol.js"]').src).href + '#' + kode;
        panggil('onSiap', kode, url);
      },
      onMencoba: (id, ice) => panggil('onMencoba', id, ice),
      onGalat: err => panggil('onGalat', err),
      onMasuk(id) {
        let p = pemain.get(id), lama = !!p;
        if (!p) {
          const dipakai = new Set([...pemain.values()].map(x => x.nomor));
          let nomor = 1; while (dipakai.has(nomor)) nomor++;
          p = { id, nomor, warna: WARNA[(nomor - 1) % WARNA.length], input: inputNetral(susunan),
            ping: { akhir: null, rata: null, maks: null, lonjakan: 0, n: 0 }, _rtt: [], _paket: [], paketPerDetik: 0, telat: 0 };
          pemain.set(id, p);
        }
        // sambungan baru = halaman HP baru: penghitung & nomor urut di HP mulai dari nol lagi
        p.tersambung = true; p.aktif = true; p._q = 0; p._hitZ = null; p._hitB = null; p._terakhir = performance.now();
        kirimTata(p); kirimInfo(p);
        panggil(lama ? 'onKembali' : 'onMasuk', p);
      },
      onKeluar(id) {
        const p = pemain.get(id); if (!p) return;
        p.tersambung = false; p.aktif = false; p.input = inputNetral(susunan);
        panggil('onKeluar', p);
      },
      onPing(id, ms) {
        const p = pemain.get(id); if (!p) return;
        const now = performance.now();
        p._rtt.push({ t: now, v: ms }); p._rtt = p._rtt.filter(r => now - r.t < JENDELA_PING);
        const v = p._rtt.map(r => r.v);
        p.ping = { akhir: ms, rata: v.reduce((a, b) => a + b, 0) / v.length, maks: Math.max(...v), lonjakan: v.filter(x => x > 100).length, n: v.length };
        kirimInfo(p);
      },
      onData(id, d) {
        const p = pemain.get(id);
        if (!p || !d || d.t !== 's') return;
        const now = performance.now();
        p._paket.push(now); p._terakhir = now;
        if (!p.aktif) { p.aktif = true; panggil('onAktif', p); }
        if (d.v !== versi) return;               // pesan dari susunan lama
        if (d.q <= p._q) { p.telat++; return; }  // paket lama yang datang belakangan
        p._q = d.q;
        const awal = !p._hitZ;                   // paket pertama sambungan ini: hanya catat penghitung
        if (awal) { p._hitZ = []; p._hitB = []; }
        susunan.zona.forEach((z, i) => {
          const v = d.z[i]; if (!v) return;
          const inp = p.input[z.id];
          if (z.jenis === 'stik') { inp.x = v[0]; inp.y = v[1]; return; }
          const [tahan, ax, ay, nLepas, lx, ly, nTekan, durasi, geser, lama] = v;
          inp.tahan = !!tahan; inp.x = ax; inp.y = ay; inp.lama = lama || 0;
          const h = p._hitZ[i] || [nTekan, nLepas];
          if (!awal && nTekan > h[0]) panggil('onTekan', p, z.id);
          if (!awal && nLepas > h[1]) {
            const arah = (lx || ly) ? { x: lx, y: ly } : null;
            panggil('onAksi', p, z.id, arah, { arah, durasi: durasi || 0, geser: geser || 0 });
          }
          p._hitZ[i] = [nTekan, nLepas];
        });
        susunan.tombol.forEach((t, i) => {
          const v = d.b[i]; if (!v) return;
          const [tahan, nTekan, nLepas, durasi, lama] = v;
          p.input[t.id].tahan = !!tahan; p.input[t.id].lama = lama || 0;
          const h = p._hitB[i] || [nTekan, nLepas];
          if (!awal && nTekan > h[0]) { panggil('onTekan', p, t.id); panggil('onAksi', p, t.id, null, { arah: null, durasi: 0, geser: 0 }); }
          if (!awal && nLepas > h[1]) panggil('onLepas', p, t.id, { arah: null, durasi: durasi || 0, geser: 0 });
          p._hitB[i] = [nTekan, nLepas];
        });
      },
    });

    // HP diam (layar mati, WiFi hilang, browser dibunuh sistem): netralkan input supaya karakter
    // tidak terus berjalan dengan input terakhir. Kabar "terputus" resmi bisa datang ±30 dtk kemudian.
    setInterval(() => {
      const now = performance.now();
      for (const p of pemain.values()) {
        p._paket = p._paket.filter(t => now - t < 1000); p.paketPerDetik = p._paket.length;
        if (p.aktif && now - p._terakhir > BATAS_DIAM) {
          p.aktif = false; p.input = inputNetral(susunan);
          panggil('onDiam', p);
        }
      }
    }, 100);

    return {
      pemain,
      get kode() { return net.kode; },
      get susunan() { return susunan; },
      getar(p, pola) { net.kirim(p.id, { t: 'v', pola }); },
      getarSemua(pola) { net.kirimSemua({ t: 'v', pola }); },
      gantiSusunan(s) {
        susunan = s; versi++;
        for (const p of pemain.values()) { p.input = inputNetral(s); p._hitZ = null; p._hitB = null; if (p.tersambung) kirimTata(p); }
      },
    };
  }

  return { host, jenis, TATA, SUSUNAN, WARNA };
})();
