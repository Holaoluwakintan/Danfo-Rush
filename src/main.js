import { Game, DEATH_LINES } from './game.js';
import * as A from './art.js';
import { initAudio, sfx, setSfx, setMusic, startMusic, suspendAudio, resumeAudio } from './audio.js';
import { CONFIG, save, persist, checkStreak, claimStreak, STREAK_REWARDS, missions, missionText, applyRunToMissions, liveMissionCheck, claimMission, ALL_BONUS, UPGRADES, MAX_UP, upCost, powerDur, buyUpgrade, buySkin, currentSkin, lagosDay } from './store.js';
import { startRun, queueRun, flush, leaderboard } from './net.js';
import { fmt, shareScore, shareChallenge } from './share.js';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
const app = document.getElementById('app');
let runToken = null, lastStats = null, contCount = 0, challenge = null;

const game = new Game($('#cv'), { onHud: hud, onEvent, onGameOver });
window.__danfo = { game, save, flush, leaderboard }; // used by the automated playtest
game.reduced = reduced; game.forceAuto = params.has('autopilot');
applySettings();

// ---------- loop ----------
let hudFrame = 0;
function loop(now) {
  if (!window.__manual && !(reduced && game.mode === 'attract' && game.t0done)) game.frame(now);
  if (reduced && game.mode === 'attract') game.t0done = true;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---------- screens ----------
function show(id) {
  $$('.screen').forEach(s => s.classList.toggle('show', s.id === id)); app.classList.toggle('on-home', id === 'home');
  $('#hud').classList.toggle('hidden', id !== 'hud');
}
function openSheet(id) { closeSheets(); const el = $('#' + id); el.classList.add('show'); sfx.click(); if (id === 'missions') renderMissions(); if (id === 'garage') renderGarage(); if (id === 'board') renderBoard(); if (id === 'settings') renderSettings(); }
function closeSheets() { $$('.sheet').forEach(s => s.classList.remove('show')); }
function modal(id, on) { $('#' + id).classList.toggle('show', on); }
$$('[data-open]').forEach(b => b.onclick = () => openSheet(b.dataset.open));
$$('.sheet .close').forEach(b => b.onclick = () => { closeSheets(); sfx.click(); renderHome(); });
$$('.tabs').forEach(t => t.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return; sfx.click();
  t.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  const sheet = t.closest('.sheet');
  if (t.dataset.tabs === 'board') { boardTab = b.dataset.tab; renderBoard(); return; }
  sheet.querySelectorAll('.tab-body').forEach(x => x.classList.toggle('hidden', x.dataset.body !== b.dataset.tab));
}));

function toast(text, kind = '') { const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = text; $('#toasts').appendChild(t); setTimeout(() => t.remove(), 2700); while ($('#toasts').children.length > 3) $('#toasts').firstChild.remove(); }

// ---------- home ----------
function renderHome() {
  $('#mCoins').textContent = fmt(save.coins); $('#mBest').textContent = fmt(save.best); $('#mStreak').textContent = save.streak;
  const ms = missions(); $('#badgeMissions').classList.toggle('hidden', !ms.list.some(m => m.done && !m.claimed));
  if (challenge) { $('#challengeBanner').classList.remove('hidden'); $('#challengeBanner').textContent = `⚔️ ${challenge.n} dey challenge you: beat ${fmt(challenge.s)}!`; }
}
function goHome() {
  modal('over', false); modal('pause', false); closeSheets(); game.reset(true); game.t0done = false; show('home'); renderHome();
}

// ---------- run ----------
function play(tutorial) {
  initAudio(); startMusic(); closeSheets(); modal('over', false); modal('pause', false);
  const tut = tutorial || !save.tutorialDone;
  Object.keys(game.durs).forEach(k => game.durs[k] = powerDur(k));
  game.skin = currentSkin(); game.start(tut); contCount = 0; show('hud'); hudCache = {};
  $('#hChallenge').classList.toggle('hidden', !challenge);
  runToken = null; startRun().then(t => { runToken = t; });
  missions(); missionLive = {};
}
$('#btnPlay').onclick = () => play(false);
$('#btnAgain').onclick = () => play(false);
$('#btnTutorial').onclick = () => { save.tutorialDone = false; persist(); play(true); };

