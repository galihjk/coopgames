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
//    const h = CoopNet.host({ onSiap(kode){}, onMencoba(id,iceState){}, onMasuk(id,meta){}, onKeluar(id){},
//                             onData(id,pesan){}, onPing(id,ms){}, onGalat(err){} });
//    h.kirim(id, pesan); h.kirimSemua(pesan);
//    const p = CoopNet.pad(kode, { onStatus(status,info,diag){}, onData(pesan){} });
//    p.kirim(pesan);
//  status HP: menyambung | tersambung | terputus | gagal-jalur | tidak-ada | galat
//  diag     : {perantara, layar, ice, kandidat, gagal}: langkah mana yang sudah/belum berhasil.
//
//  Ping diurus di sini: layar mengirim {t:'p'} tiap 0,5 dtk, HP memantulkannya sebagai {t:'q'}.
//
//  Keterbatasan (diuji 24-11-2026): server relay (TURN) gratis tanpa registrasi sudah tidak ada.
//  Relay bawaan PeerJS (eu-0/us-0.turn.peerjs.com) dan Open Relay tidak bisa di-resolve lagi.
//  Jadi sambungan hanya berhasil kalau jalur langsung berhasil, biasanya di WiFi router yang sama.
//  Lewat hotspot HP atau data seluler, jalur langsung sering gagal.
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
        // diagnosis: HP sudah mengetuk lewat perantara, jalur langsung sedang dibangun
        const pc = conn.peerConnection, idCoba = (conn.metadata && conn.metadata.id) || conn.peer;
        const lapor = () => { if (!conn.open && cb.onMencoba) cb.onMencoba(idCoba, pc ? pc.iceConnectionState : '?'); };
        if (pc) pc.addEventListener('iceconnectionstatechange', lapor);
        lapor();
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
    const status = (s, info, diag) => cb.onStatus && cb.onStatus(s, info, diag);
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

    let gagal = 0;
    function sambung() {
      if (berhenti || (conn && conn.open)) return;
      if (!peer || peer.destroyed) { bukaPeer(); return; }
      if (peer.disconnected) { try { peer.reconnect(); } catch (e) { /* abaikan */ } jadwal(2000); return; }
      // reliable:false = kanal tanpa urutan; paket telat tidak menahan paket sesudahnya
      const c = peer.connect(idPeer(kode), { reliable: false, serialization: 'json', metadata: { id } });
      conn = c;
      // diagnosis bertahap: perantara → layar ditemukan → jalur langsung (ICE)
      const pc = c.peerConnection, jenis = new Set();
      const diag = () => ({
        perantara: true,
        layar: !!(pc && pc.remoteDescription),
        ice: pc ? pc.iceConnectionState : '?',
        kandidat: [...jenis].join(', ') || '-',
        gagal,
      });
      const lapor = () => { if (conn === c && !c.open) status('menyambung', '', diag()); };
      if (pc) {
        pc.addEventListener('icecandidate', e => { if (e.candidate && e.candidate.type) { jenis.add(e.candidate.type); lapor(); } });
        pc.addEventListener('iceconnectionstatechange', lapor);
        pc.addEventListener('signalingstatechange', lapor);
      }
      lapor();
      const batas = setTimeout(() => {
        if (c.open) return;
        gagal++;
        status('gagal-jalur', '', diag()); // ditampilkan sampai percobaan berikutnya memberi kabar baru
        try { c.close(); } catch (e) { /* abaikan */ }
        if (conn === c) conn = null;
        jadwal(2500);
      }, 12000);
      c.on('open', () => { clearTimeout(batas); gagal = 0; status('tersambung'); });
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
    status('menyambung', '', { perantara: false });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && !(conn && conn.open)) jadwal(100); });

    return {
      kirim(pesan) { if (conn && conn.open) { conn.send(pesan); return true; } return false; },
      get tersambung() { return !!(conn && conn.open); },
      berhenti() { berhenti = true; clearTimeout(timer); try { peer.destroy(); } catch (e) { /* abaikan */ } },
    };
  }

  return { host, pad, buatKode, rapikanKode, kodeSah, PANJANG_KODE };
})();
