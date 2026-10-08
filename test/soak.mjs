// Simulated soak: 20 autopilot runs stepped at 60 Hz without rendering. Checks the spawner never throws,
// numbers stay finite, and reports how far a simple bot survives (and why it died).
import { chromium } from 'playwright-core';
const url = process.argv[2] || 'http://127.0.0.1:4780/';
const runs = +(process.argv[3] || 20);
const b = await chromium.launch({ args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 360, height: 800 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(url); await p.waitForFunction(() => window.__danfo);
const res = await p.evaluate(runs => {
  const g = __danfo.game; const out = [];
  g.render = () => {}; g.hooks.onGameOver = () => {}; g.hooks.onHud = () => {};
  for (let r = 0; r < runs; r++) {
    __danfo.save.tutorialDone = true; g.start(false); g.autopilot = true;
    let steps = 0; const maxSteps = 60 * 600; // 10 game-minutes max
    while (g.mode === 'play' && steps < maxSteps) { g.update(1 / 60); steps++; if (!isFinite(g.score) || !isFinite(g.bus.x)) throw new Error('non-finite state'); }
    const st = g.stats(); out.push({ m: st.distance, s: st.score, reason: g.deathReason || 'timeout', t: Math.round(g.t), objsMax: g.objs.length, coins: st.coins, pass: st.passengers, near: st.near, jumps: st.jumps, smashes: st.smashes, powers: g.powersUsed, zone: st.zoneIdx, nearRow: st.nearRow, fines: st.fines, cleared: st.cleared, dur: st.duration });
  }
  return out;
}, runs);
const dist = res.map(r => r.m).sort((a, b) => a - b);
const reasons = res.reduce((a, r) => (a[r.reason] = (a[r.reason] || 0) + 1, a), {});
// anti-cheat bounds the server applies (supabase/schema.sql danfo_submit): every bot run must pass them
const capFail = res.filter(r => { const secs = r.dur / 1000, nearSub = r.near + r.jumps + r.smashes;
  return r.m > secs * 70 + 50 || r.pass > r.m / 25 + 3 || nearSub > r.m / 8 + 3 || r.coins > r.m + 200 || r.s > r.m * 6 + r.pass * 300 + nearSub * 150 + r.coins * 6 + 500; });
const zonesSeen = Math.max(...res.map(r => r.zone));
console.log(JSON.stringify({ capFail: capFail.length, capFailSample: capFail.slice(0, 3), maxZoneIdx: zonesSeen, maxCoinsPerM: Math.max(...res.map(r => r.coins / Math.max(1, r.m))).toFixed(2), maxScorePerCap: Math.max(...res.map(r => r.s / (r.m * 6 + r.pass * 300 + (r.near + r.jumps + r.smashes) * 150 + r.coins * 6 + 500))).toFixed(2), totalFines: res.reduce((a, r) => a + r.fines, 0), totalCleared: res.reduce((a, r) => a + r.cleared, 0) }));
if (capFail.length || errs.length) process.exitCode = 1;
console.log(JSON.stringify({ runs: res.length, medianM: dist[dist.length >> 1], maxM: dist[dist.length - 1], minM: dist[0], reasons, errors: errs, sample: res.slice(0, 5) }));
await b.close();