// ---------- HUD ----------
let hudCache = {}, missionLive = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; document.getElementById(id).textContent = v; } }
function hud(g) {
  hudFrame++;
  if (hudFrame % 2 === 0) setText('hScore', fmt(g.score));
  setText('hCoins', fmt(g.coins));
  if (hudCache.mult !== g.mult) { hudCache.mult = g.mult; const m = $('#hMult'); m.textContent = 'x' + g.mult; m.classList.toggle('hot', g.mult > 1); }
  const f = Math.round(g.fuel); if (hudCache.fuel !== f) { hudCache.fuel = f; $('#hFuel').style.transform = `scaleX(${f / 100})`; $('.fuel').classList.toggle('low', f < 25); }
  const c = Math.round(g.comboT / 4 * 100); if (hudCache.combo !== c) { hudCache.combo = c; $('#hCombo').style.width = c + '%'; }
  if (hudFrame % 6 === 0) {
    const act = Object.keys(g.pw).filter(k => g.pw[k] > 0); const key = act.map(k => k + Math.ceil(g.pw[k] * 4)).join();
    if (hudCache.pw !== key) {
      hudCache.pw = key;
      $('#hPowers').innerHTML = act.map(k => { const p = g.pw[k] / g.durs[k], col = A.POWERS[k].color; return `<div class="pw" style="color:${col}"><svg viewBox="0 0 46 46"><circle cx="23" cy="23" r="20" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="4"/><circle cx="23" cy="23" r="20" fill="none" stroke="${col}" stroke-width="4" stroke-dasharray="${(p * 125.7).toFixed(1)} 200" stroke-linecap="round"/></svg>${{ shield: '💧', magnet: '🧲', express: '⚡', jerry: '⛽' }[k]}<small>${A.POWERS[k].short}</small></div>`; }).join('');
    }
    if (challenge) { const left = challenge.s - Math.floor(g.score); setText('hChallenge', left > 0 ? `⚔️ ${fmt(left)} more to beat ${challenge.n}` : `🏆 You don pass ${challenge.n}!`); }
    const hits = liveMissionCheck(g.stats()); for (const m of hits) toast('🎯 Mission done: ' + missionText(m), 'good');
  }
}
function onEvent(type, d) {
  if (type === 'zone') toast((d.id === 'bridge' ? '🌉 ' : d.id === 'lekki' ? '🌴 ' : d.id === 'market' ? '🛒 ' : '📍 ') + d.name, 'zone');
  else if (type === 'toast') toast(d.text, d.kind);
  else if (type === 'power') toast({ shield: '💧 Pure Water shield!', magnet: '🧲 Agbero-free magnet!', express: '⚡ Express lane!', jerry: '⛽ Fuel scarcity no fit you!' }[d.type], 'good');
  else if (type === 'tutorial') tutorial(d);
}
function tutorial(d) {
  const box = $('#tut'), ico = $('#tutIco'), txt = $('#tutTxt');
  if (d.done) { box.classList.add('hidden'); save.tutorialDone = true; persist(); toast('You sabi drive! Now go 🚀', 'good'); return; }
  if (!d.prompt) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden'); ico.className = 'tut-ico';
  if (d.step === 0) { ico.textContent = '👆'; txt.textContent = 'Swipe ← or → to dodge'; }
  else if (d.step === 1) { ico.textContent = '👆'; ico.classList.add('up'); txt.textContent = 'Swipe ↑ to jump the pothole'; }
  else if (d.step === 2) { ico.textContent = '🧍'; txt.textContent = 'Grab ₦ and passengers. Oshodi! Oshodi!'; }
  else if (d.step === 3) { ico.textContent = '⛽'; txt.textContent = 'Watch your fuel. Grab the red cans!'; }
}

