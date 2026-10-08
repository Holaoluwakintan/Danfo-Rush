// Gameplay clip: steps the real game at exactly 30 fps (manual clock) and screenshots each frame,
// so the clip is smooth regardless of headless speed. Then: ffmpeg -> H.264 MP4.
import { chromium } from 'playwright-core';
import fs from 'fs'; import { execSync } from 'child_process';
const url = process.argv[2] || 'http://127.0.0.1:4780/', out = process.argv[3] || '/tmp/danfo-video.mp4', secs = +(process.argv[4] || 13);
const voiceDir = process.argv[5] || new URL('../public/voice', import.meta.url).pathname; let voices = [];
const dir = '/tmp/danfo-frames'; 
const b = await chromium.launch({ args: ['--no-sandbox'] });
for (let attempt = 0; attempt < 6; attempt++) {
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir);
  const p = await b.newPage({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p.goto(url); await p.waitForFunction(() => window.__danfo); await p.waitForTimeout(700);
  await p.evaluate(() => { document.querySelector('#streak').classList.remove('show'); __danfo.save.tutorialDone = true; __danfo.save.nick = 'Michael'; });
  await p.waitForTimeout(300);
  await p.click('#btnPlay', { force: true }); await p.waitForTimeout(100);
  await p.waitForFunction(() => __danfo.voiceStats.loaded >= 11, null, { timeout: 15000 }).catch(() => console.log('voices not all loaded'));
  await p.evaluate(() => { window.__manual = true; const g = __danfo.game; g.autopilot = true; g.dist = 30 * 688; g.speed = 640; g.lockQuality = true; g.quality = 2; g.applyQuality(); g.coins = 120; g.score = 4200; __danfo.save.seenPowers = []; });
  let dead = false; voices = []; let played = await p.evaluate(() => __danfo.voiceStats.played);
  for (let f = 0; f < secs * 30; f++) {
    // v1.1 showcase: Oshodi entry, a NEPA Light, a passenger, then Third Mainland Bridge with Double Fare
    const st = await p.evaluate(f => { const g = __danfo.game;
      if (f === 75) g.obj('power', g.bus.lane, g.busY - 330, { ptype: 'express', w: 40, h: 40, collect: true });
      if (f === 150) g.obj('passenger', g.bus.lane, g.busY - 300, { w: 34, h: 34, collect: true, bubble: 'Oshodi!', person: true });
      if (f === 225) { g.objs = g.objs.filter(o => o.y > g.busY - 40); g.dist = 30 * 1396; g.nextRow = g.dist + 400; }
      if (f === 255) g.obj('power', g.bus.lane, g.busY - 330, { ptype: 'double', w: 40, h: 40, collect: true });
      if (f === 300) g.obj('passenger', g.bus.lane, g.busY - 300, { w: 34, h: 34, collect: true, bubble: 'CMS!', person: true });
      g.update(1 / 30); g.render(); return { mode: g.mode, played: __danfo.voiceStats.played, last: __danfo.voiceStats.last }; }, f);
    if (st.played !== played) { voices.push({ f, key: st.last }); played = st.played; }
    if (st.mode !== 'play') { dead = true; break; }
    await p.screenshot({ path: `${dir}/f${String(f).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 90 });
  }
  await p.close();
  if (!dead) break;
  console.log('bot crashed, retake', attempt);
}
await b.close();
// audio: the conductor voice lines exactly where the game played them (manual clock, so frame/30 = seconds)
const ins = voices.map(v => `-i ${voiceDir}/${v.key}.mp3`).join(' ');
const filt = voices.length ? voices.map((v, i) => `[${i + 1}:a]adelay=${Math.round(v.f / 30 * 1000)}|${Math.round(v.f / 30 * 1000)},volume=1.0[a${i}]`).join(';') + ';' + voices.map((v, i) => `[a${i}]`).join('') + `amix=inputs=${voices.length}:normalize=0,apad[aout]` : '';
console.log('voices', JSON.stringify(voices));
execSync(`nice -n 15 ffmpeg -y -loglevel error -threads 2 -framerate 30 -i ${dir}/f%04d.jpg ${ins} ${voices.length ? `-filter_complex "${filt}" -map 0:v -map "[aout]" -c:a aac -b:a 96k -ac 2 -shortest` : ''} -vf "scale=720:1600:flags=lanczos,format=yuv420p" -c:v libx264 -preset slow -crf 26 -movflags +faststart ${out}`);
console.log('video', out, fs.statSync(out).size);
