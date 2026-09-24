// One clock for the whole page. The ECG strip, the pleth trace, the halftone
// heart, the blood-flow band and the monitor all read the same integrated
// cardiac phase, so every beat on screen lands on the same frame — and when
// the rate changes (hover the heart) or the heart is shocked (click it), they
// all respond together without a phase jump.

// ?still — every intro animation starts finished (screenshots, OG capture)
export const STILL = new URLSearchParams(location.search).has('still');

const REST_BPM = 72;
const EXCITED_BPM = 128;
const FLATLINE = 1.25;        // s of asystole after a shock before rhythm returns

const state = {
  bpm: REST_BPM,
  target: REST_BPM,
  phase: 0,        // continuous, in beats
  prevPhase: 0,
  clock: 0,        // s since load
  shockAt: -1e9,
  prevSince: 1e9,
};

const subs = new Set();
const shockSubs = new Set();
const g = (x, mu, s) => Math.exp(-((x - mu) ** 2) / (2 * s * s));
const frac = (x) => x - Math.floor(x);

/** Synthetic lead-II complex, input in [0,1) of one beat, output in mV. */
export function ecg(p) {
  return (
    g(p, 0.12, 0.022) * 0.13 +     // P
    g(p, 0.232, 0.007) * -0.13 +   // Q
    g(p, 0.25, 0.0095) * 1.05 +    // R
    g(p, 0.268, 0.009) * -0.26 +   // S
    g(p, 0.46, 0.042) * 0.29       // T
  );
}

/** Finger plethysmograph: arrives ~0.3 beat after R, sharp upstroke, dicrotic notch. */
export function pleth(p) {
  const q = frac(p - 0.3);
  const up = q < 0.12 ? g(q, 0.12, 0.045) : g(q, 0.12, 0.12);
  return up * 0.92 + g(q, 0.37, 0.045) * 0.22;
}

/** What the ECG pen reads `s` seconds after a shock: rail, rebound, then asystole. */
export function shockTrace(s) {
  if (s < 0.035) return 3.4;
  if (s < 0.08) return -2.2;
  if (s < 0.5) return -2.2 * Math.exp(-(s - 0.08) * 11);
  return (Math.random() - 0.5) * 0.02;
}

/** Mechanical "lub-dub" envelope for things that should visibly beat. */
export function contraction(p) {
  return g(p, 0.29, 0.03) + 0.4 * g(p, 0.47, 0.035);
}

export const pulse = {
  get bpm() { return state.bpm; },
  get phase() { return state.phase; },
  get prevPhase() { return state.prevPhase; },
  /** seconds since the last shock (large if never) */
  get since() { return state.clock - state.shockAt; },
  get prevSince() { return state.prevSince; },
  get flatline() { return state.clock - state.shockAt < FLATLINE; },
  get beat() { return this.flatline ? 0 : contraction(frac(state.phase)); },
  excite(on) { state.target = on ? EXCITED_BPM : REST_BPM; },
  shock() {
    if (state.clock - state.shockAt < FLATLINE + 0.3) return false;
    state.shockAt = state.clock;
    // park just before the next P wave so rhythm restarts cleanly
    state.phase = Math.floor(state.phase) + 0.95;
    for (const fn of shockSubs) fn();
    return true;
  },
  onShock(fn) { shockSubs.add(fn); },
  /** true on the frame an R wave crosses */
  get rWave() {
    if (this.flatline) return false;
    const a = state.prevPhase - 0.25, b = state.phase - 0.25;
    return Math.floor(a) !== Math.floor(b);
  },
  FLATLINE,
  frac,
};

export function onFrame(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

let last = performance.now();
// scoped to the few elements that use it — setting it on :root would restyle
// the whole document every frame
const beaters = document.querySelectorAll('[data-beat]');
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  state.prevSince = state.clock - state.shockAt;
  state.clock += dt;
  state.bpm += (state.target - state.bpm) * Math.min(1, dt * 1.6);
  state.prevPhase = state.phase;
  if (!pulse.flatline) state.phase += dt * (state.bpm / 60);
  const b = pulse.beat.toFixed(3);
  for (const el of beaters) el.style.setProperty('--beat', b);
  for (const fn of subs) fn(dt, now / 1000);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
