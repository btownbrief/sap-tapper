/* Sap Tapper — soft WebAudio synth sounds. No audio files. Starts on first gesture (iOS). */
(function (root) {
  'use strict';
  let ctx = null, master = null, noiseBuf = null, verb = null;
  const S = { on: true, started: false };
  let birdTimer = 0, crackleAcc = 0, windTimer = 9;

  function init() {
    if (ctx) return;
    const AC = root.AudioContext || root.webkitAudioContext; if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = S.on ? .7 : 0; master.connect(ctx.destination);
    // tiny feedback delay as a "woods" reverb
    verb = ctx.createDelay(.5); verb.delayTime.value = .13;
    const fb = ctx.createGain(); fb.gain.value = .28; const vg = ctx.createGain(); vg.gain.value = .22;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    verb.connect(lp); lp.connect(fb); fb.connect(verb); lp.connect(vg); vg.connect(master);
    const len = ctx.sampleRate * .5; noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  function unlock() { init(); if (!ctx) return; if (ctx.state !== 'running' && ctx.resume) ctx.resume(); S.started = true; }
  function suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); }
  function resume() { if (ctx && S.started && ctx.state !== 'running') ctx.resume(); }
  function setOn(on) { S.on = on; if (master) master.gain.setTargetAtTime(on ? .7 : 0, ctx.currentTime, .02); }

  function tone(f, dur, type, vol, o) {
    if (!ctx || !S.on) return; o = o || {};
    const t0 = ctx.currentTime + (o.delay || 0);
    const os = ctx.createOscillator(), g = ctx.createGain();
    os.type = type || 'sine'; os.frequency.setValueAtTime(f, t0);
    if (o.to) os.frequency.exponentialRampToValueAtTime(Math.max(30, o.to), t0 + (o.glide || dur));
    g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(vol || .2, t0 + (o.attack || .005));
    g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    os.connect(g); g.connect(master); if (o.wet) g.connect(verb);
    os.start(t0); os.stop(t0 + dur + .05);
  }
  function noise(dur, freq, q, vol, o) {
    if (!ctx || !S.on) return; o = o || {};
    const t0 = ctx.currentTime + (o.delay || 0);
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(freq, t0); f.Q.value = q || 1;
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(vol || .1, t0 + (o.attack || .01)); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master); src.start(t0); src.stop(t0 + dur + .05);
  }

  // pentatonic for rising plinks
  const PENT = [0, 2, 4, 7, 9];
  const note = (i, base) => (base || 523.25) * Math.pow(2, (PENT[i % 5] + 12 * Math.floor(i / 5)) / 12);

  const A = {
    unlock, suspend, resume, setOn, get on() { return S.on; },
    /** The plink of a drop into a tin bucket. streak raises the pitch gently. */
    plink(streak) {
      const n = streak || 0, s = n <= 14 ? n : 10 + (n - 15) % 5;
      const f = note(s, 587) * (1 + (Math.random() - .5) * .02);
      tone(f * 1.9, .16, 'sine', .16, { to: f, glide: .06, wet: true });
      tone(f * 3.02, .07, 'triangle', .05);
      noise(.03, 5000, 2, .03);
    },
    buy(i) { const b = 392 * Math.pow(1.03, Math.min(i || 0, 20)); tone(b, .09, 'triangle', .14); tone(b * 1.5, .12, 'sine', .12, { delay: .05, wet: true }); noise(.05, 900, 1.5, .05); },
    /** Every 10th tap in a streak: a bright little two-note sparkle that climbs with the streak. */
    streak(n) { const b = note(Math.min(Math.floor(n / 10), 8) + 5, 587); tone(b, .14, 'triangle', .09, { wet: true }); tone(b * 1.5, .22, 'sine', .08, { delay: .06, wet: true }); },
    /** A goal on the Sugarmaker's list ticked off. */
    goal() { [0, 4, 7].forEach((n, i) => tone(392 * Math.pow(2, n / 12), .18, 'triangle', .11, { delay: i * .07, wet: true })); tone(1175, .3, 'sine', .06, { delay: .22, wet: true }); noise(.05, 2500, 2, .04, { delay: .2 }); },
    /** something new lands in the scene: a soft wooden plop, pitch by tier */
    land(i) { const f = 220 * Math.pow(1.06, Math.min(i || 0, 14)); tone(f, .12, 'sine', .08, { to: f * .7, glide: .1 }); noise(.05, 700, 1.2, .03); },
    cant() { tone(180, .1, 'square', .04, { to: 150 }); },
    upgrade() { [0, 2, 4, 7].forEach((n, i) => tone(note(n, 523), .22, 'sine', .13, { delay: i * .06, wet: true })); tone(1568, .4, 'triangle', .04, { delay: .24, wet: true }); },
    sparkleAppear() { [0, 3, 6].forEach((n, i) => tone(note(n + 5, 880), .3, 'sine', .05, { delay: i * .09, wet: true })); },
    sparkleCatch() { for (let i = 0; i < 8; i++) tone(note(i + 3, 523), .25, 'sine', .11, { delay: i * .04, wet: true }); noise(.4, 6000, .8, .05, { to: 2000 }); },
    frenzyEnd() { tone(660, .2, 'sine', .08, { to: 440, wet: true }); },
    ach() { tone(784, .18, 'triangle', .12, { wet: true }); tone(1175, .32, 'sine', .12, { delay: .1, wet: true }); },
    season() { [0, 4, 7, 12, 16].forEach((s, i) => { const f = 392 * Math.pow(2, s / 12); tone(f, .5, 'triangle', .13, { delay: i * .11, wet: true }); tone(f * 2, .4, 'sine', .05, { delay: i * .11 + .02 }); }); noise(1, 3000, .7, .04, { delay: .5, to: 900 }); },
    away() { [0, 2, 4].forEach((n, i) => tone(note(n, 440), .3, 'sine', .1, { delay: i * .1, wet: true })); },
    ui() { tone(700, .05, 'sine', .07); },
    /** Chickadee-ish two-note whistle now and then: late-winter ambience. */
    ambient(dt, fires) {
      if (!ctx || !S.on || ctx.state !== 'running') return;
      // fire crackle from the kettles and evaporator: little filtered pops, more fires = busier
      if (fires > 0) {
        crackleAcc += dt * Math.min(9, 1.5 + Math.log2(1 + fires) * 1.4);
        while (crackleAcc > 1) { crackleAcc -= 1; noise(.02 + Math.random() * .03, 1800 + Math.random() * 2600, 3, .012 + Math.random() * .02, { delay: Math.random() * .6 }); }
      }
      // a soft gust of wind now and then
      windTimer -= dt;
      if (windTimer <= 0) { windTimer = 25 + Math.random() * 35; noise(2.6, 500, .6, .018, { attack: 1.1, to: 260, type: 'lowpass' }); }
      birdTimer -= dt;
      if (birdTimer <= 0) {
        birdTimer = 18 + Math.random() * 30;
        const f = 3100 + Math.random() * 200;
        tone(f, .32, 'sine', .028, { to: f * .98, attack: .03 });
        tone(f * .82, .4, 'sine', .026, { delay: .36, to: f * .8, attack: .03 });
      }
    },
  };
  // ---------------------------------------------------------------- music: a gentle fingerpicked folk loop
  // G major, 88 bpm. Guitar-ish plucks (root bass + rolling arpeggio), a soft fiddle-like melody that comes and
  // goes, and a shaker that joins during a Sap Run. Scheduled a little ahead with a timer (the usual WebAudio way).
  const M = { on: true, playing: false, gain: null, next: 0, step: 0, timer: null, hype: 0, motif: null, seed: (() => { const z = new Date(); return 7 + z.getFullYear() * 400 + z.getMonth() * 31 + z.getDate(); })() };
  const BPM = 88, EIGHTH = 60 / BPM / 2;
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  // chords as midi roots + quality (G=55)
  const PROG = [[55, 'M'], [52, 'm'], [48, 'M'], [50, 'M'], [55, 'M'], [48, 'M'], [45, 'm'], [50, 'M']];
  const PROG_B = [[52, 'm'], [48, 'M'], [55, 'M'], [50, 'M'], [52, 'm'], [48, 'M'], [45, 'm'], [50, 'M']]; // the B section leans minor
  const chordTones = (r, q) => [r, r + (q === 'm' ? 3 : 4), r + 7];
  const SCALE = [67, 69, 71, 74, 76, 79, 81, 83]; // G pentatonic, melody range
  function mrand() { M.seed = (M.seed * 16807) % 2147483647; return M.seed / 2147483647; }
  function pluck(f, t, vol, dur) {
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o1.type = 'triangle'; o2.type = 'sine'; o1.frequency.value = f; o2.frequency.value = f * 2.003;
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(Math.min(5000, f * 7), t); lp.frequency.exponentialRampToValueAtTime(Math.max(200, f * 1.6), t + dur * .7);
    const g2 = ctx.createGain(); g2.gain.value = .35;
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(M.gain); g.connect(verb);
    o1.start(t); o2.start(t); o1.stop(t + dur + .05); o2.stop(t + dur + .05);
  }
  function fiddle(f, t, dur, vol) {
    const o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg2 = ctx.createGain(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = f * 3.2; lp.Q.value = 2;
    lfo.frequency.value = 5.2; lg2.gain.setValueAtTime(0, t); lg2.gain.linearRampToValueAtTime(f * .006, t + dur * .6); lfo.connect(lg2); lg2.connect(o.frequency);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .09); g.gain.setValueAtTime(vol, t + dur * .7); g.gain.exponentialRampToValueAtTime(.0001, t + dur + .12);
    o.connect(lp); lp.connect(g); g.connect(M.gain); g.connect(verb);
    o.start(t); lfo.start(t); o.stop(t + dur + .2); lfo.stop(t + dur + .2);
  }
  function shaker(t, vol) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6500;
    const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + .07);
    src.connect(f); f.connect(g); g.connect(M.gain); src.start(t, Math.random() * .3); src.stop(t + .1);
  }
  function newMotif() { // a 2-bar call, answered with a variation: sounds composed rather than random
    const m = []; let i = 2 + Math.floor(mrand() * 3);
    for (let k = 0; k < 6; k++) { i = Math.max(0, Math.min(SCALE.length - 1, i + [-2, -1, -1, 1, 1, 2][Math.floor(mrand() * 6)])); m.push({ n: SCALE[i], len: mrand() < .35 ? 2 : mrand() < .7 ? 3 : 4 }); }
    return m;
  }
  function schedule() {
    if (!ctx || !M.playing) return;
    if (M.next < ctx.currentTime) M.next = ctx.currentTime + .05;
    if (!M.on || !S.on) { M.next = ctx.currentTime + .1; return; } // muted: keep time, build nothing
    while (M.next < ctx.currentTime + .4) {
      const t = M.next, st = M.step, cyc = Math.floor(st / 8) % 32, B = cyc >= 16, bar = cyc % 8, e = st % 8, [root, q] = (B ? PROG_B : PROG)[bar], ct = chordTones(root, q);
      const brk = cyc === 31; // one bar of bass only before the tune comes back round
      // bass on 1 and 5, alternating root / fifth
      if (e === 0) pluck(midi(root - 12), t, .16, 1.2);
      if (e === 4) pluck(midi(ct[2] - 12), t, .12, 1.0);
      // rolling arpeggio
      const arp = brk ? null : B ? [null, null, ct[1] + 12, null, ct[2], null, ct[0] + 12, ct[1]][e] : [null, ct[1], ct[2], ct[0] + 12, ct[1] + 12, ct[2], ct[0] + 12, ct[1]][e];
      if (arp) pluck(midi(arp), t + (Math.random() - .5) * .012, e % 2 ? .055 : .07, .7);
      // melody: phrases of 4 bars, then 4 bars rest; new motif every 16 bars
      const phraseBar = Math.floor(st / 8) % 8;
      if (st % 128 === 0) M.motif = newMotif(); // a new tune every 16 bars (once per A and once per B section)
      if (phraseBar < 4 && M.motif) {
        // walk the motif: sum of lengths in eighths; second half of the phrase answers a step lower
        const pos = (Math.floor(st / 8) % 4) * 8 + e; let acc = 0;
        const half = pos >= 16 ? 1 : 0, p2 = pos % 16;
        for (const nt of M.motif) { if (acc === p2) { const n = half && nt === M.motif[M.motif.length - 1] ? SCALE[Math.max(0, SCALE.indexOf(nt.n) - 1)] : nt.n; fiddle(midi(n), t, nt.len * EIGHTH * .95, .035 + M.hype * .015); break; } acc += nt.len; if (acc > p2) break; }
      }
      if (M.hype > 0 && e % 2 === 1) shaker(t, .05);
      if (M.hype > 0 && e % 2 === 0) shaker(t, .025);
      M.next += EIGHTH * (e % 2 ? .94 : 1.06); // a little swing
      M.step++;
    }
  }
  A.music = function (on) {
    M.on = on;
    if (M.gain) M.gain.gain.setTargetAtTime(on ? .5 : 0, ctx.currentTime, .3);
    if (on) A.startMusic();
  };
  A.startMusic = function () {
    if (!ctx || M.playing || !M.on) return;
    M.gain = M.gain || (() => { const g = ctx.createGain(); g.gain.value = 0; g.connect(master); return g; })();
    M.gain.gain.setTargetAtTime(.5, ctx.currentTime, 1.2); // fade in
    M.playing = true; M.next = ctx.currentTime + .15; M.step = 0; M.motif = newMotif();
    M.timer = setInterval(schedule, 120); schedule();
  };
  A.setHype = function (h) { M.hype = h ? 1 : 0; };
  Object.defineProperty(A, 'musicOn', { get: () => M.on });
  root.SapAudio = A;
})(window);
