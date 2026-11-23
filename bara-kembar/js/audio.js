'use strict';
// =====================================================================
//  AUDIO (WebAudio sintetis)
// =====================================================================
const Snd = (() => {
  let ac = null, out, nb, drone, droneG, musicG;
  function init() {
    if (ac) { if (ac.state !== 'running') ac.resume(); return; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    out = ac.createGain(); out.gain.value = .6;
    const comp = ac.createDynamicsCompressor(); out.connect(comp); comp.connect(ac.destination);
    nb = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // drone ambient
    droneG = ac.createGain(); droneG.gain.value = .035;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
    [55, 55.5, 82.4].forEach(f => { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(); });
    lp.connect(droneG); droneG.connect(out);
    musicG = ac.createGain(); musicG.gain.value = .0; musicG.connect(out);
  }
  function env(g, t, a, v, d) { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + d); }
  function tone(f, d, type = 'sine', v = .2, f2 = 0, delay = 0, dest) {
    if (!ac) return; const t = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    env(g, t, .006, v, d); o.connect(g); g.connect(dest || out); o.start(t); o.stop(t + d + .05);
  }
  function noise(d, v, f, type = 'lowpass', q = 1, f2 = 0, delay = 0) {
    if (!ac) return; const t = ac.currentTime + delay;
    const s = ac.createBufferSource(); s.buffer = nb; s.loop = true;
    const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + d);
    const g = ac.createGain(); env(g, t, .005, v, d);
    s.connect(fl); fl.connect(g); g.connect(out); s.start(t, Math.random() * .5); s.stop(t + d + .05);
  }
  let musicOn = false;
  return {
    init,
    get ok() { return !!ac; },
    swing: () => noise(.16, .22, 700, 'bandpass', 1.4, 2800),
    swingHeavy: () => { noise(.26, .3, 400, 'bandpass', 1.2, 2000); },
    hit: () => { tone(160, .12, 'square', .12, 50); noise(.08, .3, 1800, 'lowpass'); },
    crit: () => { tone(90, .4, 'sawtooth', .2, 40); noise(.3, .4, 3000, 'lowpass', 1, 300); tone(1200, .25, 'triangle', .08, 600); },
    parry: () => { tone(1500, .35, 'triangle', .18, 1450); tone(2250, .3, 'sine', .12); noise(.06, .3, 6000, 'highpass'); },
    block: () => { tone(260, .12, 'square', .08, 180); noise(.1, .25, 2500, 'bandpass', 2); },
    guardBreak: () => { tone(140, .4, 'sawtooth', .18, 60); noise(.3, .3, 1500, 'bandpass'); },
    hurt: () => { tone(220, .2, 'sawtooth', .12, 80); noise(.12, .3, 900); },
    bow: () => { tone(320, .12, 'triangle', .14, 140); noise(.08, .15, 3000, 'highpass'); },
    bowFull: () => { tone(500, .15, 'triangle', .14, 200); noise(.12, .2, 4000, 'highpass'); },
    arrowHit: () => { noise(.05, .2, 2500, 'bandpass', 3); },
    roll: () => noise(.25, .15, 500, 'lowpass', 1, 150),
    heal: () => { [523, 659, 784].forEach((f, i) => tone(f, .35, 'sine', .08, 0, i * .08)); },
    swap: () => { tone(800, .05, 'square', .05); tone(500, .06, 'square', .05, 0, .07); },
    tele: () => tone(540, .12, 'sine', .05, 700),
    bossTele: () => { tone(110, .4, 'sawtooth', .07, 160); },
    slam: () => { tone(70, .6, 'sine', .4, 28); noise(.5, .4, 600, 'lowpass', 1, 80); },
    roar: () => { tone(95, 1.2, 'sawtooth', .22, 55); tone(140, 1.1, 'sawtooth', .12, 70); noise(1.1, .3, 900, 'bandpass', .7, 200); },
    fire: () => { noise(.3, .18, 1200, 'bandpass', .8, 300); },
    pillar: () => { tone(60, .5, 'sine', .3, 30); noise(.5, .35, 2000, 'lowpass', .7, 200); },
    die: () => { tone(300, .5, 'triangle', .1, 60); noise(.3, .2, 800); },
    enemyDie: () => { noise(.3, .2, 1200, 'lowpass', 1, 200); tone(200, .3, 'sine', .06, 70); },
    bonfire: () => { noise(1.2, .2, 300, 'lowpass', 1, 1800); [392, 523, 659].forEach((f, i) => tone(f, .9, 'sine', .06, 0, .1 + i * .15)); },
    fog: () => noise(1, .15, 3000, 'bandpass', .5, 600),
    portal: () => { [440, 554, 659, 880].forEach((f, i) => tone(f, .6, 'sine', .07, 0, i * .1)); },
    fail: () => tone(150, .08, 'square', .05),
    chain: () => tone(1800, .05, 'sine', .04),
    over: () => { [220, 207, 174].forEach((f, i) => tone(f, 1.6, 'sawtooth', .07, f * .7, i * .25)); noise(2, .1, 400); },
    victory: () => { [262, 330, 392, 523, 659].forEach((f, i) => tone(f, 2.2, 'triangle', .07, 0, i * .12)); },
    music(on) { musicOn = on; if (ac) { musicG.gain.setTargetAtTime(on ? .5 : 0, ac.currentTime, .5); droneG.gain.setTargetAtTime(on ? .05 : .035, ac.currentTime, .5); } },
    beat(n) {
      if (!ac || !musicOn) return;
      tone(55, .35, 'sine', .35, 35, 0, musicG);
      if (n % 2 === 1) noise(.06, .08, 4000, 'highpass');
      const seq = [220, 0, 261.6, 0, 246.9, 0, 207.6, 196];
      const f = seq[n % 8]; if (f) tone(f, .5, 'sawtooth', .025, 0, 0, musicG);
    }
  };
})();
