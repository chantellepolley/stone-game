/**
 * Mayan temple-themed sound effects using Web Audio API.
 * No audio files needed — all synthesized in the browser.
 */

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

/**
 * Crowned — mystical ascending temple chime.
 * Two tones rising with reverb, like ancient stone bells.
 */
export function playCrownedSound() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  // Pentatonic ascending notes (Mayan-ish scale)
  const notes = [330, 440, 550, 660];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.value = freq;

    filter.type = 'bandpass';
    filter.frequency.value = freq * 1.5;
    filter.Q.value = 8;

    const start = now + i * 0.12;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.15, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.6);

    osc.connect(filter).connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.7);
  });

  // Deep undertone — stone resonance
  const sub = ctx.createOscillator();
  const subGain = ctx.createGain();
  sub.type = 'sine';
  sub.frequency.value = 165;
  subGain.gain.setValueAtTime(0.1, now);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
  sub.connect(subGain).connect(ctx.destination);
  sub.start(now);
  sub.stop(now + 0.9);
}

/**
 * Home / Borne off — triumphant ancient drum sequence with bright chime.
 * Deep hits followed by a bright bell, like a temple ceremony completion.
 */
export function playHomeSound() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  // Two deep drum hits
  [0, 0.15].forEach(offset => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, now + offset);
    osc.frequency.exponentialRampToValueAtTime(40, now + offset + 0.3);
    gain.gain.setValueAtTime(0.25, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + offset);
    osc.stop(now + offset + 0.4);

    // Noise burst for drum texture
    const bufferSize = ctx.sampleRate * 0.1;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
    const noise = ctx.createBufferSource();
    const noiseGain = ctx.createGain();
    const noiseFilter = ctx.createBiquadFilter();
    noise.buffer = buffer;
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 200;
    noiseGain.gain.setValueAtTime(0.15, now + offset);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.15);
    noise.connect(noiseFilter).connect(noiseGain).connect(ctx.destination);
    noise.start(now + offset);
  });

  // Bright temple bell
  const bell = ctx.createOscillator();
  const bellGain = ctx.createGain();
  bell.type = 'sine';
  bell.frequency.value = 880;
  bellGain.gain.setValueAtTime(0, now + 0.3);
  bellGain.gain.linearRampToValueAtTime(0.12, now + 0.32);
  bellGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
  bell.connect(bellGain).connect(ctx.destination);
  bell.start(now + 0.3);
  bell.stop(now + 1.3);

  // Harmonic overtone
  const overtone = ctx.createOscillator();
  const otGain = ctx.createGain();
  overtone.type = 'sine';
  overtone.frequency.value = 1320;
  otGain.gain.setValueAtTime(0, now + 0.3);
  otGain.gain.linearRampToValueAtTime(0.06, now + 0.33);
  otGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
  overtone.connect(otGain).connect(ctx.destination);
  overtone.start(now + 0.3);
  overtone.stop(now + 1.0);
}

/**
 * Jailed / Captured — heavy stone door slam with ominous rumble.
 * Deep impact with descending tone, like being sealed in a temple chamber.
 */
export function playJailedSound() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  // Heavy stone impact
  const impact = ctx.createOscillator();
  const impactGain = ctx.createGain();
  impact.type = 'sine';
  impact.frequency.setValueAtTime(120, now);
  impact.frequency.exponentialRampToValueAtTime(30, now + 0.5);
  impactGain.gain.setValueAtTime(0.3, now);
  impactGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  impact.connect(impactGain).connect(ctx.destination);
  impact.start(now);
  impact.stop(now + 0.6);

  // Stone scrape noise
  const bufferSize = ctx.sampleRate * 0.3;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
  const noise = ctx.createBufferSource();
  const noiseGain = ctx.createGain();
  const noiseFilter = ctx.createBiquadFilter();
  noise.buffer = buffer;
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.value = 300;
  noiseFilter.Q.value = 3;
  noiseGain.gain.setValueAtTime(0.12, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  noise.connect(noiseFilter).connect(noiseGain).connect(ctx.destination);
  noise.start(now);

  // Ominous low rumble
  const rumble = ctx.createOscillator();
  const rumbleGain = ctx.createGain();
  rumble.type = 'sawtooth';
  rumble.frequency.value = 55;
  rumbleGain.gain.setValueAtTime(0.08, now + 0.1);
  rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
  const rumbleFilter = ctx.createBiquadFilter();
  rumbleFilter.type = 'lowpass';
  rumbleFilter.frequency.value = 100;
  rumble.connect(rumbleFilter).connect(rumbleGain).connect(ctx.destination);
  rumble.start(now + 0.1);
  rumble.stop(now + 0.9);
}

/**
 * Dice rattle — stone dice tumbling on a carved slab.
 * Series of rapid clicks with filtered noise, like pebbles shaking.
 */
export function playDiceRattle() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  // Rapid clicking stones
  for (let i = 0; i < 8; i++) {
    const t = now + i * 0.1 + Math.random() * 0.05;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 800 + Math.random() * 600;
    gain.gain.setValueAtTime(0.04 + Math.random() * 0.03, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  // Shaking noise bed
  const bufSize = ctx.sampleRate * 0.8;
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1);
  const noise = ctx.createBufferSource();
  const nGain = ctx.createGain();
  const nFilter = ctx.createBiquadFilter();
  noise.buffer = buf;
  nFilter.type = 'bandpass';
  nFilter.frequency.value = 2000;
  nFilter.Q.value = 2;
  nGain.gain.setValueAtTime(0.06, now);
  nGain.gain.linearRampToValueAtTime(0.08, now + 0.3);
  nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
  noise.connect(nFilter).connect(nGain).connect(ctx.destination);
  noise.start(now);
}

/**
 * Dice slam — stones landing hard on the board.
 * Sharp impact with a low thud.
 */
export function playDiceSlam() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  // Two stone impacts (one per die)
  [0, 0.06].forEach(offset => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now + offset);
    osc.frequency.exponentialRampToValueAtTime(60, now + offset + 0.15);
    gain.gain.setValueAtTime(0.2, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + offset);
    osc.stop(now + offset + 0.2);

    // Click
    const click = ctx.createOscillator();
    const cGain = ctx.createGain();
    click.type = 'square';
    click.frequency.value = 1200;
    cGain.gain.setValueAtTime(0.08, now + offset);
    cGain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.02);
    click.connect(cGain).connect(ctx.destination);
    click.start(now + offset);
    click.stop(now + offset + 0.03);
  });
}