// ---------- game over ----------
function onGameOver(st) {
  lastStats = st; suspendLoopMusic();
  const pool = DEATH_LINES[st.reason] || DEATH_LINES.vehicle;
  $('#oLine').textContent = pool[(Math.random() * pool.length) | 0];
  const newBest = st.score > save.best;
  $('#oNew').classList.toggle('hidden', !newBest);
  $('#oDist').textContent = fmt(st.distance); $('#oCoins').textContent = fmt(st.coins); $('#oPass').textContent = st.passengers; $('#oNear').textContent = st.near;
  countUp($('#oScore'), st.score);
  const cost = 500 * (contCount + 1); $('#contCost').textContent = fmt(cost);
  $('#oContinue').classList.toggle('hidden', contCount >= 2);
  $('#btnCont').disabled = save.coins + st.coins < cost;
  $('#btnAd').disabled = !CONFIG.ADS_ENABLED;
  $('#oRank').textContent = canContinue() ? 'Continue, or start a new run to post this score' : navigator.onLine ? 'Sending score…' : '📴 Offline: score saved, will sync later';
  $('#oMissions').innerHTML = '';
  modal('over', true); $('#hud').classList.add('hidden');
  if (challenge) $('#oRank').textContent = st.score > challenge.s ? `🏆 You beat ${challenge.n}'s ${fmt(challenge.s)}!` : `⚔️ ${fmt(challenge.s - st.score)} short of ${challenge.n}`;
}
function finalizeRun() { // bank coins, stats, missions, and submit (once per run, after any continues)
  const st = lastStats; if (!st || st.banked) return; st.banked = true;
  save.coins += st.coins; save.totalRuns++; save.totalDistance += st.distance; save.totalPassengers += st.passengers;
  if (st.score > save.best) save.best = st.score; persist();
  const done = applyRunToMissions(st);
  if (done.length) $('#oMissions').innerHTML = done.map(m => `<div class="mdone">🎯 Mission complete: ${missionText(m)} (+₦${m.reward} to claim)</div>`).join('');
  if (!save.nick) { save.nick = 'Driver' + Math.floor(100 + Math.random() * 900); persist(); } // never block the restart with a form
  submit(st);
}
function submit(st) {
  queueRun({ run: runToken, score: st.score, coins: st.coins, distance: st.distance, passengers: st.passengers, near: st.near + st.jumps + st.smashes, duration: st.duration })
    .then(res => {
      if (challenge) return;
      if (res && res.ok && res.accepted) { $('#oRank').innerHTML = `🏆 #${res.rank_week} this week · #${res.rank_all} all-time<br><small style="color:var(--mut)">as <b></b> · <button class="link" id="oNick">change name</button></small>`; $('#oRank b').textContent = save.nick; $('#oNick').onclick = () => askNick(() => { $('#oRank b').textContent = save.nick; }); }
      else if (res && res.ok) $('#oRank').textContent = 'Score saved (not ranked)';
      else if (!navigator.onLine) $('#oRank').textContent = '📴 Offline: score saved, will sync later';
      else $('#oRank').textContent = 'Score saved, will sync soon';
    });
}
function countUp(el, to) {
  if (reduced) { el.textContent = fmt(to); return; }
  const t0 = performance.now(), d = 700; const step = now => { const p = Math.min(1, (now - t0) / d); el.textContent = fmt(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); }; requestAnimationFrame(step);
}
function suspendLoopMusic() {}
$('#btnCont').onclick = () => {
  const cost = 500 * (contCount + 1); const st = lastStats; if (!st) return;
  // pay from this run's naira first, then the bank
  let fromRun = Math.min(game.coins, cost); game.coins -= fromRun; save.coins -= (cost - fromRun); persist();
  contCount++; sfx.buy(); modal('over', false); show('hud'); game.revive();
};
$('#btnAd').onclick = () => toast('Ads are coming soon 🙏');
// "One more run" and Home both bank the run first
const again = $('#btnAgain').onclick; $('#btnAgain').onclick = () => { finalizeRunSafe(); again(); };
$('#btnHome').onclick = () => { finalizeRunSafe(); goHome(); };
$('#btnShare').onclick = async () => { finalizeRunSafe(); sfx.click(); await shareScore(lastStats, currentSkin(), $('#oLine').textContent); };
$('#btnChallenge').onclick = async () => { finalizeRunSafe(); sfx.click(); await shareChallenge(lastStats); };
function finalizeRunSafe() { try { finalizeRun(); } catch (e) { console.error(e); } }
// bank automatically if the over-screen sits for a bit (so ranks show without a tap)
// (only when no paid continue is on offer, so a continued run is banked and submitted once, at its real end)
new MutationObserver(() => { if ($('#over').classList.contains('show') && !canContinue()) setTimeout(() => { if ($('#over').classList.contains('show')) finalizeRunSafe(); }, 900); }).observe($('#over'), { attributes: true, attributeFilter: ['class'] });
function canContinue() { const cost = 500 * (contCount + 1); return contCount < 2 && lastStats && save.coins + lastStats.coins >= cost; }

