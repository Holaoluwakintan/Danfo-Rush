// Gameplay clip: steps the real game at exactly 30 fps (manual clock) and screenshots each frame,
// so the clip is smooth regardless of headless speed. Then: ffmpeg -> H.264 MP4.
import { chromium } from 'playwright-core';
import fs from 'fs'; import { execSync } from 'child_process';
const url = process.argv[2] || 'http://127.0.0.1:4780/', out = process.argv[3] || '/tmp/danfo-video.mp4', secs = +(process.argv[4] || 10);
const dir = '/tmp/danfo-frames'; 
const b = await chromium.launch({ args: ['--no-sandbox'] });
for (let attempt = 0; attempt < 6; attempt++) {
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir);
  const p = await b.newPage({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p.goto(url); await p.waitForFunction(() => window.__danfo); await p.waitForTimeout(700);
  await p.evaluate(() => { document.querySelector('#streak').classList.remove('show'); __danfo.save.tutorialDone = true; __danfo.save.nick = 'Michael'; });
  await p.waitForTimeout(300);
  await p.click('#btnPlay', { force: true }); await p.waitForTimeout(100);
  await p.evaluate(() => { window.__manual = true; const g = __danfo.game; g.autopilot = true; g.dist = 30 * 905; g.speed = 640; g.lockQuality = true; g.quality = 2; g.applyQuality(); g.coins = 120; g.score = 4200; });
  let dead = false;
  for (let f = 0; f < secs * 30; f++) {
    const st = await p.evaluate(f => { const g = __danfo.game; if (f === 120) { g.obj('power', g.bus.lane, g.busY - 330, { ptype: 'magnet', w: 40, h: 40, collect: true }); } g.update(1 / 30); g.render(); return g.mode; }, f);
    if (st !== 'play') { dead = true; break; }
    await p.screenshot({ path: `${dir}/f${String(f).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 90 });
  }
  await p.close();
  if (!dead) break;
  console.log('bot crashed, retake', attempt);
}
await b.close();
execSync(`ffmpeg -y -loglevel error -framerate 30 -i ${dir}/f%04d.jpg -vf "scale=720:1600:flags=lanczos,format=yuv420p" -c:v libx264 -preset slow -crf 26 -movflags +faststart ${out}`);
console.log('video', out, fs.statSync(out).size);
