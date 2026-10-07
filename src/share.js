import * as A from './art.js';
import { CONFIG, save } from './store.js';
export const fmt = n => Math.floor(n).toLocaleString('en-US');
export function challengeUrl(score) { return `${CONFIG.SITE}/c/${Math.floor(score)}/${encodeURIComponent((save.nick || 'A driver').slice(0, 16))}`; }
export function shareText(st) { return `I just scored ${fmt(st.score)} in Danfo Rush 🚌💨 (${fmt(st.distance)} m, ${st.passengers} passengers). Lagos traffic no dey smile! Beat me if you fit 👉 ${challengeUrl(st.score)}`; }

export function scoreCard(st, skin, line) {
  const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#2b0f4f'); bg.addColorStop(0.55, '#c2185b'); bg.addColorStop(1, '#ff8f00');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // sun + skyline
  g.fillStyle = 'rgba(255,214,0,.9)'; g.beginPath(); g.arc(W / 2, 860, 260, Math.PI, 0); g.fill();
  g.fillStyle = 'rgba(30,8,40,.55)'; let x = 0; let s = 3; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  while (x < W) { const bw = 50 + r() * 90, bh = 80 + r() * 240; g.fillRect(x, 860 - bh, bw - 6, bh); x += bw; }
  // road
  g.fillStyle = '#2f3237'; g.beginPath(); g.moveTo(W / 2 - 90, 860); g.lineTo(W / 2 + 90, 860); g.lineTo(W + 200, H); g.lineTo(-200, H); g.fill();
  g.fillStyle = '#FFCB05'; for (let i = 0; i < 6; i++) { const t = i / 6, y = 870 + t * t * 480, w = 6 + t * 26; g.fillRect(W / 2 - w / 2, y, w, 16 + t * 50); }
  // bus
  const bus = A.renderAt(4.2, () => A.busSprite(skin));
  g.save(); g.translate(W / 2, 1110); g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 30; g.drawImage(bus, -bus.width / 2, -bus.height / 2); g.restore();
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = '92px "Lilita One", system-ui, sans-serif'; g.fillStyle = '#FFC21A'; g.strokeStyle = '#1a0a2a'; g.lineWidth = 14; g.lineJoin = 'round';
  g.strokeText('DANFO RUSH', W / 2, 150); g.fillText('DANFO RUSH', W / 2, 150);
  g.font = '44px "Lilita One", system-ui, sans-serif'; g.fillStyle = '#fff'; g.fillText(line || 'I just ran Lagos traffic', W / 2, 250);
  g.font = '190px "Lilita One", system-ui, sans-serif'; g.lineWidth = 18; g.strokeText(fmt(st.score), W / 2, 450); g.fillStyle = '#fff'; g.fillText(fmt(st.score), W / 2, 450);
  g.font = '46px "Lilita One", system-ui, sans-serif'; g.fillStyle = '#FFE082';
  g.fillText(`${fmt(st.distance)} m  •  ₦${fmt(st.coins)}  •  ${st.passengers} passengers`, W / 2, 530);
  g.fillStyle = '#fff'; g.font = '58px "Lilita One", system-ui, sans-serif'; g.lineWidth = 10; g.strokeText('Can you beat am? 😤', W / 2, 640); g.fillText('Can you beat am? 😤', W / 2, 640);
  g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.roundRect(W / 2 - 330, H - 120, 660, 80, 40); g.fill();
  g.fillStyle = '#fff'; g.font = '38px "Lilita One", system-ui, sans-serif'; g.fillText(CONFIG.SITE.replace('https://', ''), W / 2, H - 66);
  return c;
}
export async function shareScore(st, skin, line) {
  const text = shareText(st);
  try {
    const canvas = scoreCard(st, skin, line);
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    const file = new File([blob], 'danfo-rush-score.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return 'shared'; }
  } catch (e) { if (e && e.name === 'AbortError') return 'cancel'; }
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank'); return 'wa';
}
export async function shareChallenge(st) {
  const url = challengeUrl(st.score), text = `I dey challenge you 😤 Beat my ${fmt(st.score)} in Danfo Rush! 🚌💨`;
  try { if (navigator.share) { await navigator.share({ text, url }); return 'shared'; } } catch (e) { if (e && e.name === 'AbortError') return 'cancel'; }
  window.open('https://wa.me/?text=' + encodeURIComponent(text + ' ' + url), '_blank'); return 'wa';
}
