/* Sap Tapper — pure game engine: data, formulas, tick, buying, prestige, offline, save codes.
   No DOM. Loaded by index.html (window.SapEngine) and by node (sim.js, test.js). */
(function (root) {
  'use strict';

  const SAVE_VERSION = 1;
  const GROWTH = 1.15;          // producer cost growth per owned
  const FLOW_SHARE = 0.5;       // evaporator line may boil at most this share of passive sap flow
  const BASE_RATIO = 40;        // 40 sap -> 1 syrup. The running joke.
  const RIBBON_K = 2e5;        // season syrup per ribbon^2  (ribbons = floor(sqrt(syrup / K)))
  const RIBBON_BONUS = 0.10;    // +10% production per ribbon
  const OFFLINE_CAP_H = 8;
  const EVENT_LIFE = 13;        // seconds a sparkle bucket drifts before it's gone

  // ---------------------------------------------------------------- producers
  // kind 'tap' adds sap/s; kind 'boil' adds evaporator capacity (sap/s boiled).
  const PRODUCERS = [
    { id: 'spile',      name: 'Spile & Bucket',        kind: 'tap',  cost: 12,     cur: 'sap',   rate: 0.3,
      desc: 'A little spout and a tin bucket. Plink.' },
    { id: 'kettle',     name: 'Backyard Kettle',       kind: 'boil', cost: 75,     cur: 'sap',   rate: 1.5,
      desc: 'An iron kettle over a crackling fire. Boils sap into syrup.' },
    { id: 'bag',        name: 'Sap Bag',               kind: 'tap',  cost: 150,    cur: 'sap',   rate: 1.6,
      desc: 'Blue plastic bags. Less romantic, more sap.' },
    { id: 'sled',       name: 'Gathering Sled',        kind: 'tap',  cost: 2000,   cur: 'sap',   rate: 10,
      desc: 'A sled and a big tank, hauled from tree to tree through the slush.' },
    { id: 'evap',       name: 'Wood-Fired Evaporator', kind: 'boil', cost: 9000,   cur: 'sap',   rate: 40,
      desc: 'Long steel pans over a roaring arch. The real deal.' },
    { id: 'tubing',     name: 'Tubing Line',           kind: 'tap',  cost: 40000,  cur: 'sap',   rate: 80,
      desc: 'Blue tubing strung tree to tree, all running downhill.' },
    { id: 'vacuum',     name: 'Vacuum Pump',           kind: 'tap',  cost: 6e5,    cur: 'sap',   rate: 550,
      desc: 'Gently persuades the trees. Doubles what the lines bring in.' },
    { id: 'ro',         name: 'Reverse-Osmosis Rig',   kind: 'boil', cost: 3e6,    cur: 'sap',   rate: 2300,
      desc: 'Squeezes the water out before the boil. Very shiny.' },
    { id: 'sugarbush',  name: 'Sugarbush',             kind: 'tap',  cost: 1.5e7,  cur: 'sap',   rate: 6000,
      desc: 'A whole hillside of maples, every one of them tapped.' },
    { id: 'sugarhouse', name: 'Sugarhouse',            kind: 'boil', cost: 2.5e6,  cur: 'syrup', rate: 57000,
      desc: 'Steam pouring out the cupola means the boil is on.' },
    { id: 'pipeline',   name: 'Mountain Sap Pipeline', kind: 'tap',  cost: 1.9e7,  cur: 'syrup', rate: 2.5e5,
      desc: 'Runs straight down from the ridgeline. Gravity does the work.' },
    { id: 'coop',       name: 'Syrup Cooperative',     kind: 'boil', cost: 2.5e8,  cur: 'syrup', rate: 2.5e6,
      desc: 'Every sugarmaker in the valley boiling as one. Potluck on Fridays.' },
    { id: 'reservoir',  name: 'Lake-Sized Reservoir',  kind: 'tap',  cost: 3.75e9, cur: 'syrup', rate: 2.3e7,
      desc: 'A sap lake. Ferries are being discussed.' },
    { id: 'weather',    name: 'Freeze-Thaw Machine',   kind: 'tap',  cost: 7.5e10, cur: 'syrup', rate: 3e8,
      desc: 'Cold nights, warm days, on demand. Sap runs like crazy.' },
  ];
  const PLURAL = { spile: 'Spile & Buckets', kettle: 'Backyard Kettles', bag: 'Sap Bags', sled: 'Gathering Sleds', evap: 'Wood-Fired Evaporators',
    tubing: 'Tubing Lines', vacuum: 'Vacuum Pumps', ro: 'Reverse-Osmosis Rigs', sugarbush: 'Sugarbushes', sugarhouse: 'Sugarhouses',
    pipeline: 'Mountain Sap Pipelines', coop: 'Syrup Cooperatives', reservoir: 'Lake-Sized Reservoirs', weather: 'Freeze-Thaw Machines' };
  const P_BY_ID = {}; PRODUCERS.forEach((p, i) => { p.index = i; p.plural = PLURAL[p.id]; P_BY_ID[p.id] = p; });

  // ---------------------------------------------------------------- upgrades
  // effect types: pmul (producer x), tapmul, tappct (tap gains % of sap flow), syn (target +k per source),
  // ratio (set new ratio), boilmul, sapmul (all tap producers), event (event freq), allmul
  const UPGRADES = [];
  const U_BY_ID = {};
  function addU(u) { UPGRADES.push(u); U_BY_ID[u.id] = u; }

  const TIER_AT = [1, 10, 25, 50, 100, 150, 200, 250];
  const TIER_COST = [10, 50, 500, 5e4, 5e6, 5e8, 5e10, 5e12];
  const TIER_NAMES = {
    spile: ['Sharper Spiles', 'Bigger Buckets', 'Bucket Lids', 'Galvanized Pails', 'Health Spouts', 'Check-Valve Spiles', 'Golden Spiles', 'Spiles of Legend'],
    kettle: ['Dry Kindling', 'Cast-Iron Lid', 'Bellows', 'Kettle Tripod', 'Twin Kettles', 'Copper Kettle', 'Kettle Choir', 'Bottomless Kettle'],
    bag: ['Double-Seam Bags', 'Bag Holders', 'Tinted Bags', 'Jumbo Bags', 'Twist-Tie Mastery', 'Bag Wranglers', 'Bags of Holding', 'Bag Supremacy'],
    sled: ['Waxed Runners', 'Bigger Tank', 'Snowshoe Crew', 'Second Sled', 'Mud-Season Tires', 'Sled Dispatch', 'Sled Convoy', 'Sled Empire'],
    evap: ['Dry Hardwood', 'Deeper Pans', 'Steam Hood', 'Forced Draft', 'Float Valves', 'Arch Insulation', 'Draw-Off Mastery', 'Evaporator Royale'],
    tubing: ['Tight Fittings', 'Mainline Upgrade', 'Squirrel Guards', 'Drop Lines', 'Line Walkers', 'Slope Survey', 'Tubing Cathedral', 'Tubing Infinity'],
    vacuum: ['Leak Hunter', 'Releaser', 'Dual Pumps', 'Vacuum Gauges', 'Oil-Free Pump', 'Silent Running', 'Vacuum Symphony', 'Black Hole Pump'],
    ro: ['Fresh Membranes', 'High-Pressure Pump', 'Second Pass', 'Permeate Rinse', 'Membrane Stack', 'RO Cascade', 'Chrome Everything', 'Pure Concentrate'],
    sugarbush: ['Thinning Crew', 'Young Maples', 'Forest Survey', 'Red Maples Too', 'Old-Growth Giants', 'Sugarbush Trails', 'Maple Valley', 'Endless Woods'],
    sugarhouse: ['Cupola Vents', 'Wood Shed', 'Bottling Room', 'Open House Weekend', 'Pancake Kitchen', 'Second Sugarhouse', 'Sugarhouse Row', 'Sugar Town'],
    pipeline: ['Ridge Survey', 'Heated Pipe', 'Pump Stations', 'Twin Pipes', 'Tunnel Boring', 'Summit Taps', 'Pipe Highway', 'Sky Pipe'],
    coop: ['Shared Tanks', 'Bulk Barrels', 'Grading Station', 'Coop Trucks', 'Annual Meeting', 'Coop Bylaws', 'Syrup Exchange', 'Valley Union'],
    reservoir: ['Dam Repair', 'Cold Storage', 'Sap Ferry', 'Island Taps', 'Reservoir Two', 'Lakeside Mains', 'Sap Sea', 'Sap Ocean'],
    weather: ['Thermostat Dial', 'Cold Snap Mode', 'Sunny Afternoons', 'Microclimates', 'Jet Stream Nudge', 'Forecast Override', 'Perfect Spring', 'Eternal March'],
  };
  PRODUCERS.forEach(p => {
    TIER_AT.forEach((at, t) => {
      // cost in sap-equivalent, then converted: early tiers of sap producers cost sap, everything else syrup
      const sapEq = p.cost * TIER_COST[t] * (p.cur === 'syrup' ? SYRUP_VALUE() : 1);
      const useSap = p.cur === 'sap' && sapEq <= 4000;
      addU({
        id: p.id + '_' + t, name: TIER_NAMES[p.id][t], type: 'pmul', target: p.id, mult: 2,
        cur: useSap ? 'sap' : 'syrup', cost: roundNice(useSap ? sapEq : sapEq / SYRUP_VALUE()),
        need: { own: [p.id, at] },
        desc: p.plural + (p.kind === 'boil' ? ' boil twice as fast.' : ' make twice the sap.'),
        icon: p.id, badge: 'x2',
      });
    });
  });
  function SYRUP_VALUE() { return 80; } // sap-equivalent of one syrup, used only for pricing

  // tap power
  [
    { id: 'tap0', name: 'Sharp Drill Bit', cost: 40, cur: 'sap', mult: 2, need: { taps: 15 } },
    { id: 'tap1', name: 'Steady Hands', cost: 500, cur: 'sap', mult: 2, need: { taps: 150 } },
    { id: 'tap2', name: 'Lucky Mallet', cost: 60, cur: 'syrup', mult: 2, need: { taps: 600 } },
  ].forEach(u => addU(Object.assign({ type: 'tapmul', desc: 'Every tap on the tree gives twice the sap.', icon: 'tap', badge: 'x2' }, u)));
  [
    { id: 'mit0', name: 'Wool Mittens', cost: 25, pct: 0.02, need: { taps: 400, sapPs: 20 } },
    { id: 'mit1', name: 'Heated Mittens', cost: 2500, pct: 0.02, need: { taps: 1500, sapPs: 2000 } },
    { id: 'mit2', name: 'Mittens of Destiny', cost: 4e5, pct: 0.03, need: { taps: 4000, sapPs: 2e5 } },
    { id: 'mit3', name: 'Mitten Singularity', cost: 8e7, pct: 0.03, need: { taps: 8000, sapPs: 3e7 } },
  ].forEach(u => addU(Object.assign({ type: 'tappct', cur: 'syrup', icon: 'mitten', badge: '+' + Math.round(u.pct * 100) + '%',
    desc: 'Each tap also gives ' + Math.round(u.pct * 100) + '% of your sap flow.' }, u)));

  // ratio upgrades (the running joke gets better)
  [
    { id: 'ratio0', name: 'Sweet Tree Survey', cost: 30, ratio: 36, need: { syrupAll: 10 } },
    { id: 'ratio1', name: 'RO Membrane Tuning', cost: 2500, ratio: 32, need: { own: ['ro', 1] } },
    { id: 'ratio2', name: 'Steam-Away Preheater', cost: 9e4, ratio: 28, need: { own: ['sugarhouse', 5] } },
    { id: 'ratio3', name: 'Supersweet Clones', cost: 6e6, ratio: 24, need: { own: ['coop', 5] } },
    { id: 'ratio4', name: 'Ratio Breakthrough', cost: 5e8, ratio: 20, need: { own: ['weather', 5] } },
  ].forEach(u => addU(Object.assign({ type: 'ratio', cur: 'syrup', icon: 'ratio', badge: u.ratio + ':1',
    desc: 'Only ' + u.ratio + ' sap per syrup instead of ' + (u.ratio + 4) + '.' }, u)));

  // global boosts
  [
    { id: 'boil0', name: 'Dry Firewood', type: 'boilmul', mult: 1.5, cost: 12, need: { own: ['kettle', 3] }, desc: 'All boiling 50% faster.', icon: 'fire', badge: '+50%' },
    { id: 'boil1', name: 'Forced Draft Fans', type: 'boilmul', mult: 2, cost: 8000, need: { own: ['evap', 25] }, desc: 'All boiling twice as fast.', icon: 'fire', badge: 'x2' },
    { id: 'sap0', name: 'Good Freeze-Thaw Forecast', type: 'sapmul', mult: 1.25, cost: 150, need: { sapPs: 150 }, desc: 'All sap flow +25%.', icon: 'sun', badge: '+25%' },
    { id: 'sap1', name: 'Deep Snowpack', type: 'sapmul', mult: 1.5, cost: 2e4, need: { sapPs: 2e4 }, desc: 'All sap flow +50%.', icon: 'sun', badge: '+50%' },
    { id: 'sap2', name: 'Perfect Sugaring Spring', type: 'sapmul', mult: 2, cost: 2e8, need: { sapPs: 5e7 }, desc: 'All sap flow doubled.', icon: 'sun', badge: 'x2' },
    { id: 'ev0', name: 'Sparkle Sense', type: 'event', freq: 0.75, cost: 120, need: { events: 3 }, desc: 'Glowing buckets show up more often.', icon: 'spark', badge: '+33%' },
    { id: 'ev1', name: 'Long Glow', type: 'eventlen', mult: 1.5, cost: 4000, need: { events: 10 }, desc: 'Sap runs last 50% longer.', icon: 'spark', badge: '+50%' },
    { id: 'ev2', name: 'Sparkle Magnet', type: 'event', freq: 0.75, cost: 3e5, need: { events: 30 }, desc: 'Glowing buckets show up even more often.', icon: 'spark', badge: '+33%' },
  ].forEach(u => addU(Object.assign({ cur: 'syrup' }, u)));

  // synergies: target gets +k per source owned
  [
    { id: 'syn0', name: 'Sled Route', target: 'sled', source: 'spile', k: 0.02, cost: 60, need: { own: ['sled', 5], own2: ['spile', 25] }, desc: 'Gathering Sleds +2% for each Spile & Bucket. More buckets to empty!' },
    { id: 'syn1', name: 'Kettle Gossip', target: 'kettle', source: 'bag', k: 0.03, cost: 40, need: { own: ['kettle', 10], own2: ['bag', 10] }, desc: 'Backyard Kettles +3% for each Sap Bag.' },
    { id: 'syn2', name: 'Vacuum on the Lines', target: 'tubing', source: 'vacuum', k: 0.05, cost: 2000, need: { own: ['tubing', 10], own2: ['vacuum', 5] }, desc: 'Tubing Lines +5% for each Vacuum Pump.' },
    { id: 'syn3', name: 'Concentrate!', target: 'evap', source: 'ro', k: 0.04, cost: 8000, need: { own: ['evap', 10], own2: ['ro', 3] }, desc: 'Evaporators +4% for each RO Rig.' },
    { id: 'syn4', name: 'Woodlot Thinning', target: 'evap', source: 'sugarbush', k: 0.02, cost: 3e4, need: { own: ['evap', 25], own2: ['sugarbush', 5] }, desc: 'Evaporators +2% for each Sugarbush. Free firewood!' },
    { id: 'syn5', name: 'Bag Brigade', target: 'bag', source: 'sled', k: 0.04, cost: 150, need: { own: ['bag', 25], own2: ['sled', 10] }, desc: 'Sap Bags +4% for each Gathering Sled.' },
    { id: 'syn6', name: 'Gravity Feed', target: 'pipeline', source: 'tubing', k: 0.01, cost: 2e5, need: { own: ['pipeline', 5], own2: ['tubing', 50] }, desc: 'Pipelines +1% for each Tubing Line.' },
    { id: 'syn7', name: 'Sugarhouse Crew', target: 'sugarhouse', source: 'kettle', k: 0.01, cost: 1.5e5, need: { own: ['sugarhouse', 10], own2: ['kettle', 50] }, desc: 'Sugarhouses +1% for each Backyard Kettle. The kettle crew moves indoors.' },
    { id: 'syn8', name: 'Member Pricing', target: 'coop', source: 'sugarhouse', k: 0.02, cost: 4e6, need: { own: ['coop', 5], own2: ['sugarhouse', 25] }, desc: 'Cooperatives +2% for each Sugarhouse.' },
    { id: 'syn9', name: 'Lake Effect', target: 'reservoir', source: 'pipeline', k: 0.02, cost: 3e7, need: { own: ['reservoir', 5], own2: ['pipeline', 25] }, desc: 'Reservoirs +2% for each Pipeline.' },
    { id: 'syn10', name: 'Spile Whisperer', target: 'spile', source: 'sugarbush', k: 0.1, cost: 1e4, need: { own: ['spile', 50], own2: ['sugarbush', 1] }, desc: 'Spile & Buckets +10% for each Sugarbush.' },
    { id: 'syn11', name: 'Weather Report', target: 'sugarbush', source: 'weather', k: 0.05, cost: 4e8, need: { own: ['sugarbush', 50], own2: ['weather', 5] }, desc: 'Sugarbushes +5% for each Freeze-Thaw Machine.' },
  ].forEach(u => addU(Object.assign({ type: 'syn', cur: 'syrup', icon: u.target, icon2: u.source }, u)));

  // ---------------------------------------------------------------- ribbon milestones (permanent perks)
  const MILESTONES = [
    { at: 1, name: 'Head Start', desc: 'Each new season starts with 5 Spile & Buckets.' },
    { at: 5, name: 'Long Weekend', desc: 'Away earnings cap goes from 8 to 12 hours.' },
    { at: 15, name: 'Sparkle Season', desc: 'Glowing buckets appear 25% more often.' },
    { at: 40, name: 'Old Hand', desc: 'Each new season starts with a Backyard Kettle crew (10) and 25 Spiles.' },
    { at: 100, name: 'County Fair Legend', desc: 'Taps are worth 3x, forever.' },
  ];

  // ---------------------------------------------------------------- achievements
  const n = (x) => x;
  const ACH = [];
  function A(id, name, desc, test) { ACH.push({ id, name, desc, test }); }
  A('tap1', 'First Drip', 'Tap the tree.', s => s.totals.taps >= 1);
  A('tap100', 'Plink Plink', 'Tap 100 times.', s => s.totals.taps >= 100);
  A('tap1k', 'Mitten Calluses', 'Tap 1,000 times.', s => s.totals.taps >= 1000);
  A('tap10k', 'Thumb of Iron', 'Tap 10,000 times.', s => s.totals.taps >= 10000);
  A('burst', 'Sugar Rush Fingers', 'Tap 40 times in 5 seconds.', s => s.flags.burst);
  A('sap1k', 'Sap Happens', 'Collect 1,000 sap in total.', s => s.totals.sapAll >= 1e3);
  A('sap1m', 'Running Sap', 'Collect 1 million sap.', s => s.totals.sapAll >= 1e6);
  A('sap1b', 'Sap Tsunami', 'Collect 1 billion sap.', s => s.totals.sapAll >= 1e9);
  A('sap1t', 'Sapernova', 'Collect 1 trillion sap.', s => s.totals.sapAll >= 1e12);
  A('sap1qa', 'Sap-illionaire', 'Collect 1 quadrillion sap.', s => s.totals.sapAll >= 1e15);
  A('syr1', 'Forty to One', 'Boil your first syrup.', s => s.totals.syrupAll >= 1);
  A('syr100', 'Sticky Fingers', 'Boil 100 syrup.', s => s.totals.syrupAll >= 100);
  A('syr10k', 'Liquid Gold', 'Boil 10,000 syrup.', s => s.totals.syrupAll >= 1e4);
  A('syr1m', 'Pancake Stack to the Moon', 'Boil 1 million syrup.', s => s.totals.syrupAll >= 1e6);
  A('syr1b', 'Syrup Baron', 'Boil 1 billion syrup.', s => s.totals.syrupAll >= 1e9);
  A('ps10', 'Steady Drip', 'Reach 10 sap per second.', (s, d) => d.sapPs >= 10);
  A('ps1k', 'Gushing', 'Reach 1,000 sap per second.', (s, d) => d.sapPs >= 1e3);
  A('ps1m', 'Firehose', 'Reach 1 million sap per second.', (s, d) => d.sapPs >= 1e6);
  A('ps1b', 'Maple Monsoon', 'Reach 1 billion sap per second.', (s, d) => d.sapPs >= 1e9);
  const PA = {
    spile: ['Bucket List', 'Tapped Out'], kettle: ['Kettle Corner', 'Kettle Drum Circle'], bag: ['Bagged It', 'Bag Lady of the Woods'],
    sled: ['Sled Head', 'Runners Up'], evap: ['Fire It Up', 'Arch Nemesis'], tubing: ['Tube Rider', 'Tangled Up in Blue Tubing'],
    vacuum: ['Vacuum Sealed', 'Suction Section'], ro: ['Membrane Brain', 'Reverse Psychology'], sugarbush: ['Bush League', 'Forest for the Trees'],
    sugarhouse: ['Steam Team', 'Sugarhouse Rules'], pipeline: ['Pipe Dream', 'Pipe Down'], coop: ['Co-op Mode', 'Union of Sweetness'],
    reservoir: ['Lake Effect', 'Sap Navy'], weather: ['Weather Wizard', 'Endless March'],
  };
  PRODUCERS.forEach(p => {
    A('own_' + p.id, PA[p.id][0], 'Own ' + (/^[AEIOU]/.test(p.name) ? 'an ' : 'a ') + p.name + '.', s => (s.owned[p.id] || 0) >= 1);
    A('own50_' + p.id, PA[p.id][1], 'Own 50 ' + p.plural + '.', s => (s.owned[p.id] || 0) >= 50);
  });
  A('allp', 'Full Sugarbush', 'Own at least one of every producer.', s => PRODUCERS.every(p => (s.owned[p.id] || 0) >= 1));
  A('ev1', 'Caught a Sparkle', 'Tap a glowing bucket.', s => s.totals.events >= 1);
  A('ev10', 'Sparkle Hunter', 'Tap 10 glowing buckets.', s => s.totals.events >= 10);
  A('ev50', 'Glow Getter', 'Tap 50 glowing buckets.', s => s.totals.events >= 50);
  A('run', 'Sap Run!', 'Start a sap run frenzy.', s => s.totals.frenzies >= 1);
  A('up10', 'Tinkerer', 'Buy 10 upgrades.', s => Object.keys(s.upg).length >= 10);
  A('up50', 'Fully Kitted Out', 'Buy 50 upgrades.', s => Object.keys(s.upg).length >= 50);
  A('syn', 'Better Together', 'Buy a synergy upgrade.', s => UPGRADES.some(u => u.type === 'syn' && s.upg[u.id]));
  A('ratio', 'Sweet Spot', 'Get the ratio down to 28:1.', (s, d) => d.ratio <= 28);
  A('hold', 'Hold My Bucket', 'Buy 25 of something in one long press.', s => s.flags.hold25);
  A('away', 'Back from the Woods', 'Collect earnings from while you were away.', s => s.totals.offlineCollects >= 1);
  A('awaymax', 'Gone Sugaring', 'Be away long enough to fill the whole away cap.', s => s.flags.awayMax);
  A('night', 'Night Boil', 'Play between midnight and 4 a.m.', s => s.flags.night);
  A('pres1', 'Blue Ribbon Day', 'End your first sugaring season.', s => s.totals.seasons >= 1);
  A('pres5', 'Five Seasons Deep', 'End 5 seasons.', s => s.totals.seasons >= 5);
  A('rib10', 'Ribbon Rack', 'Hold 10 Grade A ribbons.', s => s.ribbons >= 10);
  A('rib100', 'County Fair Legend', 'Hold 100 Grade A ribbons.', s => s.ribbons >= 100);
  A('mute', 'Silent Sugaring', 'Turn the sound off. Shh, the trees are sleeping.', s => s.flags.muted);
  A('export', 'Belt and Suspenders', 'Export your save code.', s => s.flags.exported);

  // ---------------------------------------------------------------- helpers
  function roundNice(x) {
    if (x < 100) return Math.round(x);
    const p = Math.pow(10, Math.floor(Math.log10(x)) - 1);
    return Math.round(x / p) * p;
  }
  const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
  function fmt(x, dec) {
    if (!isFinite(x)) return '∞';
    if (x < 0) return '-' + fmt(-x, dec);
    if (x < 1000) {
      if (dec && x < 10 && x !== Math.floor(x)) return x.toFixed(dec === 2 ? 2 : 1);
      if (dec && x < 100 && x !== Math.floor(x)) return x.toFixed(1);
      return String(Math.floor(x));
    }
    let e = Math.floor(Math.log10(x) / 3);
    let v = x / Math.pow(1000, e);
    let s = v >= 100 ? v.toFixed(1) : v.toFixed(2);
    if (parseFloat(s) >= 1000) { e++; v = x / Math.pow(1000, e); s = v.toFixed(2); } // 999,999 -> 1.00M, not 1000.0K
    if (e >= SUFFIX.length) return x.toExponential(2).replace('+', '');
    return s + SUFFIX[e];
  }
  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    if (d) return d + 'd ' + h + 'h';
    if (h) return h + 'h ' + m + 'm';
    if (m) return m + 'm ' + (s < 10 ? '0' : '') + s + 's';
    return s + 's';
  }

  // ---------------------------------------------------------------- state
  function newState(now) {
    now = now || Date.now();
    return {
      v: SAVE_VERSION,
      sap: 0, syrup: 0,
      owned: {}, upg: {},
      ribbons: 0,
      clock: 0,                 // game seconds (monotonic, for buffs/events)
      buffs: [],                // {type:'frenzy'|'tapstorm', mult, until}
      event: null,              // {at, kind:'bucket', life}
      nextEventAt: 25,          // first sparkle comes fairly quickly
      season: { n: 1, started: now, sapEarned: 0, syrupEarned: 0, taps: 0, time: 0 },
      totals: { taps: 0, sapAll: 0, syrupAll: 0, sapTapped: 0, events: 0, frenzies: 0, seasons: 0, playTime: 0,
        bestSapPs: 0, bought: 0, offlineCollects: 0, offlineSap: 0, offlineSyrup: 0, started: now },
      ach: {},
      flags: {},
      settings: { mute: false, buyAmt: 1, music: true },
      tut: {},
      lastSeen: now,
    };
  }

  /** Season styles: one choice per season (season 2+). Keep them simple and readable. */
  const STYLES = {
    tapper: { name: "Tapper's season", desc: 'Every tap is worth ×4, mittens and all. For when you like to tap.', tap: 4 },
    boiler: { name: "Boiler's season", desc: 'Syrup ×1.6 from every boil (more ribbons). Best if you play idle.', syrup: 1.6 },
    forager: { name: "Forager's season", desc: 'Glowing buckets come twice as often and Sap Runs last 50% longer. Catch them!', evFreq: 0.5, evLen: 1.5 },
  };
  function ribbonMult(s) { return 1 + RIBBON_BONUS * s.ribbons; }
  function buffMult(s, type) {
    let m = 1;
    for (const b of s.buffs) if (b.type === type && b.until > s.clock) m *= b.mult;
    return m;
  }

  /** Derived numbers for the current state. */
  function derive(s) {
    const pm = {};
    for (const p of PRODUCERS) pm[p.id] = 1;
    let tapMul = 1, tapPct = 0, ratio = BASE_RATIO, boilMul = 1, sapMul = 1, evFreq = 1, evLen = 1;
    for (const id in s.upg) {
      const u = U_BY_ID[id]; if (!u) continue;
      switch (u.type) {
        case 'pmul': pm[u.target] *= u.mult; break;
        case 'tapmul': tapMul *= u.mult; break;
        case 'tappct': tapPct += u.pct; break;
        case 'ratio': ratio = Math.min(ratio, u.ratio); break;
        case 'boilmul': boilMul *= u.mult; break;
        case 'sapmul': sapMul *= u.mult; break;
        case 'event': evFreq *= u.freq; break;
        case 'eventlen': evLen *= u.mult; break;
        case 'syn': pm[u.target] *= 1 + u.k * (s.owned[u.source] || 0); break;
      }
    }
    // sugaring style, picked at the start of each season from season 2 on
    const style = STYLES[s.style];
    if (style) { evFreq *= style.evFreq || 1; evLen *= style.evLen || 1; }
    if (s.ribbons >= 15) evFreq *= 0.8;
    if (s.ribbons >= 100) tapMul *= 3;
    const rm = ribbonMult(s);
    const frenzy = buffMult(s, 'frenzy');
    const each = {};
    let sapPs = 0, boilCap = 0;
    for (const p of PRODUCERS) {
      const c = s.owned[p.id] || 0;
      const r = p.rate * pm[p.id] * rm * (p.kind === 'tap' ? sapMul : boilMul);
      each[p.id] = r;
      if (p.kind === 'tap') sapPs += c * r; else boilCap += c * r;
    }
    sapPs *= frenzy; boilCap *= frenzy;
    const boil = Math.min(boilCap, sapPs * FLOW_SHARE);
    const syrupPs = boil / ratio * ((style && style.syrup) || 1);
    const tapStorm = buffMult(s, 'tapstorm');
    const tapValue = (1 * tapMul * rm + tapPct * sapPs) * tapStorm * ((style && style.tap) || 1);
    return { pm, each, sapPs, boilCap, boil, syrupPs, netSap: sapPs - boil, ratio, tapValue, tapMul, tapPct,
      evFreq, evLen, frenzy, tapStorm, rm, sapMul, boilMul };
  }

  // ---------------------------------------------------------------- costs & buying
  function prodCost(p, owned, k) {
    k = k || 1;
    return p.cost * Math.pow(GROWTH, owned) * (Math.pow(GROWTH, k) - 1) / (GROWTH - 1);
  }
  function maxAffordable(p, owned, wallet) {
    const base = p.cost * Math.pow(GROWTH, owned);
    if (wallet < base) return 0;
    return Math.floor(Math.log(1 + wallet * (GROWTH - 1) / base) / Math.log(GROWTH));
  }
  function wallet(s, cur) { return cur === 'syrup' ? s.syrup : s.sap; }
  function spend(s, cur, x) { if (cur === 'syrup') s.syrup -= x; else s.sap -= x; }

  function buyProducer(s, id, k) {
    const p = P_BY_ID[id]; if (!p) return 0;
    const own = s.owned[id] || 0;
    if (k === 'max') k = Math.max(1, maxAffordable(p, own, wallet(s, p.cur)));
    k = k || 1;
    const c = prodCost(p, own, k);
    if (wallet(s, p.cur) < c - 1e-9) return 0;
    spend(s, p.cur, c);
    s.owned[id] = own + k;
    s.totals.bought += k;
    return k;
  }

  function upgradeVisible(s, u, d) {
    if (s.upg[u.id]) return false;
    const nd = u.need || {};
    if (nd.own && (s.owned[nd.own[0]] || 0) < nd.own[1]) return false;
    if (nd.own2 && (s.owned[nd.own2[0]] || 0) < nd.own2[1]) return false;
    if (nd.taps && s.totals.taps < nd.taps) return false;
    if (nd.syrupAll && s.totals.syrupAll < nd.syrupAll) return false;
    if (nd.events && s.totals.events < nd.events) return false;
    if (nd.sapPs) { d = d || derive(s); if (d.sapPs / Math.max(1, d.frenzy) < nd.sapPs) return false; }
    return true;
  }
  function visibleUpgrades(s) {
    const d = derive(s);
    return UPGRADES.filter(u => upgradeVisible(s, u, d)).sort((a, b) => (a.cur === b.cur ? a.cost - b.cost : a.cur === 'sap' ? -1 : 1));
  }
  function costInSapEq(u) { return u.cost * (u.cur === 'syrup' ? SYRUP_VALUE() : 1); }
  function buyUpgrade(s, id) {
    const u = U_BY_ID[id];
    if (!u || s.upg[id] || !upgradeVisible(s, u)) return false;
    if (wallet(s, u.cur) < u.cost) return false;
    spend(s, u.cur, u.cost);
    s.upg[id] = 1;
    return true;
  }

  /** Which producers are shown in the shop: all owned/affordable-ish ones plus the next mystery one. */
  function producerVisible(s, p) {
    if ((s.owned[p.id] || 0) > 0) return true;
    if (p.index === 0) return true;
    if (p.cur === 'sap') return s.totals.sapAll + s.sap * 0 >= p.cost * 0.35 || s.season.sapEarned >= p.cost * 0.35;
    return s.totals.syrupAll >= p.cost * 0.35 || s.season.syrupEarned >= p.cost * 0.35;
  }

  // ---------------------------------------------------------------- tapping
  function tap(s, d, mult, flowPct) {
    d = d || derive(s);
    const v = d.tapValue * (mult || 1) + (flowPct || 0) * d.sapPs / d.frenzy;
    s.sap += v;
    s.season.sapEarned += v; s.totals.sapAll += v; s.totals.sapTapped += v;
    s.totals.taps++; s.season.taps++;
    return v;
  }

  // ---------------------------------------------------------------- tick
  /** Advance dt seconds of live play. Returns d (derived at start). */
  function tick(s, dt, rand) {
    rand = rand || Math.random;
    const d = derive(s);
    const sapGain = d.netSap * dt, syrGain = d.syrupPs * dt;
    s.sap += sapGain; s.syrup += syrGain;
    s.season.sapEarned += d.sapPs * dt; s.totals.sapAll += d.sapPs * dt;
    s.season.syrupEarned += syrGain; s.totals.syrupAll += syrGain;
    s.clock += dt; s.season.time += dt; s.totals.playTime += dt;
    const basePs = d.sapPs / d.frenzy;
    if (basePs > s.totals.bestSapPs) s.totals.bestSapPs = basePs;
    if (s.buffs.length) s.buffs = s.buffs.filter(b => b.until > s.clock);
    // sparkle bucket events
    if (s.event && s.clock > s.event.at + s.event.life) s.event = null;
    if (!s.event && s.clock >= s.nextEventAt) {
      s.event = { at: s.clock, life: EVENT_LIFE, seed: rand() };
      s.nextEventAt = s.clock + EVENT_LIFE + (90 + rand() * 150) * d.evFreq;
    }
    return d;
  }

  /** Tap the sparkle bucket: returns {kind, amount, text}. */
  function catchEvent(s, rand) {
    rand = rand || Math.random;
    if (!s.event) return null;
    s.event = null;
    s.totals.events++;
    const d = derive(s);
    const r = rand();
    let res;
    if (r < 0.5 || d.sapPs < 1) {
      if (d.sapPs < 1) {
        const amt = Math.max(50, s.sap * 0.5);
        give(s, amt, 0); res = { kind: 'lump', amount: amt, text: 'Lump of sap!' };
      } else {
        const dur = 40 * d.evLen, on = s.buffs.find(b => b.type === 'frenzy' && b.until > s.clock);
        s.totals.frenzies++;
        if (on) { on.until += dur * .75; on.dur += dur * .75; res = { kind: 'frenzy', mult: 7, dur: on.until - s.clock, text: 'Sap Run extended!', chained: true }; }
        else { s.buffs.push({ type: 'frenzy', mult: 7, until: s.clock + dur, dur }); res = { kind: 'frenzy', mult: 7, dur, text: 'Sap Run! x7 flow' }; }
      }
    } else if (r < 0.8) {
      const amt = Math.max(30, Math.min(s.sap * 0.25, d.sapPs * 900), d.sapPs * 60) + 13;
      give(s, amt, 0); res = { kind: 'lump', amount: amt, text: 'Lump of sap!' };
    } else if (r < 0.93 || d.syrupPs <= 0) {
      const dur = 14 * d.evLen, on = s.buffs.find(b => b.type === 'tapstorm' && b.until > s.clock);
      if (on) { on.until += dur; on.dur += dur; res = { kind: 'tapstorm', mult: 12, dur: on.until - s.clock, text: 'Sugar Snow extended!', chained: true }; }
      else { s.buffs.push({ type: 'tapstorm', mult: 12, until: s.clock + dur, dur }); res = { kind: 'tapstorm', mult: 12, dur, text: 'Sugar Snow! Taps x12' }; }
    } else {
      const amt = Math.max(1, d.syrupPs * 600);
      give(s, 0, amt); res = { kind: 'syrup', amount: amt, text: 'Syrup jackpot!' };
    }
    return res;
  }
  function give(s, sap, syr) {
    s.sap += sap; s.syrup += syr;
    s.season.sapEarned += sap; s.totals.sapAll += sap;
    s.season.syrupEarned += syr; s.totals.syrupAll += syr;
  }

  // ---------------------------------------------------------------- offline
  function offlineCapH(s) { return OFFLINE_CAP_H + (s.ribbons >= 5 ? 4 : 0); }
  /** Apply time away (seconds). Buffs expire, no events. Returns summary. */
  function applyOffline(s, secs) {
    secs = Math.max(0, secs || 0);
    const cap = offlineCapH(s) * 3600;
    const used = Math.min(secs, cap);
    s.buffs = []; s.event = null;
    s.nextEventAt = Math.max(s.nextEventAt - s.clock, 20) + s.clock; // keep relative timer, but not before 20s
    const d = derive(s);
    const sap = d.netSap * used, syr = d.syrupPs * used;
    give(s, sap, syr);
    s.season.sapEarned += d.boil * used; s.totals.sapAll += d.boil * used; // boiled sap was also "collected"
    s.season.time += used;
    if (used > 0) { s.totals.offlineSap += sap; s.totals.offlineSyrup += syr; }
    return { secs, used, capped: secs > cap, cap, sap, syrup: syr };
  }

  // ---------------------------------------------------------------- seasons / prestige
  function ribbonsFor(seasonSyrup) { return Math.floor(Math.sqrt(Math.max(0, seasonSyrup) / RIBBON_K)); }
  function syrupForRibbons(r) { return r * r * RIBBON_K; }
  function prestigePreview(s) {
    const gain = ribbonsFor(s.season.syrupEarned);
    const nextAt = syrupForRibbons(gain + 1);
    return { gain, now: s.ribbons, after: s.ribbons + gain, bonusNow: RIBBON_BONUS * s.ribbons, bonusAfter: RIBBON_BONUS * (s.ribbons + gain),
      nextAt, toNext: nextAt - s.season.syrupEarned, seasonSyrup: s.season.syrupEarned };
  }
  function endSeason(s, now) {
    const pv = prestigePreview(s);
    if (pv.gain < 1) return null;
    now = now || Date.now();
    s.ribbons += pv.gain;
    s.totals.seasons++;
    const keepTotals = s.totals, keepAch = s.ach, keepFlags = s.flags, keepSettings = s.settings, keepTut = s.tut, keepDaily = s.daily, ribbons = s.ribbons, clock = s.clock;
    const n = s.season.n + 1;
    const fresh = newState(now);
    Object.keys(s).forEach(k => delete s[k]);
    Object.assign(s, fresh, { totals: keepTotals, ach: keepAch, flags: keepFlags, settings: keepSettings, tut: keepTut, ribbons, clock });
    if (keepDaily) s.daily = keepDaily; // today's chores survive a season change
    s.nextEventAt = clock + 30;
    s.season = { n, started: now, sapEarned: 0, syrupEarned: 0, taps: 0, time: 0 };
    if (ribbons >= 1) s.owned.spile = 5;
    if (ribbons >= 40) { s.owned.spile = 25; s.owned.kettle = 10; }
    return pv;
  }

  // ---------------------------------------------------------------- achievements
  function checkAch(s, d) {
    d = d || derive(s);
    const got = [];
    for (const a of ACH) if (!s.ach[a.id] && a.test(s, d)) { s.ach[a.id] = Date.now(); got.push(a); }
    return got;
  }

  // ---------------------------------------------------------------- save / load
  function serialize(s) { return JSON.stringify(s); }
  function migrate(o) {
    if (!o || typeof o !== 'object') throw new Error('not a save');
    if (typeof o.v !== 'number') throw new Error('no version');
    if (o.v > SAVE_VERSION) throw new Error('save is from a newer version');
    // v1 is current. Future: if (o.v === 1) { ...; o.v = 2; }
    const base = newState(o.lastSeen || Date.now());
    const s = Object.assign(base, o);
    s.totals = Object.assign(newState().totals, o.totals || {});
    s.season = Object.assign(newState().season, o.season || {});
    s.settings = Object.assign(newState().settings, o.settings || {});
    s.owned = o.owned || {}; s.upg = o.upg || {}; s.ach = o.ach || {}; s.flags = o.flags || {}; s.tut = o.tut || {};
    s.buffs = Array.isArray(o.buffs) ? o.buffs : [];
    ['sap', 'syrup', 'ribbons', 'clock', 'nextEventAt'].forEach(k => { if (!isFinite(s[k]) || s[k] < 0) s[k] = 0; });
    for (const k in s.owned) { if (!P_BY_ID[k]) delete s.owned[k]; else s.owned[k] = Math.max(0, Math.floor(+s.owned[k] || 0)); }
    for (const k in s.upg) if (!U_BY_ID[k]) delete s.upg[k];
    s.v = SAVE_VERSION;
    return s;
  }
  function deserialize(str) { return migrate(JSON.parse(str)); }

  function checksum(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
  function b64enc(str) {
    if (typeof Buffer !== 'undefined' && !root.btoa) return Buffer.from(str, 'utf8').toString('base64');
    return root.btoa(unescape(encodeURIComponent(str)));
  }
  function b64dec(b) {
    if (typeof Buffer !== 'undefined' && !root.atob) return Buffer.from(b, 'base64').toString('utf8');
    return decodeURIComponent(escape(root.atob(b)));
  }
  function exportCode(s) {
    const json = serialize(s);
    const body = b64enc(json);
    return 'SAPTAP' + SAVE_VERSION + '-' + checksum(json) + '-' + body;
  }
  function importCode(code) {
    code = String(code || '').replace(/\s+/g, '');
    const m = /^SAPTAP(\d+)-([0-9a-z]+)-([A-Za-z0-9+/=]+)$/.exec(code);
    if (!m) throw new Error("That doesn't look like a Sap Tapper save code.");
    let json;
    try { json = b64dec(m[3]); } catch (e) { throw new Error('The code is damaged (could not decode).'); }
    if (checksum(json) !== m[2]) throw new Error('The code is damaged (checksum mismatch). Copy the whole thing.');
    return deserialize(json);
  }

  const E = {
    SAVE_VERSION, GROWTH, FLOW_SHARE, BASE_RATIO, RIBBON_K, RIBBON_BONUS, OFFLINE_CAP_H, EVENT_LIFE,
    PRODUCERS, P_BY_ID, UPGRADES, U_BY_ID, ACH, MILESTONES, TIER_AT,
    STYLES, fmt, fmtTime, newState, derive, prodCost, maxAffordable, buyProducer, buyUpgrade, upgradeVisible, visibleUpgrades,
    producerVisible, tap, tick, catchEvent, applyOffline, offlineCapH, ribbonsFor, syrupForRibbons, prestigePreview, endSeason,
    checkAch, serialize, deserialize, migrate, exportCode, importCode, wallet, costInSapEq, SYRUP_VALUE,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = E;
  else root.SapEngine = E;
})(typeof window !== 'undefined' ? window : globalThis);
