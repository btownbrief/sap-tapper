/* Sap Tapper — UI glue: loop, input, shop sheet, modals, saving. Engine rules live in engine.js. */
(function () {
  'use strict';
  const E = window.SapEngine, ART = window.SapArt, AU = window.SapAudio;
  const KEY = 'sapTapper.save';
  const $ = id => document.getElementById(id);
  const fmt = E.fmt;
  const app = $('app'), cv = $('scene'), sceneWrap = $('sceneWrap');

  // ------------------------------------------------------------------ state + saving
  let s = null, d = null;
  let pendingAway = null;
  function loadSave() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); if (raw) return E.deserialize(raw); }
    catch (e) {
      console.warn('save unreadable, starting fresh (old save kept in ' + KEY + '.bak)', e);
      try { if (raw) localStorage.setItem(KEY + '.bak.' + Date.now(), raw); } catch (e2) { }
    }
    return null;
  }
  let skipSave = false;
  // The most recently opened tab owns the save. An older tab (say, an iOS tab resumed after the storage event was
  // dropped) checks before every save and on resume, and stops instead of writing over the newer one.
  const TAB = Math.random().toString(36).slice(2), STAMP = KEY + '.owner', myBoot = Date.now();
  function claimOwner() { try { localStorage.setItem(STAMP, JSON.stringify({ tab: TAB, boot: myBoot })); } catch (e) { } }
  function otherTabSaved() {
    try { const o = JSON.parse(localStorage.getItem(STAMP) || 'null'); return !!(o && o.tab !== TAB && o.boot > myBoot); } catch (e) { return false; }
  }
  function save() {
    if (!s || skipSave) return;
    if (otherTabSaved()) { anotherTab(); return; }
    s.lastSeen = Date.now();
    try { localStorage.setItem(KEY, E.serialize(s)); } catch (e) { /* private mode / full */ }
  }
  function boot() {
    claimOwner();
    s = loadSave();
    const fresh = !s;
    if (!s) s = E.newState();
    const gap = (Date.now() - (s.lastSeen || Date.now())) / 1000;
    if (!fresh && gap > 3) {
      const sum = E.applyOffline(s, gap);
      if (gap > 60 && (sum.sap > 0 || sum.syrup > 0)) pendingAway = sum;
    }
    s.lastSeen = Date.now();
    d = E.derive(s);
    AU.setOn(!s.settings.mute); app.classList.toggle('muted', !!s.settings.mute);
    if (!fresh && s.totals.taps > 0) {
      $('startTxt').textContent = 'Keep tapping';
      $('startSub').textContent = 'Season ' + s.season.n + ' · ' + fmt(s.sap) + ' sap' + (s.syrup >= 1 ? ' · ' + fmt(s.syrup) + ' syrup' : '');
      if (s.daily && s.daily.day !== dayKey() && (s.tut.goal >= 11 || s.totals.seasons > 0)) $('startSub').textContent += ' · new chores today!';
    }
  }

  // ------------------------------------------------------------------ layout (once per orientation / width change)
  let lastW = 0, lastOrient = '';
  let dpr = 1;
  function layout(force) {
    const w = window.innerWidth, h = window.innerHeight;
    const orient = w > h ? 'L' : 'P';
    if (!force && w === lastW && orient === lastOrient) return; // ignore toolbar-only height changes
    lastW = w; lastOrient = orient;
    const land = orient === 'L' && w >= 640;
    const sceneH = land ? h : Math.round(Math.max(280, Math.min(h * .46, w * 1.15)));
    document.documentElement.style.setProperty('--sceneH', sceneH + 'px');
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = sceneWrap.getBoundingClientRect();
    ART.resize(Math.round(r.width), Math.round(r.height), dpr);
    positionGhost();
  }
  window.addEventListener('resize', () => layout(false));
  window.addEventListener('orientationchange', () => setTimeout(() => layout(true), 300));

  // ------------------------------------------------------------------ tapping the tree
  let streak = 0, lastTapAt = 0;
  const tapTimes = [];
  function vib(ms) { try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(ms); } catch (e) { } }
  function evView() { return s.event ? { age: s.clock - s.event.at, life: s.event.life, seed: s.event.seed } : null; }
  cv.addEventListener('pointerdown', e => {
    e.preventDefault();
    AU.unlock();
    if (!started) return;
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (s.event && ART.hitSparkle(evView(), x, y)) { catchSparkle(x, y); return; }
    doTap(x, y);
  });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  const HOT_AT = 25, BLAZE_AT = 60; let hotTold = false, blazeTold = false;
  function doTap(x, y) {
    const now = performance.now();
    streak = now - lastTapAt < 450 ? streak + 1 : 0; lastTapAt = now;
    const hot = streak + 1 >= HOT_AT, blazing = streak + 1 >= BLAZE_AT; // keep a fast streak going: x1.5, then x2
    const v = E.tap(s, d, blazing ? 2 : hot ? 1.5 : 1, blazing ? .05 : hot ? .02 : 0);
    const big = (streak + 1) % 10 === 0; // every 10th tap in a streak gets a bigger splash
    if (s.daily && streak + 1 > (s.daily.bestStreak || 0)) s.daily.bestStreak = streak + 1;
    AU.plink(streak);
    if (big) AU.streak(streak + 1);
    ART.setCombo(streak + 1);
    aimFly();
    ART.tapFx(x, y, fmt(v, 1), d.tapStorm > 1 || hot, big);
    if (streak + 1 === HOT_AT || streak + 1 === BLAZE_AT) { AU.streak(streak + 1 === BLAZE_AT ? 80 : 40); ART.shake(streak + 1 === BLAZE_AT ? 4 : 2.5); }
    if (streak + 1 === BLAZE_AT && !blazeTold) { blazeTold = true; toast('tap', 'Blazing streak', 'Taps ×2 + 5% of flow', 'Can you keep this up?', 1.8); }
    if (streak + 1 === HOT_AT && !hotTold) { hotTold = true; toast('tap', 'Hot streak', d.sapPs >= 1 ? 'Taps ×1.5 + 2% of flow' : 'Taps ×1.5', 'Keep tapping fast to keep it going.', 1.8); }
    vib(big ? 12 : 4);
    tapTimes.push(now); while (tapTimes.length && now - tapTimes[0] > 5000) tapTimes.shift();
    if (tapTimes.length >= 40) s.flags.burst = true;
    if (s.totals.taps <= 3) positionGhost();
  }
  // tapped sap flies into the counter; the counter pulses when it lands
  const sapIco = document.querySelector('#resSap .ico');
  function aimFly() {
    const r = cv.getBoundingClientRect(), i = sapIco.getBoundingClientRect();
    ART.setFlyTarget(i.left + i.width / 2 - r.left, i.top + i.height / 2 - r.top);
  }
  ART.S.onFly = () => { bumpSap = true; };
  function catchSparkle(x, y) {
    const res = E.catchEvent(s);
    if (!res) return;
    d = E.derive(s);
    AU.sparkleCatch(); vib([10, 30, 10]);
    ART.shake(res.kind === 'frenzy' || res.kind === 'tapstorm' ? 4 : 2.5);
    ART.burst(x, y, 26, '#fff6b0');
    let line = res.text;
    if (res.kind === 'lump') line = '+' + fmt(res.amount) + ' sap!';
    if (res.kind === 'syrup') line = '+' + fmt(res.amount, 1) + ' syrup!';
    ART.pop(x, Math.max(y - 10, ART.layout().H * .6), line, '#ffd36e', 26, 2.2); // stay clear of the buff pill up top
    toast('spark', 'Glowing bucket', res.text,
      res.kind === 'frenzy' ? 'All sap flow and boiling ×7 for ' + Math.round(res.dur) + 's' : res.kind === 'tapstorm' ? 'Every tap is worth ×12 for ' + Math.round(res.dur) + 's. Tap fast!' : line, 2.6);
    refreshBuffs(true);
  }

  // ------------------------------------------------------------------ main loop
  let started = false, lastNow = performance.now(), uiAcc = 0, saveAcc = 0, achAcc = 0, t = 0;
  let bumpSap = false, hadEvent = false;
  let lastWall = Date.now(), lastInput = performance.now(), frameN = 0;
  /** Apply wall-clock time that passed without frames (hidden tab, throttled tab, sleep). Each gap counts once. */
  function catchUp(showIfLong) {
    const now = Date.now(), gap = (now - lastWall) / 1000;
    lastWall = now;
    if (gap > 2) { awayFor(gap, showIfLong); return true; }
    return false;
  }
  function loop(now) {
    requestAnimationFrame(loop);
    let dt = (now - lastNow) / 1000; lastNow = now;
    if (catchUp(false)) dt = 0;
    dt = Math.min(Math.max(dt, 0), 2);
    // simulate in small steps
    let rem = dt;
    while (rem > 0) { const h = Math.min(rem, .1); d = E.tick(s, h); rem -= h; }
    if (dt === 0) d = E.derive(s);
    t += dt;
    if (s.event && !hadEvent) AU.sparkleAppear();
    hadEvent = !!s.event;
    AU.ambient(dt, (s.owned.kettle || 0) + (s.owned.evap || 0) * 3 + (s.owned.sugarhouse || 0) * 6);
    // save battery: skip drawing under a dialog, and draw at 30fps after 10s without input
    frameN++;
    const idle = now - lastInput > 10000;
    const under = !M.classList.contains('hidden');
    if (frameN % (under ? 6 : idle ? 2 : 1) === 0) ART.frame(t, s, d, evView());
    uiAcc += dt; saveAcc += dt; achAcc += dt;
    if (uiAcc >= .1) { uiAcc = 0; refreshUI(); }
    if (achAcc >= .5) { achAcc = 0; checkAch(); }
    if (saveAcc >= 5) { saveAcc = 0; save(); }
  }

  // time away: hidden tab, or a long stall
  function awayFor(secs, showIfLong) {
    if (secs <= 0) return;
    if (secs < 60) { // a quick app switch: play it out live so a Sap Run isn't lost
      let rem = secs; while (rem > 0) { const h = Math.min(rem, .25); d = E.tick(s, h); rem -= h; }
      return;
    }
    const sum = E.applyOffline(s, secs);
    d = E.derive(s);
    if (sum.capped) s.flags.awayMax = true;
    if (showIfLong && secs > 60 && (sum.sap >= 1 || sum.syrup > 0)) showAway(sum);
  }
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); save(); AU.suspend(); }
    else {
      AU.resume();
      if (otherTabSaved()) { anotherTab(); return; }
      hiddenAt = 0; catchUp(true);
      setTimeout(morningRun, 900);
      lastNow = performance.now();
    }
  });
  window.addEventListener('pagehide', save);
  // another tab saved this game: stop saving here so the two don't overwrite each other
  // (a reload fires the old page's unload-save at the new page: that save is stamped before we booted, so ignore it)
  const bootAt = Date.now();
  window.addEventListener('storage', e => {
    if (e.key !== KEY || skipSave || !e.newValue) return;
    let stamp = 0; try { stamp = JSON.parse(e.newValue).lastSeen || 0; } catch (err) { }
    if (stamp <= bootAt + 250) return;
    anotherTab();
  });
  function anotherTab() {
    if (skipSave) return;
    skipSave = true;
    modal('Open in another tab', '<p style="text-align:center">Sap Tapper is running in another tab or window. This one has stopped saving so your progress stays safe.</p>',
      [{ txt: 'Play here instead', cls: 'big', fn: () => location.reload() }], () => location.reload());
  }
  window.addEventListener('beforeunload', save);

  // ------------------------------------------------------------------ HUD
  const el = { sapN: $('sapN'), sapPs: $('sapPs'), syrN: $('syrN'), syrPs: $('syrPs'), resSyr: $('resSyr'), resSap: $('resSap'),
    line: $('line'), lineR: $('lineR'), lineL: $('lineL'), lineFill: $('lineFill') };
  const last = {};
  let lineFull = false, vuCache = null, vuAt = -1;
  /** visible upgrades, recomputed at most every half second (it filters ~150 upgrades) */
  function visUpg(force) { const now = performance.now(); if (force || !vuCache || now - vuAt > 500) { vuCache = E.visibleUpgrades(s); vuAt = now; } return vuCache; }
  function setText(node, key, txt) { if (last[key] !== txt) { last[key] = txt; node.textContent = txt; } }
  function refreshUI() {
    setText(el.sapN, 'sapN', fmt(s.sap));
    const anyProd = E.PRODUCERS.some(p => s.owned[p.id]);
    setText(el.sapPs, 'sapPs', anyProd ? '+' + fmt(d.netSap, 1) + '/s' : (s.totals.taps < 5 ? 'tap the tree!' : '+' + fmt(d.tapValue, 1) + ' per tap'));
    if (bumpSap) { bumpSap = false; el.resSap.classList.remove('bump'); void el.resSap.offsetWidth; el.resSap.classList.add('bump'); }
    const hasSyr = s.owned.kettle || s.syrup > 0 || s.totals.syrupAll > 0;
    el.resSyr.classList.toggle('hidden', !hasSyr);
    if (hasSyr) {
      setText(el.syrN, 'syrN', fmt(s.syrup, 1));
      setText(el.syrPs, 'syrPs', '+' + fmt(d.syrupPs, 2) + '/s');
    }
    el.line.classList.toggle('hidden', !(d.boilCap > 0));
    ART.S.popTop = d.boilCap > 0 ? 112 : 64;
    if (last.hudB !== (d.boilCap > 0)) { last.hudB = d.boilCap > 0; sceneWrap.style.setProperty('--hudB', last.hudB ? '106px' : '58px'); }
    lineFull = d.boilCap > 0 && d.boilCap >= d.sapPs * E.FLOW_SHARE * 1.02;
    if (d.boilCap > 0) {
      const share = d.sapPs * E.FLOW_SHARE;
      setText(el.lineL, 'lineL', 'Evaporator · ' + d.ratio + ':1');
      const r = d.sapPs <= 0 ? 'waiting on sap: buy tappers' : d.boilCap >= share * .999
        ? 'boiling all it can · more tappers = more syrup' : 'boilers maxed · more boilers = more syrup';
      setText(el.lineR, 'lineR', r);
      const fill = share > 0 ? Math.min(1, d.boilCap / share) : 1;
      el.lineFill.style.width = Math.round(fill * 100) + '%';
    }
    refreshBuffs(false);
    refreshGoal();
    refreshTabs();
    refreshProd();
    if (tab === 'upg') refreshUpg();
    if (tab === 'season') refreshSeason(false);
    positionGhost();
  }

  // buffs
  let buffSig = '';
  function refreshBuffs(force) {
    const bb = $('buffBar');
    const act = s.buffs.filter(b => b.until > s.clock);
    const sig = act.map(b => b.type).join(',');
    if (sig !== buffSig || force) {
      if (buffSig.includes('frenzy') && !sig.includes('frenzy')) AU.frenzyEnd();
      AU.setHype(sig.includes('frenzy') || sig.includes('tapstorm'));
      buffSig = sig;
      sceneWrap.style.setProperty('--buffs', act.length);
      bb.innerHTML = act.map(b => '<div class="buff ' + (b.type === 'tapstorm' ? 'blue' : '') + '" data-t="' + b.type + '"></div>').join('');
    }
    act.forEach((b, i) => {
      const n = bb.children[i]; if (!n) return;
      const left = Math.ceil(b.until - s.clock);
      const txt = (b.type === 'frenzy' ? 'SAP RUN ×' + b.mult : 'SUGAR SNOW · TAPS ×' + b.mult) + ' · ' + left + 's';
      if (n.textContent !== txt) n.textContent = txt;
    });
  }

  // ------------------------------------------------------------------ sheet + tabs
  let tab = 'prod';
  const tabs = Array.from(document.querySelectorAll('.tab'));
  tabs.forEach(b => b.addEventListener('click', () => { AU.unlock(); setTab(b.dataset.tab); AU.ui(); }));
  function setTab(name) {
    tab = name;
    tabs.forEach(b => b.classList.toggle('on', b.dataset.tab === name));
    document.querySelectorAll('.pane').forEach(p => p.classList.toggle('on', p.id === 'pane-' + name));
    if (name === 'upg') { visUpg(true); upgSig = ''; refreshUpg(); }
    if (name === 'season') { refreshSeason(true); s.tut.seenSeasonGain = E.prestigePreview(s).gain; }
    if (name === 'prod') { prodSig = ''; refreshProd(); }
  }
  // shop handle: tap toggles, swipe up/down opens/closes
  (function () {
    const g = $('grab'); let y0 = null;
    g.addEventListener('pointerdown', e => { y0 = e.clientY; });
    g.addEventListener('pointerup', e => {
      if (y0 === null) return; const dy = e.clientY - y0; y0 = null;
      const sh = $('sheet');
      if (Math.abs(dy) < 12) sh.classList.toggle('tall'); else sh.classList.toggle('tall', dy < 0);
      AU.ui();
    });
    g.addEventListener('pointercancel', () => { y0 = null; });
  })();
  function refreshTabs() {
    const upgTab = tabs[1], seaTab = tabs[2];
    const vu = visUpg();
    const showUpg = vu.length > 0 || Object.keys(s.upg).length > 0;
    reveal(upgTab, showUpg);
    const pv = E.prestigePreview(s);
    const showSea = s.ribbons > 0 || s.totals.seasons > 0 || s.season.syrupEarned >= E.syrupForRibbons(1) * .25;
    reveal(seaTab, showSea);
    $('tabs').classList.toggle('solo', !showUpg && !showSea);
    upgTab.classList.toggle('ping', tab !== 'upg' && vu.some(u => E.wallet(s, u.cur) >= u.cost));
    upgTab.classList.toggle('bestTab', tab !== 'upg' && !!E.U_BY_ID[bestBuy()]);
    seaTab.classList.toggle('ping', tab !== 'season' && pv.gain >= 1 && pv.gain > (s.tut.seenSeasonGain || 0) && (pv.gain >= 10 || !s.tut.seenSeasonGain));
  }
  function reveal(node, show) {
    const was = !node.classList.contains('hidden');
    node.classList.toggle('hidden', !show);
    if (show && !was) { node.classList.remove('reveal'); void node.offsetWidth; node.classList.add('reveal'); }
  }

  // ------------------------------------------------------------------ hold-to-buy
  const holds = new Set(); // cancel functions of rows currently pressed
  function cancelAllHolds() { holds.forEach(f => f()); }
  window.addEventListener('pointerup', () => setTimeout(cancelAllHolds, 0));
  window.addEventListener('pointercancel', cancelAllHolds);
  window.addEventListener('blur', cancelAllHolds);
  function bindHold(node, act, onHoldEnd, oneShot) {
    let timer = null, rep = null, sx = 0, sy = 0, active = false, repeating = false, count = 0;
    const cancel = () => { active = false; clearTimeout(timer); clearTimeout(rep); node.classList.remove('press'); holds.delete(cancel); };
    node.addEventListener('pointerdown', e => {
      if (e.button > 0) return;
      AU.unlock(); active = true; repeating = false; count = 0; sx = e.clientX; sy = e.clientY;
      holds.add(cancel);
      node.classList.add('press');
      if (oneShot) return; // upgrades: buy on release, however long the press
      timer = setTimeout(() => {
        if (!active || !node.isConnected) { cancel(); return; }
        repeating = true; let delay = 170;
        const go = () => { if (!active || !node.isConnected) { cancel(); return; } if (act(true, count)) count++; delay = Math.max(45, delay * .86); rep = setTimeout(go, delay); };
        go();
      }, 380);
    });
    node.addEventListener('pointermove', e => { if (active && Math.hypot(e.clientX - sx, e.clientY - sy) > 12) cancel(); });
    const end = fire => { if (!active) return; const wasRep = repeating, n = count; cancel(); if (fire && !wasRep) act(false, 0); if (wasRep && onHoldEnd) onHoldEnd(n); };
    node.addEventListener('pointerup', () => end(true));
    node.addEventListener('pointercancel', () => end(false));
    node.addEventListener('pointerleave', () => end(false));
    node.addEventListener('contextmenu', e => e.preventDefault());
    node.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(false, 0); } });
  }

  // ------------------------------------------------------------------ producers list
  const prodList = $('prodList');
  let prodSig = '', prodRows = {}, mysteryRow = null;
  function buyAmt() { return s.settings.buyAmt || 1; }
  function refreshProd() {
    const vis = E.PRODUCERS.filter(p => E.producerVisible(s, p));
    const next = E.PRODUCERS.find(p => !E.producerVisible(s, p));
    const sig = vis.map(p => p.id).join(',') + '|' + (next ? next.id : '');
    if (sig !== prodSig) {
      const fresh = prodSig !== '';
      cancelAllHolds(); prodSig = sig; prodRows = {};
      prodList.innerHTML = '';
      vis.forEach(p => {
        const r = document.createElement('button'); r.className = 'row'; r.dataset.id = p.id;
        r.innerHTML = '<i class="prog"></i><span class="pic"><img alt="" src="' + ART.icon(p.id) + '"></span>' +
          '<span class="mid"><span class="nm"><span class="n"></span><span class="own"></span></span><span class="ds"></span></span>' +
          '<span class="cost"><span class="bv">Best value</span><b></b><small></small></span>';
        r.querySelector('.n').textContent = p.name;
        prodList.appendChild(r);
        prodRows[p.id] = { r, own: r.querySelector('.own'), ds: r.querySelector('.ds'), cb: r.querySelector('.cost b'), cs: r.querySelector('.cost small'), prog: r.querySelector('.prog'), last: {} };
        bindHold(r, (held) => buyProd(p.id, held), n => { if (n >= 25) s.flags.hold25 = true; });
        if (fresh && !s.owned[p.id]) { r.classList.add('reveal'); }
      });
      if (next) {
        const r = document.createElement('div'); r.className = 'row mystery';
        mysteryRow = r;
        r.innerHTML = '<span class="pic"><img alt="" src="' + ART.icon(next.id) + '"></span><span class="mid"><span class="nm">???</span><span class="ds">Collect ' +
          fmt(next.cost * .35) + ' ' + next.cur + ' in total to reveal.</span></span>';
        prodList.appendChild(r);
      }
    }
    if (vis.length < 3 && s.totals.seasons === 0 && !prodList.querySelector('.listNote')) {
      const n = document.createElement('div'); n.className = 'listNote';
      n.innerHTML = '<b>Tap the tree</b> for sap, then buy producers here.<br>Hold a row to keep buying. More of the sugarbush appears as you grow.';
      prodList.appendChild(n);
    }
    const amt = buyAmt();
    const bb = bestBuy();
    $('amtRow').classList.toggle('hidden', !(s.totals.bought >= 10 || s.totals.seasons > 0));
    vis.forEach(p => {
      const R = prodRows[p.id]; if (!R) return;
      const own = s.owned[p.id] || 0;
      const w = E.wallet(s, p.cur);
      let k = amt === 'max' ? Math.max(1, E.maxAffordable(p, own, w)) : amt;
      const cost = E.prodCost(p, own, k);
      const can = w >= cost;
      put(R, 'own', R.own, own ? String(own) : '');
      const each = d.each[p.id];
      const txt = p.kind === 'tap'
        ? '<em>+' + fmt(each, 1) + ' sap/s</em> each' + (own ? ' · ' + fmt(each * own * d.frenzy, 1) + '/s total' : '')
        : '<em>boils ' + fmt(each, 1) + ' sap/s</em> each' + (own ? (lineFull ? ' · line full, extras idle' : ' · ' + fmt(each * own * d.frenzy, 1) + '/s total') : '');
      if (R.last.ds !== txt) { R.last.ds = txt; R.ds.innerHTML = txt + (own === 0 ? '<br>' + p.desc : ''); }
      put(R, 'cb', R.cb, fmt(Math.ceil(cost)), p.cur);
      put(R, 'cs', R.cs, k > 1 ? 'buy ×' + k : (amt === 'max' ? 'max ×1' : ''));
      const wasCan = R.r.classList.contains('can');
      R.r.classList.toggle('can', can);
      R.r.classList.toggle('best', bb === p.id);
      if (can && !wasCan) { R.r.classList.remove('fresh'); void R.r.offsetWidth; R.r.classList.add('fresh'); }
      R.prog.style.width = can ? '0%' : Math.round(Math.min(1, w / cost) * 100) + '%';
    });
  }
  // "Best value": the same pick the balance sim's sensible buyer makes (time to afford + payback, using the real
  // marginal gain), so it never points at a kettle the evaporator line can't use. Recomputed once a second.
  let bestId = null, bestAt = -1e9;
  function bestBuy() {
    const now = performance.now();
    if (now - bestAt < 1000) return bestId;
    bestAt = now; bestId = null;
    if (s.totals.bought < 3 || s.totals.seasons > 0) return null; // a learning aid: from season 2 the choices are yours
    const tps = Math.min(4, tapTimes.filter(t => now - t < 5000).length / 5), W = E.SYRUP_VALUE();
    const val = () => { const x = E.derive(s); return x.netSap + W * x.syrupPs + tps * x.tapValue; };
    const v0 = val(), incSap = Math.max(1e-9, d.netSap + tps * d.tapValue), incSyr = Math.max(1e-12, d.syrupPs);
    let best = Infinity;
    const consider = (id, cur, cost, apply) => {
      const undo = apply(); const dv = val() - v0; undo();
      if (dv <= 0) return;
      const wait = Math.max(0, (cost - E.wallet(s, cur)) / (cur === 'syrup' ? incSyr : incSap));
      const score = wait + (cur === 'syrup' ? cost * W : cost) / dv;
      if (score < best) { best = score; bestId = id; }
    };
    E.PRODUCERS.forEach(p => {
      if (!E.producerVisible(s, p)) return;
      const o = s.owned[p.id] || 0, amt = buyAmt(), k = amt === 'max' ? Math.max(1, E.maxAffordable(p, o, E.wallet(s, p.cur))) : amt; // judge the amount you'd actually buy
      consider(p.id, p.cur, E.prodCost(p, o, k), () => { s.owned[p.id] = o + k; return () => { if (o) s.owned[p.id] = o; else delete s.owned[p.id]; }; });
    });
    visUpg().slice(0, MAX_UPG).forEach(u => { if (!s.upg[u.id]) consider(u.id, u.cur, u.cost, () => { s.upg[u.id] = 1; return () => { delete s.upg[u.id]; }; }); });
    return bestId;
  }
  function put(R, key, node, txt, cur) {
    const v = txt + (cur || '');
    if (R.last[key] === v) return; R.last[key] = v;
    if (cur) node.innerHTML = '<i class="cur ' + cur + '"></i>' + txt; else node.textContent = txt;
  }
  function buyProd(id, held) {
    const p = E.P_BY_ID[id];
    const n = E.buyProducer(s, id, buyAmt());
    const R = prodRows[id];
    if (n > 0) {
      d = E.derive(s);
      AU.buy(s.owned[id] % 12); vib(6);
      if (s.owned[id] === n) setTimeout(() => AU.land(E.P_BY_ID[id].index), 120);
      ART.buyFx(id);
      if (R) { R.last = {}; R.r.classList.remove('bought'); void R.r.offsetWidth; R.r.classList.add('bought'); }
      bestAt = -1e9;
      if (s.owned[id] === n) toast(p.id, 'New producer', p.name, p.kind === 'boil'
        ? 'Boils ' + fmt(d.each[id] * n, 1) + ' sap/s into ' + fmt(d.each[id] * n / d.ratio, 2) + ' syrup/s (' + d.ratio + ' sap → 1 syrup)' : p.desc, 3.2);
      refreshProd();
      return true;
    }
    if (!held) { AU.cant(); if (R) { R.r.classList.remove('buzz'); void R.r.offsetWidth; R.r.classList.add('buzz'); } }
    return false;
  }
  $('amtSeg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const v = b.dataset.amt; s.settings.buyAmt = v === 'max' ? 'max' : +v;
    $('amtSeg').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    AU.ui(); bestAt = -1e9; refreshProd();
  });
  function syncAmtSeg() { const a = String(buyAmt()); $('amtSeg').querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.amt === a)); }

  // ------------------------------------------------------------------ upgrades list
  const upgList = $('upgList');
  let upgSig = '', upgRows = {};
  const MAX_UPG = 14;
  function refreshUpg() {
    const all = visUpg();
    const vu = all.slice(0, MAX_UPG);
    const sig = 'u:' + vu.map(u => u.id).join(','); // never '' so an emptied list still rebuilds
    if (sig !== upgSig) {
      cancelAllHolds(); upgSig = sig; upgRows = {};
      upgList.innerHTML = '';
      if (!vu.length) upgList.innerHTML = '<div class="listNote">Nothing new right now. Upgrades appear as your sugarbush grows.</div>';
      vu.forEach(u => {
        const r = document.createElement('button'); r.className = 'row'; r.dataset.id = u.id;
        r.innerHTML = '<i class="prog"></i><span class="pic"><img alt="" src="' + ART.icon(u.icon) + '">' + (u.icon2 ? '<img alt="" src="' + ART.icon(u.icon2) + '">' : '') +
          (u.badge ? '<span class="badge">' + u.badge + '</span>' : '') + '</span>' +
          '<span class="mid"><span class="nm"></span><span class="ds"></span></span><span class="cost"><span class="bv">Best value</span><b></b></span>';
        r.querySelector('.nm').textContent = u.name; r.querySelector('.ds').textContent = u.desc;
        r.querySelector('.cost b').innerHTML = '<i class="cur ' + u.cur + '"></i>' + fmt(Math.ceil(u.cost));
        upgList.appendChild(r);
        upgRows[u.id] = { r, prog: r.querySelector('.prog') };
        bindHold(r, held => buyUpg(u.id, held), null, true);
      });
      if (all.length > MAX_UPG) {
        const n = document.createElement('div'); n.className = 'listNote'; n.textContent = '+' + (all.length - MAX_UPG) + ' more upgrades waiting further down the road.'; upgList.appendChild(n);
      }
    }
    vu.forEach(u => {
      const R = upgRows[u.id]; if (!R) return;
      const w = E.wallet(s, u.cur), can = w >= u.cost;
      const wasCan = R.r.classList.contains('can');
      R.r.classList.toggle('can', can);
      R.r.classList.toggle('best', bestBuy() === u.id);
      if (can && !wasCan) { R.r.classList.remove('fresh'); void R.r.offsetWidth; R.r.classList.add('fresh'); }
      R.prog.style.width = can ? '0%' : Math.round(Math.min(1, w / u.cost) * 100) + '%';
    });
  }
  function buyUpg(id, held) {
    const u = E.U_BY_ID[id];
    if (E.buyUpgrade(s, id)) {
      d = E.derive(s);
      AU.upgrade(); vib([8, 20, 8]); bestAt = -1e9; s.totals.upgBought = (s.totals.upgBought || 0) + 1;
      const R = upgRows[id];
      ART.burst(ART.layout().W / 2, ART.layout().H * .55, 14, '#fff6b0');
      toast(u.icon, 'Upgrade', u.name, u.desc, 2.2);
      visUpg(true); upgSig = ''; refreshUpg(); prodSig = ''; refreshProd();
      return true;
    }
    AU.cant();
    const R = upgRows[id]; if (R) { R.r.classList.remove('buzz'); void R.r.offsetWidth; R.r.classList.add('buzz'); }
    return false;
  }

  // ------------------------------------------------------------------ season pane
  const seasonBody = $('seasonBody');
  let seasonBuilt = false;
  function refreshSeason(rebuild) {
    const pv = E.prestigePreview(s);
    if (rebuild || !seasonBuilt) {
      seasonBuilt = true;
      seasonBody.innerHTML =
        '<div class="card"><div class="ribbonRow"><img class="ribbon" alt="" id="sRib"><div><div class="bigNum" id="sRibN"></div><p id="sRibB"></p></div></div></div>' +
        '<div class="card"><h3 id="sTitle"></h3><p id="sInfo"></p><div class="meter"><i id="sMeter"></i></div><p id="sNext"></p>' +
        '<button class="big blue" id="btnEnd" style="margin-top:10px"><span>End the season</span><small id="sGain"></small></button>' +
        '<p id="sHint" style="text-align:center;margin-top:10px"></p></div>' +
        (s.totals.seasons > 0 ? '<div class="card" id="sStyle"><h3>This season\'s style</h3>' + (s.style
          ? '<p><b>' + E.STYLES[s.style].name + '.</b> ' + E.STYLES[s.style].desc + '</p><p style="font-size:12.5px">You pick a new style each season.</p>'
          : '<p>Pick one for this season:</p>' + Object.keys(E.STYLES).map(k => '<button class="pill styleBtn" data-k="' + k + '"><b>' + E.STYLES[k].name + '</b><span>' + E.STYLES[k].desc + '</span></button>').join('')) + '</div>' : '') +
        '<div class="card"><h3>Ribbon milestones</h3>' + E.MILESTONES.map(m => '<div class="mile" data-at="' + m.at + '"><span class="mA">' + m.at + '</span><span class="mT"><b>' + m.name + '</b><span>' + m.desc + '</span></span></div>').join('') + '</div>' +
        '<div class="card"><h3>How seasons work</h3><p>Sugaring season doesn\'t last forever. When you end a season, the judges award <b>Grade A ribbons</b> for the syrup you boiled this season. Every ribbon is <b>+10% sap, boiling and taps, forever</b>.</p><p>You start the new season from scratch: sap, syrup, producers and upgrades reset. Ribbons, achievements and stats stay.</p></div>';
      $('btnEnd').addEventListener('click', () => { AU.unlock(); confirmSeason(); });
      seasonBody.querySelectorAll('.styleBtn').forEach(b => b.addEventListener('click', () => { AU.unlock(); pickStyle(b.dataset.k); }));
      lastRib = -1;
    }
    if (lastRib !== s.ribbons) { lastRib = s.ribbons; $('sRib').src = ART.ribbonImg(s.ribbons || 0); }
    setText($('sRibN'), 'sRibN', s.ribbons + ' Grade A ribbon' + (s.ribbons === 1 ? '' : 's'));
    setText($('sRibB'), 'sRibB', s.ribbons ? '+' + Math.round(s.ribbons * E.RIBBON_BONUS * 100) + '% to everything you make' : 'Win ribbons by ending a sugaring season.');
    setText($('sTitle'), 'sTitle', 'Season ' + s.season.n + ' · ' + E.fmtTime(s.season.time));
    setText($('sInfo'), 'sInfo', 'Syrup boiled this season: ' + fmt(pv.seasonSyrup, 1));
    const prevAt = E.syrupForRibbons(pv.gain), frac = (pv.seasonSyrup - prevAt) / Math.max(1, pv.nextAt - prevAt);
    $('sMeter').style.width = Math.round(Math.min(1, Math.max(0, frac)) * 100) + '%';
    setText($('sNext'), 'sNext', 'Next ribbon at ' + fmt(pv.nextAt) + ' syrup (' + fmt(Math.max(0, pv.toNext)) + ' to go)');
    const btn = $('btnEnd');
    btn.disabled = pv.gain < 1;
    setText($('sGain'), 'sGain', pv.gain >= 1 ? 'Win ' + pv.gain + ' ribbon' + (pv.gain === 1 ? '' : 's') + ' · +' + Math.round(pv.gain * E.RIBBON_BONUS * 100) + '% forever' : 'Boil ' + fmt(E.syrupForRibbons(1)) + ' syrup this season for ' + (s.ribbons ? 'another' : 'your first') + ' ribbon');
    const hint = pv.gain < 1 ? '' : s.totals.seasons === 0 && pv.gain < 10 ? 'Tip: most sugarmakers end their first season at about 10 ribbons.' : pv.gain >= Math.max(10, s.ribbons) ? 'This would more than double your ribbons. Good time to end it!' : 'More syrup this season means more ribbons.';
    setText($('sHint'), 'sHint', hint);
    seasonBody.querySelectorAll('.mile').forEach(m => m.classList.toggle('got', s.ribbons >= +m.dataset.at));
  }
  let lastRib = -1;

  function confirmSeason() {
    const pv = E.prestigePreview(s);
    if (pv.gain < 1) return;
    modal('End Season ' + s.season.n + '?',
      '<div class="gain"><div><small>Ribbons</small><b>' + pv.now + ' → ' + pv.after + '</b></div><div><small>Bonus</small><b>+' + Math.round(pv.bonusNow * 100) + '% → +' + Math.round(pv.bonusAfter * 100) + '%</b></div></div>' +
      '<p><b>You keep:</b> ribbons, achievements, stats.</p><p><b>You reset:</b> sap, syrup, producers and upgrades.</p>' +
      (E.MILESTONES.filter(m => m.at > pv.now && m.at <= pv.after).map(m => '<p><b>New milestone: ' + m.name + '.</b> ' + m.desc + '</p>').join('')),
      [{ txt: 'Ring the bell', sub: 'End the season, win ' + pv.gain + ' ribbon' + (pv.gain === 1 ? '' : 's'), cls: 'big blue', fn: doEndSeason }, { txt: 'Keep sugaring', cls: 'pill' }]);
  }
  function doEndSeason() {
    const pv = E.endSeason(s);
    if (!pv) return;
    toastQ.length = 0; $('toasts').innerHTML = '';
    d = E.derive(s);
    AU.season(); vib([20, 40, 20, 40, 60]); thumpPanel();
    const L = ART.layout();
    for (let i = 0; i < 4; i++) setTimeout(() => ART.burst(L.W * (.2 + Math.random() * .6), L.H * (.3 + Math.random() * .3), 22, i % 2 ? '#9fd0ff' : '#fff6b0'), i * 160);
    prodSig = ''; upgSig = ''; seasonBuilt = false; s.tut.seenSeasonGain = 0;
    save();
    setTab('prod');
    modal('Season ' + s.season.n + ' begins', '<p style="text-align:center"><img alt="" style="width:90px" src="' + ART.ribbonImg(s.ribbons) + '"></p><p style="text-align:center">The judges loved it. You now hold <b>' + s.ribbons + ' Grade A ribbons</b>: <b>+' + Math.round(s.ribbons * E.RIBBON_BONUS * 100) + '%</b> to everything.</p><p style="text-align:center">The snow is melting and the sap is running. <b>How will you sugar this season?</b></p>' + (s.totals.seasons === 1 ? '<p style="text-align:center;font-size:13px">Tip: <b>Menu → Save code</b> keeps a backup of your ribbons.</p>' : ''),
      Object.keys(E.STYLES).map((k, i) => ({ txt: E.STYLES[k].name, sub: E.STYLES[k].desc, cls: 'big', fn: () => pickStyle(k) })),
      () => setTimeout(() => { if (!s.style) toast('ribbon', 'Season style', 'Pick one in the Season tab', 'Tapper, Boiler or Forager.', 3); }, 0));
  }
  function pickStyle(k) {
    if (s.style || !E.STYLES[k]) return;
    s.style = k; d = E.derive(s); seasonBuilt = false; bestAt = -1e9;
    AU.upgrade(); vib([8, 20, 8]);
    toast('ribbon', 'Season style', E.STYLES[k].name, E.STYLES[k].desc, 2.8);
    if (tab === 'season') refreshSeason(true);
    save();
  }

  // ------------------------------------------------------------------ toasts
  // One compact toast at a time, up top under the HUD (never over the tree or the bucket); the rest wait their turn.
  const toastQ = []; let toastBusy = false;
  function toast(ic, small, title, sub, life, cls) {
    toastQ.push({ ic, small, title, sub: small === 'Achievement' ? '' : sub, life: life || 3, cls });
    if (toastQ.length > 4) { const a = toastQ.findIndex(q => q.small === 'Achievement'); toastQ.splice(a >= 0 ? a : toastQ.length - 1, 1); } // drop the oldest achievement, else the newcomer
    if (!toastBusy) nextToast();
  }
  function nextToast() {
    if (toastQ.length && !M.classList.contains('hidden')) { toastBusy = true; setTimeout(nextToast, 500); return; } // wait until the dialog closes
    const q = toastQ.shift(); toastBusy = !!q; if (!q) return;
    const box = $('toasts');
    const life = toastQ.length ? Math.min(q.life, 1.7) : q.life; // shorter when others are waiting
    const n = document.createElement('div'); n.className = 'toast' + (q.cls ? ' ' + q.cls : '');
    n.style.setProperty('--life', life + 's');
    n.innerHTML = '<span class="tI"><img alt="" src="' + ART.icon(q.ic) + '"></span><span class="tT"><small></small><b></b><span></span></span>'; n.querySelector('small').textContent = q.small; n.querySelector('b').textContent = q.title; n.querySelector('.tT span').textContent = q.sub || '';
    box.innerHTML = ''; box.appendChild(n);
    setTimeout(() => { n.remove(); nextToast(); }, (life + .4) * 1000);
  }
  function checkAch() {
    const h = new Date().getHours(); if (h < 4) s.flags.night = true;
    const got = E.checkAch(s, d);
    got.forEach((a, i) => setTimeout(() => { AU.ach(); toast('ribbon', 'Achievement', a.name, a.desc, 3); }, i * 700));
  }

  // ------------------------------------------------------------------ modal
  const M = $('modal');
  let modalOnClose = null;
  function modal(title, html, buttons, onClose) {
    $('mTitle').textContent = title;
    $('mBody').innerHTML = html;
    const mb = $('mBtns'); mb.innerHTML = '';
    (buttons || [{ txt: 'Close', cls: 'big' }]).forEach(b => {
      const n = document.createElement('button'); n.className = b.cls || 'pill';
      n.innerHTML = '<span></span>' + (b.sub ? '<small></small>' : '');
      n.querySelector('span').textContent = b.txt; if (b.sub) n.querySelector('small').textContent = b.sub;
      if (b.id) n.id = b.id;
      n.addEventListener('click', () => { AU.unlock(); AU.ui(); if (b.keep) { b.fn && b.fn(); return; } closeModal(); b.fn && b.fn(); });
      mb.appendChild(n);
    });
    M.classList.remove('hidden'); M.classList.remove('show'); void M.offsetWidth; M.classList.add('show');
    modalOnClose = onClose || null;
  }
  function thumpPanel() { const p = M.querySelector('.panel'); p.classList.remove('thump'); void p.offsetWidth; p.classList.add('thump'); }
  function closeModal() { M.classList.add('hidden'); const f = modalOnClose; modalOnClose = null; if (f) f(); }
  M.addEventListener('pointerdown', e => { if (e.target === M) closeModal(); });

  function showAway(sum) {
    AU.away();
    s.totals.offlineCollects++;
    if (sum.capped) s.flags.awayMax = true;
    modal('While you were away',
      '<p style="text-align:center">You were gone <b>' + E.fmtTime(sum.secs) + '</b>.' + (sum.capped ? ' The buckets overflowed after <b>' + (sum.cap / 3600) + ' hours</b>, so that\'s all that counted.' : ' The trees kept dripping.') + '</p>' +
      '<div class="gain"><div><small>Sap</small><b>+' + fmt(sum.sap) + '</b></div>' + (sum.syrup > 0 ? '<div><small>Syrup</small><b>+' + fmt(sum.syrup, 1) + '</b></div>' : '') + '</div>',
      [{ txt: 'Back to the sugarbush', cls: 'big' }]);
  }

  // ------------------------------------------------------------------ menu, stats, achievements, settings
  $('btnMenu').addEventListener('click', () => { AU.unlock(); AU.ui(); openMenu(); });
  $('btnSound').addEventListener('click', () => {
    AU.unlock();
    s.settings.mute = !s.settings.mute; AU.setOn(!s.settings.mute); app.classList.toggle('muted', s.settings.mute);
    if (s.settings.mute) s.flags.muted = true; else AU.ui();
    save();
  });
  function openMenu() {
    const got = Object.keys(s.ach).length;
    modal('Sap Tapper', '<div class="menuGrid">' +
      '<button class="pill" id="mStats">Stats</button><button class="pill" id="mAch">Achievements ' + got + '/' + E.ACH.length + '</button>' +
      '<button class="pill" id="mHow">How to play</button><button class="pill" id="mSave">Save code</button>' +
      '<button class="pill" id="mSnd">Sound: ' + (s.settings.mute ? 'off' : 'on') + '</button><button class="pill" id="mMus">Music: ' + (s.settings.music !== false ? 'on' : 'off') + '</button>' +
      '<button class="pill danger" id="mReset" style="grid-column:1/-1">Erase game</button></div>',
      [{ txt: 'Back to tapping', cls: 'big' }]);
    $('mStats').onclick = openStats; $('mAch').onclick = openAch; $('mHow').onclick = openHow; $('mSave').onclick = openSave; $('mReset').onclick = openReset;
    $('mSnd').onclick = () => { $('btnSound').click(); $('mSnd').textContent = 'Sound: ' + (s.settings.mute ? 'off' : 'on'); };
    $('mMus').onclick = () => { s.settings.music = s.settings.music === false; AU.music(s.settings.music); $('mMus').textContent = 'Music: ' + (s.settings.music ? 'on' : 'off'); save(); };
  }
  function openStats() {
    const T = s.totals, row = (a, b) => '<tr><td>' + a + '</td><td>' + b + '</td></tr>';
    modal('Stats', '<table class="stats">' +
      row('Season', s.season.n + ' (' + E.fmtTime(s.season.time) + ')') +
      row('Sap per second', fmt(d.sapPs, 1)) + row('Syrup per second', fmt(d.syrupPs, 2)) +
      row('Sap per tap', fmt(d.tapValue, 1)) + row('Boiling ratio', d.ratio + ' : 1') +
      row('Grade A ribbons', s.ribbons + ' (+' + Math.round(s.ribbons * E.RIBBON_BONUS * 100) + '%)') +
      row('Sap this season', fmt(s.season.sapEarned)) + row('Syrup this season', fmt(s.season.syrupEarned, 1)) +
      row('Sap, all time', fmt(T.sapAll)) + row('Syrup, all time', fmt(T.syrupAll, 1)) +
      row('Best sap per second', fmt(T.bestSapPs, 1)) +
      row('Taps', fmt(T.taps)) + row('Sap from taps', fmt(T.sapTapped)) +
      row('Producers bought', fmt(T.bought)) + row('Upgrades owned', Object.keys(s.upg).length + ' / ' + E.UPGRADES.length) +
      row('Glowing buckets caught', T.events) + row('Sap runs', T.frenzies) +
      row('Seasons finished', T.seasons) + row('Earned while away', fmt(T.offlineSap) + ' sap') +
      row('Achievements', Object.keys(s.ach).length + ' / ' + E.ACH.length) +
      row('Time played', E.fmtTime(T.playTime)) + '</table>', [{ txt: 'Back', cls: 'big', fn: openMenu, }]);
  }
  function openAch() {
    modal('Achievements · ' + Object.keys(s.ach).length + '/' + E.ACH.length, '<div class="achGrid">' +
      E.ACH.map(a => '<div class="ach' + (s.ach[a.id] ? ' got' : '') + '"><b>' + a.name + '</b><span>' + a.desc + '</span></div>').join('') + '</div>',
      [{ txt: 'Back', cls: 'big', fn: openMenu }]);
  }
  function openHow() {
    modal('How to play', '<p><b>Tap the tree</b> (anywhere in the picture) to collect sap.</p>' +
      '<p><b>Buy producers</b> in the shop below. Tappers bring in sap by themselves. <b>Boilers</b> (kettles, evaporators, sugarhouses) turn sap into <b>syrup</b> at <b>40 : 1</b>.</p>' +
      '<p>The evaporator line can boil up to <b>half</b> of your sap flow; the bar above the shop shows how much of that half your boilers can handle.</p>' +
      '<p><b>Syrup</b> buys the good stuff: upgrades and the fancy late-game producers.</p>' +
      '<p><b>Glowing buckets</b> drift by now and then. Tap one for a sap run or a lump of sap.</p>' +
      '<p><b>Hold</b> a buy button to keep buying. When the season tab lights up, you can end the season for permanent <b>Grade A ribbons</b>.</p>' +
      '<p>The game keeps sugaring while you\'re away (up to ' + E.offlineCapH(s) + ' hours).</p>', [{ txt: 'Back', cls: 'big', fn: openMenu }]);
  }
  function openSave() {
    s.flags.exported = true;
    save();
    const code = E.exportCode(s);
    modal('Save code', '<p>Copy this code somewhere safe. Paste it on any device to bring your sugarbush with you.</p>' +
      '<textarea class="code" id="expCode" readonly></textarea>' +
      '<p style="margin-top:12px"><b>Load a code</b></p><textarea class="code" id="impCode" placeholder="Paste a SAPTAP code here"></textarea><div class="err" id="impErr"></div>',
      [{ txt: 'Copy my code', cls: 'big', keep: true, fn: copyCode }, { txt: 'Load pasted code', cls: 'pill', keep: true, fn: doImport }, { txt: 'Back', cls: 'pill', fn: openMenu }]);
    $('expCode').value = code;
  }
  function copyCode() {
    const ta = $('expCode'); if (!ta) return;
    const done = () => { $('impErr').style.color = '#2e5a4c'; $('impErr').textContent = 'Copied!'; };
    try { navigator.clipboard.writeText(ta.value).then(done, () => { ta.select(); document.execCommand('copy'); done(); }); }
    catch (e) { ta.select(); try { document.execCommand('copy'); done(); } catch (e2) { } }
  }
  function doImport() {
    const v = $('impCode').value;
    let ns;
    try { ns = E.importCode(v); } catch (e) { $('impErr').style.color = ''; $('impErr').textContent = e.message; return; }
    modal('Load this save?', '<p>This replaces your current game with <b>Season ' + ns.season.n + '</b>, <b>' + fmt(ns.sap) + ' sap</b>, <b>' + ns.ribbons + ' ribbons</b>.</p>',
      [{ txt: 'Yes, load it', cls: 'big', fn: () => { replaceState(ns); toast('ratio', 'Save loaded', 'Welcome back!', '', 2.4); } }, { txt: 'Cancel', cls: 'pill', fn: openSave }]);
  }
  function openReset() {
    modal('Erase everything?', '<p>This deletes your sap, syrup, ribbons, achievements and stats on this device. It can\'t be undone (unless you saved a code).</p>',
      [{ txt: 'Erase my game', cls: 'pill danger', fn: () => { try { localStorage.removeItem(KEY); } catch (e) { } replaceState(E.newState()); } }, { txt: 'Keep it', cls: 'big', fn: openMenu }]);
  }
  function replaceState(ns) {
    s = ns; s.lastSeen = Date.now(); d = E.derive(s);
    prodSig = ''; upgSig = ''; seasonBuilt = false; buffSig = ''; visUpg(true); bestAt = -1e9; goalShown = -1; dailyMode = false; dayChecked = 0; goalEl.classList.remove('daily'); goalEl.querySelector('small').textContent = "Sugarmaker's list"; last.goalS = last.goalT = last.goalP = null;
    AU.setOn(!s.settings.mute); app.classList.toggle('muted', !!s.settings.mute);
    syncAmtSeg(); save(); setTab('prod'); refreshUI();
  }

  // ------------------------------------------------------------------ Sugarmaker's list (first-season goals)
  // One goal at a time in a chip at the bottom-left of the scene. Each pays a little sap, so the first
  // ten minutes always have a "next thing" and a small win every minute or so.
  const own = id => s.owned[id] || 0;
  const GOALS = [
    { t: 'Tap the tree 15 times', p: () => [s.totals.taps, 15], r: 10 },
    { t: 'Buy a Spile & Bucket', p: () => [own('spile'), 1], r: 10, go: 'spile' },
    { t: 'Own 5 Spiles & Buckets', p: () => [own('spile'), 5], r: 25, go: 'spile' },
    { t: 'Buy a Backyard Kettle', p: () => [own('kettle'), 1], r: 40, go: 'kettle' },
    { t: 'Boil your first syrup', p: () => [s.totals.syrupAll, 1], r: 40, f: 1 },
    { t: 'Buy a Sap Bag', p: () => [own('bag'), 1], r: 60, go: 'bag' },
    { t: 'Tap a glowing bucket', p: () => [s.totals.events, 1], r: 80, ev: 1 },
    { t: 'Buy an upgrade', p: () => [Object.keys(s.upg).length, 1], r: 100, go: 'upg' },
    { t: 'Reach 25 sap per second', p: () => [d.netSap / d.frenzy, 25], r: 150, ps: 1 },
    { t: 'Buy a Gathering Sled', p: () => [own('sled'), 1], r: 500, go: 'sled' },
    { t: 'Buy a Wood-Fired Evaporator', p: () => [own('evap'), 1], r: 1500, go: 'evap' },
  ];
  const goalEl = $('goal'), goalT = $('goalT'), goalP = $('goalP');
  let goalBusy = false, goalShown = -1;
  function goalIdx() {
    if (s.tut.goal == null) { // veterans skip the list; a season-1 save in progress skips (unpaid) what it already did
      let i = 0;
      if (s.totals.seasons > 0 || s.totals.bought > 150) i = GOALS.length;
      else while (i < GOALS.length && (() => { const [c, n] = GOALS[i].p(); return c >= n; })()) i++;
      s.tut.goal = i;
    }
    return s.tut.goal;
  }
  function goalReward(g) { return Math.max(g.r, Math.round(d.sapPs / d.frenzy * 12)); }
  function refreshGoal() {
    if (!started || goalBusy) return;
    const i = goalIdx();
    if (i >= GOALS.length || s.totals.seasons > 0) { refreshDaily(); return; }
    const g = GOALS[i], [cur, need] = g.p();
    if (goalShown !== i) { goalShown = i; goalT.textContent = g.t; goalEl.classList.remove('off'); goalEl.classList.toggle('nogo', !g.go); }
    if (cur >= need) { claimGoal(i, g); return; }
    const txt = need > 1 ? (g.ps ? fmt(cur, 1) : g.f ? cur.toFixed(2) : fmt(Math.floor(cur))) + '/' + fmt(need) : '+' + fmt(goalReward(g)) + ' sap';
    setText(goalP, 'goalP', txt);
    // teach by doing: when the goal is the glowing bucket, send one by soon
    if (g.ev && !s.event && s.nextEventAt > s.clock + 12) s.nextEventAt = s.clock + 6;
  }
  // tapping the strip takes you to what it asks for (or, once the list is done, opens today's chores)
  goalEl.addEventListener('click', () => {
    if (dailyMode) { AU.unlock(); AU.ui(); openDaily(); return; }
    const g = GOALS[goalIdx()]; if (!g || !g.go || goalBusy) return;
    AU.unlock(); AU.ui();
    if (g.go === 'upg') { if (!tabs[1].classList.contains('hidden')) setTab('upg'); return; }
    if (tab !== 'prod') setTab('prod');
    const R = prodRows[g.go]; if (!R) return;
    R.r.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    R.r.classList.remove('flash'); void R.r.offsetWidth; R.r.classList.add('flash');
  });
  function claimGoal(i, g) {
    goalBusy = true;
    const amt = goalReward(g);
    s.sap += amt; s.season.sapEarned += amt; s.totals.sapAll += amt;
    s.tut.goal = i + 1;
    setText(goalP, 'goalP', '+' + fmt(amt) + ' sap');
    goalEl.classList.add('done');
    AU.goal(); vib([6, 30, 10]);
    // the reward flies up out of the shop into the sap counter
    const r = cv.getBoundingClientRect(), gr = goalEl.getBoundingClientRect();
    aimFly(); ART.fly(gr.right - 40 - r.left, Math.min(r.height - 4, gr.top - r.top), 8, true);
    ART.pop(r.width * .62, r.height - 46, '+' + fmt(amt) + ' sap', '#c9f2b0', 22, 1.4);
    // swap to the next goal in place (fade the text only), so the shop below never moves; collapse once, at the very end
    setTimeout(() => {
      const last = s.tut.goal >= GOALS.length;
      goalEl.classList.add('swap'); // the strip stays: after the list it turns into today's chores
      setTimeout(() => {
        goalEl.classList.remove('done', 'swap'); goalBusy = false; goalShown = -1;
        if (last) toast('ribbon', "Sugarmaker's list", 'All done!', 'You know the ropes. Now grow that sugarbush.', 3.2, 'goal');
        refreshGoal();
      }, 260);
    }, 1100);
  }

  // ------------------------------------------------------------------ daily chores (a reason to come back tomorrow)
  // Three small chores per calendar day, picked from the date and scaled to your progress when the day starts.
  // Each pays ~2 minutes of flow; all three win Grade A ribbons (+5% of what you hold, at least 1) and grow a day streak.
  const CHORES = {
    taps: { t: n => 'Tap the tree ' + fmt(n) + ' times', c: () => s.totals.taps, n: r => 300 + 100 * Math.floor(r * 4) },
    bought: { t: n => 'Buy ' + n + ' producers', c: () => s.totals.bought, n: r => 30 + 10 * Math.floor(r * 4) },
    syrup: { t: n => 'Boil ' + fmt(n) + ' syrup', c: () => s.totals.syrupAll, n: r => nice(Math.max(10, d.syrupPs / d.frenzy * (900 + 900 * r))) },
    upg: { t: n => 'Buy ' + n + ' upgrades', c: () => s.totals.upgBought || 0, n: r => 3 + Math.floor(r * 3) },
    // skill chores: one of these every day
    streak: { t: n => 'Hit a ×' + n + ' tap streak', c: () => (s.daily && s.daily.bestStreak) || 0, n: r => 40 + 10 * Math.floor(r * 4), abs: 1, skill: 1 },
    events: { t: n => 'Catch ' + n + ' glowing buckets', c: () => s.totals.events, n: r => 3 + (r > .6), skill: 1 },
    runs: { t: n => 'Start ' + n + ' Sap Runs', c: () => s.totals.frenzies, n: r => 2, skill: 1 },
  };
  function nice(x) { const p = Math.pow(10, Math.floor(Math.log10(x))); return Math.ceil(x / p * 2) / 2 * p; }
  function dayKey(t) { const z = new Date(t || Date.now()); return z.getFullYear() + '-' + (z.getMonth() + 1) + '-' + z.getDate(); }
  function dayRng(key) { let h = 2166136261; for (const ch of key) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; }
  let dailyMode = false, dayChecked = 0;
  function ensureDaily() {
    const now = performance.now(); if (s.daily && now - dayChecked < 5000) return s.daily; dayChecked = now;
    const key = dayKey();
    if (s.daily && s.daily.day === key && s.daily.chores.every(c => CHORES[c.k])) return s.daily;
    const R = dayRng(key), shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const all = Object.keys(CHORES), keys = [shuffle(all.filter(k => CHORES[k].skill))[0], ...shuffle(all.filter(k => !CHORES[k].skill)).slice(0, 2)];
    const prev = s.daily;
    const yesterday = dayKey(Date.now() - 864e5);
    s.daily = { day: key, chores: keys.slice(0, 3).map(k => { const n = CHORES[k].n(R()); return { k, n, base: CHORES[k].abs ? 0 : CHORES[k].c(), got: 0 }; }),
      bestStreak: 0, all: 0, streak: prev && prev.all && prev.day === yesterday ? prev.streak || 1 : 0 };
    if (prev && dailyMode) toast('ribbon', 'New day', "Today's chores are ready", 'Finish all three for Grade A ribbons.', 3, 'goal');
    return s.daily;
  }
  function choreProg(ch) { return Math.max(0, CHORES[ch.k].c() - ch.base); }
  function streakMul(n) { return n >= 7 ? 3 : n >= 3 ? 2 : 1; }
  function dailyRibbons(streakAfter) { return Math.max(1, Math.round(s.ribbons * .03)) * streakMul(streakAfter == null ? ((s.daily && s.daily.streak) || 0) + 1 : streakAfter); }
  function refreshDaily() {
    const D = ensureDaily();
    if (!dailyMode) { dailyMode = true; goalShown = -1; last.goalT = last.goalP = last.goalS = null; goalEl.classList.remove('off', 'nogo'); goalEl.classList.add('daily'); }
    setText(goalEl.querySelector('small'), 'goalS', "Today's chores" + (D.streak ? ' · ' + D.streak + '-day streak' : ''));
    D.chores.forEach(c => { if (!c.got && choreProg(c) >= c.n) claimChore(c); });
    const open = D.chores.find(c => !c.got);
    if (!open) { setText(goalT, 'goalT', 'All done for today. New chores tomorrow!'); setText(goalP, 'goalP', ''); return; }
    setText(goalT, 'goalT', CHORES[open.k].t(open.n));
    setText(goalP, 'goalP', open.k === 'streak' ? '×' + Math.min(open.n, choreProg(open)) : fmt(Math.min(open.n, Math.floor(choreProg(open)))) + '/' + fmt(open.n));
  }
  function claimChore(c) {
    const D = s.daily; c.got = 1;
    const amt = Math.max(100, Math.round(d.sapPs / d.frenzy * 120));
    s.sap += amt; s.season.sapEarned += amt; s.totals.sapAll += amt;
    AU.goal(); vib([6, 30, 10]);
    const r = cv.getBoundingClientRect(), gr = goalEl.getBoundingClientRect();
    aimFly(); ART.fly(gr.right - 40 - r.left, Math.min(r.height - 4, gr.top - r.top), 8, true);
    goalEl.classList.remove('done'); void goalEl.offsetWidth; goalEl.classList.add('done'); setTimeout(() => goalEl.classList.remove('done'), 1100);
    toast('ratio', 'Chore done', CHORES[c.k].t(c.n), '+' + fmt(amt) + ' sap', 2.4, 'goal');
    if (D.chores.every(x => x.got) && !D.all) {
      D.all = 1; D.streak = (D.streak || 0) + 1;
      const rib = dailyRibbons(D.streak); s.ribbons += rib; d = E.derive(s);
      setTimeout(() => {
        AU.season(); vib([20, 40, 20]); setTimeout(thumpPanel, 30);
        const L = ART.layout(); ART.burst(L.W / 2, L.H * .5, 30, '#9fd0ff');
        modal("Today's chores: done!", '<p style="text-align:center"><img alt="" style="width:80px" src="' + ART.ribbonImg(s.ribbons) + '"></p>' +
          '<p style="text-align:center">The judges stopped by and liked what they saw: <b>+' + rib + ' Grade A ribbon' + (rib > 1 ? 's' : '') + '</b> (+' + Math.round(rib * E.RIBBON_BONUS * 100) + '% to everything, forever).</p>' +
          '<p style="text-align:center"><b>' + D.streak + '-day streak.</b> ' + (D.streak < 3 ? 'Reach 3 days for double ribbons.' : D.streak < 7 ? 'Reach 7 days for triple ribbons.' : 'Triple ribbons every day you keep it up.') + ' New chores tomorrow.</p>', [{ txt: 'Back to the sugarbush', cls: 'big' }]);
      }, 900);
    }
  }
  function openDaily() {
    const D = ensureDaily();
    modal("Today's chores · " + D.chores.filter(c => c.got).length + ' of 3 done', D.chores.map(c => { const p = Math.min(1, choreProg(c) / c.n); return '<div class="chore' + (c.got ? ' got' : '') + '"><b>' + CHORES[c.k].t(c.n) + '<em>' + (c.got ? 'done' : fmt(Math.min(c.n, Math.floor(choreProg(c)))) + ' / ' + fmt(c.n)) + '</em></b><div class="meter"><i style="width:' + Math.round((c.got ? 1 : p) * 100) + '%"></i></div></div>'; }).join('') +
      '<p style="text-align:center;margin-top:10px">Each chore: a bucket of sap. All three: <b>+' + dailyRibbons() + ' Grade A ribbon' + (dailyRibbons() > 1 ? 's' : '') + '</b>.' + (D.streak ? '<br>Streak: <b>' + D.streak + ' day' + (D.streak > 1 ? 's' : '') + '</b>.' : '') + '</p>', [{ txt: 'Back to tapping', cls: 'big' }]);
  }

  // ------------------------------------------------------------------ ghost hand tutorial
  const ghost = $('ghost');
  function positionGhost() {
    if (!s || !started || s.tut.done) { ghost.classList.add('hidden'); return; }
    if (s.owned.spile && s.owned.kettle && s.totals.taps >= 3) { s.tut.done = 1; ghost.classList.add('hidden'); return; }
    let x = null, y = null;
    if (s.totals.taps < 3 && s.totals.seasons === 0) {
      const L = ART.layout(); const r = cv.getBoundingClientRect();
      x = r.left + L.tx + 10; y = r.top + L.ty - L.H * .22;
    } else if (!s.owned.spile && s.sap >= 12 && tab === 'prod' && prodRows.spile) {
      const r = prodRows.spile.r.getBoundingClientRect(); x = r.right - 50; y = r.top + r.height * .55;
    } else if (s.owned.spile && !s.owned.kettle && s.sap >= 75 && tab === 'prod' && prodRows.kettle && !s.tut.kettleHint) {
      const r = prodRows.kettle.r.getBoundingClientRect(); x = r.right - 50; y = r.top + r.height * .55;
    }
    if (s.owned.kettle) s.tut.kettleHint = 1;
    if (x === null) { ghost.classList.add('hidden'); return; }
    ghost.classList.remove('hidden'); ghost.style.left = x + 'px'; ghost.style.top = y + 'px';
  }

  // first visit of a new day: the overnight freeze-thaw gets the sap running (a free 60 s Sap Run).
  // Waits until no dialog is open (so it isn't spent behind "While you were away"), and extends a live run.
  function morningRun() {
    if (!started) return;
    const today = dayKey();
    if (s.tut.runDay == null) { s.tut.runDay = today; return; } // not on the very first day
    if (s.tut.runDay === today || E.derive(s).sapPs < 1) return;
    if (!M.classList.contains('hidden')) { setTimeout(morningRun, 700); return; }
    s.tut.runDay = today;
    const on = s.buffs.find(b => b.type === 'frenzy' && b.until > s.clock);
    if (on) { on.until += 60; on.dur += 60; } else s.buffs.push({ type: 'frenzy', mult: 7, until: s.clock + 60, dur: 60 });
    d = E.derive(s);
    toast('ratio', 'Good morning', 'Freeze-thaw night: the sap is running!', 'Sap Run \u00d77 for 60 s.', 3.2, 'goal'); AU.sparkleCatch(); ART.shake(3); refreshBuffs(true);
  }

  // ------------------------------------------------------------------ title
  $('btnStart').addEventListener('click', start);
  $('title').addEventListener('click', start); // tap anywhere on the title
  function start() {
    if (started) return;
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { }
    AU.unlock(); AU.ui();
    AU.music(s.settings.music !== false);
    started = true;
    $('title').classList.add('out');
    setTimeout(() => $('title').classList.add('hidden'), 360);
    if (pendingAway) { const p = pendingAway; pendingAway = null; setTimeout(() => showAway(p), 380); }
    setTimeout(morningRun, 900);
    positionGhost();
  }

  ['touchend', 'pointerup', 'click', 'keydown'].forEach(ev => document.addEventListener(ev, () => AU.unlock(), { capture: true, passive: true }));
  ['pointerdown', 'keydown', 'wheel'].forEach(ev => document.addEventListener(ev, () => { lastInput = performance.now(); }, { capture: true, passive: true }));

  // keyboard: space/enter taps the tree on desktop
  window.addEventListener('keydown', e => {
    if (!M.classList.contains('hidden')) { if (e.key === 'Escape') closeModal(); return; }
    if (!started) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); start(); } return; }
    if (e.target && e.target.closest && e.target.closest('.row, .tab, button')) return;
    if (e.key === ' ' || e.key === 't') { e.preventDefault(); AU.unlock(); const L = ART.layout(); doTap(L.tx + (Math.random() - .5) * 60, L.ty - L.H * .3); }
    if (e.key === '1') setTab('prod'); if (e.key === '2' && !tabs[1].classList.contains('hidden')) setTab('upg'); if (e.key === '3' && !tabs[2].classList.contains('hidden')) setTab('season');
  });

  // ------------------------------------------------------------------ test hooks
  window.__T = {
    E, get s() { return s; },
    start() { start(); return true; },
    state() { return JSON.parse(E.serialize(s)); },
    derive() { return E.derive(s); },
    step(ms) { let rem = ms / 1000; while (rem > 0) { const h = Math.min(rem, .1); d = E.tick(s, h); rem -= h; } refreshUI(); return s.sap; },
    tap(n, x, y) { const L = ART.layout(); for (let i = 0; i < (n || 1); i++) doTap(x != null ? x : L.tx, y != null ? y : L.ty - L.H * .3); return s.sap; },
    give(sap, syr) { s.sap += sap || 0; s.syrup += syr || 0; s.totals.sapAll += sap || 0; s.season.sapEarned += sap || 0; s.totals.syrupAll += syr || 0; s.season.syrupEarned += syr || 0; d = E.derive(s); refreshUI(); },
    buy(id, k) { const n = E.buyProducer(s, id, k || 1); d = E.derive(s); refreshUI(); return n; },
    upgrade(id) { const ok = E.buyUpgrade(s, id); d = E.derive(s); refreshUI(); return ok; },
    away(secs) { awayFor(secs, true); return s.sap; },
    spawnEvent() { s.nextEventAt = s.clock; d = E.tick(s, .01); return evView(); },
    catchEvent() { const v = evView(); if (!v) return null; const L = ART.layout(); return catchSparkle(L.W / 2, L.H / 2), s.totals.events; },
    sparklePos() { const v = evView(); return v && ART.sparklePos(v); },
    endSeason() { doEndSeason(); return s.ribbons; },
    save() { save(); return localStorage.getItem(KEY).length; },
    reload() { s = loadSave(); d = E.derive(s); prodSig = ''; upgSig = ''; refreshUI(); return s; },
    exportCode() { return E.exportCode(s); },
    importCode(c) { replaceState(E.importCode(c)); return s; },
    setTab, modal, closeModal, refreshUI, pickStyle, openDaily,
    daily() { return ensureDaily(); },
    reset() { replaceState(E.newState()); },
    /** Pretend the player closed the tab `secs` ago, then reload (tests boot-time offline earnings). */
    reloadAsIfAway(secs) { save(); const o = JSON.parse(localStorage.getItem(KEY)); o.lastSeen = Date.now() - secs * 1000; localStorage.setItem(KEY, JSON.stringify(o)); skipSave = true; location.reload(); },
  };

  // ------------------------------------------------------------------ go
  ART.init(cv);
  boot();
  syncAmtSeg();
  layout(true);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { ART.resize(Math.round(sceneWrap.getBoundingClientRect().width), Math.round(sceneWrap.getBoundingClientRect().height), dpr); });
  refreshUI();
  requestAnimationFrame(t0 => { lastNow = t0; requestAnimationFrame(loop); });
})();
