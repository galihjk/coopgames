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
//      onAksi(p, idKontrol, arah) {},        // tombol DITEKAN, atau zona "arah" DILEPAS
//      onLepas(p, idTombol) {},              // tombol dilepas (mis. akhir tangkisan)
//      onMencoba(idPerangkat, iceState) {},  onGalat(err) {},
//    });
//    // tiap frame: baca p.input untuk setiap p di pad.pemain (Map)
//    //   zona 'stik' → p.input.gerak = {x, y}            (panjang 0..1)
//    //   zona 'arah' → p.input.serang = {tahan, x, y}    (x,y = arah bidik selama ditahan, 0 bila belum digeser)
//    //   tombol      → p.input.tangkis = {tahan}
//    pad.getar(p, pola); pad.getarSemua(pola); pad.gantiSusunan(susunanBaru);
//
//  Data pemain p: {id, nomor, warna, tersambung, aktif, input, ping:{akhir,rata,maks,lonjakan,n}, paketPerDetik, telat}
//  - nomor & warna tetap untuk HP yang sama (ID perangkat), juga setelah browser HP ditutup lalu
//    QR dipindai lagi. Slot tidak pernah dihapus; game yang memutuskan apa arti pemain terputus.
//  - onAksi: arah = {x,y} vektor satuan, atau null ("pakai arah hadap karakter").
//    Tombol tap memicu SAAT DITEKAN (lebih cepat); zona 'arah' memicu SAAT DILEPAS (bidikan final).
//
//  SUSUNAN (dikirim ke HP saat bergabung; HP menggambar kontrol sesuai susunan ini):
//    { nama, orientasi:'mendatar',
//      zona:   [ {id, jenis:'stik'|'arah', area:[x0,y0,x1,y1], label, warna} ],
//      tombol: [ {id, label, warna, area:[x0,y0,x1,y1] atau [[...],[...]] } ] }
//    area = kotak relatif 0..1 dari bidang kontrol HP (di bawah bilah status); tombol boleh
//    terdiri dari beberapa kotak (mis. bentuk L). Sentuhan dicek ke tombol dulu, lalu ke zona.
//    Zona MENGAMBANG: titik jempol mendarat di dalam area menjadi pusat lingkaran.
//    Tombol tanpa arah: mengirim tekan, tahan, lepas. Buat tombol sebagai area BESAR di pinggir,
//    bukan titik kecil, karena pemain menatap layar komputer, bukan HP.
//
//  Format pesan HP → layar (diurus file ini & pad/index.html, game tidak perlu tahu):
//    {t:'s', v:versiSusunan, q:nomorUrut, z:[...per zona], b:[[tahan, jumlahTekan, jumlahLepas] per tombol]}
//      zona stik: [x, y];  zona arah: [tahan, bidikX, bidikY, jumlahLepas, lepasX, lepasY]
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
    // Tata letak "aksi" (rancangan pemilik, uji HP 25-11-2026), HP mendatar:
    //   ┌──────────────┬──────────────┬──────┐
    //   │              │              │kanan │   gerak      = joystick mengambang (separuh kiri)
    //   │              │     arah     │ atas │   arah       = aksi berarah mengambang
    //   │    gerak     │              ├──────┤   kananAtas, kiriBawah, kananBawah = tombol tanpa arah
    //   │              ├─────────┬────┘      │   (tekan/tahan/lepas). kananBawah berbentuk L, paling
    //   │              │kiriBawah│ kananBawah│   dekat jempol → untuk aksi yang paling sering dipakai.
    //   └──────────────┴─────────┴───────────┘
    // Isi tiap slot: {id, label, warna}. Slot tombol yang tidak diisi dibiarkan kosong.
    //   CoopPad.TATA.aksi({ gerak:{id:'gerak',label:'GERAK'}, arah:{id:'tembak',label:'TEMBAK',warna:'#f80'},
    //                       kananBawah:{id:'lompat',label:'LOMPAT',warna:'#7e7'} })
    aksi(isi) {
      const AREA = {
        kananAtas: [.875, 0, 1, .5],
        kiriBawah: [.5, .75, .75, 1],
        kananBawah: [[.75, .75, 1, 1], [.875, .5, 1, .75]],
      };
      const zona = [{ jenis: 'stik', area: [0, 0, .5, 1], warna: '#9aa3c7', ...isi.gerak }];
      if (isi.arah) zona.push({ jenis: 'arah', area: [.5, 0, .875, .75], warna: '#ff7a5c', ...isi.arah });
      const tombol = Object.keys(AREA).filter(k => isi[k]).map(k => ({ warna: '#9aa3c7', ...isi[k], area: AREA[k] }));
      return { nama: isi.nama || 'aksi', orientasi: 'mendatar', zona, tombol };
    },
  };

  // CONTOH pengisian (dipakai halaman uji-koneksi). Nama aksinya hanya contoh; tiap game mengisi sendiri.
  const SUSUNAN = {
    aksi: TATA.aksi({
      gerak: { id: 'gerak', label: 'GERAK' },
      arah: { id: 'serang', label: 'SERANG', warna: '#ff7a5c' },
      kananAtas: { id: 'skill', label: 'SKILL', warna: '#b48cff' },
      kiriBawah: { id: 'tangkis', label: 'TANGKIS', warna: '#4fc3ff' },
      kananBawah: { id: 'guling', label: 'GULING', warna: '#7ee0a8' },
    }),
  };

  function inputNetral(s) {
    const inp = {};
    for (const z of s.zona) inp[z.id] = z.jenis === 'stik' ? { x: 0, y: 0 } : { tahan: false, x: 0, y: 0 };
    for (const t of s.tombol) inp[t.id] = { tahan: false };
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
        const awal = !p._hitZ;
        if (awal) { p._hitZ = []; p._hitB = []; }
        susunan.zona.forEach((z, i) => {
          const v = d.z[i]; if (!v) return;
          const inp = p.input[z.id];
          if (z.jenis === 'stik') { inp.x = v[0]; inp.y = v[1]; return; }
          inp.tahan = !!v[0]; inp.x = v[1]; inp.y = v[2];
          if (!awal && v[3] > p._hitZ[i]) panggil('onAksi', p, z.id, (v[4] || v[5]) ? { x: v[4], y: v[5] } : null);
          p._hitZ[i] = v[3];
        });
        susunan.tombol.forEach((t, i) => {
          const v = d.b[i]; if (!v) return;
          p.input[t.id].tahan = !!v[0];
          const lama = p._hitB[i];
          if (!awal && v[1] > lama[0]) panggil('onAksi', p, t.id, null);
          if (!awal && v[2] > lama[1]) panggil('onLepas', p, t.id);
          p._hitB[i] = [v[1], v[2]];
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

  return { host, TATA, SUSUNAN, WARNA };
})();
