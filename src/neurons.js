import { pulse, onFrame, STILL } from './pulse.js';
import { tokenRGB, rgba } from './ink.js';

// A sparse cortical network behind the footer. Somata with branching
// dendrites, axons as curves to their nearest neighbours. An action potential
// travels down each axon; on arrival the target fires unless it is still
// refractory. The cursor (or a tap) depolarises nearby cells, and a few cells
// fire spontaneously, some of them on the heartbeat.

const TAU = Math.PI * 2;
const REFRACTORY = 1.1;
const SPEED = 320; // px/s — conduction, scaled for the eye

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function initNeurons(canvas, { reduced }) {
  const host = canvas.parentElement;
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, visible = false, clock = 0;
  let cells = [], axons = [], spikes = [];
  let INK = [244, 247, 255, 1], ACC = [143, 230, 255, 1];
  let still = null;                 // cached static layer
  const probe = { x: -1e4, y: -1e4 };

  function build() {
    const r = rng(1906);             // Cajal's Nobel year
    const cols = Math.max(4, Math.round(W / 190)), rows = Math.max(3, Math.round(H / 170));
    cells = [];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        if (r() < 0.18) continue;
        const x = ((i + 0.5 + (r() - 0.5) * 0.8) / cols) * W;
        const y = ((j + 0.5 + (r() - 0.5) * 0.8) / rows) * H;
        const dend = [];
        const grow = (x0, y0, a, len, depth) => {
          const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len;
          dend.push([x0, y0, x1, y1, depth]);
          if (depth < 3) {
            grow(x1, y1, a + 0.3 + r() * 0.5, len * (0.55 + r() * 0.2), depth + 1);
            grow(x1, y1, a - 0.3 - r() * 0.5, len * (0.55 + r() * 0.2), depth + 1);
          }
        };
        const n = 4 + Math.floor(r() * 3);
        for (let k = 0; k < n; k++) grow(x, y, (k / n) * TAU + r() * 0.6, 18 + r() * 16, 0);
        cells.push({ x, y, r: 3.2 + r() * 2.4, dend, last: -9, glow: 0, heart: r() < 0.08, spont: 4 + r() * 9, next: r() * 8 });
      }
    }
    axons = [];
    cells.forEach((c, i) => {
      const near = cells
        .map((d, j) => [j, (d.x - c.x) ** 2 + (d.y - c.y) ** 2])
        .filter(([j]) => j !== i)
        .sort((a, b) => a[1] - b[1])
        .slice(0, 2);
      for (const [j] of near) {
        const d = cells[j];
        const mx = (c.x + d.x) / 2, my = (c.y + d.y) / 2;
        const nx = -(d.y - c.y), ny = d.x - c.x;
        const bend = (r() - 0.5) * 0.5;
        const cp = [mx + nx * bend, my + ny * bend];
        const pts = [];
        for (let s = 0; s <= 24; s++) {
          const u = s / 24;
          pts.push([
            (1 - u) ** 2 * c.x + 2 * (1 - u) * u * cp[0] + u * u * d.x,
            (1 - u) ** 2 * c.y + 2 * (1 - u) * u * cp[1] + u * u * d.y,
          ]);
        }
        let len = 0;
        for (let s = 1; s < pts.length; s++) len += Math.hypot(pts[s][0] - pts[s - 1][0], pts[s][1] - pts[s - 1][1]);
        axons.push({ from: i, to: j, pts, len });
      }
    });
  }

  function bakeStill() {
    still = document.createElement('canvas');
    still.width = W * dpr; still.height = H * dpr;
    const g = still.getContext('2d');
    g.scale(dpr, dpr);
    g.lineCap = 'round';
    for (const a of axons) {
      g.strokeStyle = rgba(INK, 0.12);
      g.lineWidth = 1;
      g.beginPath();
      a.pts.forEach(([x, y], s) => (s ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.stroke();
    }
    for (const c of cells) {
      for (const [x0, y0, x1, y1, d] of c.dend) {
        g.strokeStyle = rgba(INK, 0.3 - d * 0.06);
        g.lineWidth = 1.6 - d * 0.35;
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      }
    }
  }

  function resize() {
    const r = host.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.round(r.width); H = Math.round(r.height);
    canvas.width = W * dpr; canvas.height = H * dpr;
    INK = tokenRGB(host, '--ink');
    ACC = tokenRGB(host, '--accent');
    build();
    bakeStill();
    draw();
  }

  function fire(i) {
    const c = cells[i];
    if (clock - c.last < REFRACTORY) return;
    c.last = clock;
    c.glow = 1;
    for (const a of axons) if (a.from === i) spikes.push({ a, d: 0 });
  }

  function at(pts, len, d) {
    let acc = 0;
    for (let s = 1; s < pts.length; s++) {
      const l = Math.hypot(pts[s][0] - pts[s - 1][0], pts[s][1] - pts[s - 1][1]);
      if (acc + l >= d) { const k = (d - acc) / l; return [pts[s - 1][0] + (pts[s][0] - pts[s - 1][0]) * k, pts[s - 1][1] + (pts[s][1] - pts[s - 1][1]) * k]; }
      acc += l;
    }
    return pts[pts.length - 1];
  }

  function draw() {
    if (!W || !still) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(still, 0, 0, W, H);
    // spikes with a short myelinated-looking trail
    for (const s of spikes) {
      for (let k = 0; k < 5; k++) {
        const [x, y] = at(s.a.pts, s.a.len, Math.max(0, s.d - k * 7));
        ctx.fillStyle = rgba(ACC, 1 - k * 0.2);
        ctx.beginPath(); ctx.arc(x, y, 2.6 - k * 0.35, 0, TAU); ctx.fill();
      }
    }
    for (const c of cells) {
      if (c.glow > 0.01) {
        ctx.fillStyle = rgba(ACC, 0.18 * c.glow);
        ctx.beginPath(); ctx.arc(c.x, c.y, c.r + 16 * c.glow, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = c.glow > 0.05 ? rgba(ACC, 0.6 + 0.4 * c.glow) : rgba(INK, 0.55);
      ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, TAU); ctx.fill();
    }
  }

  const poke = (e) => {
    const r = host.getBoundingClientRect();
    probe.x = e.clientX - r.left; probe.y = e.clientY - r.top;
    cells.forEach((c, i) => { if ((c.x - probe.x) ** 2 + (c.y - probe.y) ** 2 < 70 ** 2) fire(i); });
  };
  host.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') poke(e); });
  host.addEventListener('pointerdown', poke);

  new ResizeObserver(resize).observe(host);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(host);
  if (reduced || STILL) return;
  onFrame((dt) => {
    if (!visible || document.hidden || !W) return;
    clock += dt;
    for (const s of spikes) s.d += SPEED * dt;
    const arrived = spikes.filter((s) => s.d >= s.a.len);
    spikes = spikes.filter((s) => s.d < s.a.len);
    // fire after filtering, so the new spikes land in the live list
    for (const s of arrived) if (Math.random() < 0.48) fire(s.a.to);   // branching ~0.96: lively but subcritical
    if (spikes.length > 60) spikes.splice(0, spikes.length - 60);
    const rw = pulse.rWave;
    cells.forEach((c, i) => {
      c.glow *= Math.exp(-dt * 3.5);
      if (clock > c.next) { c.next = clock + c.spont; fire(i); }
      if (rw && c.heart) fire(i);
    });
    draw();
  });
}
