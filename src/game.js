import * as A from './art.js';
import { sfx, setIntensity } from './audio.js';

export const LW = 400;
const ROAD_L = 64, ROAD_R = 336, LANE_W = (ROAD_R - ROAD_L) / 3;
export const laneX = i => ROAD_L + LANE_W * (i + 0.5);
const PXM = 30;            // px per metre
const JUMP = 0.62;         // jump duration (s)
const BUS_W = 42;          // hitbox width
const SEG = 160;           // ground segment height
export const ZONES = [
  { id: 'city', name: 'Ojuelegba' },
  { id: 'market', name: 'Oshodi' },
  { id: 'bridge', name: 'Third Mainland Bridge' },
  { id: 'lekki', name: 'Lekki' },
];
const ZONE_M = 1000;
const SHOUTS = ['Oshodi! Oshodi!', 'Enter with your change o!', 'Owa o!', 'Shift body!', 'CMS! Obalende!', 'Wole! Wole!', 'Ojuelegba! Straight!', 'No change o!', 'Yaba! Yaba!', 'Ikeja along!'];
const NEAR_SHOUTS = ['Driver, you wan kill us?!', 'Haba! Gently!', 'Jesu! Driver!', 'Ehen! Na driver be dis!', 'My heart don cut!'];
const STOPS = ['Oshodi!', 'CMS!', 'Ikeja!', 'Yaba!', 'Obalende!', 'Ajah!', 'Mile 2!', 'Lekki!'];
export const DEATH_LINES = {
  vehicle: ['Wahala dey!', 'Na so e take start o…', 'Who send you message?!', 'Your papa get road?'],
  lastma: ['You don jam LASTMA!', 'LASTMA don hold you. Settle am!'],
  police: ['Police don stop you. Wetin you carry?', 'Oga, show your particulars!'],
  pothole: ['Pothole don swallow your tyre!', 'Lagos road no dey smile o!'],
  fuel: ['Fuel don finish! Scarcity no smile.', 'You no buy fuel?! Na trek remain.'],
};
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

