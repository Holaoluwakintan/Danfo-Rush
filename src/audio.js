// Every sound is synthesised live with WebAudio: no audio files, nothing copyrighted.
let ac = null, master = null, sfxBus = null, musBus = null, noiseBuf = null;
let sfxOn = true, musicOn = true, musicTimer = null, nextNote = 0, step = 0, intensity = 0;

export function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ac = new AC({ latencyHint: 'interactive' });
  master = ac.createGain(); master.gain.value = 0.8;
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
  master.connect(comp); comp.connect(ac.destination);
  sfxBus = ac.createGain(); sfxBus.gain.value = sfxOn ? 0.9 : 0; sfxBus.connect(master);
  musBus = ac.createGain(); musBus.gain.value = musicOn ? 0.32 : 0; musBus.connect(master);
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.6, ac.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
export function setSfx(on) { sfxOn = on; if (sfxBus) sfxBus.gain.value = on ? 0.9 : 0; }
export function setMusic(on) { musicOn = on; if (musBus) musBus.gain.setTargetAtTime(on ? 0.32 : 0, ac.currentTime, 0.05); }
export function setIntensity(v) { intensity = v; }

function tone(type, f0, f1, dur, vol, bus = sfxBus, t = ac.currentTime, attack = 0.005) {
  const o = ac.createOscillator(), gn = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(vol, t + attack); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(gn); gn.connect(bus); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol, fType, f0, f1, bus = sfxBus, t = ac.currentTime, q = 1) {
  const s = ac.createBufferSource(); s.buffer = noiseBuf;
  const f = ac.createBiquadFilter(); f.type = fType; f.Q.value = q; f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const gn = ac.createGain(); gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(gn); gn.connect(bus); s.start(t, Math.random() * 0.3); s.stop(t + dur + 0.02);
}

export const sfx = {
  coin(p = 0) { if (!ac || !sfxOn) return; const b = 988 * Math.pow(1.0595, Math.min(p, 12)); tone('square', b, b, 0.05, 0.08); tone('square', b * 1.5, b * 1.5, 0.12, 0.07, sfxBus, ac.currentTime + 0.05); },
  passenger() { if (!ac || !sfxOn) return; const t = ac.currentTime; [523, 659, 784].forEach((f, i) => tone('triangle', f, f, 0.14, 0.18, sfxBus, t + i * 0.06)); },
  jump() { if (!ac || !sfxOn) return; noise(0.3, 0.25, 'bandpass', 400, 2400, sfxBus, ac.currentTime, 2); tone('sine', 220, 520, 0.25, 0.12); },
  land() { if (!ac || !sfxOn) return; tone('sine', 140, 50, 0.16, 0.35); noise(0.1, 0.15, 'lowpass', 800, 200); },
  lane() { if (!ac || !sfxOn) return; noise(0.08, 0.12, 'highpass', 2500, 5000); },
  near() { if (!ac || !sfxOn) return; noise(0.35, 0.3, 'bandpass', 3000, 600, sfxBus, ac.currentTime, 1.5); tone('sawtooth', 660, 1320, 0.18, 0.05); },
  crash() { if (!ac || !sfxOn) return; noise(0.6, 0.7, 'lowpass', 3000, 120); tone('sine', 110, 35, 0.5, 0.6); tone('square', 80, 40, 0.3, 0.15); },
  splash() { if (!ac || !sfxOn) return; noise(0.45, 0.4, 'bandpass', 1200, 300, sfxBus, ac.currentTime, 0.8); },
  power() { if (!ac || !sfxOn) return; const t = ac.currentTime; [392, 523, 659, 784, 1047].forEach((f, i) => tone('square', f, f, 0.12, 0.07, sfxBus, t + i * 0.05)); },
  powerEnd() { if (!ac || !sfxOn) return; const t = ac.currentTime; [784, 523].forEach((f, i) => tone('triangle', f, f, 0.12, 0.1, sfxBus, t + i * 0.08)); },
  horn() { if (!ac || !sfxOn) return; const t = ac.currentTime; for (const k of [0, 0.22]) { tone('sawtooth', 415, 415, 0.16, 0.09, sfxBus, t + k, 0.01); tone('sawtooth', 523, 523, 0.16, 0.07, sfxBus, t + k, 0.01); } },
  smash() { if (!ac || !sfxOn) return; noise(0.3, 0.5, 'bandpass', 1800, 400, sfxBus, ac.currentTime, 1); tone('square', 300, 90, 0.2, 0.12); },
  ouch() { if (!ac || !sfxOn) return; tone('sawtooth', 400, 180, 0.3, 0.12); },
  shieldPop() { if (!ac || !sfxOn) return; noise(0.25, 0.4, 'highpass', 1500, 6000); tone('sine', 900, 300, 0.2, 0.2); },
  low() { if (!ac || !sfxOn) return; tone('square', 880, 880, 0.08, 0.06); },
  click() { if (!ac || !sfxOn) return; tone('triangle', 1200, 900, 0.05, 0.12); },
  buy() { if (!ac || !sfxOn) return; const t = ac.currentTime; [659, 880, 1319].forEach((f, i) => tone('square', f, f, 0.1, 0.07, sfxBus, t + i * 0.07)); },
  combo(n) { if (!ac || !sfxOn) return; const f = 440 * Math.pow(1.122, n); tone('triangle', f, f * 1.5, 0.15, 0.12); },
};

// --- procedural afrobeat-ish loop (112 bpm) ---
const BPM = 112, SIX = 60 / BPM / 4;
const BASS = [41, 0, 0, 41, 0, 44, 0, 46, 48, 0, 46, 0, 44, 0, 41, 0];
const LEAD = [65, 0, 68, 70, 0, 72, 0, 70, 68, 0, 65, 0, 63, 65, 0, 0];
const midi = n => 440 * Math.pow(2, (n - 69) / 12);
function schedule() {
  if (!ac) return;
  while (nextNote < ac.currentTime + 0.12) {
    const s = step % 16, t = nextNote, bar = Math.floor(step / 16) % 4;
    if (s % 4 === 0) { tone('sine', 120, 45, 0.18, 0.9, musBus, t); }
    if (s === 4 || s === 12) noise(0.12, 0.35, 'bandpass', 1800, 900, musBus, t, 0.7);
    noise(0.04, s % 2 ? 0.08 : 0.14, 'highpass', 7000, 0, musBus, t);
    if (s === 3 || s === 7 || s === 10 || s === 14) tone('triangle', 900, 700, 0.05, 0.12, musBus, t); // cowbell-ish
    const bn = BASS[s]; if (bn) tone('triangle', midi(bn + (bar === 3 ? -2 : 0)), midi(bn + (bar === 3 ? -2 : 0)), SIX * 1.8, 0.35, musBus, t, 0.01);
    if (intensity > 0.3 || bar % 2) { const ln = LEAD[(s + bar * 3) % 16]; if (ln) tone('square', midi(ln + 12), midi(ln + 12), SIX * 0.9, 0.035, musBus, t, 0.004); }
    nextNote += SIX; step++;
  }
}
export function startMusic() { if (!ac || musicTimer) return; nextNote = ac.currentTime + 0.05; musicTimer = setInterval(schedule, 30); }
export function stopMusic() { clearInterval(musicTimer); musicTimer = null; }
export function suspendAudio() { if (ac && ac.state === 'running') ac.suspend(); }
export function resumeAudio() { if (ac && ac.state === 'suspended') ac.resume(); }
