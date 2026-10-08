import { SKINS } from './art.js';
export const CONFIG = {
  VERSION: '1.1.0',
  ADS_ENABLED: false,        // rewarded "watch ad to continue": placeholder only
  PAYSTACK_READY: false,     // flip when Paystack keys + coin packs go live
  PAYSTACK_PUBLIC_KEY: '',
  SUPA_URL: 'https://rlbrhpjljjgpqpqjrpkc.supabase.co',
  SUPA_KEY: 'sb_publishable_NT2VXfEUwWEEdcuft2VdDA_9DXSaMq4', // publishable: safe in browser; data only via checked RPCs
  SITE: 'https://danfo-rush-ng.vercel.app',
};
const KEY = 'danfo.v1';
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
const DEF = () => ({
  device: uuid(), nick: '', coins: 0, best: 0, totalRuns: 0, totalDistance: 0, totalPassengers: 0,
  skin: 'classic', owned: ['classic'], up: { shield: 0, magnet: 0, express: 0, jerry: 0 },
  settings: { sfx: true, music: true, haptics: true, shake: true, voice: true }, seenPowers: [],
  tutorialDone: false, streak: 0, lastDay: '', lastClaim: '', missions: null, pending: [],
});
export let save = load();
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.device) { const d = DEF(); return { ...d, ...s, up: { ...d.up, ...s.up }, settings: { ...d.settings, ...s.settings } }; } } catch (e) {} return DEF(); }
export function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {} }
export function resetSave() { save = DEF(); persist(); }

// Lagos calendar day (UTC+1, no DST)
export function lagosDay(t = Date.now()) { return new Date(t + 3600e3).toISOString().slice(0, 10); }
function dayDiff(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / 864e5); }

// ---- daily streak ----
export const STREAK_REWARDS = [50, 100, 150, 250, 400, 600, 1000];
export function checkStreak() { // returns reward info if today's reward is unclaimed
  const today = lagosDay();
  if (save.lastClaim === today) return null;
  const gap = save.lastClaim ? dayDiff(save.lastClaim, today) : 99;
  const day = gap === 1 ? (save.streak % 7) + 1 : 1;
  return { day, reward: STREAK_REWARDS[day - 1], broke: gap > 1 && save.streak > 1 };
}
export function claimStreak(info) {
  save.streak = info.day === 1 ? 1 : save.streak + 1; save.lastClaim = lagosDay(); save.coins += info.reward; persist();
}

