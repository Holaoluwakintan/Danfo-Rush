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
    out.push({ m: Math.floor(g.dist / 30), s: Math.floor(g.score), reason: g.deathReason || 'timeout', t: Math.round(g.t), objsMax: g.objs.length, coins: g.coins, pass: g.passengers, near: g.near, powers: g.powersUsed });
  }
  return out;
}, runs);
const dist = res.map(r => r.m).sort((a, b) => a - b);
const reasons = res.reduce((a, r) => (a[r.reason] = (a[r.reason] || 0) + 1, a), {});
console.log(JSON.stringify({ runs: res.length, medianM: dist[dist.length >> 1], maxM: dist[dist.length - 1], minM: dist[0], reasons, errors: errs, sample: res.slice(0, 5) }));
await b.close();