// ---------- pause ----------
function pauseGame() { if (game.mode !== 'play') return; game.pause(); modal('pause', true); syncPausePills(); }
function resumeGame() { modal('pause', false); game.resume(); }
$('#btnPause').onclick = pauseGame; $('#btnResume').onclick = resumeGame;
$('#btnRestart').onclick = () => { modal('pause', false); play(false); };
$('#btnQuit').onclick = () => { modal('pause', false); goHome(); };
function syncPausePills() { $('#btnPauseSfx').classList.toggle('off', !save.settings.sfx); $('#btnPauseMusic').classList.toggle('off', !save.settings.music); }
$('#btnPauseSfx').onclick = () => { save.settings.sfx = !save.settings.sfx; persist(); applySettings(); syncPausePills(); };
$('#btnPauseMusic').onclick = () => { save.settings.music = !save.settings.music; persist(); applySettings(); syncPausePills(); };
document.addEventListener('visibilitychange', () => { if (document.hidden) { pauseGame(); suspendAudio(); } else resumeAudio(); });

// ---------- input ----------
let tx = 0, ty = 0, tracking = false;
function startTouch(x, y) { tx = x; ty = y; tracking = true; }
function moveTouch(x, y) {
  if (!tracking || game.mode !== 'play') return; const dx = x - tx, dy = y - ty, th = 26;
  if (Math.abs(dx) > th && Math.abs(dx) > Math.abs(dy)) { game.move(dx > 0 ? 1 : -1); tx = x; ty = y; }
  else if (Math.abs(dy) > th) { if (dy < 0) game.jump(); else game.drop(); tx = x; ty = y; tracking = dy > 0; }
}
app.addEventListener('touchstart', e => { const t = e.touches[0]; startTouch(t.clientX, t.clientY); }, { passive: true });
app.addEventListener('touchmove', e => { const t = e.touches[0]; moveTouch(t.clientX, t.clientY); }, { passive: true });
app.addEventListener('touchend', () => tracking = false, { passive: true });
app.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && e.target.id === 'cv') startTouch(e.clientX, e.clientY); });
app.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' && e.buttons) moveTouch(e.clientX, e.clientY); });
window.addEventListener('keydown', e => {
  const k = e.key;
  if (game.mode === 'play') {
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') game.move(-1);
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') game.move(1);
    else if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === ' ') { game.jump(); e.preventDefault(); }
    else if (k === 'ArrowDown' || k === 's' || k === 'S') game.drop();
    else if (k === 'p' || k === 'P' || k === 'Escape') pauseGame();
  } else if (game.mode === 'paused' && (k === 'p' || k === 'P' || k === 'Escape')) resumeGame();
  else if (game.mode === 'over' && (k === 'Enter' || k === ' ')) { e.preventDefault(); $('#btnAgain').click(); }
  else if (game.mode === 'attract' && k === 'Enter' && $('#home').classList.contains('show')) play(false);
});

