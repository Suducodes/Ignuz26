// One clock for the whole page. The ECG strip, the pleth trace, the halftone
// heart, the blood-flow band and the monitor all read the same integrated
// cardiac phase, so every beat on screen lands on the same frame — and when
// the rate changes (hover the heart) or the heart is shocked (click it), they
// all respond together without a phase jump.

import { ecg, pleth, shockTrace, contraction } from './wave.js';

export { ecg, pleth, shockTrace, contraction };

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
const frac = (x) => x - Math.floor(x);

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