export class Game {
  constructor(canvas, hooks) {
    this.cv = canvas; this.g = canvas.getContext('2d', { alpha: false });
    this.hooks = { onHud: hooks.onHud, onGameOver: hooks.onGameOver, onEvent: (t, d) => { if (this.mode === 'play') hooks.onEvent(t, d); } };
    this.objs = []; this.parts = []; this.pops = []; this.decor = []; this.segs = [];
    for (let i = 0; i < 220; i++) this.parts.push({ life: 0 });
    this.mode = 'attract'; this.autopilot = true; this.timeScale = 1; this.shakeAmp = 0;
    this.dprCap = Math.min(window.devicePixelRatio || 1, (navigator.deviceMemory && navigator.deviceMemory <= 4) ? 1.75 : 2); this.quality = this.dprCap;
    this.frameTimes = []; this.fps = 60; this.shakeOn = true; this.reduced = false; this.haptics = true;
    this.skin = A.SKINS[0]; this.durs = { shield: 6, magnet: 7, express: 4, jerry: 8 };
    this.resize(); this.reset(true);
    window.addEventListener('resize', () => this.resize());
  }
  resize() {
    const r = this.cv.getBoundingClientRect(); const cw = Math.max(200, r.width), ch = Math.max(300, r.height);
    this.cssW = cw; this.cssH = ch; this.applyQuality();
  }
  applyQuality() {
    const dpr = this.quality;
    this.cv.width = Math.round(this.cssW * dpr); this.cv.height = Math.round(this.cssH * dpr);
    this.S = this.cv.width / LW; this.LH = this.cv.height / this.S; A.setArtScale(this.S);
    this.playBusY = this.LH - Math.min(200, this.LH * 0.24); this.busY = this.mode === 'attract' ? this.LH * 0.6 : this.playBusY;
    this.asphalt = this.makeAsphalt(); this.shadowSpr = null;
  }
  makeAsphalt() {
    const c = document.createElement('canvas'), w = ROAD_R - ROAD_L, h = 256;
    c.width = Math.ceil(w * this.S); c.height = Math.ceil(h * this.S); const g = c.getContext('2d'); g.scale(this.S, this.S);
    g.fillStyle = '#3b3e44'; g.fillRect(0, 0, w, h);
    let s = 11; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 420; i++) { g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.12)'; g.fillRect(r() * w, r() * h, 1.5, 1.5); }
    g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(40, 30, 50, 34); g.fillRect(170, 150, 60, 40);
    g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(120, 90, 30, 70);
    c.lw = w; c.lh = h; return c;
  }
  shadow() {
    if (!this.shadowSpr) this.shadowSpr = A.sprite('shadow', 80, 140, (g, w, h) => { g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 10 * this.S; g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.roundRect(12, 12, w - 24, h - 24, 14); g.fill(); });
    return this.shadowSpr;
  }
  // ---------- run lifecycle ----------
  reset(attract) {
    this.objs.length = 0; this.pops.length = 0; this.decor.length = 0; this.segs.length = 0;
    for (const p of this.parts) p.life = 0;
    this.t = 0; this.dist = 0; this.speed = 380; this.score = 0; this.coins = 0; this.passengers = 0; this.near = 0; this.jumps = 0;
    this.smashes = 0; this.powersUsed = 0; this.combo = 0; this.comboT = 0; this.mult = 1; this.maxMult = 1; this.fuel = 100;
    this.pw = { shield: 0, magnet: 0, express: 0, jerry: 0 }; this.invuln = 0; this.slowT = 0; this.boost = 1; this.dying = 0;
    this.bus = { lane: 1, x: laneX(1), jumpT: 0, tilt: 0, laneT: 0 };
    this.nextRow = 500; this.nextFuel = 1100; this.nextPower = 2400; this.zone = -1; this.revived = 0; this.lastLowBeep = 0;
    this.shout = null; this.coinChain = 0; this.coinChainT = 0; this.tut = null; this.deathReason = null; this.timeScale = 1;
    this.mode = attract ? 'attract' : 'play'; this.autopilot = attract || this.forceAuto; this.busY = attract ? this.LH * 0.6 : this.playBusY;
    let y = this.LH + SEG; while (y > -SEG) { this.addSeg(y, 0); y -= SEG; }
    this.decorY = [this.LH + 40, this.LH + 40];
    while (this.decorY[0] > -120 || this.decorY[1] > -120) this.spawnDecor(true);
  }
  start(tutorial) {
    this.reset(false); this.runStart = performance.now();
    if (tutorial) { this.tut = { step: 0, t: 0 }; this.nextRow = 1e9; this.nextFuel = 1e9; this.nextPower = 1e9; }
    this.say('Oya, make we go!', 1.4); sfx.horn();
  }
  revive() {
    for (const o of this.objs) if (o.y > -60 && o.y < this.LH + 80 && !o.collect) o.dead = true;
    this.invuln = 2.5; this.fuel = Math.max(this.fuel, 60); this.mode = 'play'; this.dying = 0; this.timeScale = 1; this.revived++;
    this.say('We move! Oya!', 1.2); sfx.horn();
  }
  pause() { if (this.mode === 'play') { this.mode = 'paused'; } }
  resume() { if (this.mode === 'paused') { this.mode = 'play'; this.lastT = 0; } }
  stats() {
    return { score: Math.floor(this.score), coins: this.coins, distance: Math.floor(this.dist / PXM), passengers: this.passengers,
      near: this.near, jumps: this.jumps, smashes: this.smashes, powers: this.powersUsed, maxMult: this.maxMult,
      duration: Math.round(this.t * 1000), reason: this.deathReason };
  }
  // ---------- input ----------
  move(dir) {
    if (this.mode !== 'play' && this.mode !== 'attract') return;
    const b = this.bus, nl = clamp(b.lane + dir, 0, 2); if (nl === b.lane) { this.bump(dir); return; }
    // near-miss arming: obstacles close ahead in the lane we are leaving
    const top = this.busY - 60;
    for (const o of this.objs) if (o.deadly && !o.dead && o.lane === b.lane && o.y + o.h / 2 > top - 190 && o.y - o.h / 2 < this.busY + 60) o.nearArm = true;
    b.lane = nl; b.laneT = 0.18; if (this.mode === 'play') sfx.lane();
    if (this.tut && this.tut.step === 0 && this.tut.wait) this.tutNext();
  }
  bump(dir) { this.bus.tilt = dir * 0.12; }
  jump() {
    if (this.mode !== 'play' && this.mode !== 'attract') return;
    if (this.bus.jumpT > 0) return; this.bus.jumpT = 0.0001; if (this.mode === 'play') sfx.jump();
    if (this.tut && this.tut.step === 1 && this.tut.wait) this.tutNext();
  }
  drop() { if (this.bus.jumpT > 0 && this.bus.jumpT < JUMP * 0.8) this.bus.jumpT = Math.max(this.bus.jumpT, JUMP * 0.8); }
  // ---------- spawning ----------
  obj(kind, lane, y, extra) {
    const o = { kind, lane, x: lane >= 0 ? laneX(lane) : 0, y, vs: 0, vsCur: 0, deadly: false, jumpable: false, collect: false, dead: false, nearArm: false, passed: false, ph: Math.random() * 6, ...extra };
    if (!o.spr) { if (kind === 'passenger') o.spr = A.passengerSprite(0); else if (kind === 'power') o.spr = A.powerSprite(o.ptype); else if (kind === 'coin') o.spr = A.coinSprite(); else if (kind === 'fuel') o.spr = A.fuelSprite(); }
    this.objs.push(o); return o;
  }
  vehicle(lane, y, slow) {
    const r = Math.random(), d = this.diff();
    let o;
    if (r < 0.34) o = this.obj('car', lane, y, { spr: A.carSprite((Math.random() * 8) | 0), w: 50, h: 92, vs: slow ? 0.04 : rnd(0.12, 0.3) });
    else if (r < 0.56) o = this.obj('okada', lane, y, { spr: A.okadaSprite((Math.random() * 4) | 0), w: 24, h: 56, vs: rnd(0.25, 0.4), weave: !slow && Math.random() < 0.35 + d * 0.3 });
    else if (r < 0.78) o = this.obj('keke', lane, y, { spr: A.kekeSprite(), w: 44, h: 66, vs: slow ? 0.04 : rnd(0.1, 0.22) });
    else if (r < 0.9 && !slow) o = this.obj('tanker', lane, y - 30, { spr: A.tankerSprite(), w: 56, h: 146, vs: rnd(0.08, 0.15) });
    else o = this.obj('bus2', lane, y, { spr: A.busSprite(A.SKINS[(Math.random() * 3) | 0]), w: 54, h: 108, vs: slow ? 0.04 : rnd(0.1, 0.25) });
    o.deadly = true; o.vsCur = o.vs; o.reason = 'vehicle'; return o;
  }
  hazard(kind, lane, y) {
    if (kind === 'pothole') return this.obj('pothole', lane, y, { spr: A.potholeSprite((Math.random() * 3) | 0), w: 50, h: 34, deadly: true, jumpable: true, ground: true, reason: 'pothole' });
    if (kind === 'puddle') return this.obj('puddle', lane, y, { spr: A.puddleSprite(), w: 62, h: 42, jumpable: true, ground: true, soft: true });
    if (kind === 'lastma') return this.obj('lastma', lane, y, { spr: A.lastmaSprite(), w: 30, h: 30, deadly: true, reason: 'lastma', person: true });
    if (kind === 'agbero') { const side = lane === 0 ? -1 : lane === 2 ? 1 : (Math.random() < 0.5 ? -1 : 1); return this.obj('agbero', lane, y, { x: laneX(lane) + side * 34, drift: -side * 22, w: 30, h: 30, agbero: true, person: true }); }
  }
  coinLine(lane, y, n, arc) {
    for (let i = 0; i < n; i++) this.obj('coin', lane, y - i * 44, { spr: A.coinSprite(), w: 26, h: 26, collect: true, arcJ: arc ? Math.sin(i / (n - 1) * Math.PI) : 0 });
  }
  diff() { return clamp(this.dist / PXM / 3200, 0, 1); }
  laneFree(lane, y, span = 260) { for (const o of this.objs) if (!o.dead && o.lane === lane && !o.collect && Math.abs(o.y - y) < span) return false; return true; }
  // When would anything already on the road occupy the bus line in this lane? (seconds from now)
  laneClearAt(lane, t0, t1) {
    const v = Math.max(200, this.speed * this.boost), bTop = this.busY - 60, bBot = this.busY + 60;
    for (const o of this.objs) {
      if (o.dead || o.collect || o.decor || !o.deadly || o.flying) continue;
      const ls = o.lanes || (o.toLane !== undefined && o.blinkT > 0 ? [o.lane, o.toLane] : [o.lane]); if (!ls.includes(lane)) continue;
      const vr = v * (1 - (o.vsCur || 0)), h = o.h || 30;
      const a = (bTop - (o.y + h / 2)) / vr, b = (bBot - (o.y - h / 2)) / vr;
      if (b > t0 && a < t1) return false;
    }
    return true;
  }
  spawnRow() {
    const d = this.diff(), y = -120, v = Math.max(200, this.speed * this.boost);
    const tA = (this.busY - 60 - (y + 60)) / v - 0.5, tB = (this.busY + 60 - (y - 80)) / v + 0.5; // this row's pass window + reaction margin
    const top = [0, 1, 2].filter(l => this.laneFree(l, y, 300));
    const openable = top.filter(l => this.laneClearAt(l, tA, tB)).sort(() => Math.random() - 0.5);
    if (!openable.length || top.length < 2) return; // nothing fair to add right now
    const open = openable[0];
    const others = top.filter(l => l !== open).sort(() => Math.random() - 0.5);
    const r = Math.random();
    if (r < 0.1 + d * 0.06 && others.length === 2 && Math.abs(others[0] - others[1]) === 1) { // police checkpoint across two lanes
      const l0 = Math.min(others[0], others[1]), left = l0 === 0;
      this.obj('checkpoint', -1, y, { x: (laneX(l0) + laneX(l0 + 1)) / 2, lanes: [l0, l0 + 1], spr: A.checkpointSprite(), w: 170, h: 26, deadly: true, reason: 'police' });
      this.obj('cop', -1, y - 4, { x: left ? ROAD_L - 22 : ROAD_R + 22, spr: A.policeSprite(), w: 0, h: 0, decor: true, bubble: 'Oya park!' });
      if (Math.random() < 0.8) this.coinLine(open, y + 40, 4);
    } else if (r < 0.26 + d * 0.12 && others.length === 2) { // go-slow: two lanes jammed
      for (const l of others) { const o = this.vehicle(l, y, true); o.weave = false; if (Math.random() < 0.4 + d * 0.4) { const o2 = this.vehicle(l, y - 130, true); o2.weave = false; } }
      this.coinLine(open, y, 5);
      if (!this.goSlowToast || this.t - this.goSlowToast > 25) { this.goSlowToast = this.t; this.hooks.onEvent('toast', { text: 'Go-slow ahead! 🚦', kind: 'warn' }); }
    } else {
      const nHaz = Math.min(others.length, Math.random() < 0.18 + d * 0.5 ? 2 : 1);
      for (let i = 0; i < nHaz; i++) {
        const l = others[i]; const k = Math.random(); let o;
        if (k < 0.5) { o = this.vehicle(l, y); if (nHaz > 1) o.weave = false; }
        else if (k < 0.66) this.hazard('pothole', l, y);
        else if (k < 0.76) this.hazard('lastma', l, y);
        else if (k < 0.86) this.hazard('agbero', l, y);
        else this.hazard('puddle', l, y);
      }
      const c = Math.random();
      if (c < 0.45) this.coinLine(open, y + 20, 5 + ((Math.random() * 3) | 0), Math.random() < 0.2);
      else if (c < 0.62) this.obj('passenger', open, y, { spr: A.passengerSprite((Math.random() * 6) | 0), w: 34, h: 34, collect: true, bubble: pick(STOPS), person: true });
      else if (c < 0.7) { this.hazard('pothole', open, y - 10); this.coinLine(open, y + 10, 3, true); }
    }
  }
  spawnPickup(kind) {
    const lanes = [0, 1, 2].filter(l => this.laneFree(l, -120, 200)); if (!lanes.length) return false;
    const l = pick(lanes);
    if (kind === 'fuel') this.obj('fuel', l, -120, { spr: A.fuelSprite(), w: 28, h: 30, collect: true });
    else { const types = ['shield', 'magnet', 'express', 'jerry']; const t = pick(types); this.obj('power', l, -120, { ptype: t, spr: A.powerSprite(t), w: 40, h: 40, collect: true }); }
    return true;
  }
  addSeg(y, zone) { this.segs.push({ y, z: zone }); }
  spawnDecor(init) {
    const zi = Math.max(0, this.zone), z = ZONES[zi].id;
    for (let side = 0; side < 2; side++) {
      while (this.decorY[side] > -120) {
        const y = this.decorY[side]; const xL = side ? ROAD_R + 6 : 0, xR = side ? LW : ROAD_L - 6; const cx = (xL + xR) / 2;
        let spr, gap, x = cx;
        if (z === 'bridge') {
          if (Math.random() < 0.5) { spr = A.lampSprite(); x = side ? ROAD_R + 12 : ROAD_L - 12; gap = rnd(90, 140); if (side) spr = { flip: true, s: spr }; }
          else { spr = Math.random() < 0.5 ? A.canoeSprite((Math.random() * 2) | 0) : A.stiltSprite((Math.random() * 3) | 0); x = side ? ROAD_R + rnd(26, 48) : rnd(10, 36); gap = rnd(80, 160); }
        } else if (z === 'market') {
          const k = Math.random(); x = cx + rnd(-6, 6);
          spr = k < 0.45 ? A.umbrellaSprite((Math.random() * 4) | 0) : k < 0.8 ? A.stallSprite((Math.random() * 3) | 0) : A.passengerSprite((Math.random() * 6) | 0);
          gap = rnd(36, 60);
        } else if (z === 'lekki') {
          spr = Math.random() < 0.55 ? A.palmSprite((Math.random() * 3) | 0) : A.flatRoof((Math.random() * 4) | 0); gap = rnd(60, 110); x = cx + rnd(-4, 4);
        } else {
          const k = Math.random();
          spr = k < 0.45 ? A.zincRoof((Math.random() * 6) | 0) : k < 0.8 ? A.flatRoof((Math.random() * 4) | 0) : A.palmSprite((Math.random() * 3) | 0);
          gap = (spr.lh || 60) + rnd(4, 18); x = side ? LW - (spr.lw || 50) / 2 + 2 : (spr.lw || 50) / 2 - 2;
          if (spr.lw < 57) x = cx;
        }
        this.decor.push({ x, y, spr }); this.decorY[side] -= gap;
      }
    }
  }
  // ---------- effects ----------
  burst(x, y, n, col, spd = 160, size = 4, life = 0.6) {
    for (let i = 0; i < n; i++) {
      const p = this.parts.find(q => q.life <= 0); if (!p) return;
      const a = Math.random() * 6.283, s = spd * (0.3 + Math.random());
      p.x = x; p.y = y; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s; p.life = p.max = life * (0.6 + Math.random() * 0.6); p.col = col; p.size = size * (0.6 + Math.random() * 0.8);
    }
  }
  pop(x, y, text, col = '#fff', big) { if (this.mode !== 'play') return; if (this.pops.length > 7) this.pops.shift(); for (const p of this.pops) if (p.life > 0.45 && Math.abs(p.y - y) < 24 && Math.abs(p.x - x) < 120) y = p.y - 26; this.pops.push({ x, y, text, col, life: 0.9, big }); }
  say(text, dur = 1.2) { if (this.mode === 'play') this.shout = { text, t: dur }; }
  shake(a) { if (this.shakeOn && !this.reduced) this.shakeAmp = Math.max(this.shakeAmp, a); }
  buzz(ms) { if (this.haptics && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) {} }
  addCombo(pts, label, x, y) {
    this.combo++; this.comboT = 4;
    const m = this.combo >= 15 ? 5 : this.combo >= 10 ? 4 : this.combo >= 6 ? 3 : this.combo >= 3 ? 2 : 1;
    if (m > this.mult) { this.pop(this.bus.x, this.busY - 110, 'x' + m + ' COMBO!', '#FFD54F', true); sfx.combo(m); this.buzz(20); }
    this.mult = m; this.maxMult = Math.max(this.maxMult, m);
    this.score += pts * this.mult; if (label) this.pop(x, y, label + ' +' + pts * this.mult, '#7CFFB2');
  }
  breakCombo() { if (this.combo >= 3) this.pop(this.bus.x, this.busY - 90, 'Combo lost', '#FF8A80'); this.combo = 0; this.mult = 1; this.comboT = 0; }
  power(t) {
    this.pw[t] = this.durs[t]; this.powersUsed++; sfx.power(); this.buzz(30);
    if (t === 'jerry') this.fuel = 100;
    this.pop(this.bus.x, this.busY - 100, A.POWERS[t].short.toUpperCase() + '!', A.POWERS[t].color, true);
    this.hooks.onEvent('power', { type: t });
    this.burst(this.bus.x, this.busY, 22, A.POWERS[t].color, 220, 5);
  }
  // ---------- tutorial ----------
  tutNext() {
    const tt = this.tut; tt.step++; tt.wait = false; tt.spawned = false; this.timeScale = 1; tt.t = 0;
    this.hooks.onEvent('tutorial', { step: tt.step });
  }
  tutUpdate(dt) {
    const tt = this.tut; tt.t += dt; const b = this.bus;
    if (tt.step === 0) {
      if (!tt.spawned && tt.t > 0.8) { tt.o = this.vehicle(b.lane, -120); tt.o.vs = tt.o.vsCur = 0.1; tt.spawned = true; this.hooks.onEvent('tutorial', { step: 0 }); }
      if (tt.spawned && !tt.wait && tt.o.y > this.busY - 330 && tt.o.lane === b.lane) { tt.wait = true; this.timeScale = 0.08; this.hooks.onEvent('tutorial', { step: 0, prompt: true }); }
      if (tt.spawned && !tt.wait && tt.o.lane !== b.lane && tt.o.y > this.busY - 330) this.tutNext();
    } else if (tt.step === 1) {
      if (!tt.spawned && tt.t > 0.7) { tt.o = this.hazard('pothole', b.lane, -100); tt.spawned = true; }
      if (tt.spawned && !tt.wait && tt.o.lane !== b.lane) { tt.o.lane = b.lane; tt.o.x = laneX(b.lane); }
      if (tt.spawned && !tt.wait && tt.o.y > this.busY - 210) { tt.wait = true; this.timeScale = 0.08; this.hooks.onEvent('tutorial', { step: 1, prompt: true }); }
    } else if (tt.step === 2) {
      if (!tt.spawned && tt.t > 0.6) { const l = b.lane === 1 ? 0 : 1; this.coinLine(l, -100, 6); this.obj('passenger', l, -420, { spr: A.passengerSprite(2), w: 34, h: 34, collect: true, bubble: 'Oshodi!', person: true }); tt.spawned = true; this.hooks.onEvent('tutorial', { step: 2, prompt: true }); }
      if (tt.spawned && tt.t > 3.4) this.tutNext();
    } else if (tt.step === 3) {
      if (!tt.spawned) { this.spawnPickup('fuel'); tt.spawned = true; this.hooks.onEvent('tutorial', { step: 3, prompt: true }); }
      if (tt.t > 2.8) { this.tut = null; this.nextRow = this.dist + 200; this.nextFuel = this.dist + 2400; this.nextPower = this.dist + 1800; this.hooks.onEvent('tutorial', { step: 4, done: true }); }
    }
  }
  // ---------- autopilot (attract mode, demo + tests) ----------
  auto() {
    const b = this.bus, top = this.busY - 60, bot = this.busY + 60; const danger = [0, 0, 0], good = [0, 0, 0], near = [1e9, 1e9, 1e9];
    const look = 300 + this.speed * this.boost * 0.55;
    for (const o of this.objs) {
      if (o.dead || o.decor || o.flying) continue; const h = o.h || 30;
      const oTop = o.y - h / 2, oBot = o.y + h / 2;
      if (oTop > bot + 10) continue;            // already behind us
      const gap = top - oBot;                    // >0: ahead of us; <0: alongside
      if (gap > look) continue;
      const lanes = o.lanes || (o.blinkT > 0 ? [o.lane, o.toLane] : [o.lane]);
      for (const l of lanes) {
        if (l < 0) continue;
        if (o.deadly && !o.jumpable) { danger[l] += gap < 0 ? 1e5 : 1e4 / Math.max(15, gap + 40); near[l] = Math.min(near[l], gap); }
        else if (o.jumpable && o.deadly) danger[l] += gap < 0 ? 150 : 300 / Math.max(15, gap + 40);
        else if (o.jumpable || o.agbero) danger[l] += 300 / Math.max(20, gap + 60);
        else if (o.collect) good[l] += (o.kind === 'power' || o.kind === 'fuel' ? 40 : o.kind === 'passenger' ? 25 : 6) / Math.max(30, gap + 60) * 60;
      }
      if (o.jumpable && o.deadly && o.lane === b.lane && b.jumpT === 0 && gap > -25 && gap < 40 + this.speed * this.boost * 0.09) this.jump();
    }
    if (b.laneT > 0) return;
    const score = l => -danger[l] + good[l] - Math.abs(l - b.lane) * 2;
    let best = b.lane; for (let l = 0; l < 3; l++) if (score(l) > score(best) + 3) best = l;
    if (best !== b.lane) { const step = best > b.lane ? 1 : -1, tl = b.lane + step, safe = near[tl] > this.speed * this.boost * 0.28 || near[tl] > near[b.lane] + 40; if (safe && danger[tl] < 1e4 && (danger[tl] < 200 || danger[b.lane] > danger[tl])) this.move(step); }
  }
  // ---------- main update ----------
  update(rawDt) {
    if (this.mode === 'paused' || this.mode === 'over') return;
    const dt = Math.min(rawDt, 1 / 24) * this.timeScale;
    const b = this.bus, play = this.mode === 'play';
    if (this.dying > 0) { this.dying -= rawDt; this.timeScale = 0.25; if (this.dying <= 0) { this.mode = 'over'; this.timeScale = 1; this.hooks.onGameOver(this.stats()); } }
    if (this.tut) this.tutUpdate(rawDt);
    if (this.autopilot && this.dying <= 0) this.auto();
    // speed
    const dm = this.dist / PXM;
    let target = 380 + 600 * (1 - Math.exp(-dm / 1800));
    if (this.mode === 'attract') target = 420;
    this.boost += ((this.pw.express > 0 ? 1.7 : 1) - this.boost) * Math.min(1, dt * 4);
    if (this.slowT > 0) { this.slowT -= dt; target *= 0.75; }
    if (this.fuel <= 0 && play) target = 0;
    this.speed += (target - this.speed) * Math.min(1, dt * (this.fuel <= 0 ? 1.6 : 3));
    const v = this.speed * this.boost, dy = v * dt;
    if (play && this.dying <= 0) {
      this.t += dt; this.dist += dy; this.score += dy / PXM * this.mult;
      if (this.pw.jerry <= 0 && !this.tut) this.fuel -= dt * (1.7 + this.diff() * 0.5);
      if (this.fuel < 25 && this.fuel > 0 && this.t - this.lastLowBeep > 1.2) { this.lastLowBeep = this.t; sfx.low(); }
      if (this.fuel <= 0) { this.fuel = 0; if (this.speed < 30) this.die('fuel'); }
    } else if (this.mode === 'attract') { this.dist += dy; }
    setIntensity(clamp(dm / 2000, 0, 1));
    // timers
    for (const k in this.pw) if (this.pw[k] > 0) { this.pw[k] -= dt; if (this.pw[k] <= 0) { this.pw[k] = 0; if (play) sfx.powerEnd(); if (k === 'express') this.invuln = Math.max(this.invuln, 1); } }
    if (this.invuln > 0) this.invuln -= dt;
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.breakCombo(); }
    if (this.shout) { this.shout.t -= dt; if (this.shout.t <= 0) this.shout = null; }
    if (this.coinChainT > 0) { this.coinChainT -= dt; if (this.coinChainT <= 0) this.coinChain = 0; }
    // zone
    const zi = Math.floor(dm / ZONE_M) % ZONES.length;
    if (zi !== this.zone) {
      const first = this.zone === -1; this.zone = zi;
      if (!first || play) { this.decor.push({ x: ROAD_R + 34, y: -60, spr: A.signSprite(ZONES[zi].name.split(' ')[0].toUpperCase()), sign: true }); }
      if (ZONES[zi].id === 'lekki') this.gantry = { y: -200 };
      if (play && !first) this.hooks.onEvent('zone', { name: ZONES[zi].name, id: ZONES[zi].id });
      if (first && play) this.hooks.onEvent('zone', { name: ZONES[zi].name, id: ZONES[zi].id });
    }
    // ground + decor scroll
    for (const s of this.segs) s.y += dy;
    while (this.segs.length && this.segs[0].y - SEG > this.LH) this.segs.shift();
    while (this.segs[this.segs.length - 1].y > 0) this.addSeg(this.segs[this.segs.length - 1].y - SEG, zi);
    for (const d of this.decor) d.y += dy;
    this.decorY[0] += dy; this.decorY[1] += dy; this.spawnDecor();
    if (this.decor.length > 80 || (this.decor.length && this.decor[0].y > this.LH + 140)) this.decor = this.decor.filter(d => d.y < this.LH + 140);
    if (this.gantry) { this.gantry.y += dy; if (this.gantry.y > this.LH + 200) this.gantry = null; }
    // spawn
    if (!this.tut && this.dying <= 0) {
      if (this.dist >= this.nextRow) { this.spawnRow(); this.nextRow = this.dist + Math.max(240, v * (0.66 - this.diff() * 0.12)); }
      if (play && this.dist >= this.nextFuel) { if (this.spawnPickup('fuel')) this.nextFuel = this.dist + PXM * rnd(260, 360); else this.nextFuel += 80; }
      if (this.dist >= this.nextPower) { if (this.spawnPickup('power')) this.nextPower = this.dist + PXM * rnd(380, 560); else this.nextPower += 80; }
    }
    // bus motion
    const tx = laneX(b.lane); b.x += (tx - b.x) * Math.min(1, dt * 16); if (b.laneT > 0) b.laneT -= dt;
    b.tilt += ((tx - b.x) * 0.0045 - b.tilt) * Math.min(1, dt * 12);
    if (b.jumpT > 0) { b.jumpT += dt; if (b.jumpT >= JUMP) { b.jumpT = 0; if (play) sfx.land(); this.burst(b.x, this.busY + 40, 8, 'rgba(200,190,170,.8)', 90, 4, 0.4); this.shake(2); } }
    const air = b.jumpT > 0.06 && b.jumpT < JUMP - 0.04;
    const bTop = this.busY - 55, bBot = this.busY + 55, bL = b.x - BUS_W / 2, bR = b.x + BUS_W / 2;
    const ghost = this.invuln > 0 || this.pw.express > 0 || this.mode === 'attract';
    // objects
    const objs = this.objs;
    for (const o of objs) { // traffic queueing: stop behind whatever is ahead
      if (o.vs > 0 && !o.dead && !o.flying) {
        let want = o.vs;
        for (const p of objs) if (p !== o && !p.dead && !p.collect && !p.decor && p.lane === o.lane && p.y < o.y && (o.y - o.h / 2) - (p.y + (p.h || 30) / 2) < 40) want = Math.min(want, p.vsCur || 0);
        o.vsCur += (want - o.vsCur) * Math.min(1, dt * 6);
      }
    }
    for (const o of objs) {
      if (o.dead) continue;
      if (o.flying) { o.x += o.fvx * dt; o.y += o.fvy * dt + dy; o.rot += o.fvr * dt; o.fl -= dt; if (o.fl <= 0) o.dead = true; continue; }
      o.y += dy * (1 - o.vsCur); o.ph += dt;
      if (o.drift) { const lim = laneX(o.lane); o.x += o.drift * dt; if ((o.drift > 0 && o.x > lim + 4) || (o.drift < 0 && o.x < lim - 4)) o.drift = -o.drift * 0.5; }
      if (o.weave && o.y > 40 && o.y < this.busY - 380 && !o.weaved) {
        const nl = o.lane === 0 ? 1 : o.lane === 2 ? 1 : (Math.random() < 0.5 ? 0 : 2);
        const vv = Math.max(200, this.speed * this.boost) * (1 - o.vsCur);
        if (this.laneFree(nl, o.y, 160) && this.laneClearAt(nl, (this.busY - 60 - o.y - 30) / vv - 0.6, (this.busY + 60 - o.y + 30) / vv + 0.6)) { o.weaved = true; o.blinkT = 0.5; o.toLane = nl; } else o.weaved = true;
      }
      if (o.blinkT > 0) { o.blinkT -= dt; if (o.blinkT <= 0) o.lane = o.toLane; }
      if (o.lane >= 0 && !o.drift && !o.agbero && !o.mag) o.x += (laneX(o.lane) - o.x) * Math.min(1, dt * 5);
      if (o.y > this.LH + 200) { o.dead = true; continue; }
      if (o.decor || this.dying > 0) continue;
      // magnet pull
      if (o.collect && (this.pw.magnet > 0 || this.pw.express > 0) && o.kind === 'coin' && Math.abs(o.y - this.busY) < 200 && Math.abs(o.x - b.x) < 200) { o.mag = true; o.x += (b.x - o.x) * Math.min(1, dt * 10); o.y += (this.busY - o.y) * Math.min(1, dt * 10); }
      const hw = (o.w || 30) * 0.42, hh = (o.h || 30) * 0.42;
      const hit = o.x + hw > bL && o.x - hw < bR && o.y + hh > bTop && o.y - hh < bBot;
      if (hit) {
        if (o.collect) this.collect(o);
        else if (o.jumpable && (air || o.cleared)) { if (!o.cleared) { o.cleared = true; if (o.deadly) { this.jumps++; this.addCombo(20, 'Clean jump', o.x, o.y - 30); } } }
        else if (o.soft) { if (!o.hitDone) { o.hitDone = true; if (!ghost) { this.slowT = 0.8; this.breakCombo(); sfx.splash(); this.say('Ah! Water don enter!', 1); } this.burst(o.x, o.y, 18, 'rgba(120,170,210,.9)', 200, 5); } }
        else if (o.agbero) { if (!o.hitDone) { o.hitDone = true; this.agberoHit(o, ghost); } }
        else if (o.deadly) {
          if (ghost) this.smash(o);
          else if (this.pw.shield > 0) { this.pw.shield = 0; this.invuln = 1.2; sfx.shieldPop(); this.smash(o); this.pop(b.x, this.busY - 90, 'Pure water saved you!', '#81D4FA'); this.buzz(60); }
          else this.die(o.reason || 'vehicle', o);
        }
      } else if (o.deadly && !o.passed && o.y - (o.h || 30) / 2 > bBot) {
        o.passed = true;
        if (o.nearArm && play) { this.near++; this.addCombo(25, 'NEAR MISS', o.x, this.busY - 40); sfx.near(); this.shake(3); this.buzz(15); if (Math.random() < 0.4) this.say(pick(NEAR_SHOUTS), 1.1); }
      }
    }
    if (objs.length > 60 || (objs.length && objs[0].dead)) this.objs = objs.filter(o => !o.dead);
    // particles + popups
    for (const p of this.parts) if (p.life > 0) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt + dy * 0.6; p.vx *= 0.96; p.vy *= 0.96; }
    for (const p of this.pops) { p.life -= dt; p.y -= 50 * dt; }
    if (this.pops.length && this.pops[0].life <= 0) this.pops = this.pops.filter(p => p.life > 0);
    if (this.pw.express > 0 && Math.random() < 0.8) this.burst(b.x + rnd(-14, 14), this.busY + 58, 1, 'rgba(0,230,118,.8)', 40, 5, 0.35);
    else if (v > 700 && Math.random() < 0.15) this.burst(b.x + rnd(-18, 18), this.busY + 58, 1, 'rgba(210,200,180,.5)', 30, 4, 0.4);
    this.shakeAmp *= Math.pow(0.02, dt);
    if (play) this.hooks.onHud(this);
  }
  collect(o) {
    o.dead = true; const b = this.bus;
    if (o.kind === 'coin') {
      this.coins++; this.score += this.mult; this.coinChain++; this.coinChainT = 0.5; sfx.coin(this.coinChain); this.burst(o.x, o.y, 5, '#FFD54F', 90, 3, 0.35);
    } else if (o.kind === 'passenger') {
      this.passengers++; this.coins += 10; sfx.passenger(); this.addCombo(50, 'Passenger', o.x, o.y - 30); this.say(pick(SHOUTS), 1.3); this.buzz(20);
      this.burst(o.x, o.y, 12, '#FF80AB', 140, 4);
    } else if (o.kind === 'fuel') { this.fuel = Math.min(100, this.fuel + 40); sfx.power(); this.pop(o.x, o.y - 20, '+Fuel', '#FF8A65'); this.burst(o.x, o.y, 10, '#FF7043', 120, 4); }
    else if (o.kind === 'power') this.power(o.ptype);
  }
  agberoHit(o, ghost) {
    if (this.pw.magnet > 0 || ghost) { o.flee = true; o.drift = (o.x < this.bus.x ? -1 : 1) * 160; this.pop(o.x, o.y - 24, 'Agbero-free!', '#EF9A9A'); return; }
    const loss = Math.min(this.coins, Math.max(5, Math.round(this.coins * 0.2)));
    this.coins -= loss; this.breakCombo(); sfx.ouch(); this.shake(4); this.buzz(40);
    this.pop(o.x, o.y - 24, loss ? `Agbero collect ₦${loss}!` : 'Agbero vex!', '#FF5252', true); this.say('Agbero, abeg na!', 1);
  }
  smash(o) {
    this.smashes++; o.flying = true; o.fl = 0.9; o.rot = 0; o.fvr = rnd(-8, 8); o.fvx = (o.x < this.bus.x ? -1 : 1) * rnd(300, 500); o.fvy = -rnd(150, 300);
    if (o.person) { o.fvr = 0; o.fvy = -100; }
    sfx.smash(); this.shake(5); this.burst(o.x, o.y, 16, '#FFF59D', 260, 4); this.addCombo(30, o.person ? 'Comot for road!' : 'SMASH', o.x, o.y);
  }
  die(reason, o) {
    if (this.dying > 0 || this.mode !== 'play') return;
    this.deathReason = reason; this.dying = reason === 'fuel' ? 0.3 : 0.55; sfx.crash(); this.shake(14); this.buzz([80, 40, 120]);
    this.burst(this.bus.x, this.busY - 40, 40, '#FFC107', 300, 6, 0.9); this.burst(this.bus.x, this.busY - 40, 24, '#9E9E9E', 200, 7, 1.1);
    this.hooks.onEvent('crash', { reason });
  }
  // ---------- render ----------
  draw(spr, x, y, sc = 1) { this.g.drawImage(spr, x - spr.lw * sc / 2, y - spr.lh * sc / 2, spr.lw * sc, spr.lh * sc); }
  render() {
    const g = this.g, S = this.S, LH = this.LH, b = this.bus;
    let sx = 0, sy = 0; if (this.shakeAmp > 0.3) { sx = (Math.random() - 0.5) * this.shakeAmp; sy = (Math.random() - 0.5) * this.shakeAmp; }
    g.setTransform(S, 0, 0, S, sx * S, sy * S);
    // ground segments
    const off = this.dist;
    for (const s of this.segs) {
      const z = ZONES[s.z].id, top = s.y - SEG;
      if (z === 'bridge') {
        g.fillStyle = '#1f7fa6'; g.fillRect(-10, top, ROAD_L + 10, SEG + 1); g.fillRect(ROAD_R, top, LW - ROAD_R + 10, SEG + 1);
        g.fillStyle = 'rgba(255,255,255,.16)';
        for (let i = 0; i < 4; i++) { const yy = top + ((i * 43 + off * 0.35) % SEG); g.fillRect(8 + (i * 13) % 30, yy, 18, 2); g.fillRect(ROAD_R + 14 + (i * 17) % 30, yy + 20, 20, 2); }
        g.fillStyle = '#b8bcc2'; g.fillRect(ROAD_L - 8, top, 8, SEG + 1); g.fillRect(ROAD_R, top, 8, SEG + 1);
        g.fillStyle = '#8b9097'; for (let yy = top + ((off) % 40); yy < s.y; yy += 40) { g.fillRect(ROAD_L - 8, yy, 8, 4); g.fillRect(ROAD_R, yy, 8, 4); }
      } else {
        g.fillStyle = z === 'market' ? '#cfc2a8' : z === 'lekki' ? '#d9d4c7' : '#c9c1b3'; g.fillRect(-10, top, ROAD_L + 10, SEG + 1); g.fillRect(ROAD_R, top, LW - ROAD_R + 10, SEG + 1);
        if (z === 'lekki') { g.fillStyle = '#7cb35a'; g.fillRect(-10, top, 26, SEG + 1); g.fillRect(LW - 16, top, 26, SEG + 1); }
        g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(ROAD_L - 22, top, 2, SEG + 1); g.fillRect(ROAD_R + 20, top, 2, SEG + 1);
        // black & yellow kerbs
        g.fillStyle = '#1d1d1d'; g.fillRect(ROAD_L - 6, top, 6, SEG + 1); g.fillRect(ROAD_R, top, 6, SEG + 1);
        g.fillStyle = '#FFCB05'; const k0 = top + (off % 40) - 40; for (let yy = k0; yy < s.y; yy += 40) { const a = Math.max(yy, top), bb = Math.min(yy + 20, s.y); if (bb > a) { g.fillRect(ROAD_L - 6, a, 6, bb - a); g.fillRect(ROAD_R, a, 6, bb - a); } }
      }
    }
    // road
    const ah = this.asphalt, ay = (off % ah.lh) - ah.lh;
    for (let yy = ay; yy < LH; yy += ah.lh) g.drawImage(ah, ROAD_L, yy, ah.lw, ah.lh + 0.5);
    g.fillStyle = 'rgba(255,255,255,.75)'; g.fillRect(ROAD_L + 3, 0, 2.5, LH); g.fillRect(ROAD_R - 5.5, 0, 2.5, LH);
    g.fillStyle = 'rgba(255,255,255,.65)';
    const d0 = (off % 70) - 70; for (let yy = d0; yy < LH; yy += 70) { g.fillRect(ROAD_L + LANE_W - 1.5, yy, 3, 36); g.fillRect(ROAD_L + 2 * LANE_W - 1.5, yy, 3, 36); }
    // decor
    for (const d of this.decor) { if (d.y < -140 || d.y > LH + 140) continue; if (d.spr.flip) { g.save(); g.translate(d.x, d.y); g.scale(-1, 1); this.draw(d.spr.s, 0, 0); g.restore(); } else this.draw(d.spr, d.x, d.y); }
    // ground objects
    for (const o of this.objs) if (!o.dead && o.ground && o.y > -80 && o.y < LH + 80) this.draw(o.spr, o.x, o.y);
    // collectibles
    const tt = this.t + this.dist * 0.0001;
    for (const o of this.objs) {
      if (o.dead || !o.collect || o.y < -60 || o.y > LH + 60) continue;
      if (o.kind === 'coin') { const sc = Math.abs(Math.cos(o.ph * 4)); g.drawImage(o.spr, o.x - 13 * Math.max(0.15, sc), o.y - 13 - o.arcJ * 26, 26 * Math.max(0.15, sc), 26); }
      else if (o.kind === 'power') { const bob = Math.sin(o.ph * 5) * 3; this.draw(o.spr, o.x, o.y + bob, 1 + Math.sin(o.ph * 8) * 0.05); }
      else if (o.kind === 'passenger') { this.draw(o.spr, o.x, o.y); this.bubble(o.bubble, o.x, o.y - 30); }
      else this.draw(o.spr, o.x, o.y);
    }
    // vehicles & people (shadow then body)
    const sh = this.shadow();
    for (const o of this.objs) if (!o.dead && !o.ground && !o.collect && o.spr && o.h > 50 && o.y > -180 && o.y < LH + 180) g.drawImage(sh, o.x - o.w * 0.62 + 5, o.y - o.h * 0.62 + 6, o.w * 1.24, o.h * 1.24);
    for (const o of this.objs) {
      if (o.dead || o.ground || o.collect || o.y < -180 || o.y > LH + 180) continue;
      if (o.agbero) { this.draw(A.agberoSprite(((o.ph * 4) | 0) % 2), o.x, o.y); if (!o.flee) this.bubble('Driver! Owo mi!', o.x, o.y - 28, '#FFCDD2'); continue; }
      if (!o.spr) continue;
      if (o.flying) { g.save(); g.translate(o.x, o.y); g.rotate(o.rot); g.globalAlpha = Math.max(0, o.fl); this.draw(o.spr, 0, 0); g.restore(); g.globalAlpha = 1; continue; }
      this.draw(o.spr, o.x, o.y);
      if (o.blinkT > 0 && ((o.blinkT * 10) | 0) % 2) { g.fillStyle = '#FFAB00'; const sd = o.toLane < o.lane ? -1 : 1; g.fillRect(o.x + sd * 12 - 3, o.y - 30, 6, 6); }
      if (o.bubble && o.kind === 'cop') this.bubble(o.bubble, o.x, o.y - 26);
    }
    // the bus
    const jp = b.jumpT > 0 ? Math.sin(b.jumpT / JUMP * Math.PI) : 0, bs = 1 + jp * 0.28;
    const bus = A.busSprite(this.skin);
    g.drawImage(sh, b.x - 40 + 6 + jp * 18, this.busY - 70 + 8 + jp * 22, 80, 140);
    if (this.pw.express > 0) { g.fillStyle = 'rgba(0,230,118,.22)'; g.fillRect(b.x - 30, this.busY + 50, 60, 140); g.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 6; i++) g.fillRect(ROAD_L + 10 + ((i * 53 + this.dist * 0.7) % (ROAD_R - ROAD_L - 20)), (i * 157 + this.dist * 1.6) % LH, 2, 40); }
    const blink = this.invuln > 0 && this.pw.express <= 0 && ((this.invuln * 12) | 0) % 2;
    if (this.dying <= 0 || ((this.dying * 20) | 0) % 2) {
      g.save(); g.translate(b.x, this.busY - jp * 10); g.rotate(b.tilt); g.globalAlpha = blink ? 0.45 : 1; this.draw(bus, 0, 0, bs); g.restore(); g.globalAlpha = 1;
    }
    if (this.pw.shield > 0) { const a = 0.35 + Math.sin(this.t * 10) * 0.1 - (this.pw.shield < 1.5 ? (((this.pw.shield * 8) | 0) % 2) * 0.2 : 0); g.strokeStyle = `rgba(129,212,250,${a + 0.3})`; g.fillStyle = `rgba(129,212,250,${a * 0.4})`; g.lineWidth = 3; g.beginPath(); g.ellipse(b.x, this.busY, 46 * bs, 74 * bs, 0, 0, 7); g.fill(); g.stroke(); }
    if (this.pw.magnet > 0) { const r = 60 + ((this.t * 90) % 60); g.strokeStyle = `rgba(239,83,80,${0.5 - (r - 60) / 140})`; g.lineWidth = 2.5; g.beginPath(); g.arc(b.x, this.busY, r, 0, 7); g.stroke(); }
    // overhead: Lekki toll gantry
    if (this.gantry && this.gantry.y > -150 && this.gantry.y < LH + 150) this.drawGantry(this.gantry.y);
    // particles
    for (const p of this.parts) if (p.life > 0) { g.globalAlpha = Math.min(1, p.life / p.max * 1.5); g.fillStyle = p.col; g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
    g.globalAlpha = 1;
    // conductor shout + popups
    if (this.shout) this.bubble(this.shout.text, clamp(b.x + 40, 90, LW - 90), this.busY - 30, '#FFF59D', 13);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const p of this.pops) { g.globalAlpha = Math.min(1, p.life * 2.2); g.font = (p.big ? '22px' : '16px') + ' "Lilita One", system-ui, sans-serif'; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.55)'; g.strokeText(p.text, clamp(p.x, 70, LW - 70), p.y); g.fillStyle = p.col; g.fillText(p.text, clamp(p.x, 70, LW - 70), p.y); }
    g.globalAlpha = 1;
    // low-fuel / express edge tint
    if (this.mode === 'play' && this.fuel < 25 && this.fuel > 0 && ((this.t * 3) | 0) % 2) { g.fillStyle = 'rgba(255,40,40,.12)'; g.fillRect(0, 0, LW, LH); }
  }
  bubble(text, x, y, col = '#fff', size = 11) {
    const g = this.g; g.font = size + 'px "Lilita One", system-ui, sans-serif'; const w = g.measureText(text).width + 12, h = size + 9;
    x = clamp(x, w / 2 + 4, LW - w / 2 - 4);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.roundRect(x - w / 2 + 2, y - h / 2 + 2, w, h, 8); g.fill();
    g.fillStyle = col; g.beginPath(); g.roundRect(x - w / 2, y - h / 2, w, h, 8); g.fill();
    g.beginPath(); g.moveTo(x - 4, y + h / 2 - 1); g.lineTo(x, y + h / 2 + 5); g.lineTo(x + 4, y + h / 2 - 1); g.fill();
    g.fillStyle = '#1a1a1a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, x, y + 1);
  }
  drawGantry(y) {
    const g = this.g;
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(ROAD_L - 30, y + 18, ROAD_R - ROAD_L + 60, 40);
    g.fillStyle = '#e8eaed'; g.fillRect(ROAD_L - 36, y - 26, ROAD_R - ROAD_L + 72, 44);
    g.fillStyle = '#c5c9ce'; for (let x = ROAD_L - 30; x < ROAD_R + 36; x += 22) g.fillRect(x, y - 26, 3, 44);
    g.fillStyle = '#0B6B3A'; g.fillRect(ROAD_L + 40, y - 16, ROAD_R - ROAD_L - 80, 24);
    g.fillStyle = '#fff'; g.font = '15px "Lilita One", system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('LEKKI TOLL PLAZA', LW / 2, y - 3);
    g.fillStyle = '#9aa0a6'; g.fillRect(ROAD_L - 40, y - 30, 14, 52); g.fillRect(ROAD_R + 26, y - 30, 14, 52);
    g.fillStyle = '#ff5252'; g.fillRect(ROAD_L - 37, y - 24, 8, 8); g.fillStyle = '#69f0ae'; g.fillRect(ROAD_R + 29, y - 24, 8, 8);
  }
  // ---------- loop + adaptive quality ----------
  frame(now) {
    const dt = this.lastT ? (now - this.lastT) / 1000 : 1 / 60; this.lastT = now;
    const w0 = performance.now(); this.update(dt); if (this.mode !== 'paused') this.render();
    const wk = performance.now() - w0; this.workMs = this.workMs ? this.workMs * 0.95 + wk * 0.05 : wk; if (wk > (this.workMax || 0)) this.workMax = wk;
    // adaptive resolution: if we can't hold ~55fps, render fewer pixels
    const ft = this.frameTimes; ft.push(dt); if (ft.length > 90) ft.shift();
    if (ft.length === 90 && !this.lockQuality) {
      const avg = ft.reduce((a, b) => a + b, 0) / 90; this.fps = 1 / avg;
      if (avg > 1 / 50 && this.quality > 1) { this.quality = Math.max(1, +(this.quality - 0.25).toFixed(2)); this.applyQuality(); ft.length = 0; }
    }
  }
}
