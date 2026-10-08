// Automated headless playtest: collisions, scoring, power-ups, restart speed, pause, continue,
// offline queue, leaderboard submit (real Supabase), challenge links, and fps sampling.
// Usage: node test/playtest.mjs <url> [--nick TabTest_xxx] [--shots dir]
import { chromium } from 'playwright-core';
import fs from 'fs';
const url = process.argv[2] || 'http://127.0.0.1:4780/';
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const nick = arg('--nick') || 'TabTest' + Math.floor(Math.random() * 1000);
const shots = arg('--shots');
const results = []; let failed = 0;
const ok = (name, cond, info) => { results.push({ name, pass: !!cond, info }); if (!cond) failed++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); };

const browser = await chromium.launch({ args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
const ev = (f, a) => page.evaluate(f, a);
const wait = ms => page.waitForTimeout(ms);
const shot = async name => { if (shots) { await page.screenshot({ path: `${shots}/${name}.png` }); console.log('shot', name); } };
const clearStage = () => ev(() => { const g = __danfo.game; g.objs.length = 0; g.nextRow = g.nextFuel = g.nextPower = 1e12; g.fuel = 100; });

// ---- boot + home ----
const t0 = Date.now();
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__danfo && __danfo.game);
ok('boots with no JS errors', errs.length === 0, errs);
ok('home screen visible', await page.isVisible('#btnPlay'));
const streakShown = await ev(() => document.querySelector('#streak').classList.contains('show')).catch(() => false);
await wait(800);
ok('daily streak reward offered on first open', await ev(() => document.querySelector('#streak').classList.contains('show')));
const c0 = await ev(() => __danfo.save.coins);
await page.click('#btnClaim', { force: true }); await wait(300);
ok('streak claim pays ₦50', (await ev(() => __danfo.save.coins)) === c0 + 50, await ev(() => __danfo.save.coins));
await wait(300); await shot('01-menu');

// ---- tutorial (first run) ----
await page.click('#btnPlay', { force: true });
await page.waitForFunction(() => __danfo.game.mode === 'play');
await page.waitForFunction(() => !document.querySelector('#tut').classList.contains('hidden'), null, { timeout: 8000 });
const tt1 = await page.textContent('#tutTxt'); ok('tutorial step 1 prompt (swipe to dodge)', /dodge/i.test(tt1), tt1);
await page.keyboard.press('ArrowLeft'); await wait(200);
await page.waitForFunction(() => /jump/i.test(document.querySelector('#tutTxt').textContent) && !document.querySelector('#tut').classList.contains('hidden'), null, { timeout: 8000 });
ok('tutorial step 2 prompt (swipe up to jump)', true);
await page.keyboard.press('ArrowUp');
await page.waitForFunction(() => __danfo.save.tutorialDone === true, null, { timeout: 15000 });
ok('tutorial completes and is remembered', true, await ev(() => ({ jumps: __danfo.game.jumps, mode: __danfo.game.mode })));

// ---- collisions ----
await clearStage();
await ev(() => { const g = __danfo.game; g.invuln = 0; const o = g.vehicle(g.bus.lane, g.busY - 160); o.vs = o.vsCur = 0; });
await page.waitForFunction(() => __danfo.game.mode === 'over' || __danfo.game.dying > 0, null, { timeout: 3000 }).catch(() => {});
await page.waitForFunction(() => __danfo.game.mode === 'over', null, { timeout: 4000 }).catch(() => {});
let st = await ev(() => ({ mode: __danfo.game.mode, reason: __danfo.game.deathReason }));
ok('car in your lane = crash + game over', st.mode === 'over' && st.reason === 'vehicle', st);
await wait(500);
ok('game-over screen shows a pidgin line', (await page.textContent('#oLine')).length > 3, await page.textContent('#oLine'));
await shot('04-game-over');

// ---- fast restart (< 1 s) ----
const restartMs = await ev(() => new Promise(res => { const t = performance.now(); document.querySelector('#btnAgain').click(); const chk = () => { if (__danfo.game.mode === 'play' && __danfo.game.t > 0) res(performance.now() - t); else requestAnimationFrame(chk); }; requestAnimationFrame(chk); }));
ok('"one more run" restart under 1 s', restartMs < 1000, Math.round(restartMs) + ' ms');

// ---- scoring: coins, passengers ----
await clearStage();
let before = await ev(() => ({ c: __danfo.game.coins, s: __danfo.game.score }));
await ev(() => { const g = __danfo.game; g.coinLine(g.bus.lane, g.busY - 120, 5); });
await wait(1200);
let after = await ev(() => ({ c: __danfo.game.coins, s: __danfo.game.score, m: __danfo.game.mode }));
ok('collecting 5 coins adds ₦5', after.c - before.c === 5, { before, after });
ok('score rises while driving', after.s > before.s);
await ev(() => { const g = __danfo.game; g.obj('passenger', g.bus.lane, g.busY - 140, { spr: null, w: 34, h: 34, collect: true, bubble: 'Oshodi!', person: true }); });
await wait(900);
const pp = await ev(() => ({ p: __danfo.game.passengers, c: __danfo.game.coins, combo: __danfo.game.combo }));
ok('passenger pick-up counts + pays ₦10 fare', pp.p === 1 && pp.c === after.c + 10, pp);

// ---- potholes: jump clears, no jump crashes ----
await clearStage();
await ev(() => { const g = __danfo.game; g.hazard('pothole', g.bus.lane, g.busY - 200); });
await page.waitForFunction(() => { const g = __danfo.game; return g.objs.some(o => o.kind === 'pothole' && o.y > g.busY - 120); }, null, { timeout: 3000 });
await page.keyboard.press('ArrowUp'); await wait(1000);
st = await ev(() => ({ mode: __danfo.game.mode, jumps: __danfo.game.jumps }));
ok('jumping a pothole = clean jump, no crash', st.mode === 'play' && st.jumps >= 1, st);

// ---- near miss ----
await clearStage();
const nm0 = await ev(() => __danfo.game.near);
await ev(() => { const g = __danfo.game; const o = g.vehicle(g.bus.lane, g.busY - 250); o.vs = o.vsCur = 0; o.weave = false; });
await page.waitForFunction(() => { const g = __danfo.game; return g.objs.some(o => o.deadly && o.y > g.busY - 190); }, null, { timeout: 3000 });
await ev(() => { const g = __danfo.game; g.move(g.bus.lane === 0 ? 1 : -1); });
await wait(1200);
st = await ev(() => ({ near: __danfo.game.near, mode: __danfo.game.mode, mult: __danfo.game.mult }));
ok('last-second swerve = near-miss bonus', st.near === nm0 + 1 && st.mode === 'play', st);

// ---- power-ups ----
await clearStage();
await ev(() => { const g = __danfo.game; g.obj('power', g.bus.lane, g.busY - 120, { ptype: 'shield', spr: null, w: 40, h: 40, collect: true }); });
await wait(800);
ok('Pure Water shield picked up', await ev(() => __danfo.game.pw.shield > 0));
await ev(() => { const g = __danfo.game; const o = g.vehicle(g.bus.lane, g.busY - 150); o.vs = o.vsCur = 0; });
await wait(900);
st = await ev(() => ({ mode: __danfo.game.mode, shield: __danfo.game.pw.shield, smashes: __danfo.game.smashes }));
ok('shield absorbs a crash', st.mode === 'play' && st.shield === 0 && st.smashes >= 1, st);
await clearStage();
await ev(() => { const g = __danfo.game; g.invuln = 0; g.power('magnet'); g.coinLine(g.bus.lane === 0 ? 2 : 0, g.busY - 150, 4); });
const cm = await ev(() => __danfo.game.coins); await wait(1000);
ok('magnet pulls coins from another lane', (await ev(() => __danfo.game.coins)) - cm >= 3, await ev(() => ({ c: __danfo.game.coins, mode: __danfo.game.mode, m: __danfo.game.pw.magnet, lane: __danfo.game.bus.lane, objs: __danfo.game.objs.length })));
await ev(() => { const g = __danfo.game; g.fuel = 30; g.power('jerry'); });
await wait(1000);
ok('jerrycan fills tank and stops fuel drain', (await ev(() => __danfo.game.fuel)) >= 99.9);
await ev(() => { const g = __danfo.game; g.power('express'); g.power('shield'); const o = g.vehicle((g.bus.lane + 1) % 3, g.busY - 330); g.coinLine(g.bus.lane, g.busY - 300, 6); });
await wait(450); await shot('03-power-up');
await ev(() => { const g = __danfo.game; const o = g.vehicle(g.bus.lane, g.busY - 150); o.vs = o.vsCur = 0; });
await wait(700);
ok('express lane smashes through traffic', (await ev(() => __danfo.game.mode)) === 'play');

// ---- agbero + fuel death ----
await clearStage();
await ev(() => { const g = __danfo.game; g.pw.magnet = 0; g.pw.express = 0; g.pw.shield = 0; g.invuln = 0; g.coins = 100; const a = g.hazard('agbero', g.bus.lane, g.busY - 130); a.drift = 0; a.x = g.bus.x; });
await wait(900);
ok('agbero collects 20% of run naira', (await ev(() => __danfo.game.coins)) === 80, await ev(() => __danfo.game.coins));

// ==== v1.1: new power-ups, LASTMA fine, flood, zones, voice ====
await clearStage();
await ev(() => { const g = __danfo.game; g.invuln = 0; for (const k in g.pw) g.pw[k] = 0; const o1 = g.vehicle(g.bus.lane, g.busY - 330); o1.vs = o1.vsCur = 0; o1.weave = false; const o2 = g.vehicle((g.bus.lane + 1) % 3, g.busY - 420); o2.vs = o2.vsCur = 0; o2.weave = false; g.power('agbero'); });
await wait(250);
st = await ev(() => { const g = __danfo.game; return { cleared: g.cleared, flying: g.objs.filter(o => o.flying).length, mode: g.mode }; });
ok('Agbero power clears the cars ahead', st.cleared >= 2 && st.mode === 'play', st);
await clearStage();
await ev(() => { const g = __danfo.game; g.pw.agbero = 0; g.power('double'); g.coins = 0; g.obj('passenger', g.bus.lane, g.busY - 120, { w: 34, h: 34, collect: true, bubble: 'CMS!', person: true }); });
await wait(700);
st = await ev(() => ({ c: __danfo.game.coins, p: __danfo.game.pw.double }));
ok('Double Fare pays ₦20 per passenger', st.c === 20 && st.p > 0, st);
await clearStage();
await ev(() => { const g = __danfo.game; g.pw.double = 0; g.power('express'); });
await wait(400);
st = await ev(() => ({ boost: __danfo.game.boost, name: document.querySelector('#hPowers').textContent, bar: !!document.querySelector('#hPowers .tbar i') }));
ok('NEPA Light boosts speed + shows icon and timer bar', st.boost > 1.3 && /NEPA/.test(st.name) && st.bar, st);
await ev(() => { const g = __danfo.game; const o = g.vehicle(g.bus.lane, g.busY - 150); o.vs = o.vsCur = 0; o.weave = false; });
await wait(600);
ok('NEPA Light = invincible (smashes traffic)', (await ev(() => __danfo.game.mode)) === 'play');
await clearStage();
await ev(() => { const g = __danfo.game; for (const k in g.pw) g.pw[k] = 0; g.invuln = 0; g.coins = 100; g.slowT = 0; g.hazard('lastma', g.bus.lane, g.busY - 130); });
await wait(800);
st = await ev(() => ({ mode: __danfo.game.mode, coins: __danfo.game.coins, fines: __danfo.game.fines, slow: __danfo.game.slowT }));
ok('LASTMA fines you (coins) + slows you, run continues', st.mode === 'play' && st.coins === 85 && st.fines === 1, st);
await clearStage();
await ev(() => { const g = __danfo.game; g.slowT = 0; g.hazard('flood', g.bus.lane, g.busY - 140); });
await page.waitForFunction(() => __danfo.game.slowT > 0, null, { timeout: 3000 }).catch(() => {});
st = await ev(() => ({ slow: __danfo.game.slowT, mode: __danfo.game.mode }));
ok('flood patch slows the bus', st.slow > 0.5 && st.mode === 'play', st);
// zones: jump the odometer to each zone and check banner + overhead sign
const zoneNames = [];
for (const zi of [1, 2, 3, 4]) {
  await clearStage();
  await ev(zi => { const g = __danfo.game; g.dist = (zi * 700 + 5) * 30; }, zi);
  await wait(250);
  const zs = await ev(() => ({ banner: document.querySelector('#zoneBanner').classList.contains('show'), name: document.querySelector('#zoneBanner .zb-n').textContent, sign: __danfo.game.gantry && __danfo.game.gantry.text, zone: __danfo.game.zone }));
  zoneNames.push(zs);
  if (zi === 2) { await wait(900); await shot('04-zone-third-mainland'); }
  if (zi === 1) { await ev(() => { const g = __danfo.game; g.nextRow = g.dist + 50; }); await wait(1300); await shot('05-zone-oshodi'); }
}
await ev(() => { const g = __danfo.game; g.dist = 300 * 30; g.objs.length = 0; }); // back to a plausible odometer so the run still passes server anti-cheat
ok('zone banners: Oshodi, Third Mainland Bridge, CMS / Marina, Lekki Toll Gate', zoneNames.map(z => z.name).join('|') === 'Oshodi|Third Mainland Bridge|CMS / Marina|Lekki Toll Gate' && zoneNames.every(z => z.banner), zoneNames);
ok('bridge sign shows the full "THIRD MAINLAND BRIDGE"', zoneNames[1].sign === 'THIRD MAINLAND BRIDGE', zoneNames[1].sign);
await ev(() => { __danfo.save.seenPowers = []; const g = __danfo.game; g.objs.length = 0; g.spawnPickup('power'); });
await wait(200);
st = await ev(() => ({ show: document.querySelector('#pwHint').classList.contains('show'), txt: document.querySelector('#pwHint .ph-t').textContent, seen: __danfo.save.seenPowers.length }));
ok('first-time power-up tip appears', st.show && st.txt.length > 10 && st.seen === 1, st);
await ev(() => { const g = __danfo.game; g.objs.length = 0; __danfo.save.seenPowers = ['shield', 'magnet', 'express', 'jerry', 'agbero', 'double']; document.querySelector('#pwHint').classList.remove('show'); g.spawnPickup('power'); });
await wait(200);
ok('tip does not repeat once seen', !(await ev(() => document.querySelector('#pwHint').classList.contains('show'))));
st = await ev(() => ({ ...__danfo.voiceStats }));
ok('conductor voice clips lazy-loaded after first run', st.loaded >= 8, st);
const sizes = await ev(async () => { const out = {}; for (const k of ['oshodi', 'owa', 'change', 'wole', 'owao', 'near']) { const r = await fetch('/voice/' + k + '.mp3'); out[k] = (await r.arrayBuffer()).byteLength; } return out; });
ok('every voice clip is under 30 KB', Object.values(sizes).every(n => n > 3000 && n < 30000), sizes);


// ---- pause ----
await page.keyboard.press('p'); await wait(200);
const pT = await ev(() => __danfo.game.t); await wait(500);
ok('pause freezes the run', (await ev(() => __danfo.game.mode)) === 'paused' && (await ev(() => __danfo.game.t)) === pT);
await page.click('#btnResume', { force: true }); await wait(300);
ok('resume continues', (await ev(() => __danfo.game.mode)) === 'play', await ev(() => ({ mode: __danfo.game.mode, pause: document.querySelector('#pause').className, over: document.querySelector('#over').className })));

// ---- gameplay screenshot with normal traffic ----
await ev(() => { const g = __danfo.game; g.nextRow = g.dist + 50; g.nextFuel = g.dist + 900; g.nextPower = g.dist + 3000; g.autopilot = true; g.invuln = 0; });
await wait(4500); if ((await ev(() => __danfo.game.mode)) === 'play') await shot('02-gameplay'); else console.log('autopilot crashed before gameplay shot');
if ((await ev(() => __danfo.game.mode)) !== 'play') { await page.click('#btnAgain', { force: true }); await wait(300); await ev(() => { const g = __danfo.game; g.autopilot = true; }); await wait(3000); }

// ---- fps sampling (autopilot traffic, normal + 4x CPU throttle ~ cheap Android) ----
async function sampleFps(label, ms) {
  const r = await ev(ms => new Promise(res => { const ts = []; let last = performance.now(); const end = last + ms; const f = now => { ts.push(now - last); last = now; if (now < end) requestAnimationFrame(f); else { ts.sort((a, b) => a - b); const avg = ts.reduce((a, b) => a + b, 0) / ts.length; res({ frames: ts.length, avgFps: +(1000 / avg).toFixed(1), p95ms: +ts[Math.floor(ts.length * 0.95)].toFixed(1), worstMs: +ts[ts.length - 1].toFixed(1), quality: __danfo.game.quality, mode: __danfo.game.mode, workMsAvg: +__danfo.game.workMs.toFixed(2), objs: __danfo.game.objs.length }); } }; __danfo.game.workMax = 0; requestAnimationFrame(f); }), ms);
  console.log('FPS', label, JSON.stringify(r)); return r;
}
await ev(() => { const g = __danfo.game; g.lockQuality = false; g.invuln = 999; });
const fpsNormal = await sampleFps('normal', 6000);
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
const fpsThrottled = await sampleFps('cpu4x-a', 6000);
const fpsThrottled2 = await sampleFps('cpu4x-b-after-adapt', 6000);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
ok('fps sampled (normal)', fpsNormal.avgFps > 0, fpsNormal);
ok('fps sampled (4x CPU throttle)', fpsThrottled2.avgFps > 0, fpsThrottled2);
await ev(() => { __danfo.game.autopilot = false; __danfo.game.invuln = 0; });

// ---- leaderboard submit (real) ----
await ev(n => { __danfo.save.nick = n; }, nick);
await clearStage();
await ev(() => { const g = __danfo.game; g.invuln = 0; g.pw.express = 0; g.pw.shield = 0; const o = g.vehicle(g.bus.lane, g.busY - 160); o.vs = o.vsCur = 0; });
await page.waitForFunction(() => __danfo.game.mode === 'over', null, { timeout: 5000 });
const runStats = await ev(() => __danfo.game.stats());
await page.waitForFunction(() => /#\d+ this week/.test(document.querySelector('#oRank').textContent) || /not ranked/.test(document.querySelector('#oRank').textContent), null, { timeout: 15000 }).catch(() => {});
const rankTxt = await page.textContent('#oRank');
ok('score submitted and ranked', /#\d+ this week/.test(rankTxt), { rankTxt, score: runStats.score, duration: runStats.duration });
ok('pending queue empty after submit', (await ev(() => __danfo.save.pending.length)) === 0);
ok('coins banked into wallet', (await ev(() => __danfo.save.coins)) > 0, await ev(() => __danfo.save.coins));
const lb = await ev(() => __danfo.leaderboard('weekly'));
ok('weekly board lists this player', lb && lb.rows.some(r => r.me), lb && lb.me);
await page.click('#btnHome', { force: true }); await wait(400);
await ev(() => document.querySelector('[data-open="board"]').click()); await page.waitForSelector('.brow', { timeout: 8000 }); await wait(700);
await shot('05-leaderboard');
await ev(() => document.querySelector('#board .close').click());
await ev(() => document.querySelector('[data-open="garage"]').click()); await wait(700); await shot('06-garage');
await ev(() => document.querySelector('#garage .close').click());
await ev(() => document.querySelector('[data-open="missions"]').click()); await wait(700); await shot('07-missions');
await ev(() => document.querySelector('#missions .close').click()); await wait(300);

// ---- offline play + sync ----
await ctx.setOffline(true);
await page.click('#btnPlay', { force: true }); await wait(1500);
await clearStage();
await ev(() => { const g = __danfo.game; g.invuln = 0; const o = g.vehicle(g.bus.lane, g.busY - 160); o.vs = o.vsCur = 0; });
await page.waitForFunction(() => __danfo.game.mode === 'over', null, { timeout: 5000 });
await wait(1500);
ok('offline run is kept in the sync queue', (await ev(() => __danfo.save.pending.length)) === 1, await page.textContent('#oRank'));
await ctx.setOffline(false); await ev(() => window.dispatchEvent(new Event('online')));
await page.waitForFunction(() => __danfo.save.pending.length === 0, null, { timeout: 15000 }).catch(() => {});
ok('queued run syncs when back online', (await ev(() => __danfo.save.pending.length)) === 0);

// ---- paid continue ----
await page.click('#btnAgain', { force: true }); await wait(800);
await ev(() => { __danfo.save.coins = 2000; });
await clearStage();
await ev(() => { const g = __danfo.game; g.invuln = 0; const o = g.vehicle(g.bus.lane, g.busY - 160); o.vs = o.vsCur = 0; });
await page.waitForFunction(() => __danfo.game.mode === 'over', null, { timeout: 5000 });
await wait(300);
ok('continue offered when you can afford it', await page.isEnabled('#btnCont'));
await page.click('#btnCont', { force: true }); await wait(400);
st = await ev(() => ({ mode: __danfo.game.mode, invuln: __danfo.game.invuln, coins: __danfo.save.coins + __danfo.game.coins }));
ok('continue revives with grace period', st.mode === 'play' && st.invuln > 0, st);
await ev(() => { const g = __danfo.game; g.invuln = 0; g.objs.length = 0; const o = g.vehicle(g.bus.lane, g.busY - 160); o.vs = o.vsCur = 0; });
await page.waitForFunction(() => __danfo.game.mode === 'over', null, { timeout: 5000 });
await page.click('#btnHome', { force: true }); await wait(300);

// ---- challenge link ----
await page.goto(url + '?c=5000&n=Ada', { waitUntil: 'load' }); await wait(900);
const ban = await page.textContent('#challengeBanner');
ok('challenge link shows "beat 5,000" banner', /Ada/.test(ban) && /5,000/.test(ban), ban);


// ---- v1.1: toast never covers the game-over card ----
await page.goto(url, { waitUntil: 'load' }); await page.waitForFunction(() => window.__danfo && __danfo.game); await wait(900);
if (await ev(() => document.querySelector('#streak').classList.contains('show'))) { await page.click('#btnClaim', { force: true }); await wait(300); }
await page.click('#btnPlay', { force: true }); await page.waitForFunction(() => __danfo.game.mode === 'play');
await clearStage();
await ev(() => { const g = __danfo.game; g.hooks.onEvent('toast', { text: 'Go-slow ahead! 🚦', kind: 'warn' }); g.invuln = 0; for (const k in g.pw) g.pw[k] = 0; const o = g.vehicle(g.bus.lane, g.busY - 150); o.vs = o.vsCur = 0; o.weave = false; });
await page.waitForFunction(() => __danfo.game.mode === 'over', null, { timeout: 5000 }); await wait(400);
await page.click('#btnAd', { force: true }).catch(() => {}); await wait(250);
st = await ev(() => { const c = document.querySelector('#over .card').getBoundingClientRect(); const ts = [...document.querySelectorAll('#toasts .toast')].map(t => t.getBoundingClientRect()); return { n: ts.length, overlap: ts.some(t => !(t.bottom <= c.top || t.top >= c.bottom || t.right <= c.left || t.left >= c.right)) }; });
ok('no toast overlaps the game-over card', !st.overlap, st);
// ---- v1.1: daily challenges + streak bonus + claim screen ----
st = await ev(() => { const ms = __danfo.missions(); return { n: ms.list.length, ids: ms.list.map(m => m.id), fresh: ms.list.filter(m => ['carry', 'zone', 'nearrow'].includes(m.id)).length }; });
ok('3 daily challenges, 2 of them Lagos challenges', st.n === 3 && st.fresh >= 2, st);
await ev(() => { const ms = __danfo.missions(); for (const m of ms.list) { m.done = true; m.claimed = false; m.prog = m.n; } __danfo.save.streak = 3; });
await page.click('#btnHome', { force: true }); await wait(400);
await ev(() => document.querySelector('[data-open="missions"]').click()); await wait(600);
st = await ev(() => ({ title: document.querySelector('#missions h2').textContent, ready: document.querySelectorAll('#missionList .claim.ready').length, bonus: document.querySelector('#streakBonus').textContent }));
ok('claim screen: Daily Challenges with 3 claimable + streak bonus', /Challenges/.test(st.title) && st.ready === 3 && /\+30%/.test(st.bonus), st);
await shot('06-daily-challenges');
const cb = await ev(() => __danfo.save.coins);
const r0 = await ev(() => __danfo.missions().list[0].reward);
await ev(() => document.querySelector('#missionList .claim.ready').click()); await wait(300);
ok('claim pays reward + 30% streak bonus', (await ev(() => __danfo.save.coins)) - cb === Math.round(r0 * 1.3), { got: (await ev(() => __danfo.save.coins)) - cb, base: r0 });
await ev(() => document.querySelector('#missions .close').click()); await wait(300);

ok('no JS errors during the whole session', errs.length === 0, errs.slice(0, 5));
const out = { url, nick, when: new Date().toISOString(), failed, passed: results.filter(r => r.pass).length, results, fps: { normal: fpsNormal, cpu4x: fpsThrottled, cpu4xAfterAdapt: fpsThrottled2 }, restartMs: Math.round(restartMs), device: await ev(() => __danfo.save.device), totalMs: Date.now() - t0 };
fs.writeFileSync(arg('--out') || '/tmp/danfo-playtest.json', JSON.stringify(out, null, 1));
console.log(`\n${out.passed} passed, ${failed} failed`);
await browser.close();
process.exit(failed ? 1 : 0);