// ---------- missions + streak ----------
const MI = { coins: '💰', pass: '🧍', near: '😱', dist: '🛣️', jumps: '🕳️', power: '⚡', score: '⭐', combo: '🔥', runs: '🔁' };
function renderMissions() {
  const ms = missions();
  const ms2 = 864e5 - ((Date.now() + 3600e3) % 864e5); $('#missionsReset').textContent = `New missions in ${Math.floor(ms2 / 36e5)}h ${Math.floor(ms2 % 36e5 / 6e4)}m`;
  $('#missionList').innerHTML = ms.list.map((m, i) => `<div class="mission ${m.done ? 'done' : ''}"><div class="mi">${MI[m.id]}</div><div class="mt"><b>${missionText(m)}</b><div class="prog"><i style="width:${Math.round(m.prog / m.n * 100)}%"></i></div></div><button class="claim" data-m="${i}" ${m.done && !m.claimed ? '' : 'disabled'}>${m.claimed ? '✓' : '₦' + m.reward}</button></div>`).join('');
  $$('#missionList .claim').forEach(b => b.onclick = () => { const got = claimMission(ms.list[+b.dataset.m]); if (got) { sfx.buy(); toast(`+₦${got} collected!`, 'good'); renderMissions(); renderHome(); } });
  const all = ms.list.every(m => m.claimed);
  $('#missionBonus').innerHTML = ms.bonusClaimed ? 'All 3 done today. Champion! 👑' : all ? `All 3 done! <button id="btnBonus">Claim ₦${ALL_BONUS}</button>` : `Finish all 3 for a ₦${ALL_BONUS} bonus`;
  const bb = $('#btnBonus'); if (bb) bb.onclick = () => { ms.bonusClaimed = true; save.coins += ALL_BONUS; persist(); sfx.buy(); toast(`+₦${ALL_BONUS} bonus!`, 'good'); renderMissions(); renderHome(); };
  renderStrip($('#streakStrip'), save.lastClaim === lagosDay() ? save.streak : -1);
}
function renderStrip(el, todayDay) {
  const cur = save.lastClaim === lagosDay() ? save.streak : (checkStreak() ? checkStreak().day - 1 : save.streak);
  el.innerHTML = STREAK_REWARDS.map((r, i) => `<div class="${i < (cur % 7 || (cur && cur % 7 === 0 ? 7 : 0)) ? 'got' : ''} ${i === todayDay - 1 ? 'today' : ''}">Day ${i + 1}<b>₦${fmt(r)}</b></div>`).join('');
}
function maybeStreak() {
  const info = checkStreak(); if (!info) return;
  $('#sTitle').textContent = info.day === 1 ? (info.broke ? 'Streak reset 😢 Day 1!' : 'Daily reward!') : `Day ${info.day} streak! 🔥`;
  $('#sText').textContent = info.day < 7 ? `Come back tomorrow for ₦${fmt(STREAK_REWARDS[info.day])}. Day 7 pays ₦1,000.` : 'Full week! You be real Lagos driver 👑';
  $('#btnClaim').textContent = `Collect ₦${fmt(info.reward)}`;
  renderStrip($('#sStrip'), info.day);
  $('#sStrip').querySelectorAll('div').forEach((d, i) => d.classList.toggle('got', i < info.day));
  modal('streak', true);
  $('#btnClaim').onclick = () => { initAudio(); claimStreak(info); sfx.buy(); modal('streak', false); toast(`+₦${fmt(info.reward)}! 🔥 ${save.streak}-day streak`, 'good'); renderHome(); };
}
$('#btnStreak').onclick = () => { if (checkStreak()) maybeStreak(); else openSheet('missions'); };

// ---------- garage ----------
function renderGarage() {
  $$('.gCoins').forEach(e => e.textContent = fmt(save.coins));
  const grid = $('#skinGrid'); grid.innerHTML = '';
  for (const s of A.SKINS) {
    const own = save.owned.includes(s.id), on = save.skin === s.id;
    const d = document.createElement('div'); d.className = 'skin' + (on ? ' on' : '');
    const c = A.renderAt(2, () => A.busSprite(s)); const cv = document.createElement('canvas'); cv.width = c.width; cv.height = c.height; cv.getContext('2d').drawImage(c, 0, 0);
    d.appendChild(cv);
    d.insertAdjacentHTML('beforeend', `<div class="nm">${s.name}</div><div class="tg">${s.tag}</div>`);
    const b = document.createElement('button');
    if (on) { b.textContent = 'Driving ✓'; b.className = 'eq'; }
    else if (own) { b.textContent = 'Drive this'; b.className = 'eq'; b.onclick = () => { save.skin = s.id; persist(); sfx.click(); renderGarage(); game.skin = s; }; }
    else { b.textContent = '₦' + fmt(s.price); if (save.coins < s.price) b.className = 'lock'; b.onclick = () => { if (buySkin(s.id)) { sfx.buy(); toast(`${s.name} unlocked! 🎉`, 'good'); game.skin = s; renderGarage(); } else toast(`You need ₦${fmt(s.price - save.coins)} more`, 'warn'); }; }
    d.appendChild(b); grid.appendChild(d);
  }
  const ic = { shield: '💧', magnet: '🧲', express: '⚡', jerry: '⛽' };
  $('#upList').innerHTML = Object.keys(UPGRADES).map(k => { const u = UPGRADES[k], l = save.up[k], c = upCost(l); return `<div class="up"><div class="ic">${ic[k]}</div><div class="tx"><b>${u.name}</b><small>${u.desc}: ${powerDur(k).toFixed(1)}${u.unit}${l < MAX_UP ? ' → ' + (powerDur(k) + u.per).toFixed(1) + u.unit : ''}</small><div class="pips">${Array.from({ length: MAX_UP }, (_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('')}</div></div><button data-up="${k}" ${l >= MAX_UP || save.coins < c ? 'disabled' : ''}>${l >= MAX_UP ? 'MAX' : '₦' + fmt(c)}</button></div>`; }).join('');
  $$('#upList button').forEach(b => b.onclick = () => { if (buyUpgrade(b.dataset.up)) { sfx.buy(); toast('Upgraded! 💪', 'good'); renderGarage(); } });
  const packs = [['₦5,000', '₦200'], ['₦15,000', '₦500'], ['₦50,000', '₦1,500']];
  $('#shopList').innerHTML = packs.map(([a, p]) => `<div class="pack"><div class="amt">💰 ${a} coins<small>${p} · Paystack</small></div><button disabled>Coming soon</button></div>`).join('') + `<div class="note">${CONFIG.PAYSTACK_READY ? '' : 'Coin packs open soon. Everything in Danfo Rush can be earned free by playing.'}</div>`;
}

