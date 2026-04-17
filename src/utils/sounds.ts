/**
 * Mayan temple-themed sound effects using Web Audio API.
 */

let audioCtx: AudioContext | null = null;
let soundEnabled = true;

export function setSoundEnabled(enabled: boolean) { soundEnabled = enabled; }
export function isSoundEnabled() { return soundEnabled; }

function ctx(): AudioContext | null {
  if (!soundEnabled) return null;
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

/** Your turn notification — gentle temple gong */
export function playYourTurnSound() {
  const c = ctx(); if (!c) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.value = 523;
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
  osc.connect(gain).connect(c.destination);
  osc.start(now); osc.stop(now + 0.9);

  // Overtone
  const o2 = c.createOscillator();
  const g2 = c.createGain();
  o2.type = 'sine'; o2.frequency.value = 784;
  g2.gain.setValueAtTime(0.06, now);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
  o2.connect(g2).connect(c.destination);
  o2.start(now); o2.stop(now + 0.7);

  // Vibrate on mobile
  if (navigator.vibrate) navigator.vibrate(200);
}

/** Crowned — mystical ascending temple chime */
export function playCrownedSound() {
  const c = ctx(); if (!c) return;
  const now = c.currentTime;
  [330, 440, 550, 660].forEach((freq, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    const filter = c.createBiquadFilter();
    osc.type = 'triangle'; osc.frequency.value = freq;
    filter.type = 'bandpass'; filter.frequency.value = freq * 1.5; filter.Q.value = 8;
    const start = now + i * 0.12;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.15, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.6);
    osc.connect(filter).connect(gain).connect(c.destination);
    osc.start(start); osc.stop(start + 0.7);
  });
  const sub = c.createOscillator();
  const sg = c.createGain();
  sub.type = 'sine'; sub.frequency.value = 165;
  sg.gain.setValueAtTime(0.1, now);
  sg.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
  sub.connect(sg).connect(c.destination);
  sub.start(now); sub.stop(now + 0.9);
}

/** Home / Borne off — triumphant drums + bell */
export function playHomeSound() {
  const c = ctx(); if (!c) return;
  const now = c.currentTime;
  [0, 0.15].forEach(offset => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, now + offset);
    osc.frequency.exponentialRampToValueAtTime(40, now + offset + 0.3);
    gain.gain.setValueAtTime(0.25, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.3);
    osc.connect(gain).connect(c.destination);
    osc.start(now + offset); osc.stop(now + offset + 0.4);
  });
  const bell = c.createOscillator();
  const bg = c.createGain();
  bell.type = 'sine'; bell.frequency.value = 880;
  bg.gain.setValueAtTime(0, now + 0.3);
  bg.gain.linearRampToValueAtTime(0.12, now + 0.32);
  bg.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
  bell.connect(bg).connect(c.destination);
  bell.start(now + 0.3); bell.stop(now + 1.3);
}

/** Jailed / Captured — stone door slam */
export function playJailedSound() {
  const c = ctx(); if (!c) return;
  const now = c.currentTime;
  const impact = c.createOscillator();
  const ig = c.createGain();
  impact.type = 'sine';
  impact.frequency.setValueAtTime(120, now);
  impact.frequency.exponentialRampToValueAtTime(30, now + 0.5);
  ig.gain.setValueAtTime(0.3, now);
  ig.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  impact.connect(ig).connect(c.destination);
  impact.start(now); impact.stop(now + 0.6);

  const rumble = c.createOscillator();
  const rg = c.createGain();
  rumble.type = 'sawtooth'; rumble.frequency.value = 55;
  rg.gain.setValueAtTime(0.08, now + 0.1);
  rg.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
  const rf = c.createBiquadFilter();
  rf.type = 'lowpass'; rf.frequency.value = 100;
  rumble.connect(rf).connect(rg).connect(c.destination);
  rumble.start(now + 0.1); rumble.stop(now + 0.9);
}

/** Dice rattle — stones tumbling */
export function playDiceRattle() {
  const c = ctx(); if (!c) return;
  const now = c.currentTime;
  for (let i = 0; i < 8; i++) {
    const t = now + i * 0.1 + Math.random() * 0.05;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'square';
    osc.frequency.value = 800 + Math.random() * 600;
    gain.gain.setValueAtTime(0.04 + Math.random() * 0.03, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc.connect(gain).connect(c.destination);
    osc.start(t); osc.stop(t + 0.05);
  }
}

/** Dice slam — stones landing */
export function playDiceSlam() {
  const c = ctx(); if (!c) return;
  const now = c.currentTime;
  [0, 0.06].forEach(offset => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now + offset);
    osc.frequency.exponentialRampToValueAtTime(60, now + offset + 0.15);
    gain.gain.setValueAtTime(0.2, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.15);
    osc.connect(gain).connect(c.destination);
    osc.start(now + offset); osc.stop(now + offset + 0.2);
  });
}
