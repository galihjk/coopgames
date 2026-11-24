'use strict';
// =====================================================================
//  KONEKSI "LAYAR + HP PENGENDALI" — dipakai bersama oleh halaman layar & halaman HP
//
//  Memakai PeerJS (WebRTC) dan server perantara publik PeerJS, tanpa registrasi.
//  Perantara hanya dipakai untuk "berkenalan" (bertukar alamat). Setelah tersambung,
//  data mengalir langsung HP → komputer dan terenkripsi bawaan WebRTC.
//  Bila server perantara bermasalah, cukup ganti file ini; game tidak perlu diubah.
//
//  Butuh dimuat lebih dulu:
//    <script src="https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js"></script>
//
//  Pemakaian:
//    const h = CoopNet.host({ onSiap(kode){}, onMasuk(id,meta){}, onKeluar(id){},
//                             onData(id,pesan){}, onPing(id,ms){}, onGalat(err){} });
//    h.kirim(id, pesan); h.kirimSemua(pesan);
//    const p = CoopNet.pad(kode, { onStatus(status,info){}, onData(pesan){} });
//    p.kirim(pesan);
//
//  Ping diurus di sini: layar mengirim {t:'p'} tiap 0,5 dtk, HP memantulkannya sebagai {t:'q'}.
// =====================================================================
const CoopNet = (() => {
  const AWALAN = 'coopgames-pad-';
  const ALFABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // tanpa I, L, O, 0, 1 supaya tidak tertukar
  const PANJANG_KODE = 4;

  const buatKode = () => Array.from({ length: PANJANG_KODE }, () => ALFABET[Math.floor(Math.random() * ALFABET.length)]).join('');
  const rapikanKode = s => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, PANJANG_KODE);
  const kodeSah = s => rapikanKode(s).length === PANJANG_KODE;
  const idPeer = kode => AWALAN + kode.toLowerCase();

  // ID perangkat HP disimpan di window.name: bertahan saat halaman dimuat ulang di tab yang sama
  // (jadi slot pemain tetap sama saat tersambung ulang), tetapi berbeda untuk tiap tab/iframe.
  function idPerangkat() {
    if (!/^coopPad:/.test(window.name)) window.name = 'coopPad:' + Math.random().toString(36).slice(2, 10);
    return window.name.slice(8);
  }

  // ------------------------------------------------------------------ layar (tuan rumah)
  function host(cb = {}) {
    let kode = '', peer = null, coba = 0, nPing = 0;
    const sambungan = new Map(); // idPerangkat -> DataConnection

    function mulai() {
      kode = buatKode();
      peer = new Peer(idPeer(kode), { debug: 1 });
      peer.on('open', () => cb.onSiap && cb.onSiap(kode));
      peer.on('connection', conn => {
        conn.on('open', () => {
          const id = (conn.metadata && conn.metadata.id) || conn.peer;
          const lama = sambungan.get(id);
          if (lama && lama !== conn) { try { lama.close(); } catch (e) { /* abaikan */ } }
          sambungan.set(id, conn);
          cb.onMasuk && cb.onMasuk(id, conn.metadata || {});
          conn.on('data', d => {
            if (d && d.t === 'q') { cb.onPing && cb.onPing(id, performance.now() - d.ts); return; }
            cb.onData && cb.onData(id, d);
          });
          conn.on('close', () => {
            if (sambungan.get(id) !== conn) return; // sudah diganti sambungan yang lebih baru
            sambungan.delete(id);
            cb.onKeluar && cb.onKeluar(id);
          });
          conn.on('error', () => { /* ditangani lewat 'close' */ });
        });
      });
      // putus dari server perantara: sambungan yang sudah ada tetap jalan, tapi HP baru tak bisa masuk
      peer.on('disconnected', () => { if (!peer.destroyed) setTimeout(() => { try { peer.reconnect(); } catch (e) { /* coba lagi nanti */ } }, 1500); });
      peer.on('error', err => {
        if (err.type === 'unavailable-id' && coba++ < 5) { peer.destroy(); mulai(); return; } // kode bentrok, buat baru
        cb.onGalat && cb.onGalat(err);
      });
    }
    mulai();

    setInterval(() => {
      const pesan = { t: 'p', n: ++nPing, ts: performance.now() };
      for (const c of sambungan.values()) if (c.open) c.send(pesan);
    }, 500);

    return {
      get kode() { return kode; },
      kirim(id, pesan) { const c = sambungan.get(id); if (c && c.open) c.send(pesan); },
      kirimSemua(pesan) { for (const c of sambungan.values()) if (c.open) c.send(pesan); },
    };
  }

  // ------------------------------------------------------------------ HP (pengendali)
  function pad(kode, cb = {}) {
    const id = idPerangkat();
    let peer = null, conn = null, timer = null, berhenti = false;
    const status = (s, info) => cb.onStatus && cb.onStatus(s, info);
    const jadwal = ms => { clearTimeout(timer); timer = setTimeout(sambung, ms); };

    function bukaPeer() {
      peer = new Peer({ debug: 1 });
      peer.on('open', sambung);
      peer.on('disconnected', () => { if (!berhenti) setTimeout(() => { try { peer.reconnect(); } catch (e) { /* abaikan */ } }, 1500); });
      peer.on('error', err => {
        if (err.type === 'peer-unavailable') status('tidak-ada', `Ruang ${kode} tidak ditemukan. Pastikan halaman layar masih terbuka dan kodenya benar.`);
        else status('galat', err.type || String(err));
        jadwal(3000);
      });
    }

    function sambung() {
      if (berhenti || (conn && conn.open)) return;
      if (!peer || peer.destroyed) { bukaPeer(); return; }
      if (peer.disconnected) { try { peer.reconnect(); } catch (e) { /* abaikan */ } jadwal(2000); return; }
      status('menyambung');
      // reliable:false = kanal tanpa urutan; paket telat tidak menahan paket sesudahnya
      const c = peer.connect(idPeer(kode), { reliable: false, serialization: 'json', metadata: { id } });
      conn = c;
      const batas = setTimeout(() => { if (!c.open) { try { c.close(); } catch (e) { /* abaikan */ } if (conn === c) conn = null; jadwal(1000); } }, 8000);
      c.on('open', () => { clearTimeout(batas); status('tersambung'); });
      c.on('data', d => {
        if (d && d.t === 'p') { c.send({ t: 'q', n: d.n, ts: d.ts }); return; }
        cb.onData && cb.onData(d);
      });
      c.on('close', () => {
        clearTimeout(batas);
        if (conn !== c) return;
        conn = null; status('terputus'); jadwal(1500);
      });
      c.on('error', () => { /* ditangani lewat 'close' */ });
    }

    bukaPeer();
    status('menyambung');
    document.addEventListener('visibilitychange', () => { if (!document.hidden && !(conn && conn.open)) jadwal(100); });

    return {
      kirim(pesan) { if (conn && conn.open) { conn.send(pesan); return true; } return false; },
      get tersambung() { return !!(conn && conn.open); },
      berhenti() { berhenti = true; clearTimeout(timer); try { peer.destroy(); } catch (e) { /* abaikan */ } },
    };
  }

  return { host, pad, buatKode, rapikanKode, kodeSah, PANJANG_KODE };
})();