// ---------- leaderboard ----------
let boardTab = 'weekly';
async function renderBoard() {
  $('#bNick').textContent = save.nick || 'Driver (not set)';
  const list = $('#boardList'); list.innerHTML = '<div class="skel"></div>'.repeat(6); $('#boardMe').textContent = '';
  flush(); const tab = boardTab; const d = await leaderboard(tab); if (tab !== boardTab) return;
  if (!d) { list.innerHTML = '<div class="empty">📴 You\'re offline.<br>Your scores are saved and will sync when you\'re back online.</div>'; return; }
  if (!d.rows.length) { list.innerHTML = `<div class="empty">No scores ${tab === 'weekly' ? 'this week' : ''} yet.<br>Be the first name on the board! 🏁</div>`; }
  else list.innerHTML = d.rows.map((r, i) => `<div class="brow ${r.me ? 'me' : ''} ${r.rank === 1 ? 'top1' : ''}" style="animation-delay:${Math.min(i, 12) * 30}ms"><div class="rk">${r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank}</div><div class="nk"></div><div class="sc">${fmt(r.score)}</div></div>`).join('');
  list.querySelectorAll('.nk').forEach((n, i) => n.textContent = d.rows[i].nick); // textContent: nicknames never become HTML
  $('#boardMe').textContent = (d.stale ? '📴 Offline, showing saved board. ' : '') + (d.me ? `You: #${d.me.rank} with ${fmt(d.me.score)}` : 'Play a run to get on the board') + (tab === 'weekly' ? ` · ${d.players} drivers this week · resets Monday` : '') + (save.pending.length ? ` · ${save.pending.length} run(s) waiting to sync` : '');
}
function askNick(after) {
  modal('nick', true); const inp = $('#nickInput'); inp.value = save.nick || ''; setTimeout(() => inp.focus(), 150);
  $('#btnNickSave').onclick = () => { const v = inp.value.replace(/[^A-Za-z0-9 _.\-]/g, '').trim().slice(0, 16); save.nick = v || 'Driver' + Math.floor(100 + Math.random() * 900); persist(); modal('nick', false); sfx.click(); if (after) after(); if ($('#board').classList.contains('show')) renderBoard(); };
}
$('#btnNick').onclick = () => askNick(); $('#btnNick2').onclick = () => askNick();

// ---------- settings ----------
function renderSettings() { $$('[data-set]').forEach(i => { i.checked = !!save.settings[i.dataset.set]; }); $('#ver').textContent = CONFIG.VERSION; }
$$('[data-set]').forEach(i => i.onchange = () => { save.settings[i.dataset.set] = i.checked; persist(); applySettings(); if (i.checked) { initAudio(); sfx.click(); } if (i.dataset.set === 'haptics' && i.checked && navigator.vibrate) navigator.vibrate(30); });
function applySettings() { setSfx(save.settings.sfx); setMusic(save.settings.music); game.haptics = save.settings.haptics; game.shakeOn = save.settings.shake; }

// ---------- challenge links ----------
(function () { const s = parseInt(params.get('c'), 10), n = (params.get('n') || 'Your friend').replace(/[^A-Za-z0-9 _.\-]/g, '').slice(0, 16); if (s > 0 && s < 1e7) challenge = { s, n: n || 'Your friend' }; })();

// ---------- install prompt (Android) ----------
let deferred = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; $('#installBox').classList.remove('hidden'); });
$('#btnInstall').onclick = async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; $('#installBox').classList.add('hidden'); };

// ---------- boot ----------
document.fonts && document.fonts.load('20px "Lilita One"').then(() => { A.setArtScale(game.S); });
renderHome(); setTimeout(maybeStreak, 600); flush();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js').catch(() => {});
document.addEventListener('click', e => { if (e.target.closest('button')) initAudio(); }, { capture: true });
