// All art is drawn in code (vector paths), cached to offscreen canvases at device resolution.
export const SKINS = [
  { id: 'classic', name: 'Classic Danfo', price: 0, body: '#FFC21A', body2: '#F29E00', stripe: '#141414', roof: '#FFD84D', tag: 'The OG yellow' },
  { id: 'molue', name: 'Molue', price: 1500, body: '#F7B500', body2: '#C98200', stripe: '#141414', roof: '#E9E2CF', long: true, tag: 'Old-school 911 legend' },
  { id: 'eko', name: 'Eko Green', price: 3000, body: '#0FA958', body2: '#06783D', stripe: '#FFFFFF', roof: '#22C46E', tag: 'Green-white-green pride' },
  { id: 'brt', name: 'BRT Blue', price: 5000, body: '#1F6FE5', body2: '#1348A6', stripe: '#E8323C', roof: '#3D86F2', text: 'BRT', tag: 'Lane discipline. Sometimes.' },
  { id: 'owambe', name: 'Owambe Purple', price: 8000, body: '#8C3BE0', body2: '#5B1FA3', stripe: '#FFC21A', roof: '#A35CF0', dots: true, tag: 'Aso-ebi on wheels' },
  { id: 'gold', name: 'Gold Danfo', price: 25000, body: '#FFD86B', body2: '#B8860B', stripe: '#6B4A00', roof: '#FFF1B8', gold: true, tag: 'Big boy energy' },
];

let S = 2; // pixels per logical unit
export function setArtScale(s) { S = s; cache.clear(); }
let cache = new Map();
export function renderAt(scale, factory) { const s0 = S, c0 = cache; S = scale; cache = new Map(); try { return factory(); } finally { S = s0; cache = c0; } }

