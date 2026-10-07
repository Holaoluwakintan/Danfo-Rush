import { CONFIG, save, persist } from './store.js';
const H = { apikey: CONFIG.SUPA_KEY, Authorization: 'Bearer ' + CONFIG.SUPA_KEY, 'Content-Type': 'application/json' };
async function rpc(fn, body, ms = 7000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(`${CONFIG.SUPA_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: H, body: JSON.stringify(body), signal: ctl.signal });
    if (!r.ok) throw new Error('rpc ' + r.status); return await r.json();
  } finally { clearTimeout(t); }
}
async function sig(score, distance, coins) {
  const data = new TextEncoder().encode(`${save.device}:${score}:${distance}:${coins}:danfo-oshodi-2026`);
  const h = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function startRun() { if (!navigator.onLine) return null; try { return await rpc('danfo_start_run', { p_device: save.device }, 4000); } catch (e) { return null; } }

// Every finished run is queued first, then flushed: offline runs sync when the phone is back online.
export function queueRun(run) {
  save.pending.push(run); if (save.pending.length > 30) save.pending.splice(0, save.pending.length - 30); persist();
  return flush();
}
let flushing = null;
export function flush() {
  if (flushing) return flushing;
  flushing = (async () => {
    let last = null;
    while (save.pending.length && navigator.onLine) {
      const r = save.pending[0];
      try {
        last = await rpc('danfo_submit', {
          p_device: save.device, p_run: r.run || null, p_nick: save.nick || 'Driver', p_score: r.score, p_coins: r.coins,
          p_distance: r.distance, p_passengers: r.passengers, p_near: r.near, p_duration_ms: r.duration, p_version: CONFIG.VERSION,
          p_sig: await sig(r.score, r.distance, r.coins),
        });
        save.pending.shift(); persist(); r.result = last;
      } catch (e) { console.warn('sync failed', e && e.message); break; }
    }
    return last;
  })().finally(() => { flushing = null; });
  return flushing;
}
const lbCache = {};
export async function leaderboard(board) {
  try { const d = await rpc('danfo_leaderboard', { p_board: board, p_device: save.device, p_limit: 50 }); lbCache[board] = d; try { localStorage.setItem('danfo.lb.' + board, JSON.stringify(d)); } catch (e) {} return d; }
  catch (e) { const c = lbCache[board] || JSON.parse(localStorage.getItem('danfo.lb.' + board) || 'null'); if (c) c.stale = true; return c; }
}
window.addEventListener('online', () => flush());
