// Monitor audio, synthesised — no files. Off until the visitor opts in.
// Like a real pulse oximeter, the beep's pitch tracks saturation: 98 % sits
// near 880 Hz and every point lower drops it by a few hertz.

let ctx = null;
let on = false;

function audio() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export const sound = {
  get on() { return on; },
  set(v) { on = v; if (v) audio(); },

  beep(spo2 = 98) {
    if (!on) return;
    const a = audio();
    const t = a.currentTime;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = 'sine';
    o.frequency.value = 880 - (98 - spo2) * 12;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + 0.15);
  },

  // capacitor whine → discharge thump
  zap() {
    if (!on) return;
    const a = audio();
    const t = a.currentTime;
    const whine = a.createOscillator();
    const wg = a.createGain();
    whine.type = 'sawtooth';
    whine.frequency.setValueAtTime(500, t);
    whine.frequency.exponentialRampToValueAtTime(2600, t + 0.16);
    wg.gain.setValueAtTime(0.0001, t);
    wg.gain.exponentialRampToValueAtTime(0.035, t + 0.12);
    wg.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    whine.connect(wg).connect(a.destination);
    whine.start(t);
    whine.stop(t + 0.22);

    const len = Math.floor(a.sampleRate * 0.3);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    const n = a.createBufferSource();
    const f = a.createBiquadFilter();
    const ng = a.createGain();
    n.buffer = buf;
    f.type = 'lowpass';
    f.frequency.value = 900;
    ng.gain.value = 0.5;
    n.connect(f).connect(ng).connect(a.destination);
    n.start(t + 0.2);
  },
};
