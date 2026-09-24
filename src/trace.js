import { pulse, ecg, pleth, shockTrace, onFrame, STILL } from './pulse.js';
import { tokenRGB, rgbOf, rgba } from './ink.js';

// Monitor sweep drawn to real paper maths: the page grid is 1 mm = 8 px, so
// 25 mm/s = 200 px/s and 10 mm/mV = 80 px/mV. The trace overwrites itself
// left→right with an erase gap ahead of the pen, like an actual monitor.
// The same sweep draws the small SpO₂ pleth channel inside the monitor.

const MM = 8;

const PRESETS = {
  ecg: {
    wave: ecg, speed: 25 * MM, gap: 26, startX: 9 * MM, calibration: true,
    baseline: 0.74, gain: (h, base) => Math.min(10 * MM, (base - 14) / 1.05), lineWidth: 1.6, dot: 3.2,
  },
  pleth: {
    wave: pleth, speed: 60, gap: 12, startX: 0, calibration: false,
    baseline: 0.9, gain: (h) => h * 0.78, lineWidth: 1.4, dot: 2.2,
  },
};

export function initTrace(canvas, { reduced, kind = 'ecg', color, dotColor }) {
  const o = PRESETS[kind];
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, gain = 80, base = 0;
  let ys = new Float32Array(0);
  let head = o.startX;
  let visible = true;
  let ink = [10, 22, 51, 1], dot = [98, 214, 255, 1];

  function readInk() {
    ink = color ? rgbOf(color) : tokenRGB(canvas, '--ink');
    dot = dotColor ? rgbOf(dotColor) : tokenRGB(canvas, '--accent');
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    base = Math.round(H * o.baseline);
    gain = o.gain(H, base);
    const next = new Float32Array(W).fill(NaN);
    next.set(ys.subarray(0, Math.min(ys.length, W)));
    ys = next;
    if (head >= W) head = o.startX;
    readInk();
    if (reduced || STILL) fillStatic();
    draw();
  }

  // reduced motion / stills: one fully drawn strip
  function fillStatic() {
    const perBeat = (o.speed * 60) / 72;
    for (let x = o.startX; x < W; x++) ys[x] = o.wave(((x - o.startX) / perBeat + 0.6) % 1);
    head = W - 1;
  }

  function write(dt) {
    const from = head;
    const to = head + o.speed * dt;
    const p0 = pulse.prevPhase, p1 = pulse.phase;
    const s0 = pulse.prevSince, s1 = pulse.since;
    const span = W - o.startX;
    for (let x = Math.floor(from) + 1; x <= Math.floor(to); x++) {
      const k = (x - from) / (to - from);
      const since = s0 + (s1 - s0) * k;
      const col = o.startX + ((x - o.startX) % span);
      if (since < pulse.FLATLINE) {
        ys[col] = kind === 'ecg' ? shockTrace(since) : 0.02;
        continue;
      }
      const ph = p0 + (p1 - p0) * k;
      const wander = kind === 'ecg' ? Math.sin(ph * 0.9) * 0.018 + (Math.random() - 0.5) * 0.008 : 0;
      ys[col] = o.wave(ph - Math.floor(ph)) + wander;
    }
    head = to;
    if (head >= W) head = o.startX + (head - W);
  }

  function calibration() {
    // the 1 mV / 200 ms square every ECG printout starts with
    const x0 = 2 * MM, x1 = 7 * MM, top = base - gain;
    ctx.beginPath();
    ctx.moveTo(0, base);
    ctx.lineTo(x0, base);
    ctx.lineTo(x0 + 0.5, top);
    ctx.lineTo(x1, top);
    ctx.lineTo(x1 + 0.5, base);
    ctx.lineTo(o.startX, base);
    ctx.stroke();
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = o.lineWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = rgba(ink);
    if (o.calibration) calibration();

    const gapFrom = Math.floor(head) + 1;
    const gapTo = gapFrom + o.gap;
    const clampY = (y) => Math.max(1, Math.min(H - 1, y));
    ctx.beginPath();
    let pen = false;
    for (let x = o.startX; x < W; x++) {
      const inGap = (x >= gapFrom && x < gapTo) || (gapTo > W && x < o.startX + (gapTo - W));
      const v = ys[x];
      if (inGap || Number.isNaN(v)) { pen = false; continue; }
      const y = clampY(base - v * gain);
      if (pen) ctx.lineTo(x, y); else { ctx.moveTo(x, y); pen = true; }
    }
    ctx.stroke();

    if (!reduced) {
      const hx = Math.floor(head);
      const v = ys[hx];
      if (!Number.isNaN(v)) {
        const y = clampY(base - v * gain);
        ctx.fillStyle = rgba(dot, 0.25);
        ctx.beginPath(); ctx.arc(hx, y, o.dot * 2.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = rgba(dot);
        ctx.beginPath(); ctx.arc(hx, y, o.dot, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);

  if (!reduced) {
    onFrame((dt) => {
      if (!W) return;
      write(dt);                 // keep writing offscreen so the phase never jumps
      if (visible && !document.hidden) draw();
    });
  }
}
