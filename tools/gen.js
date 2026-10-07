import * as A from '../src/art.js';
function bg(g, W, H) {
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#2b0f4f'); gr.addColorStop(0.6, '#c2185b'); gr.addColorStop(1, '#ff8f00'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
}
function road(g, W, H, cx, wTop, wBot, y0) {
  g.fillStyle = '#2f3237'; g.beginPath(); g.moveTo(cx - wTop / 2, y0); g.lineTo(cx + wTop / 2, y0); g.lineTo(cx + wBot / 2, H); g.lineTo(cx - wBot / 2, H); g.fill();
  g.fillStyle = '#FFCB05'; for (let i = 0; i < 6; i++) { const t = i / 6, y = y0 + 10 + t * t * (H - y0), w = 4 + t * 18; g.fillRect(cx - w / 2, y, w, 10 + t * 36); }
}
window.icon = (size, maskable) => {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  bg(g, size, size); g.fillStyle = 'rgba(255,214,0,.85)'; g.beginPath(); g.arc(size / 2, size * 0.55, size * 0.3, Math.PI, 0); g.fill();
  road(g, size, size, size / 2, size * 0.12, size * 1.1, size * 0.55);
  const sc = size / (maskable ? 210 : 170); const bus = A.renderAt(sc, () => A.busSprite(A.SKINS[0]));
  g.save(); g.translate(size / 2, size * 0.56); g.rotate(-0.18); g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = size * 0.04; g.drawImage(bus, -bus.width / 2, -bus.height / 2); g.restore();
  return c.toDataURL('image/png');
};
window.og = (challenge) => {
  const W = 1200, H = 630, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  bg(g, W, H); g.fillStyle = 'rgba(255,214,0,.9)'; g.beginPath(); g.arc(860, 470, 220, Math.PI, 0); g.fill();
  g.fillStyle = 'rgba(30,8,40,.5)'; let x = 560, s = 5; const r = () => (s = (s * 16807) % 2147483647) / 2147483647; while (x < W) { const bw = 40 + r() * 70, bh = 60 + r() * 200; g.fillRect(x, 470 - bh, bw - 6, bh); x += bw; }
  road(g, W, H, 860, 120, 900, 470);
  const bus = A.renderAt(3.1, () => A.busSprite(A.SKINS[0]));
  g.save(); g.translate(860, 470); g.rotate(-0.12); g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 30; g.drawImage(bus, -bus.width / 2, -bus.height / 2); g.restore();
  for (const [k, xx, yy, s2] of [['okada', 1080, 300, 2.2], ['coin', 700, 330, 2.6], ['coin', 650, 400, 2.2]]) { const sp = A.renderAt(s2, () => k === 'okada' ? A.okadaSprite(0) : A.coinSprite()); g.drawImage(sp, xx - sp.width / 2, yy - sp.height / 2); }
  g.textAlign = 'left'; g.lineJoin = 'round';
  g.font = '130px "Lilita One"'; g.lineWidth = 16; g.strokeStyle = '#2a0d00';
  g.save(); g.translate(60, 200); g.rotate(-0.05); g.strokeText('DANFO', 0, 0); g.fillStyle = '#FFC21A'; g.fillText('DANFO', 0, 0); g.strokeText('RUSH', 30, 120); g.fillStyle = '#fff'; g.fillText('RUSH', 30, 120); g.restore();
  g.font = '40px "Lilita One"'; g.fillStyle = '#fff'; g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,.45)';
  const line = challenge ? 'Beat my score if you fit! 😤' : 'Lagos traffic no dey smile 🚌💨'; g.strokeText(line, 64, 420); g.fillText(line, 64, 420);
  g.font = '28px "Lilita One"'; g.fillStyle = '#FFE082'; const l2 = 'Dodge okadas • potholes • LASTMA'; g.strokeText(l2, 64, 480); g.fillText(l2, 64, 480);
  g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.roundRect(60, 530, 420, 60, 30); g.fill(); g.fillStyle = '#fff'; g.font = '28px "Lilita One"'; g.fillText(challenge ? '⚔️ Tap to accept the challenge' : '▶ Play free, no download', 84, 570);
  return c.toDataURL('image/png');
};