function mk(w, h, fn) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * S)); c.height = Math.max(1, Math.ceil(h * S));
  const g = c.getContext('2d'); g.scale(S, S); fn(g, w, h); c.lw = w; c.lh = h; return c;
}
export function sprite(key, w, h, fn) {
  let c = cache.get(key); if (!c) { c = mk(w, h, fn); cache.set(key, c); } return c;
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function shade(hex, f) { // f<0 darker, f>0 lighter
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, gg = (n >> 8) & 255, b = n & 255;
  const t = f < 0 ? 0 : 255, p = Math.abs(f);
  r = Math.round((t - r) * p + r); gg = Math.round((t - gg) * p + gg); b = Math.round((t - b) * p + b);
  return `rgb(${r},${gg},${b})`;
}

// ---------- vehicles (front points UP) ----------
export function busSprite(skin) {
  const L = skin.long ? 128 : 118;
  return sprite('bus_' + skin.id, 64, L, (g, w, h) => {
    const x = 4, y = 2, bw = w - 8, bh = h - 4;
    // mirrors
    g.fillStyle = '#222'; rr(g, 0, 18, 6, 8, 2); g.fill(); rr(g, w - 6, 18, 6, 8, 2); g.fill();
    // body with cylindrical shading
    const gr = g.createLinearGradient(x, 0, x + bw, 0);
    gr.addColorStop(0, skin.body2); gr.addColorStop(0.18, skin.body); gr.addColorStop(0.5, shade(skin.body, 0.12)); gr.addColorStop(0.82, skin.body); gr.addColorStop(1, skin.body2);
    g.fillStyle = gr; rr(g, x, y, bw, bh, 14); g.fill();
    // side stripes
    g.fillStyle = skin.stripe; g.fillRect(x + 1, y + 22, 5, bh - 34); g.fillRect(x + bw - 6, y + 22, 5, bh - 34);
    if (skin.id === 'eko') { g.fillStyle = '#fff'; g.fillRect(x + bw / 2 - 9, y + 24, 18, bh - 38); }
    // windscreen
    const wg = g.createLinearGradient(0, y + 4, 0, y + 22);
    wg.addColorStop(0, '#1d2a3a'); wg.addColorStop(1, '#3d5674');
    g.fillStyle = wg; g.beginPath(); g.moveTo(x + 8, y + 20); g.lineTo(x + 12, y + 6); g.lineTo(x + bw - 12, y + 6); g.lineTo(x + bw - 8, y + 20); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(x + 16, y + 18); g.lineTo(x + 20, y + 8); g.lineTo(x + 25, y + 8); g.lineTo(x + 21, y + 18); g.fill();
    // roof panel
    const rg = g.createLinearGradient(x + 8, 0, x + bw - 8, 0);
    rg.addColorStop(0, shade(skin.roof, -0.08)); rg.addColorStop(0.5, skin.roof); rg.addColorStop(1, shade(skin.roof, -0.08));
    g.fillStyle = rg; rr(g, x + 8, y + 24, bw - 16, bh - 40, 6); g.fill();
    if (skin.dots) { g.fillStyle = 'rgba(255,215,64,.55)'; for (let i = 0; i < 9; i++) for (let j = 0; j < 3; j++) { g.beginPath(); g.arc(x + 16 + j * 12, y + 30 + i * 9, 1.8, 0, 7); g.fill(); } }
    if (skin.gold) { g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.moveTo(x + 12, y + 30); g.lineTo(x + 22, y + 30); g.lineTo(x + 14, y + bh - 30); g.lineTo(x + 10, y + bh - 30); g.fill(); }
    // roof rack + luggage
    g.strokeStyle = 'rgba(20,20,20,.55)'; g.lineWidth = 1.6;
    rr(g, x + 12, y + 34, bw - 24, bh - 64, 3); g.stroke();
    for (let i = 1; i < 5; i++) { const yy = y + 34 + i * (bh - 64) / 5; g.beginPath(); g.moveTo(x + 12, yy); g.lineTo(x + bw - 12, yy); g.stroke(); }
    if (skin.text) {
      g.fillStyle = '#fff'; g.font = '900 15px Lilita One, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.save(); g.translate(w / 2, y + bh / 2); g.rotate(-Math.PI / 2); g.fillText(skin.text, 0, 0); g.restore();
    } else {
      // "Ghana must go" plaid bag
      g.fillStyle = '#C8323A'; rr(g, x + 15, y + 40, 18, 14, 2); g.fill();
      g.fillStyle = 'rgba(30,60,170,.75)'; g.fillRect(x + 15, y + 44, 18, 3); g.fillRect(x + 20, y + 40, 3, 14); g.fillRect(x + 27, y + 40, 3, 14);
      g.fillStyle = '#6B4A2B'; rr(g, x + 34, y + 58, 13, 16, 2); g.fill();
      g.fillStyle = '#2E7D32'; rr(g, x + 16, y + 62, 14, 11, 2); g.fill();
    }
    // rear window + lights
    g.fillStyle = '#26364a'; rr(g, x + 12, y + bh - 13, bw - 24, 7, 3); g.fill();
    g.fillStyle = '#ff3b30'; g.fillRect(x + 3, y + bh - 7, 6, 4); g.fillRect(x + bw - 9, y + bh - 7, 6, 4);
    g.fillStyle = '#fff6c4'; g.fillRect(x + 4, y + 1, 8, 3); g.fillRect(x + bw - 12, y + 1, 8, 3);
    // conductor hanging out of the door (right side)
    g.fillStyle = '#e94f37'; g.beginPath(); g.ellipse(w - 3, y + bh * 0.47, 4, 6, 0, 0, 7); g.fill();
    g.fillStyle = '#3b2314'; g.beginPath(); g.arc(w - 2.5, y + bh * 0.47 - 6, 3.6, 0, 7); g.fill();
    g.strokeStyle = '#3b2314'; g.lineWidth = 2.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(w - 2, y + bh * 0.47); g.lineTo(w + 0.5, y + bh * 0.47 - 12); g.stroke();
    // gloss outline
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.2; rr(g, x, y, bw, bh, 14); g.stroke();
  });
}

const CAR_COLORS = ['#E53935', '#ECEFF1', '#263238', '#1E88E5', '#43A047', '#8E24AA', '#FB8C00', '#90A4AE'];
export function carSprite(i) {
  const col = CAR_COLORS[i % CAR_COLORS.length];
  return sprite('car' + i, 56, 100, (g, w, h) => {
    g.fillStyle = '#1a1a1a'; rr(g, 2, 16, 4, 14, 2); g.fill(); rr(g, w - 6, 16, 4, 14, 2); g.fill(); rr(g, 2, h - 30, 4, 14, 2); g.fill(); rr(g, w - 6, h - 30, 4, 14, 2); g.fill();
    const gr = g.createLinearGradient(5, 0, w - 5, 0);
    gr.addColorStop(0, shade(col, -0.35)); gr.addColorStop(0.25, col); gr.addColorStop(0.5, shade(col, 0.2)); gr.addColorStop(0.75, col); gr.addColorStop(1, shade(col, -0.35));
    g.fillStyle = gr; rr(g, 5, 2, w - 10, h - 4, 16); g.fill();
    g.fillStyle = '#22303f'; g.beginPath(); g.moveTo(11, 34); g.quadraticCurveTo(w / 2, 22, w - 11, 34); g.lineTo(w - 14, 44); g.lineTo(14, 44); g.closePath(); g.fill();
    g.fillStyle = shade(col, 0.08); rr(g, 13, 44, w - 26, 30, 6); g.fill();
    g.fillStyle = '#22303f'; g.beginPath(); g.moveTo(14, 74); g.lineTo(w - 14, 74); g.lineTo(w - 11, 84); g.quadraticCurveTo(w / 2, 90, 11, 84); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(16, 46, 4, 26);
    g.fillStyle = '#fffbd0'; rr(g, 9, 3, 10, 4, 2); g.fill(); rr(g, w - 19, 3, 10, 4, 2); g.fill();
    g.fillStyle = '#ff2d2d'; rr(g, 9, h - 7, 10, 4, 2); g.fill(); rr(g, w - 19, h - 7, 10, 4, 2); g.fill();
  });
}
export function tankerSprite() {
  return sprite('tanker', 64, 156, (g, w, h) => {
    g.fillStyle = '#1a1a1a'; for (const yy of [20, 70, 100, 124]) { rr(g, 2, yy, 5, 18, 2); g.fill(); rr(g, w - 7, yy, 5, 18, 2); g.fill(); }
    g.fillStyle = '#e8e8e8'; rr(g, 6, 2, w - 12, 34, 8); g.fill();
    g.fillStyle = '#22303f'; rr(g, 11, 6, w - 22, 10, 3); g.fill();
    g.fillStyle = '#d32f2f'; rr(g, 8, 18, w - 16, 16, 4); g.fill();
    const gr = g.createLinearGradient(6, 0, w - 6, 0);
    gr.addColorStop(0, '#8d99a6'); gr.addColorStop(0.5, '#f3f6f9'); gr.addColorStop(1, '#8d99a6');
    g.fillStyle = gr; rr(g, 6, 40, w - 12, h - 44, 18); g.fill();
    g.fillStyle = '#ffb300'; g.fillRect(6, 80, w - 12, 10);
    g.fillStyle = '#5d6b78'; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(w / 2, 58 + i * 32, 5, 0, 7); g.fill(); }
    g.fillStyle = '#c62828'; g.font = 'bold 9px system-ui'; g.textAlign = 'center'; g.save(); g.translate(w / 2, 120); g.rotate(-Math.PI / 2); g.fillText('FLAMMABLE', 0, 3); g.restore();
  });
}
export function okadaSprite(i) {
  const shirts = ['#2E7D32', '#1565C0', '#C62828', '#F9A825'];
  return sprite('okada' + i, 30, 64, (g, w, h) => {
    g.fillStyle = '#111'; rr(g, w / 2 - 3, 0, 6, 15, 3); g.fill(); rr(g, w / 2 - 3, h - 15, 6, 15, 3); g.fill();
    g.fillStyle = '#B71C1C'; rr(g, w / 2 - 5, 10, 10, h - 20, 5); g.fill();
    g.strokeStyle = '#555'; g.lineWidth = 2.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(3, 15); g.lineTo(w - 3, 15); g.stroke();
    // passenger + rider
    g.fillStyle = shirts[(i + 1) % 4]; g.beginPath(); g.ellipse(w / 2, 42, 11, 7, 0, 0, 7); g.fill();
    g.fillStyle = '#3b2314'; g.beginPath(); g.arc(w / 2, 44, 5, 0, 7); g.fill();
    g.fillStyle = shirts[i % 4]; g.beginPath(); g.ellipse(w / 2, 28, 12, 7, 0, 0, 7); g.fill();
    g.strokeStyle = shirts[i % 4]; g.lineWidth = 3.5; g.beginPath(); g.moveTo(5, 27); g.lineTo(4, 16); g.moveTo(w - 5, 27); g.lineTo(w - 4, 16); g.stroke();
    g.fillStyle = '#FFD600'; g.beginPath(); g.arc(w / 2, 25, 6, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(w / 2 - 2, 23, 2, 0, 7); g.fill();
  });
}
export function kekeSprite() {
  return sprite('keke', 50, 76, (g, w, h) => {
    g.fillStyle = '#111'; rr(g, w / 2 - 3, 0, 6, 12, 3); g.fill(); rr(g, 1, h - 20, 6, 15, 2); g.fill(); rr(g, w - 7, h - 20, 6, 15, 2); g.fill();
    g.fillStyle = '#FFD000'; g.beginPath(); g.moveTo(w / 2 - 10, 6); g.lineTo(w / 2 + 10, 6); g.lineTo(w - 4, 30); g.lineTo(w - 4, h - 4); g.lineTo(4, h - 4); g.lineTo(4, 30); g.closePath(); g.fill();
    g.fillStyle = '#1B8F3A'; rr(g, 6, 22, w - 12, h - 28, 8); g.fill();
    g.fillStyle = '#22B04A'; rr(g, 9, 26, w - 18, h - 36, 6); g.fill();
    g.fillStyle = '#FFD000'; g.fillRect(9, 44, w - 18, 5);
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(12, 28, 4, h - 40);
    g.fillStyle = '#22303f'; g.beginPath(); g.moveTo(w / 2 - 8, 10); g.lineTo(w / 2 + 8, 10); g.lineTo(w / 2 + 13, 20); g.lineTo(w / 2 - 13, 20); g.fill();
  });
}

// ---------- people (top-down) ----------
function person(g, cx, cy, shirt, skin, hat, armUp) {
  g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.ellipse(cx + 2, cy + 3, 13, 9, 0, 0, 7); g.fill();
  g.fillStyle = shirt; g.beginPath(); g.ellipse(cx, cy, 12, 7.5, 0, 0, 7); g.fill();
  g.strokeStyle = skin; g.lineWidth = 4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(cx - 10, cy); g.lineTo(cx - 13, cy + 8);
  if (armUp) { g.moveTo(cx + 10, cy - 1); g.lineTo(cx + 18, cy - 12); } else { g.moveTo(cx + 10, cy); g.lineTo(cx + 13, cy + 8); }
  g.stroke();
  g.fillStyle = skin; g.beginPath(); g.arc(cx, cy, 5.8, 0, 7); g.fill();
  if (hat) { g.fillStyle = hat; g.beginPath(); g.arc(cx, cy - 0.5, 6.2, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.arc(cx - 2, cy - 2, 2, 0, 7); g.fill(); }
  else { g.fillStyle = '#1a0f08'; g.beginPath(); g.arc(cx, cy - 1, 5, Math.PI, 0); g.fill(); }
}
export function agberoSprite(frame) {
  return sprite('agbero' + frame, 44, 40, (g, w, h) => person(g, w / 2 - 2, h / 2 + 2, '#D32F2F', '#6d4126', '#1a1a1a', frame === 0));
}
export function lastmaSprite() {
  return sprite('lastma', 46, 44, (g, w, h) => {
    person(g, w / 2 - 4, h / 2 + 4, '#FFD000', '#5a341f', '#7B1F2E', false);
    g.fillStyle = '#555'; g.fillRect(w - 13, 10, 2.5, 14);
    g.fillStyle = '#E53935'; g.beginPath(); g.arc(w - 12, 9, 8, 0, 7); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = '#fff'; g.font = 'bold 5.5px system-ui'; g.textAlign = 'center'; g.fillText('STOP', w - 12, 11);
  });
}
export function policeSprite() {
  return sprite('police', 40, 40, (g, w, h) => person(g, w / 2, h / 2, '#1d2430', '#5a341f', '#0f1218', false));
}
const SHIRTS = ['#FF7043', '#26A69A', '#AB47BC', '#42A5F5', '#EC407A', '#7CB342'];
export function passengerSprite(i) {
  return sprite('pass' + i, 40, 40, (g, w, h) => {
    person(g, w / 2, h / 2, SHIRTS[i % SHIRTS.length], ['#6d4126', '#8a5a3c', '#4a2c1a'][i % 3], i % 2 ? '#F4511E' : null, true);
    // ankara pattern dots
    g.fillStyle = 'rgba(255,255,255,.55)'; for (let k = -2; k <= 2; k++) { g.beginPath(); g.arc(w / 2 + k * 4, h / 2 + 4, 1.1, 0, 7); g.fill(); }
  });
}

// ---------- road hazards ----------
export function potholeSprite(i) {
  return sprite('pot' + i, 64, 48, (g, w, h) => {
    const n = 14, pts = [];
    let seed = 7 + i * 13; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2, r = 0.78 + rnd() * 0.22; pts.push([w / 2 + Math.cos(a) * (w / 2 - 3) * r, h / 2 + Math.sin(a) * (h / 2 - 3) * r]); }
    g.fillStyle = '#8a8478'; g.beginPath(); pts.forEach(([x, y], k) => k ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill();
    g.save(); g.translate(w / 2, h / 2); g.scale(0.82, 0.8); g.translate(-w / 2, -h / 2);
    g.fillStyle = '#2b2622'; g.beginPath(); pts.forEach(([x, y], k) => k ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill(); g.restore();
    g.fillStyle = 'rgba(80,120,150,.55)'; g.beginPath(); g.ellipse(w / 2 + 3, h / 2 + 3, w * 0.22, h * 0.17, 0, 0, 7); g.fill();
    g.strokeStyle = '#3a342e'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(3, h / 2); g.lineTo(-2, h / 2 - 6); g.moveTo(w - 5, h / 2 + 4); g.lineTo(w, h / 2 + 10); g.stroke();
  });
}
export function puddleSprite() {
  return sprite('puddle', 76, 54, (g, w, h) => {
    g.fillStyle = 'rgba(92,72,48,.75)'; g.beginPath(); g.ellipse(w / 2, h / 2, w / 2 - 1, h / 2 - 1, 0.1, 0, 7); g.fill();
    g.fillStyle = 'rgba(70,110,140,.8)'; g.beginPath(); g.ellipse(w / 2 + 2, h / 2, w / 2 - 9, h / 2 - 9, 0.1, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.ellipse(w / 2 - 10, h / 2 - 6, 12, 3, -0.2, 0, 7); g.fill();
    g.beginPath(); g.ellipse(w / 2 + 12, h / 2 + 7, 6, 1.6, -0.2, 0, 7); g.fill();
  });
}
export function checkpointSprite() {
  return sprite('checkpoint', 176, 44, (g, w, h) => {
    // drums + plank with spikes
    g.fillStyle = 'rgba(0,0,0,.25)'; rr(g, 4, 18, w - 4, 20, 6); g.fill();
    g.fillStyle = '#e9e9e9'; rr(g, 8, 16, w - 16, 10, 3); g.fill();
    g.fillStyle = '#D32F2F'; for (let x = 12; x < w - 20; x += 20) g.fillRect(x, 16, 10, 10);
    g.fillStyle = '#444'; for (let x = 10; x < w - 10; x += 8) { g.beginPath(); g.moveTo(x, 30); g.lineTo(x + 4, 38); g.lineTo(x + 8, 30); g.fill(); }
    for (const x of [16, w / 2, w - 16]) {
      g.fillStyle = '#E65100'; g.beginPath(); g.arc(x, 21, 11, 0, 7); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.beginPath(); g.arc(x, 21, 7, 0, 7); g.stroke();
      g.fillStyle = '#BF360C'; g.beginPath(); g.arc(x, 21, 3, 0, 7); g.fill();
    }
  });
}

// ---------- collectibles ----------
export function coinSprite() {
  return sprite('coin', 26, 26, (g, w, h) => {
    const gr = g.createRadialGradient(9, 8, 2, 13, 13, 13);
    gr.addColorStop(0, '#FFF6B0'); gr.addColorStop(0.5, '#FFC107'); gr.addColorStop(1, '#C77C00');
    g.fillStyle = gr; g.beginPath(); g.arc(13, 13, 12, 0, 7); g.fill();
    g.strokeStyle = '#A86500'; g.lineWidth = 1.5; g.beginPath(); g.arc(13, 13, 8.5, 0, 7); g.stroke();
    g.fillStyle = '#8A5200'; g.font = '900 12px Lilita One, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('₦', 13, 13.5);
  });
}
export function fuelSprite() {
  return sprite('fuel', 26, 30, (g, w, h) => {
    g.fillStyle = 'rgba(0,0,0,.25)'; rr(g, 4, 6, 21, 23, 4); g.fill();
    g.fillStyle = '#E53935'; rr(g, 2, 4, 20, 24, 4); g.fill();
    g.fillStyle = '#B71C1C'; rr(g, 14, 0, 6, 6, 1.5); g.fill();
    g.strokeStyle = '#B71C1C'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(5, 5); g.lineTo(11, 2); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2; g.beginPath(); g.moveTo(6, 10); g.lineTo(18, 24); g.moveTo(18, 10); g.lineTo(6, 24); g.stroke();
  });
}
export const POWERS = {
  shield: { name: 'Pure Water Shield', color: '#29B6F6', short: 'Shield' },
  jerry: { name: 'Fuel-Scarcity-Proof Jerrycan', color: '#FFB300', short: 'Full Tank' },
  magnet: { name: 'Agbero-Free Magnet', color: '#EF5350', short: 'Magnet' },
  express: { name: 'Express Lane', color: '#00E676', short: 'Express' },
};
export function powerIcon(g, type, cx, cy, s) {
  g.save(); g.translate(cx, cy); g.scale(s, s);
  if (type === 'shield') { // pure water sachet
    g.fillStyle = 'rgba(225,245,255,.95)'; rr(g, -11, -13, 22, 26, 5); g.fill();
    g.strokeStyle = '#0288D1'; g.lineWidth = 1.4; g.stroke();
    g.fillStyle = '#0288D1'; g.fillRect(-8, -6, 16, 3); g.fillRect(-6, -1, 12, 2); g.fillRect(-7, 3, 14, 2);
    g.fillStyle = '#4FC3F7'; g.beginPath(); g.moveTo(0, -12); g.quadraticCurveTo(5, -8, 0, -7.5); g.quadraticCurveTo(-5, -8, 0, -12); g.fill();
  } else if (type === 'jerry') {
    g.fillStyle = '#FFB300'; rr(g, -10, -9, 20, 22, 4); g.fill();
    g.fillStyle = '#E65100'; rr(g, 3, -14, 6, 6, 1.5); g.fill();
    g.strokeStyle = '#E65100'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-7, -9); g.lineTo(-1, -12); g.stroke();
    g.fillStyle = '#fff'; g.font = '900 10px Lilita One, system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('∞', 0, 3);
  } else if (type === 'magnet') {
    g.lineWidth = 7; g.lineCap = 'butt'; g.strokeStyle = '#E53935'; g.beginPath(); g.arc(0, -1, 8, Math.PI, 0); g.stroke();
    g.beginPath(); g.moveTo(-8, -1); g.lineTo(-8, 7); g.moveTo(8, -1); g.lineTo(8, 7); g.stroke();
    g.strokeStyle = '#ECEFF1'; g.beginPath(); g.moveTo(-8, 7); g.lineTo(-8, 12); g.moveTo(8, 7); g.lineTo(8, 12); g.stroke();
  } else if (type === 'express') {
    g.fillStyle = '#00E676'; g.beginPath(); g.moveTo(-10, 2); g.lineTo(0, -12); g.lineTo(10, 2); g.lineTo(4, 2); g.lineTo(4, 12); g.lineTo(-4, 12); g.lineTo(-4, 2); g.closePath(); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-5, -1); g.lineTo(0, -8); g.lineTo(5, -1); g.closePath(); g.fill();
  }
  g.restore();
}
export function powerSprite(type) {
  return sprite('pw_' + type, 48, 48, (g, w, h) => {
    const c = POWERS[type].color;
    const gr = g.createRadialGradient(24, 24, 4, 24, 24, 24);
    gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(0.55, c + 'cc'); gr.addColorStop(1, c + '00');
    g.fillStyle = gr; g.beginPath(); g.arc(24, 24, 24, 0, 7); g.fill();
    g.fillStyle = 'rgba(20,24,40,.85)'; g.beginPath(); g.arc(24, 24, 16, 0, 7); g.fill();
    g.strokeStyle = c; g.lineWidth = 2.5; g.stroke();
    powerIcon(g, type, 24, 24, 0.82);
  });
}

// ---------- roadside ----------
export function zincRoof(i) {
  const W = 52 + (i % 3) * 6, H = 70 + (i % 4) * 12;
  return sprite('zinc' + i, W, H, (g, w, h) => {
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(4, 4, w - 4, h - 4);
    const rust = ['#9c6b4a', '#a9a9a2', '#8f5b3c', '#b8b2a3'][i % 4];
    g.fillStyle = rust; g.fillRect(0, 0, w - 4, h - 4);
    g.fillStyle = 'rgba(0,0,0,.18)'; for (let x = 2; x < w - 4; x += 5) g.fillRect(x, 0, 2, h - 4);
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, (h - 4) / 2 - 1, w - 4, 2);
    g.fillStyle = 'rgba(120,60,20,.35)'; g.beginPath(); g.ellipse(w * 0.3, h * 0.7, 9, 6, 0, 0, 7); g.fill();
  });
}
export function flatRoof(i) {
  const W = 60 + (i % 2) * 6, H = 84 + (i % 3) * 14;
  const cols = ['#E8D9C0', '#D9E3E8', '#F0E0D0', '#E3E8D9'];
  return sprite('flat' + i, W, H, (g, w, h) => {
    g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(5, 5, w - 5, h - 5);
    g.fillStyle = cols[i % 4]; g.fillRect(0, 0, w - 5, h - 5);
    g.strokeStyle = 'rgba(0,0,0,.15)'; g.lineWidth = 2; g.strokeRect(3, 3, w - 11, h - 11);
    // GeePee water tank (black)
    g.fillStyle = '#1b1b1b'; g.beginPath(); g.arc(16, 18, 8, 0, 7); g.fill();
    g.fillStyle = '#3a3a3a'; g.beginPath(); g.arc(16, 18, 3, 0, 7); g.fill();
    g.fillStyle = '#6d7a85'; g.fillRect(w - 26, h - 30, 14, 10);
  });
}
export function palmSprite(i) {
  return sprite('palm' + i, 56, 56, (g, w, h) => {
    g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.arc(w / 2 + 5, h / 2 + 5, 20, 0, 7); g.fill();
    const n = 8; for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2 + i;
      g.save(); g.translate(w / 2, h / 2); g.rotate(a);
      g.fillStyle = k % 2 ? '#2E7D32' : '#43A047'; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(10, -6, 26, 0); g.quadraticCurveTo(10, 6, 0, 0); g.fill();
      g.restore();
    }
    g.fillStyle = '#6D4C41'; g.beginPath(); g.arc(w / 2, h / 2, 4, 0, 7); g.fill();
  });
}
export function umbrellaSprite(i) {
  const pal = [['#E53935', '#FFEB3B'], ['#1E88E5', '#FFFFFF'], ['#43A047', '#FFFFFF'], ['#FB8C00', '#6A1B9A']][i % 4];
  return sprite('umb' + i, 46, 46, (g, w, h) => {
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.arc(w / 2 + 3, h / 2 + 3, 20, 0, 7); g.fill();
    for (let k = 0; k < 8; k++) { g.fillStyle = pal[k % 2]; g.beginPath(); g.moveTo(w / 2, h / 2); g.arc(w / 2, h / 2, 20, k * Math.PI / 4, (k + 1) * Math.PI / 4); g.fill(); }
    g.fillStyle = '#333'; g.beginPath(); g.arc(w / 2, h / 2, 2, 0, 7); g.fill();
  });
}
export function stallSprite(i) {
  return sprite('stall' + i, 40, 34, (g, w, h) => {
    g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(3, 3, w - 3, h - 3);
    g.fillStyle = '#8D6E63'; g.fillRect(0, 0, w - 3, h - 3);
    const goods = ['#F44336', '#FFEB3B', '#4CAF50', '#FF9800', '#E91E63'];
    for (let k = 0; k < 6; k++) { g.fillStyle = goods[(k + i) % 5]; g.beginPath(); g.arc(7 + (k % 3) * 12, 9 + Math.floor(k / 3) * 13, 4.5, 0, 7); g.fill(); }
  });
}
export function lampSprite() {
  return sprite('lamp', 30, 14, (g, w, h) => {
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(4, 8, w - 4, 4);
    g.fillStyle = '#9aa3ab'; g.fillRect(0, 5, w - 6, 3);
    g.fillStyle = '#fff3c0'; g.beginPath(); g.ellipse(w - 6, 6.5, 6, 4, 0, 0, 7); g.fill();
  });
}
export function canoeSprite(i) {
  return sprite('canoe' + i, 22, 64, (g, w, h) => {
    g.fillStyle = '#5D4037'; g.beginPath(); g.moveTo(w / 2, 0); g.quadraticCurveTo(w, h / 2, w / 2, h); g.quadraticCurveTo(0, h / 2, w / 2, 0); g.fill();
    g.fillStyle = '#8D6E63'; g.beginPath(); g.ellipse(w / 2, h / 2, 5, h / 2 - 8, 0, 0, 7); g.fill();
    g.fillStyle = ['#E53935', '#1E88E5'][i % 2]; g.beginPath(); g.arc(w / 2, h / 2 - 6, 4, 0, 7); g.fill();
    g.fillStyle = '#3b2314'; g.beginPath(); g.arc(w / 2, h / 2 - 6, 2.2, 0, 7); g.fill();
  });
}
export function stiltSprite(i) {
  return sprite('stilt' + i, 46, 40, (g, w, h) => {
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(4, 4, w - 4, h - 4);
    g.fillStyle = ['#8a6a4a', '#9c7b5a', '#7a5a3c'][i % 3]; g.fillRect(0, 0, w - 4, h - 4);
    g.fillStyle = 'rgba(0,0,0,.2)'; for (let x = 2; x < w - 4; x += 6) g.fillRect(x, 0, 2, h - 4);
  });
}
export function signSprite(text) {
  return sprite('sign_' + text, 92, 34, (g, w, h) => {
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(4, 4, w - 4, h - 4);
    g.fillStyle = '#0B6B3A'; rr(g, 0, 0, w - 4, h - 4, 4); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 1.5; rr(g, 2.5, 2.5, w - 9, h - 9, 3); g.stroke();
    g.fillStyle = '#fff'; g.font = '13px Lilita One, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, (w - 4) / 2, (h - 4) / 2 + 1, w - 14);
  });
}
export function busStopSprite(text) {
  return sprite('stop_' + text, 46, 86, (g, w, h) => {
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(5, 5, w - 5, h - 5);
    g.fillStyle = '#E0E0E0'; g.fillRect(0, 0, w - 5, h - 5);
    g.fillStyle = '#1565C0'; g.fillRect(0, 0, w - 5, 14);
    g.fillStyle = '#fff'; g.font = '9px Lilita One, system-ui'; g.textAlign = 'center'; g.fillText('BUS STOP', (w - 5) / 2, 10);
    g.save(); g.translate((w - 5) / 2, 48); g.rotate(-Math.PI / 2); g.fillStyle = '#1565C0'; g.font = '13px Lilita One, system-ui'; g.fillText(text, 0, 4); g.restore();
  });
}
