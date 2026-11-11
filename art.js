/* Sap Tapper — code-drawn art: the late-winter scene, producers, particles and shop icons.
   ASSETS: drop a PNG path into ASSETS[key] (or load with ?art=1) and it replaces the code-drawn version. */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const INK = '#33210f';

  // painted-art slots (see IMAGE-PROMPTS.md). null = use code-drawn fallback.
  const ASSETS = {
    backdrop: null, tree: null, bucket: null, sparkleBucket: null,
    spile: null, kettle: null, bag: null, sled: null, evap: null, tubing: null, vacuum: null, ro: null,
    sugarbush: null, sugarhouse: null, pipeline: null, coop: null, reservoir: null, weather: null,
  };
  const IMG = {};
  function loadAssets() {
    if (!/[?&]art=1/.test(root.location ? root.location.search : '')) return;
    Object.keys(ASSETS).forEach(k => {
      const im = new Image();
      im.onload = () => { IMG[k] = im; if (S.onAsset) S.onAsset(k); };
      im.src = ASSETS[k] || ('assets/' + k + '.png');
    });
  }

  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const easeOut = t => 1 - Math.pow(1 - t, 3);

  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function ell(c, x, y, rx, ry) { c.beginPath(); c.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), 0, 0, TAU); }
  function lg(c, x0, y0, x1, y1, stops) { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach((s, i) => g.addColorStop(s[0], s[1])); return g; }
  function fs(c, fill, stroke, lw) { if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 2; c.stroke(); } }

  // ================================================================ objects (drawn in local units, ground-center at 0,0)
  // Each draws roughly within x -50..50, y -100..0 unless noted.

  function drawBucket(c, opts) {
    opts = opts || {};
    const fill = opts.fill || 0;
    // bucket hangs from hook at (0,-60) ; body from y -52 to 0
    c.lineJoin = 'round';
    c.beginPath(); c.moveTo(-26, -50); c.lineTo(26, -50); c.lineTo(20, 0); c.lineTo(-20, 0); c.closePath();
    fs(c, lg(c, -26, 0, 26, 0, [[0, '#8d9ba3'], [.35, '#e3ebef'], [.6, '#b8c6cd'], [1, '#76858d']]), INK, 3.5);
    // sap inside (visible through open top as an ellipse)
    ell(c, 0, -50, 26, 6); fs(c, '#55636b', INK, 3);
    if (fill > 0) { ell(c, 0, -50 + 3 * (1 - fill), 24 * (0.9 + .1 * fill), 4.6); fs(c, 'rgba(178,226,244,.95)'); ell(c, -6, -51 + 3 * (1 - fill), 7, 1.6); fs(c, 'rgba(255,255,255,.8)'); }
    // ribs
    c.strokeStyle = 'rgba(51,33,15,.35)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-24, -34); c.lineTo(24, -34); c.moveTo(-22, -17); c.lineTo(22, -17); c.stroke();
    // lid
    if (opts.lid) { c.beginPath(); c.moveTo(-30, -52); c.quadraticCurveTo(0, -70, 30, -52); c.closePath(); fs(c, lg(c, 0, -68, 0, -52, [[0, '#c6d2d8'], [1, '#7b8a92']]), INK, 3); }
  }
  function drawSpout(c) {
    // spile sticking out to the right from (0,0)
    c.beginPath(); c.moveTo(-4, -4); c.lineTo(16, -2); c.lineTo(18, 3); c.lineTo(-4, 4); c.closePath();
    fs(c, lg(c, 0, -4, 0, 4, [[0, '#f0f4f6'], [1, '#7f8d95']]), INK, 2.5);
    c.beginPath(); c.moveTo(6, 2); c.lineTo(6, 9); fs(c, null, INK, 2.5);
  }
  function drawBag(c) {
    c.beginPath(); c.moveTo(-14, -46); c.quadraticCurveTo(-22, -10, -12, 0); c.quadraticCurveTo(0, 6, 12, 0); c.quadraticCurveTo(22, -10, 14, -46); c.closePath();
    fs(c, lg(c, -20, 0, 20, 0, [[0, '#2f7fc4'], [.4, '#79c0f0'], [1, '#2a6aa8']]), INK, 3);
    c.globalAlpha = .55; c.beginPath(); c.moveTo(-15, -14); c.quadraticCurveTo(0, -10, 15, -14); c.lineTo(13, 0); c.quadraticCurveTo(0, 5, -12, 0); c.closePath(); fs(c, '#d9f2ff'); c.globalAlpha = 1;
    rr(c, -16, -52, 32, 9, 3); fs(c, '#9aa6ac', INK, 2.5);
  }
  function drawKettle(c, t, fire) {
    // tripod
    c.strokeStyle = '#4a3420'; c.lineWidth = 5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-34, 0); c.lineTo(0, -92); c.lineTo(34, 0); c.moveTo(0, -92); c.lineTo(6, 4); c.stroke();
    c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -90); c.lineTo(0, -62); c.stroke();
    // fire
    if (fire) drawFire(c, 0, -2, 1, t);
    // logs
    c.lineWidth = 7; c.strokeStyle = '#6b4526'; c.beginPath(); c.moveTo(-22, -2); c.lineTo(20, -8); c.moveTo(-18, -8); c.lineTo(22, -1); c.stroke();
    // kettle body
    c.beginPath(); c.moveTo(-28, -56); c.bezierCurveTo(-34, -30, -24, -16, 0, -16); c.bezierCurveTo(24, -16, 34, -30, 28, -56); c.closePath();
    fs(c, lg(c, -30, 0, 30, 0, [[0, '#1b1b1d'], [.35, '#5a5a60'], [.55, '#2c2c30'], [1, '#121214']]), INK, 3);
    ell(c, 0, -56, 28, 6); fs(c, '#c98b2a', INK, 3);
    ell(c, -6, -57, 9, 2); fs(c, 'rgba(255,230,160,.8)');
    c.strokeStyle = INK; c.lineWidth = 2.5; c.beginPath(); c.arc(0, -56, 30, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
  }
  function drawFire(c, x, y, s, t) {
    const f = Math.sin(t * 17) * .12 + Math.sin(t * 29 + 1) * .08;
    c.save(); c.translate(x, y); c.scale(s, s * (1 + f));
    const g = c.createRadialGradient(0, -8, 2, 0, -8, 30); g.addColorStop(0, 'rgba(255,200,90,.55)'); g.addColorStop(1, 'rgba(255,120,30,0)');
    c.fillStyle = g; c.beginPath(); c.arc(0, -8, 30, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(-14, 0); c.bezierCurveTo(-18, -14, -6, -18, -4, -30); c.bezierCurveTo(2, -20, 6, -24, 6, -34); c.bezierCurveTo(16, -20, 18, -8, 14, 0); c.closePath();
    fs(c, lg(c, 0, -34, 0, 0, [[0, '#ffd34d'], [.6, '#ff8a1f'], [1, '#d9420f']]));
    c.beginPath(); c.moveTo(-6, 0); c.bezierCurveTo(-8, -8, 0, -10, 1, -18); c.bezierCurveTo(6, -10, 8, -6, 6, 0); c.closePath(); fs(c, '#fff3b0');
    c.restore();
  }
  function drawEvap(c, t) {
    // lean-to roof
    c.beginPath(); c.moveTo(-62, -64); c.lineTo(58, -84); c.lineTo(62, -76); c.lineTo(-60, -56); c.closePath(); fs(c, '#6e4b2e', INK, 3);
    c.strokeStyle = '#5a3a20'; c.lineWidth = 5; c.beginPath(); c.moveTo(-54, -58); c.lineTo(-54, 0); c.moveTo(52, -78); c.lineTo(52, 0); c.stroke();
    // brick arch
    rr(c, -46, -30, 92, 30, 4); fs(c, '#a5452c', INK, 3);
    c.strokeStyle = 'rgba(51,33,15,.35)'; c.lineWidth = 1.5; c.beginPath();
    for (let r = 0; r < 3; r++) { c.moveTo(-46, -30 + r * 10); c.lineTo(46, -30 + r * 10); for (let x = -46 + (r % 2) * 9; x < 46; x += 18) { c.moveTo(x, -30 + r * 10); c.lineTo(x, -20 + r * 10); } }
    c.stroke();
    // fire door
    rr(c, -40, -22, 18, 16, 3); fs(c, '#1d1410', INK, 2);
    const fl = .6 + .4 * Math.sin(t * 13) * Math.sin(t * 7.3);
    c.fillStyle = 'rgba(255,' + Math.round(140 + 60 * fl) + ',40,' + (.7 + .3 * fl) + ')'; c.fillRect(-37, -14, 12, 7);
    // pans
    rr(c, -50, -40, 100, 11, 3); fs(c, lg(c, 0, -40, 0, -29, [[0, '#f2f6f8'], [1, '#8d9aa2']]), INK, 3);
    c.fillStyle = 'rgba(224,146,48,.85)'; c.fillRect(-46, -39, 40, 4); c.fillStyle = 'rgba(180,220,235,.9)'; c.fillRect(-4, -39, 50, 4);
    // stack
    rr(c, 36, -112, 10, 74, 2); fs(c, '#3d3f44', INK, 2.5);
  }
  function drawSugarhouse(c, t, lit) {
    // walls
    c.beginPath(); c.moveTo(-60, 0); c.lineTo(-60, -56); c.lineTo(60, -56); c.lineTo(60, 0); c.closePath();
    fs(c, lg(c, 0, -56, 0, 0, [[0, '#9c4a2c'], [1, '#7a3620']]), INK, 3);
    c.strokeStyle = 'rgba(51,33,15,.35)'; c.lineWidth = 1.5; c.beginPath(); for (let x = -50; x < 60; x += 10) { c.moveTo(x, -54); c.lineTo(x, -2); } c.stroke();
    // roof
    c.beginPath(); c.moveTo(-70, -52); c.lineTo(0, -92); c.lineTo(70, -52); c.closePath(); fs(c, '#4b545c', INK, 3);
    c.beginPath(); c.moveTo(-64, -54); c.lineTo(0, -88); c.lineTo(64, -54); c.lineTo(52, -54); c.lineTo(0, -82); c.lineTo(-52, -54); c.closePath(); fs(c, '#f4f8fb');
    // cupola
    c.beginPath(); c.rect(-14, -108, 28, 22); fs(c, '#8c4128', INK, 2.5);
    c.beginPath(); c.moveTo(-20, -106); c.lineTo(0, -122); c.lineTo(20, -106); c.closePath(); fs(c, '#4b545c', INK, 2.5);
    c.fillStyle = '#2a1a10'; c.fillRect(-10, -103, 20, 12);
    // door + window
    rr(c, -14, -38, 28, 38, 2); fs(c, '#5e2a17', INK, 2.5);
    rr(c, 26, -42, 22, 18, 2); fs(c, lit ? '#ffcf6a' : '#3a2a20', INK, 2.5);
    rr(c, -48, -42, 22, 18, 2); fs(c, lit ? '#ffcf6a' : '#3a2a20', INK, 2.5);
    if (lit) { c.globalAlpha = .25 + .1 * Math.sin(t * 3); ell(c, 37, -33, 22, 16); fs(c, '#ffd27a'); ell(c, -37, -33, 22, 16); fs(c, '#ffd27a'); c.globalAlpha = 1; }
    // woodpile
    for (let i = 0; i < 3; i++) for (let j = 0; j < 4 - i; j++) { ell(c, 72 + j * 8 + i * 4, -5 - i * 7, 4.5, 4.5); fs(c, '#c99a62', INK, 1.5); }
  }
  function drawRO(c, t, n) {
    n = n || 1;
    for (let i = 0; i < n; i++) {
      const x = -22 + i * 18 - (n - 1) * 4, h = 66 - i * 8;
      rr(c, x - 9, -h, 18, h, 8); fs(c, lg(c, x - 9, 0, x + 9, 0, [[0, '#7d8b93'], [.3, '#f6fafc'], [.55, '#c2ced5'], [1, '#6c7a82']]), INK, 2.5);
      c.strokeStyle = 'rgba(51,33,15,.4)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x - 9, -h + 14); c.lineTo(x + 9, -h + 14); c.moveTo(x - 9, -14); c.lineTo(x + 9, -14); c.stroke();
    }
    // glint
    const g = (t * .4) % 3; if (g < 1) { c.globalAlpha = Math.sin(g * Math.PI) * .9; star(c, -24, -54, 7, '#fff'); c.globalAlpha = 1; }
    rr(c, -40, -8, 70, 8, 2); fs(c, '#55646c', INK, 2);
  }
  function drawVacuum(c, t) {
    // little shed
    c.beginPath(); c.moveTo(-30, 0); c.lineTo(-30, -38); c.lineTo(0, -56); c.lineTo(30, -38); c.lineTo(30, 0); c.closePath(); fs(c, '#6b7f5a', INK, 3);
    c.beginPath(); c.moveTo(-36, -36); c.lineTo(0, -60); c.lineTo(36, -36); fs(c, null, '#3e463f', 6); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
    // gauge
    ell(c, 0, -26, 12, 12); fs(c, '#fbf4e4', INK, 2.5);
    const a = -2.3 + 1.2 + Math.sin(t * 2.1) * .25 + Math.sin(t * 7) * .05;
    c.strokeStyle = '#b5332b'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(0, -26); c.lineTo(Math.cos(a) * 9, -26 + Math.sin(a) * 9); c.stroke();
    // tube out
    c.strokeStyle = '#2f7fc4'; c.lineWidth = 4; c.beginPath(); c.moveTo(30, -8); c.quadraticCurveTo(46, -10, 52, -2); c.stroke();
  }
  function drawSled(c, t) {
    // runners
    c.strokeStyle = INK; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-44, -4); c.lineTo(38, -4); c.quadraticCurveTo(50, -4, 48, -14); c.stroke();
    c.strokeStyle = '#8a5a30'; c.lineWidth = 5; c.beginPath(); c.moveTo(-40, -10); c.lineTo(40, -10); c.stroke();
    // tank
    rr(c, -36, -46, 64, 34, 14); fs(c, lg(c, 0, -46, 0, -12, [[0, '#f1f5f7'], [.5, '#b5c3ca'], [1, '#7b8a92']]), INK, 3);
    c.globalAlpha = .7; rr(c, -30, -24, 52, 8, 4); fs(c, 'rgba(160,214,236,.9)'); c.globalAlpha = 1;
    rr(c, -8, -52, 14, 8, 2); fs(c, '#9aa6ac', INK, 2);
    // rope
    c.strokeStyle = '#d9b77c'; c.lineWidth = 2; c.beginPath(); c.moveTo(48, -14); c.quadraticCurveTo(60, -10 + Math.sin(t * 3) * 2, 70, -18); c.stroke();
  }
  function drawBarn(c, t) {
    c.beginPath(); c.moveTo(-40, 0); c.lineTo(-40, -36); c.lineTo(-26, -54); c.lineTo(0, -64); c.lineTo(26, -54); c.lineTo(40, -36); c.lineTo(40, 0); c.closePath();
    fs(c, '#b3392c', INK, 3);
    c.beginPath(); c.moveTo(-44, -34); c.lineTo(-28, -56); c.lineTo(0, -68); c.lineTo(28, -56); c.lineTo(44, -34); fs(c, null, '#e9eef2', 5); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
    rr(c, -14, -32, 28, 32, 2); fs(c, '#f4ead8', INK, 2.5);
    c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.moveTo(-14, -32); c.lineTo(14, 0); c.moveTo(14, -32); c.lineTo(-14, 0); c.stroke();
    // flag
    c.strokeStyle = INK; c.lineWidth = 2.5; c.beginPath(); c.moveTo(0, -66); c.lineTo(0, -96); c.stroke();
    c.beginPath(); c.moveTo(0, -96);
    for (let i = 0; i <= 6; i++) c.lineTo(i * 4.5, -96 + Math.sin(t * 5 + i * .9) * 2 * (i / 6));
    for (let i = 6; i >= 0; i--) c.lineTo(i * 4.5, -84 + Math.sin(t * 5 + i * .9) * 2 * (i / 6));
    c.closePath(); fs(c, '#ffc45c', INK, 2);
  }
  function drawWeather(c, t) {
    rr(c, -8, -70, 16, 70, 3); fs(c, '#6b7a84', INK, 2.5);
    ell(c, 0, -84, 28, 28); fs(c, '#fbf4e4', INK, 3);
    c.save(); c.translate(0, -84); c.rotate(t * .7);
    c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 24, 0, Math.PI); c.closePath(); fs(c, '#ffc45c');
    c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 24, Math.PI, TAU); c.closePath(); fs(c, '#a6d6ee');
    c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); for (let i = 0; i < 3; i++) { const a = Math.PI + .5 + i * .9; c.moveTo(0, 0); c.lineTo(Math.cos(a) * 18, Math.sin(a) * 18); } c.stroke();
    c.restore();
    ell(c, 0, -84, 5, 5); fs(c, INK);
    // antenna spark
    c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -112); c.lineTo(0, -126); c.stroke();
    if ((t * 1.3) % 2 < .3) star(c, 0, -128, 8, '#fff6b0');
  }
  function star(c, x, y, r, col) {
    c.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr2 = i % 2 ? r * .3 : r; c.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); } c.closePath(); c.fillStyle = col; c.fill();
  }
  /** a little pyramid of syrup jugs (rows of 4,3,2,1) on a wooden pallet */
  function drawJugPile(c, x, y, n, k) {
    const jw = 10 * k, jh = 13 * k;
    rr(c, x - 2.3 * jw, y - 2 * k, 4.6 * jw, 4 * k, 1.5 * k); fs(c, '#a8783f', INK, 1.5);
    let i = 0;
    for (let row = 0; row < 4 && i < n; row++) for (let j = 0; j < 4 - row && i < n; j++, i++) {
      const jx = x + (j - (3 - row) / 2) * jw * 1.05, jy = y - 2 * k - row * jh * .95, gj = grow('j' + i);
      c.save(); c.translate(jx, jy); c.scale(gj, gj); c.translate(-jx, -jy);
      c.beginPath(); c.moveTo(jx - jw * .42, jy); c.lineTo(jx - jw * .42, jy - jh * .62); c.lineTo(jx - jw * .2, jy - jh * .82); c.lineTo(jx + jw * .2, jy - jh * .82); c.lineTo(jx + jw * .42, jy - jh * .62); c.lineTo(jx + jw * .42, jy); c.closePath();
      fs(c, lg(c, jx - jw * .4, 0, jx + jw * .4, 0, [[0, '#a9560c'], [.4, '#f0a53a'], [1, '#9a4c0a']]), INK, 1.4);
      rr(c, jx - jw * .32, jy - jh * .5, jw * .64, jh * .28, 1); fs(c, '#fbf4e4');
      rr(c, jx - jw * .16, jy - jh, jw * .32, jh * .2, 1); fs(c, '#b5332b', INK, 1);
      c.restore();
    }
  }
  function drawLake(c, w, h, t) {
    ell(c, 0, 0, w, h); fs(c, lg(c, 0, -h, 0, h, [[0, '#d6a54b'], [.5, '#e7b960'], [1, '#b8822e']]), 'rgba(51,33,15,.6)', 2);
    c.globalAlpha = .7; c.strokeStyle = '#fff1c4'; c.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) { const x = Math.sin(t * .5 + i * 2) * w * .5, y = (i - 1.5) * h * .4; c.beginPath(); c.moveTo(x - w * .15, y); c.lineTo(x + w * .15, y); c.stroke(); }
    c.globalAlpha = 1;
  }

  // ================================================================ tree generation
  function growTree(seed, len, w, depth, spread) {
    const R = rng(seed), segs = [], tips = [];
    (function br(x, y, a, l, wd, d) {
      const bend = (R() - .5) * .25;
      const x2 = x + Math.cos(a) * l, y2 = y + Math.sin(a) * l;
      const mx = x + Math.cos(a + bend) * l * .5, my = y + Math.sin(a + bend) * l * .5;
      segs.push({ x, y, mx, my, x2, y2, w: wd, w2: wd * .7, d });
      if (d >= depth || l < 4) { tips.push({ x: x2, y: y2, a }); return; }
      const n = d < 2 ? 2 : (R() < .35 ? 3 : 2);
      for (let i = 0; i < n; i++) {
        const off = n === 2 ? (i ? 1 : -1) * (spread * (.6 + R() * .5)) : (i - 1) * spread * .9;
        br(x2, y2, a + off + (R() - .5) * .25, l * (.68 + R() * .14), wd * .7, d + 1);
      }
    })(0, 0, -Math.PI / 2 + (R() - .5) * .08, len, w, 0);
    return { segs, tips, R: rng(seed + 9) };
  }
  function paintTree(c, tree, opts) {
    opts = opts || {};
    const bark = opts.bark || '#5d4a3c', dark = opts.dark || '#3b2c22', lite = opts.lite || '#8a7462';
    c.lineCap = 'round'; c.lineJoin = 'round';
    // outline pass
    for (const s of tree.segs) {
      c.strokeStyle = INK; c.lineWidth = s.w + (opts.outline != null ? opts.outline : 3);
      c.beginPath(); c.moveTo(s.x, s.y); c.quadraticCurveTo(s.mx, s.my, s.x2, s.y2); c.stroke();
    }
    for (const s of tree.segs) {
      c.strokeStyle = s.d < 2 ? bark : s.d < 4 ? lg(c, s.x, s.y, s.x2, s.y2, [[0, bark], [1, lite]]) : lite;
      c.lineWidth = s.w;
      c.beginPath(); c.moveTo(s.x, s.y); c.quadraticCurveTo(s.mx, s.my, s.x2, s.y2); c.stroke();
    }
    // shading on left of thick segs + bark furrows
    for (const s of tree.segs) if (s.w > 7) {
      c.strokeStyle = dark; c.lineWidth = s.w * .28; c.globalAlpha = .55;
      const nx = -Math.sin(Math.atan2(s.y2 - s.y, s.x2 - s.x)) * s.w * .28, ny = Math.cos(Math.atan2(s.y2 - s.y, s.x2 - s.x)) * s.w * .28;
      c.beginPath(); c.moveTo(s.x - nx, s.y - ny); c.quadraticCurveTo(s.mx - nx, s.my - ny, s.x2 - nx, s.y2 - ny); c.stroke();
      c.globalAlpha = .35; c.lineWidth = Math.max(1, s.w * .06); c.strokeStyle = dark;
      for (let k = -1; k <= 1; k += 2) { c.beginPath(); c.moveTo(s.x + nx * k * .6, s.y + ny * k * .6); c.quadraticCurveTo(s.mx + nx * k * .4 + 2, s.my + ny * k * .4, s.x2 + nx * k * .5, s.y2 + ny * k * .5); c.stroke(); }
      c.globalAlpha = 1;
    }
    // buds
    if (opts.buds !== false) {
      const R = tree.R;
      for (const tp of tree.tips) {
        c.fillStyle = R() < .5 ? '#b5332b' : '#d2523c';
        c.beginPath(); c.arc(tp.x, tp.y, opts.bud || 1.8, 0, TAU); c.fill();
      }
    }
    // snow clumps on upward-facing mid branches
    if (opts.snow) {
      const R = rng(77);
      for (const s of tree.segs) if (s.d >= 1 && s.d <= 3 && R() < .35) {
        const t0 = .15 + R() * .45, t1 = Math.min(1, t0 + .2 + R() * .25), lift = s.w * .22;
        c.strokeStyle = 'rgba(247,251,253,.8)'; c.lineCap = 'round'; c.lineWidth = Math.max(1.5, s.w * .3);
        c.beginPath(); c.moveTo(lerp(s.x, s.x2, t0), lerp(s.y, s.y2, t0) - lift); c.lineTo(lerp(s.x, s.x2, t1), lerp(s.y, s.y2, t1) - lift); c.stroke();
      }
    }
  }

  // ================================================================ the Scene
  const S = { onAsset: null };
  let cv, cx, W = 0, H = 0, DPR = 1, k = 1;
  let bg = null, sky = null, treeL = null, bgKey = ''; // sky sits behind the clouds; bg (hills, trees, snow) in front
  let mainTree = null, sideL = null, sideR = null, midTrees = [];
  const L = {}; // layout
  const parts = [];   // particles
  const pops = [];    // number popups
  let squash = 0, bucketFill = .35, slosh = 0;
  let combo = 0, comboLife = 0, comboPunch = 0;
  let sledX = 0, sledDir = 1;
  let flyTo = null, shakeAmt = 0; // where tapped sap flies to (the HUD sap counter), in scene coords

  function init(canvas) { cv = canvas; cx = cv.getContext('2d'); loadAssets(); }
  function resize(w, h, dpr) {
    W = w; H = h; DPR = dpr;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    k = clamp(Math.min(w / 390, h / 360), .6, 2.2);
    const land = w > h * 1.25;
    L.horizon = h * (land ? .52 : .55);
    L.tx = w * (land ? .36 : .34); L.ty = h * .93;
    L.trunkW = 40 * k; L.treeLen = h * .27;
    L.spileX = L.tx + L.trunkW * .3; L.spileY = L.ty - h * .3;
    L.bucketS = .8 * k; L.bucketX = L.spileX + 12 * k; L.bucketY = L.spileY + 62 * L.bucketS;
    L.kettleX = w * (land ? .6 : .6); L.kettleY = h * .93;
    L.evapX = w * .8; L.evapY = h * .9;
    L.houseX = w * .84; L.houseY = h * .72;
    L.roX = w * .63; L.roY = h * .72;
    L.vacX = w * .1; L.vacY = h * .74;
    L.sledY = h * .86;
    L.barnX = w * .15; L.barnY = L.horizon + 4 * k;
    L.lakeX = w * .42; L.lakeY = L.horizon + 10 * k;
    L.wxX = w * .6; L.wxY = L.horizon - 26 * k;
    mainTree = growTree(11, L.treeLen, L.trunkW, 7, .5);
    sideL = growTree(23, h * .26, 16 * k, 6, .4);
    sideR = growTree(31, h * .2, 12 * k, 6, .45);
    midTrees = [];
    const R = rng(5);
    for (let i = 0; i < 8; i++) midTrees.push({ x: w * (.05 + i * .13 + (R() - .5) * .04), y: L.horizon + h * (.09 + R() * .03), s: .42 + R() * .14, tree: growTree(100 + i, h * .16, 8 * k, 5, .48) });
    bgKey = '';
  }

  // ---------------------------------------------------------------- time of day
  // An 8-minute loop: bright late-winter morning -> golden afternoon -> pink sugaring dusk -> golden -> morning.
  const TOD = [ // [phase, sky top, sky mid, horizon, warm tint alpha, sun height 0..1]
    [0, [134, 174, 203], [199, 219, 230], [245, 227, 200], 0, .35],
    [.35, [125, 160, 196], [226, 205, 178], [255, 214, 160], .06, .5],
    [.55, [96, 112, 160], [205, 160, 178], [255, 182, 140], .11, .72],
    [.8, [22, 30, 58], [44, 56, 92], [86, 82, 112], 0, 1],
    [1, [134, 174, 203], [199, 219, 230], [245, 227, 200], 0, .35]];
  let skyKey = '', tod = TOD[0], night = 0, tintNow = 0;
  function todAt(ph) {
    for (let i = 0; i < TOD.length - 1; i++) {
      const a = TOD[i], b = TOD[i + 1];
      if (ph <= b[0]) { const u = (ph - a[0]) / (b[0] - a[0]), m = (x, y) => x.map((v, j) => Math.round(lerp(v, y[j], u))); return [ph, m(a[1], b[1]), m(a[2], b[2]), m(a[3], b[3]), lerp(a[4], b[4], u), lerp(a[5], b[5], u)]; }
    }
    return TOD[0];
  }
  const rgb = a => 'rgb(' + a.join(',') + ')';
  function paintSky(t) {
    if (!sky || IMG.backdrop) return;
    const z = new Date(), h = S.hour != null ? S.hour : z.getHours() + z.getMinutes() / 60;
    const ph = h < 5 ? .8 : h < 7 ? .8 + (h - 5) / 2 * .2 : h < 11 ? 0 : h < 15 ? (h - 11) / 4 * .35 : h < 18.5 ? .35 + (h - 15) / 3.5 * .2 : h < 20.5 ? .55 + (h - 18.5) / 2 * .25 : .8, key = W + '|' + H + '|' + Math.round(ph * 200);
    if (key === skyKey) return; skyKey = key; tod = todAt(ph);
    const k2 = sky.getContext('2d'); k2.setTransform(DPR, 0, 0, DPR, 0, 0);
    k2.fillStyle = lg(k2, 0, 0, 0, L.horizon, [[0, rgb(tod[1])], [.55, rgb(tod[2])], [1, rgb(tod[3])]]); k2.fillRect(0, 0, W, L.horizon + 40);
    night = clamp((ph - .55) / .25, 0, 1) * (ph <= .8 ? 1 : 1 - (ph - .8) / .2);
    if (night > .3) { const R = rng(77); k2.fillStyle = '#fff8e0'; for (let i = 0; i < 60; i++) { k2.globalAlpha = (night - .3) * (.4 + .6 * R()); ell(k2, R() * W, R() * L.horizon * .8, .6 + R() * 1.1, .6 + R() * 1.1); k2.fill(); } k2.globalAlpha = 1; }
    if (night > .6) { ell(k2, W * .2, L.horizon * .22, 11 * k, 11 * k); fs(k2, '#f4f0dc'); ell(k2, W * .2 + 4 * k, L.horizon * .22 - 3 * k, 9 * k, 9 * k); fs(k2, rgb(tod[1])); return; } // crescent moon, no sun
    const sx = W * (.82 - tod[5] * .1), sy = L.horizon * tod[5];
    const sg = k2.createRadialGradient(sx, sy, 4, sx, sy, W * .5);
    sg.addColorStop(0, 'rgba(255,246,214,.95)'); sg.addColorStop(.12, 'rgba(255,226,180,.55)'); sg.addColorStop(1, 'rgba(255,220,180,0)');
    k2.fillStyle = sg; k2.fillRect(0, 0, W, L.horizon + 40);
    ell(k2, sx, sy, 14 * k, 14 * k); fs(k2, tod[5] > .6 ? '#ffe2b8' : '#fffaf0');
  }

  /** at night the fires and windows glow through the dark */
  function drawNightGlows(c, st, t) {
    const glow = (x, y, r, a) => { const g = c.createRadialGradient(x, y, 1, x, y, r); g.addColorStop(0, 'rgba(255,190,90,' + a + ')'); g.addColorStop(1, 'rgba(255,170,70,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
    c.globalCompositeOperation = 'lighter';
    const nk = Math.min(5, vis(st, 'kettle')); for (let i = 0; i < Math.min(3, nk); i++) glow(L.kettleX - i * 30 * k, L.kettleY - 4 * k, 26 * k, .35 * night * (.85 + .15 * Math.sin(t * 9 + i)));
    if (vis(st, 'evap')) glow(L.evapX - 8 * k, L.evapY - 8 * k, 34 * k, .35 * night);
    if (vis(st, 'sugarhouse')) glow(L.houseX, L.houseY - 20 * k, 52 * k, .3 * night);
    c.globalCompositeOperation = 'source-over';
  }

  /** Static backdrop, re-rendered when the visible-producer key changes. */
  function renderBg(st) {
    const farHouses = (vis(st, 'sugarhouse') >= 10) + (vis(st, 'sugarhouse') >= 25);
    const key = [W, H, vis(st, 'sugarbush'), vis(st, 'tubing'), vis(st, 'pipeline'), vis(st, 'reservoir'), vis(st, 'coop'), farHouses].join('|');
    if (key === bgKey && bg) return;
    bgKey = key;
    bg = bg || document.createElement('canvas'); sky = sky || document.createElement('canvas');
    treeL = treeL || document.createElement('canvas'); treeL.width = cv.width; treeL.height = cv.height;
    bg.width = cv.width; bg.height = cv.height; sky.width = cv.width; sky.height = Math.ceil((L.horizon + 40) * DPR);
    let c = bg.getContext('2d'); c.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (IMG.backdrop) { c.drawImage(IMG.backdrop, 0, 0, W, H); sky.height = 1; }
    else {
      skyKey = ''; // the sky itself is painted by paintSky (time of day)
      // far mountains
      ridge(c, L.horizon - 60 * k, 34 * k, 3, '#93a9ba', '#eef4f8', .6);
      ridge(c, L.horizon - 26 * k, 22 * k, 7, '#7c95a3', '#e9f0f4', .45);
      // pipeline up the mountain
      const np = vis(st, 'pipeline');
      if (np) for (let i = 0; i < Math.min(3, np); i++) {
        c.strokeStyle = INK; c.lineWidth = 4.5; c.beginPath(); pipePath(c, i); c.stroke();
        c.strokeStyle = '#aab6bd'; c.lineWidth = 2.5; c.beginPath(); pipePath(c, i); c.stroke();
      }
      // mid hills
      c.beginPath(); c.moveTo(0, L.horizon + 6 * k);
      for (let x = 0; x <= W; x += 8) c.lineTo(x, L.horizon + 4 * k - Math.sin(x / W * 5 + 1) * 10 * k - Math.sin(x / W * 13) * 4 * k);
      c.lineTo(W, H); c.lineTo(0, H); c.closePath(); fs(c, '#6f8473');
      // sugarbush grove on the hills
      const nb = vis(st, 'sugarbush');
      const R = rng(9);
      const grove = nb ? Math.min(42, 6 + Math.floor(Math.log2(nb + 1) * 6)) : 0;
      for (let i = 0; i < 26 + grove; i++) {
        const x = R() * W, y = L.horizon + (R() * 10 - 2) * k - Math.sin(x / W * 5 + 1) * 10 * k;
        const isMaple = i >= 26;
        c.strokeStyle = isMaple ? '#6a4a3a' : '#4d5f55'; c.lineWidth = 1.2;
        const hgt = (isMaple ? 16 : 10 + R() * 6) * k;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - hgt);
        for (let j = 0; j < 4; j++) { const yy = y - hgt * (.4 + j * .15); c.moveTo(x, yy); c.lineTo(x + (j % 2 ? 1 : -1) * hgt * .3, yy - hgt * .2); }
        c.stroke();
        if (isMaple) { c.fillStyle = 'rgba(181,51,43,.6)'; c.beginPath(); c.arc(x, y - hgt, 2.4 * k, 0, TAU); c.fill(); }
      }
      // snow fields with melt
      c.beginPath(); c.moveTo(0, L.horizon + 18 * k);
      for (let x = 0; x <= W; x += 10) c.lineTo(x, L.horizon + 16 * k + Math.sin(x / W * 7 + 2) * 6 * k);
      c.lineTo(W, H); c.lineTo(0, H); c.closePath();
      fs(c, lg(c, 0, L.horizon, 0, H, [[0, '#e2ebf0'], [.5, '#f4f8fa'], [1, '#dfe8ee']]));
      // lake (reservoir) on the plain
      const nr = vis(st, 'reservoir');
      if (nr) { c.save(); c.translate(L.lakeX, L.lakeY + 8 * k); drawLake(c, (40 + Math.min(60, Math.log2(nr + 1) * 14)) * k, 7 * k, 0); c.restore(); }
      // mud and grass patches
      const R2 = rng(42);
      for (let i = 0; i < 16; i++) {
        const x = R2() * W, y = lerp(L.horizon + 30 * k, H * .98, R2()), rx = (12 + R2() * 30) * k * (y / H), ry = rx * .28;
        ell(c, x, y, rx + 2, ry + 2); fs(c, 'rgba(255,255,255,.6)');
        ell(c, x, y, rx, ry); fs(c, '#7b5c43');
        ell(c, x - rx * .2, y - ry * .2, rx * .7, ry * .6); fs(c, '#8e6d50');
        if (R2() < .6) { c.strokeStyle = '#8a9a5a'; c.lineWidth = 1.4; c.beginPath(); for (let g = 0; g < 5; g++) { const gx = x - rx * .5 + g * rx * .25; c.moveTo(gx, y); c.lineTo(gx + (R2() - .5) * 4, y - 4 * k - R2() * 3 * k); } c.stroke(); }
      }
      // puddles
      for (let i = 0; i < 4; i++) {
        const x = R2() * W, y = lerp(L.horizon + 40 * k, H * .95, R2()), rx = (14 + R2() * 18) * k;
        ell(c, x, y, rx, rx * .22); fs(c, lg(c, 0, y - 4, 0, y + 4, [[0, '#a9cde0'], [1, '#d9ecf5']]), 'rgba(80,60,40,.5)', 1.5);
        c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x - rx * .4, y - 1); c.lineTo(x + rx * .1, y - 1); c.stroke();
      }
    }
    // tubing between mid trees
    const nt = vis(st, 'tubing');
    // far-off sugarhouses on the hills: small and hazed into the distance, behind the near maples
    for (let j = 0; j < farHouses; j++) {
      c.save(); c.translate(W * (j ? .93 : .72), L.horizon + (j ? 8 : 4) * k); c.scale(.15 * k, .15 * k); drawSugarhouse(c, 0, true); c.restore();
      c.globalAlpha = .35; ell(c, W * (j ? .93 : .72), L.horizon + (j ? 2 : -2) * k, 13 * k, 11 * k); fs(c, '#b9cad6'); c.globalAlpha = 1;
    }
    // mid trees
    for (const m of midTrees) { c.save(); c.translate(m.x, m.y); c.scale(m.s, m.s); paintTree(c, m.tree, { outline: 0, bud: 2.2, bark: '#7d6f66', lite: '#9d918a', dark: '#6a5d55' }); c.restore(); shadow(c, m.x, m.y, 16 * k * m.s); }
    if (nt) {
      const lines = Math.min(5, 1 + Math.floor(nt / 10));
      for (let l = 0; l < lines; l++) {
        c.strokeStyle = '#1f5f96'; c.lineWidth = 2.6; c.beginPath();
        for (let i = 0; i < midTrees.length - 1; i++) {
          const a = midTrees[i], b = midTrees[i + 1], ya = a.y - (16 + l * 5) * k * a.s, yb = b.y - (14 + l * 5) * k * b.s;
          c.moveTo(a.x, ya); c.quadraticCurveTo((a.x + b.x) / 2, (ya + yb) / 2 + 8 * k, b.x, yb);
        }
        c.stroke();
        c.strokeStyle = 'rgba(160,215,245,.8)'; c.lineWidth = 1; c.stroke();
      }
    }
    // side trees
    c.save(); c.translate(W * .03, H * 1.0); paintTree(c, sideL, { snow: true }); c.restore();
    c.save(); c.translate(W * .985, H * .8); paintTree(c, sideR, { snow: true, bud: 1.5 }); c.restore();
    // big tree (own layer: it flexes when you tap it)
    c = treeL.getContext('2d'); c.setTransform(DPR, 0, 0, DPR, 0, 0);
    shadow(c, L.tx, L.ty, 42 * k);
    if (IMG.tree) { const ih = H * .98; c.drawImage(IMG.tree, L.tx - ih * .5, L.ty - ih, ih, ih); }
    else { c.save(); c.translate(L.tx, L.ty); paintTree(c, mainTree, { snow: true, bud: 2.3, outline: 3.5 }); c.restore(); }
    // snow ring around trunk base (melting)
    ell(c, L.tx, L.ty + 2, 36 * k, 7 * k); fs(c, 'rgba(110,80,55,.85)');
    ell(c, L.tx + 4, L.ty + 1, 26 * k, 4.5 * k); fs(c, '#6a4c36');
  }
  function shadow(c, x, y, r) { ell(c, x, y + 1, r, r * .22); fs(c, 'rgba(60,80,100,.18)'); }
  function ridge(c, y, amp, seed, col, snow, snowLine) {
    const R = rng(seed); const pts = [];
    let x = -20; while (x < W + 40) { pts.push([x, y - R() * amp - (Math.sin(x / W * 3 + seed) * .5 + .5) * amp]); x += (18 + R() * 30) * k; }
    c.beginPath(); c.moveTo(-20, y + 60); pts.forEach(p => c.lineTo(p[0], p[1])); c.lineTo(W + 40, y + 60); c.closePath(); fs(c, col);
    // snow caps
    c.save(); c.clip();
    c.beginPath(); c.moveTo(-20, y + 60); pts.forEach(p => c.lineTo(p[0], p[1])); c.lineTo(W + 40, y + 60); c.closePath();
    c.fillStyle = snow; c.globalAlpha = .9;
    for (const p of pts) { c.beginPath(); c.moveTo(p[0] - 14 * k, p[1] + 10 * k); c.lineTo(p[0], p[1]); c.lineTo(p[0] + 16 * k, p[1] + 12 * k); c.lineTo(p[0] + 4 * k, p[1] + 8 * k); c.closePath(); c.fill(); }
    c.restore(); c.globalAlpha = 1;
  }
  function pipePath(c, i) {
    const x0 = W * (.98 - i * .04), y0 = L.horizon - 70 * k;
    c.moveTo(x0, y0); c.quadraticCurveTo(W * (.86 - i * .03), L.horizon - 30 * k, W * (.78 - i * .02), L.horizon + 10 * k);
  }
  function vis(st, id) { return (st && st.owned && st.owned[id]) || 0; }
  /** how many of something to draw: one each for the first `lin`, then slower (log) growth up to `max` */
  // things you buy pop into the scene: scale 0 -> overshoot -> 1 over half a second (nothing pops on first load)
  const born = {}; let popReady = false, ownedSum = 0;
  const easeBack = u => 1 + 2.7 * Math.pow(u - 1, 3) + 1.7 * Math.pow(u - 1, 2);
  function grow(key) {
    let b = born[key]; if (b === undefined) b = born[key] = popReady ? lastT : -9;
    const u = (lastT - b) / .5; return u >= 1 ? 1 : Math.max(.01, easeBack(clamp(u, 0, 1)));
  }
  function shown(n, lin, max) { return Math.min(max, n <= lin ? n : Math.floor(lin + (max - lin) * Math.log(n / lin) / Math.log(100 / lin))); }

  // ---------------------------------------------------------------- per-frame drawing
  let lastT = 0, dripAcc = 0, steamAcc = 0;
  function frame(t, st, d, ev) {
    const dt = clamp(t - lastT, 0, .1); lastT = t;
    renderBg(st);
    // screen shake for big moments: a few px, gone in ~150 ms
    shakeAmt *= Math.pow(.002, dt);
    if (shakeAmt > .15) { const a = shakeAmt * k, sg = () => (Math.random() < .5 ? -1 : 1) * (.6 + .4 * Math.random()); cx.setTransform(DPR, 0, 0, DPR, sg() * a * DPR, sg() * a * .7 * DPR); }
    if (st && st.owned) { let n = 0; for (const id in st.owned) n += st.owned[id]; if (n < ownedSum) for (const key in born) delete born[key]; ownedSum = n; }
    const c = cx; if (shakeAmt <= .15) c.setTransform(DPR, 0, 0, DPR, 0, 0);
    c.clearRect(-20, -20, W + 40, H + 40);
    paintSky(t);
    if (sky.height > 1) c.drawImage(sky, 0, 0, sky.width, sky.height, 0, 0, W, sky.height / DPR);
    // clouds (behind the hills and trees): soft, layered puffs
    for (let i = 0; i < 3; i++) {
      const x = ((t * (4 + i * 2) * k + i * W * .45) % (W + 160 * k)) - 80 * k, y = H * (.3 + i * .055), s2 = 1 - i * .15;
      c.globalAlpha = .5 - i * .08; c.fillStyle = '#fff';
      ell(c, x, y, 34 * k * s2, 8 * k * s2); c.fill(); ell(c, x + 14 * k * s2, y - 6 * k * s2, 18 * k * s2, 9 * k * s2); c.fill(); ell(c, x - 12 * k * s2, y - 3 * k * s2, 13 * k * s2, 7 * k * s2); c.fill();
      c.globalAlpha = .22; c.fillStyle = '#9fb4c4'; ell(c, x + 2 * k, y + 4 * k * s2, 30 * k * s2, 3 * k * s2); c.fill();
    }
    c.globalAlpha = 1;
    // squash & stretch the tree on tap
    squash *= Math.pow(.0005, dt);
    c.drawImage(bg, 0, 0, bg.width, bg.height, 0, 0, W, H);
    if (squash > .002) {
      const sx = 1 + squash * .05, sy = 1 - squash * .035;
      c.save(); c.translate(L.tx, L.ty); c.scale(sx, sy); c.translate(-L.tx, -L.ty);
      c.drawImage(treeL, 0, 0, treeL.width, treeL.height, 0, 0, W, H); c.restore();
    } else c.drawImage(treeL, 0, 0, treeL.width, treeL.height, 0, 0, W, H);


    const frenzy = d && d.frenzy > 1;
    // producers presence ------------------------------------------------
    const nb = vis(st, 'bag'), ns = vis(st, 'spile');
    // extra buckets on side trees + mid trees
    const bucketSpots = bucketSlots();
    for (let i = 0, n = shown(ns, 8, bucketSpots.length); i < n; i++) {
      const b = bucketSpots[i];
      const g = grow('b' + i);
      c.save(); c.translate(b.x, b.y); c.scale(b.s * g * (b.flip ? -1 : 1), b.s * g); drawSpout(c); c.translate(8, 70); c.scale(.55, .55); drawBucket(c, { lid: i % 3 === 1, fill: .5 }); c.restore();
      if (Math.random() < dt * (frenzy ? 4 : .8)) parts.push({ k: 'drip', x: b.x + 6 * b.s * (b.flip ? -1 : 1), y: b.y + 8 * b.s, vy: 0, to: b.y + 40 * b.s, life: 1 });
    }
    const bagSpots = bagSlots();
    for (let i = 0, n = shown(nb, 4, bagSpots.length); i < n; i++) {
      const b = bagSpots[i], g = grow('g' + i); c.save(); c.translate(b.x, b.y); c.scale(b.s * g, b.s * g); drawBag(c); c.restore();
    }
    // vacuum shed
    if (vis(st, 'vacuum')) { const g = grow('vac'); c.save(); c.translate(L.vacX, L.vacY); c.scale(.55 * k * g, .55 * k * g); drawVacuum(c, t); c.restore(); }
    // weather machine on the far hill
    if (vis(st, 'weather')) { const g = grow('wx'); c.save(); c.translate(L.wxX, L.wxY + 30 * k); c.scale(.32 * k * g, .32 * k * g); drawWeather(c, t); c.restore(); }
    // coop barn
    if (vis(st, 'coop')) { const g = grow('barn'); c.save(); c.translate(L.barnX, L.barnY + 8 * k); c.scale(.36 * k * g, .36 * k * g); drawBarn(c, t); c.restore(); }
    // reservoir shimmer
    if (vis(st, 'reservoir')) {
      c.globalAlpha = .6; c.strokeStyle = '#fff6d0'; c.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) { const x = L.lakeX + Math.sin(t * .6 + i * 2.1) * 30 * k, y = L.lakeY + 6 * k + (i - 1) * 3 * k; c.beginPath(); c.moveTo(x - 6 * k, y); c.lineTo(x + 6 * k, y); c.stroke(); }
      c.globalAlpha = 1;
    }
    // pipeline sap pulses
    if (vis(st, 'pipeline')) {
      const ph = (t * .35) % 1; const p = qpt(W * .98, L.horizon - 70 * k, W * .86, L.horizon - 30 * k, W * .78, L.horizon + 10 * k, ph);
      ell(c, p[0], p[1], 2.4, 2.4); fs(c, '#bfe8fa', INK, 1);
    }
    // tubing droplets moving downhill
    const nt = vis(st, 'tubing');
    if (nt) {
      for (let i = 0; i < midTrees.length - 1; i++) {
        const a = midTrees[i], b = midTrees[i + 1]; const ph = (t * .5 + i * .37) % 1;
        const ya = a.y - 16 * k * a.s, yb = b.y - 14 * k * b.s;
        const p = qpt(a.x, ya, (a.x + b.x) / 2, (ya + yb) / 2 + 8 * k, b.x, yb, ph);
        ell(c, p[0], p[1], 1.8, 1.8); fs(c, '#d8f4ff');
      }
    }
    // RO rig
    const nro = vis(st, 'ro');
    if (nro) { const g = grow('ro'); c.save(); c.translate(L.roX, L.roY); c.scale(.5 * k * g, .5 * k * g); drawRO(c, t, Math.min(3, 1 + Math.floor(nro / 10))); c.restore(); }
    // sugarhouse with steam
    const nh = vis(st, 'sugarhouse');
    if (nh) {
      const g = grow('house'); c.save(); c.translate(L.houseX, L.houseY); c.scale(.62 * k * g, .62 * k * g); drawSugarhouse(c, t, true); c.restore();
      steamAcc += dt * Math.min(6, 2 + Math.log2(nh + 1) * .6) * (frenzy ? 1.6 : 1);
      while (steamAcc > 1) { steamAcc -= 1; parts.push({ k: 'steam', x: L.houseX + (Math.random() - .5) * 10 * k, y: L.houseY - 66 * k, vx: (3 + Math.random() * 6) * k, vy: -(14 + Math.random() * 10) * k, r: 4 * k, life: 1, max: 2.2 + Math.random() * .8 }); }
    }
    // steam from the far-off sugarhouses (the buildings themselves are baked into the backdrop)
    if (nh >= 10) for (let j = 0; j < 1 + (nh >= 25); j++) {
      if (Math.random() < dt * 1.2) parts.push({ k: 'steam', x: W * (j ? .93 : .72), y: L.horizon - (j ? 3 : 7) * k, vx: 1.5 * k, vy: -6 * k, r: 1.6 * k, life: 1, max: 1.8 });
    }
    // the syrup you've made, stacked in jugs by the sugarhouse door (grows on a log scale)
    const jugs = st && st.syrup >= 1 ? Math.min(10, 1 + Math.floor(Math.log10(st.syrup) * .9)) : 0;
    if (jugs) drawJugPile(c, W * .9, H - 24 * k, jugs, k);
    // evaporator
    if (vis(st, 'evap')) {
      const g = grow('evap'); c.save(); c.translate(L.evapX, L.evapY); c.scale(.5 * k * g, .5 * k * g); drawEvap(c, t); c.restore();
      if (Math.random() < dt * 3) parts.push({ k: 'steam', x: L.evapX + (Math.random() - .5) * 30 * k, y: L.evapY - 22 * k, vx: 2 * k, vy: -10 * k, r: 4 * k, life: 1, max: 2 });
      if (Math.random() < dt * 1.2) parts.push({ k: 'smoke', x: L.evapX + 21 * k, y: L.evapY - 56 * k, vx: 4 * k, vy: -12 * k, r: 3 * k, life: 1, max: 2.5 });
    }
    // sled going back and forth along the bottom
    const nsl = vis(st, 'sled');
    if (nsl) {
      sledX += sledDir * dt * 16 * k; const lo = W * .08, hi = W * .55;
      if (sledX < lo) { sledX = lo; sledDir = 1; } if (sledX > hi) { sledX = hi; sledDir = -1; }
      // more sleds join the shuttle as you buy more (further back, smaller, out of step)
      for (let j = Math.min(2, (nsl >= 15) + (nsl >= 40)); j >= 1; j--) {
        const ph = (t * .05 + j * .37) % 2, u = ph < 1 ? ph : 2 - ph, dir = ph < 1 ? 1 : -1;
        const g = grow('sl' + j); c.save(); c.translate(lerp(W * .1, W * .52, u), L.sledY - 14 * k * j); c.scale(dir * (.48 - .08 * j) * k * g, (.48 - .08 * j) * k * g); drawSled(c, t + j); c.restore();
      }
      const g0 = grow('sl0'); c.save(); c.translate(sledX, L.sledY); c.scale(sledDir * .48 * k * g0, .48 * k * g0); drawSled(c, t); c.restore();
    }

    // kettles
    const nk = vis(st, 'kettle');
    for (let i = Math.min(5, shown(nk, 3, 5)) - 1; i >= 0; i--) { // back row (4th, 5th) first
      const back = i >= 3, j = back ? i - 3 : i;
      const kx = back ? L.kettleX - 15 * k - j * 30 * k : L.kettleX - i * 30 * k, ky = back ? L.kettleY - 20 * k - j * 5 * k : L.kettleY - i * 6 * k, s = back ? (.3 - j * .04) * k : (.42 - i * .06) * k;
      const g = grow('k' + i); c.save(); c.translate(kx, ky); c.scale(s * g, s * g); drawKettle(c, t + i, true); c.restore();
      if (Math.random() < dt * 2.2) parts.push({ k: 'steam', x: kx + (Math.random() - .5) * 10 * s, y: ky - 60 * s, vx: 1.5 * k, vy: -9 * k, r: 3.5 * k, life: 1, max: 1.6 });
    }
    // main spile + bucket (the player's) ------------------------------------
    c.save(); c.translate(L.spileX, L.spileY); c.scale(.9 * k, .9 * k); drawSpout(c); c.restore();
    slosh *= Math.pow(.02, dt);
    c.save(); c.translate(L.bucketX, L.bucketY); c.rotate(Math.sin(t * 18) * slosh * .06); c.scale(L.bucketS, L.bucketS);
    if (IMG.bucket) c.drawImage(IMG.bucket, -32, -62, 64, 64); else drawBucket(c, { fill: bucketFill });
    c.restore();
    // ambient drips from the main spile
    dripAcc += dt * clamp(.5 + (d ? Math.log10(1 + d.sapPs) * .6 : 0), .5, 4) * (frenzy ? 3 : 1);
    while (dripAcc > 1) { dripAcc -= 1; spawnDrop(false); }

    // particles ------------------------------------------------------------
    if (parts.length > 400) parts.splice(0, parts.length - 400);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (p.k === 'drop' || p.k === 'drip') {
        p.vy += 900 * k * dt; p.y += p.vy * dt;
        const r = p.k === 'drop' ? 3.6 * k : 1.8 * k;
        c.beginPath(); c.moveTo(p.x, p.y - r * 2.2); c.quadraticCurveTo(p.x + r, p.y - r * .3, p.x, p.y + r); c.quadraticCurveTo(p.x - r, p.y - r * .3, p.x, p.y - r * 2.2);
        fs(c, p.gold ? '#ffcf6a' : '#c9ecfa', p.k === 'drop' ? '#1d3f52' : null, 1.5);
        if (p.y >= p.to) {
          parts.splice(i, 1);
          if (p.k === 'drop') { parts.push({ k: 'ring', x: p.x, y: p.to, r: 2, life: 1, max: .45 }); bucketFill = clamp(bucketFill + .015, .2, 1); slosh = Math.min(1, slosh + .25); if (bucketFill >= 1) bucketFill = .35; for (let j = 0; j < 3; j++) parts.push({ k: 'spl', x: p.x, y: p.to, vx: (Math.random() - .5) * 90 * k, vy: -(60 + Math.random() * 60) * k, life: 1, max: .35 }); }
        }
        continue;
      }
      if (p.k === 'fly') {
        p.u += dt / p.dur;
        if (p.u < 0) continue;
        if (!flyTo || p.u >= 1) {
          parts.splice(i, 1);
          if (flyTo) { parts.push({ k: 'ring', x: flyTo.x, y: flyTo.y + 4, r: 2, life: 1, max: .3 }); if (S.onFly) S.onFly(p.gold); }
          continue;
        }
        const e = p.u * p.u * (1.6 - .6 * p.u); // ease in: launch slow, arrive fast
        for (let tr = 2; tr >= 0; tr--) {
          const ee = Math.max(0, e - tr * .06), q = qpt(p.x0, p.y0, p.cx, p.cy, flyTo.x, flyTo.y, ee), r = (5 - tr * 1.3) * k * (1 - ee * .4);
          c.globalAlpha = tr ? .35 / tr : 1;
          c.beginPath(); c.moveTo(q[0], q[1] - r * 1.9); c.quadraticCurveTo(q[0] + r, q[1] - r * .2, q[0], q[1] + r); c.quadraticCurveTo(q[0] - r, q[1] - r * .2, q[0], q[1] - r * 1.9);
          fs(c, p.gold ? '#ffcf6a' : '#e4f7ff', tr ? null : '#1d3f52', 1.8);
        }
        c.globalAlpha = 1;
        continue;
      }
      p.life -= dt / (p.max || 1);
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      const a = p.life;
      if (p.k === 'steam' || p.k === 'smoke') {
        p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * 6 * k;
        c.globalAlpha = (p.k === 'steam' ? .55 : .35) * Math.sin(a * Math.PI);
        ell(c, p.x, p.y, p.r, p.r * .85); fs(c, p.k === 'steam' ? '#ffffff' : '#7a8088'); c.globalAlpha = 1;
      } else if (p.k === 'ring') {
        c.globalAlpha = a; c.strokeStyle = '#ffffff'; c.lineWidth = 1.5; ell(c, p.x, p.y, 4 + (1 - a) * 14 * k, (4 + (1 - a) * 14 * k) * .3); c.stroke(); c.globalAlpha = 1;
      } else if (p.k === 'ripple') {
        c.globalAlpha = a * .8; c.strokeStyle = p.col || '#fff'; c.lineWidth = 3 * a + .5; c.beginPath(); c.arc(p.x, p.y, (1 - a) * 40 * k + 6, 0, TAU); c.stroke(); c.globalAlpha = 1;
      } else if (p.k === 'spl') {
        p.vy += 500 * k * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        ell(c, p.x, p.y, 1.6 * k, 1.6 * k); fs(c, '#c9ecfa');
      } else if (p.k === 'spark') {
        p.vx *= .96; p.vy = p.vy * .96 + 40 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        c.globalAlpha = a; star(c, p.x, p.y, p.r * (.5 + a * .5), p.col || '#fff6b0'); c.globalAlpha = 1;
      } else if (p.k === 'fall') {
        p.vy += 300 * k * dt; p.y += p.vy * dt; p.x += Math.sin(t * 3 + p.ph) * .3;
        ell(c, p.x, p.y, 2 * k, 2.6 * k); fs(c, '#c9ecfa', 'rgba(29,63,82,.6)', 1);
      }
    }
    tintNow += ((frenzy ? 0 : tod[4]) - tintNow) * Math.min(1, dt * 2.5);
    if (tintNow > .005) { c.globalCompositeOperation = 'soft-light'; c.globalAlpha = Math.min(1, tintNow * 4); c.fillStyle = '#ff8a3a'; c.fillRect(0, 0, W, H); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
    if (night > .02) { const y0 = L.horizon - 90 * k; c.globalAlpha = night * .38; c.fillStyle = lg(c, 0, y0, 0, y0 + 60 * k, [[0, 'rgba(24,34,74,0)'], [1, 'rgba(24,34,74,1)']]); c.fillRect(0, y0, W, H - y0); c.globalAlpha = 1; drawNightGlows(c, st, t); }
    // sparkle bucket event -------------------------------------------------
    if (ev) drawSparkleBucket(c, t, ev);
    // frenzy tint
    if (frenzy) { c.globalAlpha = .12 + .05 * Math.sin(t * 4); c.fillStyle = '#ffb43c'; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
    // tap streak counter beside the bucket, grows with the streak
    comboLife -= dt; comboPunch *= Math.pow(.001, dt);
    if (combo >= 5 && comboLife > 0) {
      const a = Math.min(1, comboLife / .25), sz = (16 + Math.min(combo, 60) * .25) * k * (1 + comboPunch * .35);
      c.globalAlpha = a; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = '400 ' + Math.round(sz) + 'px "Alfa Slab One", Georgia, serif';
      const x = L.bucketX + 46 * k, y = L.bucketY - 30 * k;
      c.lineWidth = 5; c.strokeStyle = 'rgba(40,24,10,.9)'; c.lineJoin = 'round'; c.strokeText('×' + combo, x, y);
      c.fillStyle = combo >= 60 ? '#ff7a3c' : combo >= 25 ? '#ffb43c' : combo >= 10 ? '#ffd36e' : '#fff6e4'; c.fillText('×' + combo, x, y);
      c.font = '800 ' + Math.round(11.5 * k) + 'px Manrope, sans-serif'; c.lineWidth = 3.5; const lbl = combo >= 60 ? 'BLAZING · ×2' : combo >= 25 ? 'HOT · ×1.5' : 'STREAK'; c.strokeText(lbl, x, y + sz * .62); c.fillStyle = combo >= 60 ? '#ff7a3c' : combo >= 25 ? '#ffb43c' : '#fff6e4'; c.fillText(lbl, x, y + sz * .62);
      c.globalAlpha = 1;
    }
    popReady = true;
    // number pops (on top)
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i]; p.life -= dt / p.max; if (p.life <= 0) { pops.splice(i, 1); continue; }
      const e = easeOut(1 - p.life);
      const y = Math.max((S.popTop || 0) + p.size * k * .6, p.y - e * 46 * k), sc = p.life > .85 ? 1 + (p.life - .85) * 3 : 1;
      c.globalAlpha = Math.min(1, p.life * 2.2);
      c.font = '400 ' + Math.round(p.size * k * sc) + 'px "Alfa Slab One", Georgia, serif';
      if (p.w == null) p.w = c.measureText(p.text).width / sc;
      const px = clamp(p.x, p.w / 2 + 8, W - p.w / 2 - 8); // keep long pops on screen
      c.save(); c.translate(px, y); if (p.rot) c.rotate(p.rot * p.life);
      c.lineWidth = 5; c.strokeStyle = 'rgba(40,24,10,.92)'; c.lineJoin = 'round'; c.strokeText(p.text, 0, 0);
      c.fillStyle = p.col; c.fillText(p.text, 0, 0);
      c.restore();
      c.globalAlpha = 1;
    }
  }
  function qpt(x0, y0, x1, y1, x2, y2, t) { const u = 1 - t; return [u * u * x0 + 2 * u * t * x1 + t * t * x2, u * u * y0 + 2 * u * t * y1 + t * t * y2]; }

  function bucketSlots() {
    if (S._bs && S._bs.W === W && S._bs.H === H) return S._bs.v;
    const v = [];
    const s = .5 * k;
    // side trunk left, mid trees, side right
    v.push({ x: W * .03 + 6 * k, y: H * .7, s: .6 * k });
    midTrees.forEach((m, i) => { if (i !== 2 && i !== 3) v.push({ x: m.x + 2 * k * m.s, y: m.y - 26 * k * m.s, s: .95 * k * m.s }); });
    v.push({ x: W * .985 - 2 * k, y: H * .62, s: .45 * k });
    v.push({ x: W * .03 + 6 * k, y: H * .83, s: .6 * k });
    // second wave: the other side of the trunks, then low on your own tree
    midTrees.forEach((m, i) => { if (i !== 2 && i !== 3) v.push({ x: m.x - 2 * k * m.s, y: m.y - 18 * k * m.s, s: .85 * k * m.s, flip: 1 }); });
    v.push({ x: L.tx - L.trunkW * .42, y: L.ty - H * .17, s: .62 * k, flip: 1 });
    v.push({ x: W * .985 - 5 * k, y: H * .74, s: .45 * k, flip: 1 });
    S._bs = { W, H, v }; return v;
  }
  function bagSlots() {
    const v = [];
    midTrees.forEach((m, i) => { if (i % 2 === 0) v.push({ x: m.x - 8 * k * m.s, y: m.y - 4 * k * m.s, s: .62 * k * m.s }); });
    v.push({ x: L.tx - L.trunkW * .55, y: L.ty - H * .21, s: .5 * k });
    midTrees.forEach((m, i) => { if (i % 2 === 1 && i !== 3) v.push({ x: m.x + 7 * k * m.s, y: m.y - 2 * k * m.s, s: .6 * k * m.s }); });
    v.push({ x: W * .03 + 10 * k, y: H * .93, s: .45 * k });
    return v;
  }

  function drawSparkleBucket(c, t, ev) {
    const p = sparklePos(ev, t);
    const pulse = 1 + Math.sin(t * 6) * .06;
    const g = c.createRadialGradient(p.x, p.y, 2, p.x, p.y, 62 * k);
    g.addColorStop(0, 'rgba(255,246,190,1)'); g.addColorStop(.35, 'rgba(255,205,95,.6)'); g.addColorStop(1, 'rgba(255,190,80,0)');
    c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, 62 * k * pulse, 0, TAU); c.fill();
    c.globalAlpha = .5 + .3 * Math.sin(t * 6); c.strokeStyle = '#fff3c0'; c.lineWidth = 2.5; c.beginPath(); c.arc(p.x, p.y, (36 + 10 * ((t * 1.4) % 1)) * k, 0, TAU); c.stroke(); c.globalAlpha = 1;
    c.save(); c.translate(p.x, p.y + 20 * k); c.rotate(Math.sin(t * 2.5) * .15); c.scale(.72 * k * pulse, .72 * k * pulse);
    if (IMG.sparkleBucket) c.drawImage(IMG.sparkleBucket, -40, -70, 80, 80);
    else {
      c.beginPath(); c.moveTo(-26, -50); c.lineTo(26, -50); c.lineTo(20, 0); c.lineTo(-20, 0); c.closePath();
      fs(c, lg(c, -26, 0, 26, 0, [[0, '#d68a1c'], [.35, '#fff1b8'], [.6, '#ffc94d'], [1, '#c4760f']]), INK, 3.5);
      ell(c, 0, -50, 26, 6); fs(c, '#ffdd7a', INK, 3);
      c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.arc(0, -50, 30, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
    }
    c.restore();
    for (let i = 0; i < 4; i++) {
      const a = t * 2 + i * TAU / 4, r = 38 * k;
      c.globalAlpha = .5 + .5 * Math.sin(t * 5 + i); star(c, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * .7, 5 * k, '#fffbe0'); c.globalAlpha = 1;
    }
    if (Math.random() < .3) parts.push({ k: 'spark', x: p.x + (Math.random() - .5) * 30 * k, y: p.y + (Math.random() - .5) * 20 * k, vx: 0, vy: 10, r: 4 * k, life: 1, max: .8 });
  }
  /** Where the drifting sparkle bucket is, given engine event {at, life, seed} and scene time t (s since the event appeared). */
  function sparklePos(ev, t) {
    const u = clamp(ev.age / ev.life, 0, 1);
    const ltr = ev.seed < .5;
    const x = ltr ? lerp(-30 * k, W + 30 * k, u) : lerp(W + 30 * k, -30 * k, u);
    const yb = H * (.36 + (ev.seed * 7 % 1) * .24);
    return { x, y: yb + Math.sin(ev.age * 1.6) * 16 * k };
  }

  // ---------------------------------------------------------------- effects API
  function spawnDrop(gold) {
    parts.push({ k: 'drop', x: L.spileX + 15 * k, y: L.spileY + 4 * k, vy: 30 * k, to: L.bucketY - 50 * L.bucketS + 4, gold, life: 1 });
  }
  function tapFx(x, y, amount, strong, big) {
    if (parts.length > 260) parts.splice(0, parts.length - 200);
    squash = Math.min(1, squash + (big ? .9 : .55));
    spawnDrop(strong);
    parts.push({ k: 'ripple', x, y, life: 1, max: .45, col: strong ? '#ffd27a' : '#ffffff' });
    // a few droplets shaken off the branches
    for (let i = 0; i < (strong ? 3 : 1); i++) parts.push({ k: 'fall', x: L.tx + (Math.random() - .5) * W * .4, y: H * (.1 + Math.random() * .25), vy: 0, ph: Math.random() * 6, life: 1, max: 1.2 });
    // the sap you tapped flies up into the counter
    if (flyTo) for (let i = 0; i < (big ? 4 : strong ? 2 : 1); i++) {
      const side = (Math.random() - .5) * 140 * k;
      parts.push({ k: 'fly', x0: x, y0: y, cx: x + side, cy: y - (50 + Math.random() * 50) * k, u: -i * .07, dur: .5 + Math.random() * .12, gold: strong, x, y, life: 1 });
    }
    if (big) {
      for (let i = 0; i < 12; i++) { const a = -Math.PI * (.1 + .8 * Math.random()), sp = (120 + Math.random() * 160) * k; parts.push({ k: 'spl', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, max: .55 }); }
      parts.push({ k: 'ripple', x, y, life: 1, max: .7, col: '#ffe9a8' });
    }
    pops.push({ x: x + (Math.random() - .5) * 34, y: y - 14 - Math.random() * 14, text: '+' + amount, col: strong || big ? '#ffd36e' : '#ffffff', size: big ? 34 : strong ? 29 : 25, life: 1, max: big ? 1.1 : .95, rot: (Math.random() - .5) * .24 });
    if (pops.length > 12) pops.shift();
  }
  /** n drops fly from (x, y) up into the counter, staggered */
  function fly(x, y, n, gold) {
    if (!flyTo) return;
    for (let i = 0; i < n; i++) parts.push({ k: 'fly', x0: x + (Math.random() - .5) * 40 * k, y0: y, cx: x + (Math.random() - .5) * 160 * k, cy: y - (60 + Math.random() * 80) * k, u: -i * .06, dur: .6 + Math.random() * .15, gold, x, y, life: 1 });
  }
  function shake(a) { shakeAmt = Math.max(shakeAmt, a); }
  function setFlyTarget(x, y) { flyTo = x == null ? null : { x, y }; }
  function setCombo(n) { combo = n; comboLife = .9; comboPunch = 1; }
  function pop(x, y, text, col, size, max) { pops.push({ x, y, text, col: col || '#ffd36e', size: size || 24, life: 1, max: max || 1.6 }); }
  function burst(x, y, n, col) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, sp = (80 + Math.random() * 180) * k; parts.push({ k: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: (4 + Math.random() * 4) * k, life: 1, max: .7 + Math.random() * .6, col }); } }
  function buyFx(id) {
    // a little sparkle where the new thing lives in the scene
    const at = { spile: [W * .5, H * .7], kettle: [L.kettleX, L.kettleY - 30 * k], bag: [W * .3, H * .66], sled: [sledX || W * .3, L.sledY - 20 * k], evap: [L.evapX, L.evapY - 30 * k],
      tubing: [W * .5, H * .62], vacuum: [L.vacX, L.vacY - 20 * k], ro: [L.roX, L.roY - 20 * k], sugarbush: [W * .5, L.horizon], sugarhouse: [L.houseX, L.houseY - 40 * k],
      pipeline: [W * .88, L.horizon - 30 * k], coop: [L.barnX, L.barnY - 10 * k], reservoir: [L.lakeX, L.lakeY], weather: [L.wxX, L.wxY] }[id];
    if (at) burst(at[0], at[1], 10, '#fff6b0');
  }
  function hitSparkle(ev, x, y) { const p = sparklePos(ev); return Math.hypot(p.x - x, p.y - y) < 58 * k; }
  function layout() { return Object.assign({ W, H, k }, L); }

  // ================================================================ icons (rendered once, used as <img>)
  const iconCache = {};
  function icon(key, size) {
    size = size || 108;
    const ck = key + '@' + size; if (iconCache[ck]) return iconCache[ck];
    const c2 = document.createElement('canvas'); c2.width = c2.height = size;
    const c = c2.getContext('2d'); c.scale(size / 100, size / 100);
    c.lineJoin = 'round'; c.lineCap = 'round';
    if (IMG[key]) { c.drawImage(IMG[key], 4, 4, 92, 92); }
    else drawIcon(c, key, 0);
    return (iconCache[ck] = c2.toDataURL());
  }
  function iconBg(c, top, bot) { rr(c, 0, 0, 100, 100, 26); c.fillStyle = lg(c, 0, 0, 0, 100, [[0, top], [1, bot]]); c.fill(); }
  function snowFloor(c, y) { c.beginPath(); c.moveTo(0, y); c.quadraticCurveTo(50, y - 8, 100, y); c.lineTo(100, 100); c.lineTo(0, 100); c.closePath(); c.fillStyle = '#f4f8fa'; c.fill(); }
  function bark(c, x, w) { c.beginPath(); c.rect(x, -5, w, 110); fs(c, lg(c, x, 0, x + w, 0, [[0, '#3b2c22'], [.4, '#6f5a49'], [1, '#43342a']])); c.strokeStyle = 'rgba(30,20,10,.45)'; c.lineWidth = 2; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(x + 6 + i * w / 3, 0); c.quadraticCurveTo(x + 10 + i * w / 3, 50, x + 4 + i * w / 3, 100); c.stroke(); } }
  function drawIcon(c, key, t) {
    const tf = (x, y, s, fn) => { c.save(); c.translate(x, y); c.scale(s, s); fn(); c.restore(); };
    switch (key) {
      case 'spile': iconBg(c, '#d7e6ee', '#b7cfdb'); bark(c, 0, 40); tf(30, 28, 1.3, () => drawSpout(c)); tf(52, 92, .95, () => drawBucket(c, { fill: .7 })); break;
      case 'kettle': iconBg(c, '#f7d9a8', '#e7a868'); snowFloor(c, 86); tf(50, 92, .82, () => drawKettle(c, 0.3, true)); break;
      case 'bag': iconBg(c, '#d7e6ee', '#b7cfdb'); bark(c, 10, 40); tf(54, 88, 1.25, () => drawBag(c)); break;
      case 'sled': iconBg(c, '#dce9f0', '#c0d4df'); snowFloor(c, 76); tf(46, 82, .78, () => drawSled(c, 0)); break;
      case 'evap': iconBg(c, '#f2d2b0', '#d9a172'); snowFloor(c, 86); tf(50, 90, .72, () => drawEvap(c, .2)); break;
      case 'tubing': iconBg(c, '#d7e6ee', '#b7cfdb'); bark(c, 0, 22); bark(c, 78, 22);
        c.strokeStyle = INK; c.lineWidth = 7; c.beginPath(); c.moveTo(20, 34); c.quadraticCurveTo(50, 56, 80, 50); c.moveTo(20, 62); c.quadraticCurveTo(50, 84, 80, 78); c.stroke();
        c.strokeStyle = '#2f7fc4'; c.lineWidth = 4; c.stroke(); c.strokeStyle = '#9fd3f2'; c.lineWidth = 1.2; c.stroke(); break;
      case 'vacuum': iconBg(c, '#dfe9d6', '#b9cba9'); snowFloor(c, 84); tf(50, 88, 1.15, () => drawVacuum(c, .3)); break;
      case 'ro': iconBg(c, '#e3ecf1', '#bccbd4'); tf(55, 88, 1.05, () => drawRO(c, 0, 3)); break;
      case 'sugarbush': iconBg(c, '#c7dbe6', '#f3e2c6');
        c.beginPath(); c.moveTo(0, 70); c.quadraticCurveTo(50, 40, 100, 66); c.lineTo(100, 100); c.lineTo(0, 100); c.closePath(); c.fillStyle = '#f4f8fa'; c.fill();
        { const tr = growTree(4, 26, 4, 4, .5); [[22, 74, .8], [50, 64, 1], [78, 70, .85], [36, 88, .9], [66, 90, .95]].forEach(p => tf(p[0], p[1], p[2], () => paintTree(c, tr, { outline: 1.5, bud: 2 }))); }
        break;
      case 'sugarhouse': iconBg(c, '#c7dbe6', '#e9d7bd'); snowFloor(c, 86);
        c.globalAlpha = .9; [[50, 18, 10], [60, 10, 8], [42, 8, 7]].forEach(p => { ell(c, p[0], p[1], p[2], p[2] * .8); fs(c, '#fff'); }); c.globalAlpha = 1;
        tf(46, 90, .58, () => drawSugarhouse(c, 0, true)); break;
      case 'pipeline': iconBg(c, '#bcd3e2', '#e8eef2');
        c.beginPath(); c.moveTo(0, 90); c.lineTo(40, 20); c.lineTo(60, 34); c.lineTo(100, 8); c.lineTo(100, 100); c.lineTo(0, 100); c.closePath(); c.fillStyle = '#8fa6b5'; c.fill();
        c.beginPath(); c.moveTo(30, 38); c.lineTo(40, 20); c.lineTo(52, 29); c.lineTo(44, 32); c.closePath(); c.fillStyle = '#fff'; c.fill();
        c.strokeStyle = INK; c.lineWidth = 8; c.beginPath(); c.moveTo(88, 18); c.quadraticCurveTo(60, 60, 14, 92); c.stroke(); c.strokeStyle = '#c3ced4'; c.lineWidth = 4.5; c.stroke();
        ell(c, 50, 60, 4, 4); fs(c, '#bfe8fa', INK, 1.5); break;
      case 'coop': iconBg(c, '#c7dbe6', '#e9d7bd'); snowFloor(c, 84); tf(50, 88, .85, () => drawBarn(c, .5)); break;
      case 'reservoir': iconBg(c, '#c7dbe6', '#e9e2d4');
        c.beginPath(); c.moveTo(0, 50); c.quadraticCurveTo(30, 36, 60, 44); c.quadraticCurveTo(80, 50, 100, 40); c.lineTo(100, 100); c.lineTo(0, 100); c.closePath(); c.fillStyle = '#7f988a'; c.fill();
        tf(50, 70, 1, () => drawLake(c, 44, 20, 1)); break;
      case 'weather': iconBg(c, '#c4dcea', '#f4e2c4'); tf(50, 120, .85, () => drawWeather(c, .4)); break;
      case 'tap': iconBg(c, '#d7e6ee', '#b7cfdb'); bark(c, 0, 40);
        c.save(); c.translate(52, 18); c.rotate(.5);
        c.beginPath(); c.moveTo(14, 30); c.lineTo(14, 8); c.arc(18.5, 8, 4.5, Math.PI, 0); c.lineTo(23, 23); c.lineTo(36, 25); c.quadraticCurveTo(44, 30, 42, 44); c.lineTo(38, 58); c.lineTo(14, 58); c.lineTo(6, 40); c.quadraticCurveTo(4, 32, 14, 30); c.closePath();
        fs(c, '#fff3e0', INK, 3); c.restore();
        tf(30, 88, 1, () => { c.beginPath(); c.moveTo(0, -22); c.quadraticCurveTo(10, -6, 0, 0); c.quadraticCurveTo(-10, -6, 0, -22); fs(c, '#9fd3e8', INK, 2.5); }); break;
      case 'mitten': iconBg(c, '#f2d6cf', '#e0a99d');
        c.beginPath(); c.moveTo(34, 84); c.lineTo(32, 40); c.quadraticCurveTo(34, 16, 54, 16); c.quadraticCurveTo(72, 16, 72, 40); c.lineTo(72, 56); c.quadraticCurveTo(84, 44, 86, 54); c.quadraticCurveTo(88, 62, 72, 74); c.lineTo(70, 84); c.closePath();
        fs(c, '#b5332b', INK, 3.5); rr(c, 30, 76, 44, 14, 5); fs(c, '#f4ead8', INK, 3);
        c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 3; c.beginPath(); c.moveTo(40, 36); c.lineTo(62, 36); c.moveTo(40, 50); c.lineTo(62, 50); c.stroke(); break;
      case 'ratio': iconBg(c, '#fbe6bf', '#eab868');
        c.beginPath(); c.moveTo(30, 34); c.lineTo(70, 34); c.lineTo(76, 46); c.lineTo(76, 84); c.quadraticCurveTo(76, 92, 68, 92); c.lineTo(32, 92); c.quadraticCurveTo(24, 92, 24, 84); c.lineTo(24, 46); c.closePath();
        fs(c, lg(c, 0, 34, 0, 92, [[0, '#ffcf6a'], [1, '#b8620e']]), INK, 3.5); rr(c, 34, 20, 32, 14, 3); fs(c, '#b5332b', INK, 3);
        rr(c, 30, 54, 40, 22, 4); fs(c, '#fbf4e4'); c.fillStyle = INK; c.font = '400 15px "Alfa Slab One", Georgia'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('40:1', 50, 66); break;
      case 'fire': iconBg(c, '#4a3a33', '#2a1f1b'); drawFire(c, 50, 86, 1.9, .2);
        c.lineWidth = 9; c.strokeStyle = INK; c.beginPath(); c.moveTo(22, 88); c.lineTo(78, 80); c.moveTo(24, 80); c.lineTo(78, 90); c.stroke(); c.lineWidth = 6; c.strokeStyle = '#8a5a30'; c.stroke(); break;
      case 'sun': iconBg(c, '#bcd6e8', '#f3e0c0');
        ell(c, 40, 42, 20, 20); fs(c, '#ffd35c', INK, 3);
        c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; c.moveTo(40 + Math.cos(a) * 25, 42 + Math.sin(a) * 25); c.lineTo(40 + Math.cos(a) * 33, 42 + Math.sin(a) * 33); } c.stroke();
        c.strokeStyle = '#fff'; c.lineWidth = 4; c.beginPath(); for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; c.moveTo(70 + Math.cos(a) * 16, 72 + Math.sin(a) * 16); c.lineTo(70 - Math.cos(a) * 16, 72 - Math.sin(a) * 16); } c.stroke();
        c.strokeStyle = '#6aa8d8'; c.lineWidth = 2; c.stroke(); break;
      case 'spark': iconBg(c, '#2f4a5c', '#1d2f3b');
        { const g = c.createRadialGradient(50, 52, 4, 50, 52, 46); g.addColorStop(0, 'rgba(255,230,150,.9)'); g.addColorStop(1, 'rgba(255,200,90,0)'); c.fillStyle = g; c.fillRect(0, 0, 100, 100); }
        tf(50, 76, .8, () => { c.beginPath(); c.moveTo(-26, -50); c.lineTo(26, -50); c.lineTo(20, 0); c.lineTo(-20, 0); c.closePath(); fs(c, lg(c, -26, 0, 26, 0, [[0, '#d68a1c'], [.4, '#fff1b8'], [1, '#c4760f']]), INK, 3.5); ell(c, 0, -50, 26, 6); fs(c, '#ffdd7a', INK, 3); });
        star(c, 76, 24, 10, '#fffbe0'); star(c, 22, 30, 7, '#fffbe0'); break;
      case 'ribbon': drawRibbon(c, 50, 50, 1); break;
      default: iconBg(c, '#ddd', '#bbb');
    }
  }
  function drawRibbon(c, x, y, s, n) {
    c.save(); c.translate(x, y); c.scale(s, s);
    c.beginPath(); c.moveTo(-16, 4); c.lineTo(-24, 46); c.lineTo(-12, 38); c.lineTo(-4, 50); c.lineTo(2, 8); c.closePath(); fs(c, '#2f63b0', INK, 3);
    c.beginPath(); c.moveTo(16, 4); c.lineTo(24, 46); c.lineTo(12, 38); c.lineTo(4, 50); c.lineTo(-2, 8); c.closePath(); fs(c, '#3d7fd0', INK, 3);
    c.beginPath(); for (let i = 0; i < 24; i++) { const a = i / 24 * TAU, r = i % 2 ? 26 : 30; c.lineTo(Math.cos(a) * r, -14 + Math.sin(a) * r); } c.closePath(); fs(c, '#3d7fd0', INK, 3);
    ell(c, 0, -14, 19, 19); fs(c, '#fbf4e4', INK, 2.5);
    c.fillStyle = '#2f63b0'; c.font = '400 ' + (n != null && String(n).length > 2 ? 12 : 15) + 'px "Alfa Slab One", Georgia'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(n != null ? String(n) : 'A', 0, -13);
    c.restore();
  }
  function ribbonImg(n, size) {
    const c2 = document.createElement('canvas'); size = size || 120; c2.width = size; c2.height = size * 1.18;
    const c = c2.getContext('2d'); c.scale(size / 100, size / 100); drawRibbon(c, 50, 50, 1.25, n); return c2.toDataURL();
  }

  const ART = { ASSETS, init, resize, frame, tapFx, fly, shake, setFlyTarget, setCombo, pop, burst, buyFx, hitSparkle, sparklePos, layout, icon, ribbonImg, drawRibbon, drawIcon,
    drawBucket, drawKettle, drawSugarhouse, growTree, paintTree, S };
  root.SapArt = ART;
})(window);
