// Live extras: offline reload through the service worker, reduced-motion boot, clean power-up screenshot.
import { chromium } from 'playwright-core';
const url = process.argv[2], shots = process.argv[3];
const b = await chromium.launch({ args: ['--no-sandbox'] });
const out = {};
{ // offline: first visit installs the SW, then airplane mode + reload must still boot the game
  const ctx = await b.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(url); await p.evaluate(() => navigator.serviceWorker.ready); await p.waitForTimeout(1500);
  await p.reload(); await p.waitForTimeout(800);
  await ctx.setOffline(true); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1200);
  out.offlineBoot = await p.evaluate(() => !!(window.__danfo && document.querySelector('#btnPlay')));
  await p.evaluate(() => { document.querySelector('#streak').classList.remove('show'); __danfo.save.tutorialDone = true; }); await p.waitForTimeout(300);
  await p.click('#btnPlay', { force: true }); await p.waitForTimeout(2500);
  out.offlinePlay = await p.evaluate(() => ({ mode: __danfo.game.mode, dist: Math.round(__danfo.game.dist / 30) }));
  out.offlineErrors = errs; await ctx.close();
}
{ // reduced motion
  const ctx = await b.newContext({ viewport: { width: 360, height: 800 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(url); await p.waitForTimeout(1200);
  out.reducedMotion = await p.evaluate(() => ({ reduced: __danfo.game.reduced, shakeWhenHit: (__danfo.game.shake(10), __danfo.game.shakeAmp), menu: !!document.querySelector('#btnPlay') }));
  out.reducedErrors = errs; await ctx.close();
}
{ // clean power-up screenshot
  const ctx = await b.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); await p.goto(url); await p.waitForTimeout(800);
  await p.evaluate(() => { document.querySelector('#streak').classList.remove('show'); __danfo.save.tutorialDone = true; }); await p.waitForTimeout(300);
  await p.click('#btnPlay', { force: true }); await p.waitForTimeout(2600);
  await p.evaluate(() => { const g = __danfo.game; g.objs.length = 0; g.nextRow = g.nextFuel = g.nextPower = 1e12; g.dist = 30 * 2150; g.speed = 700; g.coins = 146; g.score = 6840; g.combo = 7; g.mult = 3; g.comboT = 3;
    g.obj('power', g.bus.lane, g.busY - 360, { ptype: 'magnet', w: 40, h: 40, collect: true }); g.power('express'); g.power('shield');
    const o = g.vehicle((g.bus.lane + 1) % 3, g.busY - 420); o.vs = o.vsCur = 0.1; g.coinLine(g.bus.lane === 0 ? 2 : 0, g.busY - 140, 5); g.coinLine(g.bus.lane, g.busY - 480, 6); });
  await p.waitForTimeout(250); await p.evaluate(() => { document.querySelector('#toasts').innerHTML = ''; });
  await p.waitForTimeout(350); await p.evaluate(() => { document.querySelector('#toasts').innerHTML = ''; });
  await p.screenshot({ path: shots + '/03-power-up.png' }); await ctx.close();
}
console.log(JSON.stringify(out));
await b.close();