// ---- daily missions ----
const POOL = [
  { id: 'coins', t: n => `Collect ₦${n} in one run`, n: [150, 250, 400], stat: 'coins', reward: 150 },
  { id: 'pass', t: n => `Pick up ${n} passengers in one run`, n: [6, 10, 15], stat: 'passengers', reward: 200 },
  { id: 'near', t: n => `Get ${n} near misses in one run`, n: [4, 8, 12], stat: 'near', reward: 200 },
  { id: 'dist', t: n => `Drive ${n} m in one run`, n: [800, 1500, 2500], stat: 'distance', reward: 200 },
  { id: 'jumps', t: n => `Jump ${n} potholes in one run`, n: [3, 6, 10], stat: 'jumps', reward: 150 },
  { id: 'power', t: n => `Use ${n} power-ups in one run`, n: [2, 3, 5], stat: 'powers', reward: 150 },
  { id: 'score', t: n => `Score ${n.toLocaleString()} in one run`, n: [3000, 6000, 12000], stat: 'score', reward: 250 },
  { id: 'combo', t: n => `Reach a x${n} combo`, n: [3, 4, 5], stat: 'maxMult', reward: 200 },
  { id: 'runs', t: n => `Play ${n} runs today`, n: [3, 5, 8], stat: 'runsToday', reward: 120, cumulative: true },
  // v1.1 daily challenges (Lagos-flavoured; two of these lead every day's three)
  { id: 'carry', t: n => `Carry ${n} passengers today`, n: [20, 30, 45], stat: 'passengers', reward: 200, sum: true, fresh: true },
  { id: 'zone', t: n => ['', 'Reach Oshodi', 'Pass Oshodi', 'Cross Third Mainland Bridge', 'Reach Lekki Toll Gate'][n], n: [2, 3, 4], stat: 'zoneIdx', reward: 250, fresh: true },
  { id: 'nearrow', t: n => `Get ${n} near misses in a row`, n: [2, 3, 4], stat: 'nearRow', reward: 200, fresh: true },
];
// Streak bonus: every claimed reward grows +10% per streak day, up to +100% at 10 days
export const streakMult = () => 1 + Math.min(save.streak || 0, 10) * 0.1;
export const withStreak = n => Math.round(n * streakMult());
function seeded(str) { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296; }
export function missions() {
  const today = lagosDay();
  const old = save.missions && save.missions.day === today && !save.missions.v && !save.missions.list.some(m => m.claimed); // upgrade today's v1 list once
  if (!save.missions || save.missions.day !== today || old) {
    const r = seeded('danfo' + today), picks = [];
    const fresh = POOL.map((p, i) => i).filter(i => POOL[i].fresh), rest = POOL.map((p, i) => i).filter(i => !POOL[i].fresh);
    const take = (arr) => arr.splice(Math.floor(r() * arr.length), 1)[0];
    const order = [take(fresh), take(fresh), take(rest)].sort(() => r() - 0.5);
    for (const i of order) { const p = POOL[i]; const tier = picks.length; picks.push({ id: p.id, n: p.n[tier], prog: 0, done: false, claimed: false, reward: p.reward + tier * 100 }); }
    save.missions = { v: 2, day: today, list: picks, runsToday: 0, sums: {}, bonusClaimed: false }; persist();
  }
  return save.missions;
}
export function missionText(m) { return POOL.find(p => p.id === m.id).t(m.n); }
export function applyRunToMissions(st) { // st = run stats; returns newly completed missions
  const ms = missions(); ms.runsToday++; const done = []; ms.sums = ms.sums || {};
  for (const p of POOL) if (p.sum) ms.sums[p.stat] = (ms.sums[p.stat] || 0) + (st[p.stat] || 0);
  for (const m of ms.list) {
    if (m.done) continue; const p = POOL.find(x => x.id === m.id);
    const v = p.cumulative ? ms.runsToday : p.sum ? ms.sums[p.stat] : (st[p.stat] || 0);
    m.prog = Math.max(m.prog, Math.min(v, m.n)); if (v >= m.n) { m.done = true; done.push(m); }
  }
  persist(); return done;
}
export function liveMissionCheck(st) { // during a run: which not-done missions are now hit (for toasts)
  const ms = missions(); const out = [];
  for (const m of ms.list) { if (m.done || m.live) continue; const p = POOL.find(x => x.id === m.id); if (p.cumulative) continue; const v = (st[p.stat] || 0) + (p.sum ? ((ms.sums || {})[p.stat] || 0) : 0); if (v >= m.n) { m.live = true; out.push(m); } }
  return out;
}
export function claimMission(m) { if (!m.done || m.claimed) return 0; m.claimed = true; const got = withStreak(m.reward); save.coins += got; persist(); return got; }
export function missionIcon(id) { return { coins: '💰', pass: '🧍', near: '😱', dist: '🛣️', jumps: '🕳️', power: '⚡', score: '⭐', combo: '🔥', runs: '🔁', carry: '🚌', zone: '🗺️', nearrow: '😱' }[id] || '🎯'; }
export function unclaimedCount() { const ms = missions(); return ms.list.filter(m => m.done && !m.claimed).length; }
export const ALL_BONUS = 500;

// ---- garage ----
export const UPGRADES = {
  shield: { name: 'Pure Water Shield', desc: 'Shield lasts longer', base: 6, per: 1.5, unit: 's' },
  magnet: { name: 'Agbero-Free Magnet', desc: 'Magnet lasts longer', base: 7, per: 1.5, unit: 's' },
  express: { name: 'NEPA Light', desc: 'Light lasts longer', base: 4, per: 0.8, unit: 's' },
  jerry: { name: 'Jerrycan', desc: 'Free fuel lasts longer', base: 8, per: 2, unit: 's' },
};
export const MAX_UP = 5;
export const upCost = lvl => [300, 700, 1500, 3000, 6000][lvl] || Infinity;
const FIXED_DUR = { agbero: 1.6, double: 8 };
export const powerDur = k => UPGRADES[k] ? UPGRADES[k].base + UPGRADES[k].per * save.up[k] : FIXED_DUR[k] || 5;
export function buyUpgrade(k) { const l = save.up[k], c = upCost(l); if (l >= MAX_UP || save.coins < c) return false; save.coins -= c; save.up[k]++; persist(); return true; }
export function buySkin(id) { const s = SKINS.find(x => x.id === id); if (!s || save.owned.includes(id) || save.coins < s.price) return false; save.coins -= s.price; save.owned.push(id); save.skin = id; persist(); return true; }
export const currentSkin = () => SKINS.find(s => s.id === save.skin) || SKINS[0];
