import { onFrame, STILL } from './pulse.js';
import { tokenRGB, hex } from './ink.js';

// Six "specimen plates" — one generative figure per event, drawn in the same
// two-ink language as the heart. Each is deterministic (seeded), draws itself
// in when it scrolls into view, and has a small behaviour on hover/tap that
// says something about the event it labels.

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOut = (t) => 1 - (1 - t) ** 3;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const frac = (x) => x - Math.floor(x);

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

function makeNoise(seed) {
  const rand = rng(seed);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const val = new Float32Array(256).map(() => rand() * 2 - 1);
  const f = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const u = f(x - xi), v = f(y - yi);
    const X = xi & 255, Y = yi & 255;
    const a = val[perm[X + perm[Y]]], b = val[perm[X + 1 + perm[Y]]];
    const c = val[perm[X + perm[Y + 1]]], d = val[perm[X + 1 + perm[Y + 1]]];
    const top = a + (b - a) * u, bot = c + (d - c) * u;
    return top + (bot - top) * v;
  };
}
const fbm = (n, x, y, oct = 4) => {
  let s = 0, amp = 0.5, fq = 1;
  for (let i = 0; i < oct; i++) { s += amp * n(x * fq, y * fq); amp *= 0.5; fq *= 2.03; }
  return s;
};

const mono = (px, w = 500) => `${w} ${px}px "IBM Plex Mono", ui-monospace, monospace`;

function withAlpha(hex, a) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function polyline(ctx, pts, fracDrawn = 1) {
  if (pts.length < 2 || fracDrawn <= 0) return;
  let total = 0;
  const seg = [];
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    seg.push(l); total += l;
  }
  let left = total * clamp(fracDrawn);
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length && left > 0; i++) {
    const l = seg[i - 1];
    if (left >= l) { ctx.lineTo(pts[i][0], pts[i][1]); left -= l; }
    else {
      const k = left / l;
      ctx.lineTo(lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k));
      left = 0;
    }
  }
  ctx.stroke();
}

function pointAlong(pts, f) {
  let total = 0;
  const seg = [];
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    seg.push(l); total += l;
  }
  let d = total * clamp(f);
  for (let i = 1; i < pts.length; i++) {
    if (d <= seg[i - 1]) {
      const k = seg[i - 1] ? d / seg[i - 1] : 0;
      return [lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)];
    }
    d -= seg[i - 1];
  }
  return pts[pts.length - 1];
}

/* ───────────────────────────────────────── 01 · Rorschach inkblot
   Card II of the Rorschach set is a two-ink print — so is this. */
function inkblot(seed) {
  const n = makeNoise(seed);
  return {
    draw(ctx, s) {
      const { w, h, intro, hover, ht, ink, accent } = s;
      const cols = 68;
      const cell = w / cols;
      const rows = Math.ceil(h / cell);
      const level = lerp(0.9, 0, easeOut(intro)) + Math.sin(ht * 2.1) * 0.05 * hover;
      const drift = ht * 0.22;
      // u runs from the fold (0) outward (1); the blot is a few overlapping
      // lobes pushed around by noise, so the edge feathers and the body has holes
      const lobe = (u, v, cu, cv, ru, rv) => 1 - Math.hypot((u - cu) / ru, (v - cv) / rv);

      ctx.strokeStyle = withAlpha(ink, 0.3);
      ctx.setLineDash([3, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(w / 2, h * 0.06); ctx.lineTo(w / 2, h * 0.94); ctx.stroke();
      ctx.setLineDash([]);

      for (let j = 0; j < rows; j++) {
        const y = (j + 0.5) * cell;
        const v = y / h;
        for (let i = 0; i < cols / 2; i++) {
          const x = (i + 0.5) * cell;
          const u0 = Math.abs(x / w - 0.5) * 2;
          const u = u0 + 0.09 * n(u0 * 4.5 + 11, v * 4.5 + drift);
          const vv = v + 0.07 * n(u0 * 4.5 + 23, v * 4.5 - drift);
          const lobes = [
            lobe(u, vv, 0.3, 0.52, 0.34, 0.26),          // main mass
            lobe(u, vv, 0.64, 0.28, 0.2, 0.13) * 0.95,   // upper wing — accent ink
            lobe(u, vv, 0.1, 0.24, 0.1, 0.16) * 0.9,     // head at the fold
            lobe(u, vv, 0.52, 0.72, 0.17, 0.12) * 0.85,  // lower lobe
            lobe(u, vv, 0.13, 0.86, 0.09, 0.08) * 0.85,  // drip — accent ink
          ];
          let top = 0;
          for (let q = 1; q < lobes.length; q++) if (lobes[q] > lobes[top]) top = q;
          const nz = fbm(n, u * 3.4 + 3.1, vv * 4.2 + drift, 5);
          const f = lobes[top] * 1.15 + nz * 0.65 - smooth(0.82, 1, u0) - smooth(0.86, 1, Math.abs(v - 0.5) * 2) - 0.04;
          const k = clamp((f - level) / 0.45);
          if (k <= 0.05) continue;
          const r = cell * 0.64 * Math.sqrt(k);
          ctx.fillStyle = top === 1 || top === 4 ? accent : ink;
          ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
          ctx.beginPath(); ctx.arc(w - x, y, r, 0, TAU); ctx.fill();
        }
      }
    },
  };
}

/* ───────────────────────────────────────── 02 · schematic (cyanotype)
   A chip with fan-out escape routing; on hover, signals run out to the pads. */
function schematic(seed) {
  const rand = rng(seed);
  const traces = [];
  // everything in plate-width units; the plate is 4:3 so its height is 0.75
  const cx = 0.5, cs = 0.24, chipH = cs * 0.75;
  const cy = 0.4;
  const side = (count, fn) => { for (let k = 0; k < count; k++) fn(k, (k - (count - 1) / 2) / ((count - 1) / 2)); };
  // left / right: out, 45° fan-out, then straight to the pads
  for (const dir of [-1, 1]) {
    side(6, (k, o) => {
      const py = cy + (k - 2.5) * (chipH * 0.13);
      const px = cx + (dir * cs) / 2;
      const x1 = px + dir * (0.03 + rand() * 0.015);
      const fan = o * 0.07;
      const x2 = x1 + dir * Math.abs(fan);
      const y2 = py + fan;
      const x3 = dir < 0 ? 0.07 + rand() * 0.04 : 0.93 - rand() * 0.04;
      traces.push([[px, py], [x1, py], [x2, y2], [x3, y2]]);
    });
  }
  // bottom only — the top carries the dimension line
  side(5, (k, o) => {
    const px = cx + (k - 2) * (cs * 0.17);
    const py = cy + chipH / 2;
    const y1 = py + 0.025 + rand() * 0.01;
    const fan = o * 0.09;
    const y2 = y1 + Math.abs(fan) * 0.6;
    traces.push([[px, py], [px, y1], [px + fan, y2], [px + fan, 0.64]]);
  });
  return {
    draw(ctx, s) {
      const { w, h, intro, hover, ht, ink, accent } = s;
      const X = (v) => v * w;
      const minor = w / 32;
      ctx.lineWidth = 1;
      for (let i = 0, x = 0; x <= w + 1; i++, x += minor) {
        ctx.strokeStyle = withAlpha(ink, (i % 4 ? 0.07 : 0.16) * intro);
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let i = 0, y = 0; y <= h + 1; i++, y += minor) {
        ctx.strokeStyle = withAlpha(ink, (i % 4 ? 0.07 : 0.16) * intro);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      const pts = traces.map((t) => t.map(([x, y]) => [X(x), X(y)]));
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.4;
      ctx.lineJoin = 'round';
      pts.forEach((p, i) => {
        const f = clamp(intro * 1.6 - i * 0.025);
        polyline(ctx, p, f);
        if (f >= 1) {
          const [ex, ey] = p[p.length - 1];
          ctx.beginPath(); ctx.arc(ex, ey, w * 0.012, 0, TAU); ctx.stroke();
          ctx.fillStyle = ink;
          ctx.beginPath(); ctx.arc(ex, ey, w * 0.004, 0, TAU); ctx.fill();
        }
      });

      // signals
      if (hover > 0.01) {
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2.4;
        ctx.globalAlpha = hover;
        pts.forEach((p, i) => {
          const f = frac(ht * 0.55 + i * 0.137);
          const a = pointAlong(p, f), b = pointAlong(p, Math.min(1, f + 0.12));
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        });
        ctx.globalAlpha = 1;
      }

      // chip
      const x0 = X(cx - cs / 2), y0 = X(cy - chipH / 2), cw = X(cs), ch = X(chipH);
      ctx.globalAlpha = smooth(0.1, 0.5, intro);
      ctx.fillStyle = s.bg;
      ctx.fillRect(x0, y0, cw, ch);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.6;
      ctx.strokeRect(x0, y0, cw, ch);
      ctx.save();
      ctx.beginPath(); ctx.rect(x0 + 6, y0 + 6, cw - 12, ch - 12); ctx.clip();
      ctx.lineWidth = 1;
      ctx.strokeStyle = withAlpha(ink, 0.28);
      for (let d = -ch; d < cw; d += 7) { ctx.beginPath(); ctx.moveTo(x0 + d, y0 + ch); ctx.lineTo(x0 + d + ch, y0); ctx.stroke(); }
      ctx.restore();
      ctx.beginPath(); ctx.arc(x0 + 12, y0 + 12, 4, 0, TAU); ctx.fillStyle = ink; ctx.fill();
      ctx.fillStyle = s.bg;
      const lab = 'BME·26';
      ctx.font = mono(Math.round(w * 0.034), 600);
      const tw = ctx.measureText(lab).width;
      ctx.fillRect(x0 + cw / 2 - tw / 2 - 6, y0 + ch / 2 - w * 0.026, tw + 12, w * 0.048);
      ctx.fillStyle = hover > 0.5 ? accent : ink;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(lab, x0 + cw / 2, y0 + ch / 2 + 1);

      // dimension line
      const dy = y0 - X(0.09);
      ctx.strokeStyle = withAlpha(ink, 0.8);
      ctx.fillStyle = ink;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0, dy - 5); ctx.lineTo(x0, dy + 5);
      ctx.moveTo(x0 + cw, dy - 5); ctx.lineTo(x0 + cw, dy + 5);
      ctx.moveTo(x0, dy); ctx.lineTo(x0 + cw, dy);
      ctx.stroke();
      ctx.font = mono(Math.round(w * 0.024));
      const dl = '24.00';
      const dw = ctx.measureText(dl).width + 8;
      ctx.fillStyle = s.bg; ctx.fillRect(x0 + cw / 2 - dw / 2, dy - 7, dw, 14);
      ctx.fillStyle = ink; ctx.fillText(dl, x0 + cw / 2, dy + 1);

      // title block
      const tbw = X(0.3), tbh = X(0.075), tbx = w - tbw - X(0.03), tby = h - tbh - X(0.03);
      ctx.strokeStyle = ink;
      ctx.strokeRect(tbx, tby, tbw, tbh);
      ctx.beginPath(); ctx.moveTo(tbx, tby + tbh / 2); ctx.lineTo(tbx + tbw, tby + tbh / 2); ctx.stroke();
      ctx.textAlign = 'left';
      ctx.font = mono(Math.round(w * 0.02));
      ctx.fillText('DWG IGN-02 · REV B', tbx + 6, tby + tbh * 0.27);
      ctx.fillText('SCALE 1:1 · SHT 1/1', tbx + 6, tby + tbh * 0.76);
      ctx.globalAlpha = 1;
    },
  };
}

/* ───────────────────────────────────────── 03 · iris + AR overlay
   The eye tracks the cursor inside a fixed HUD. The pupil constricts as the
   plate comes into view and again when the cursor (a penlight) comes close. */
function iris(seed) {
  const rand = rng(seed);
  const n = makeNoise(seed + 11);
  const fibers = Array.from({ length: 210 }, (_, i) => ({
    a: (i / 210) * TAU + (rand() - 0.5) * 0.02,
    s: rand() * 50,
    al: 0.25 + rand() * 0.6,
    lw: 0.5 + rand() * 0.9,
    len: 0.8 + rand() * 0.2,
  }));
  const crypts = Array.from({ length: 14 }, () => ({ a: rand() * TAU, r: 0.45 + rand() * 0.35, sz: 0.03 + rand() * 0.05 }));
  return {
    draw(ctx, s) {
      const { w, h, intro, hover, ht, ink, accent, bg, look } = s;
      const hx = w / 2, hy = h / 2;                       // HUD stays put
      const R = h * 0.3;
      const cx = hx + look.x * R * 0.16, cy = hy + look.y * R * 0.16;   // the eye moves
      // hippus: the small natural oscillation of a resting pupil
      const dil = lerp(0.78, 0.36, easeOut(intro)) - 0.11 * hover + Math.sin(ht * 1.3 + 1) * 0.015;
      const rp = R * dil;
      const sweep = easeOut(intro) * TAU;

      // HUD ticks
      ctx.strokeStyle = withAlpha(ink, 0.55);
      ctx.lineWidth = 1;
      for (let i = 0; i < 90; i++) {
        const a = (i / 90) * TAU - Math.PI / 2;
        if (a + Math.PI / 2 > sweep) break;
        const l = i % 15 === 0 ? 0.09 : 0.035;
        ctx.beginPath();
        ctx.moveTo(hx + Math.cos(a) * R * 1.16, hy + Math.sin(a) * R * 1.16);
        ctx.lineTo(hx + Math.cos(a) * R * (1.16 + l), hy + Math.sin(a) * R * (1.16 + l));
        ctx.stroke();
      }
      // brackets
      const b = R * 1.38, bl = R * 0.2;
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.4;
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        ctx.beginPath();
        ctx.moveTo(hx + sx * b, hy + sy * (b - bl));
        ctx.lineTo(hx + sx * b, hy + sy * b);
        ctx.lineTo(hx + sx * (b - bl), hy + sy * b);
        ctx.stroke();
      }

      // fibres
      ctx.lineCap = 'round';
      for (const f of fibers) {
        if (f.a > sweep) continue;
        ctx.strokeStyle = withAlpha(ink, f.al);
        ctx.lineWidth = f.lw;
        ctx.beginPath();
        for (let k = 0; k <= 6; k++) {
          const t = k / 6;
          const r = lerp(rp * 1.03, R * 0.97 * f.len + R * 0.03, t);
          const a = f.a + n(f.s, t * 2.4) * 0.07;
          const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
          k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
      // crypts
      ctx.fillStyle = withAlpha(ink, 0.55);
      for (const c of crypts) {
        if (c.a > sweep) continue;
        const r = lerp(rp, R, c.r);
        ctx.save();
        ctx.translate(cx + Math.cos(c.a) * r, cy + Math.sin(c.a) * r);
        ctx.rotate(c.a);
        ctx.beginPath(); ctx.ellipse(0, 0, R * c.sz * 1.6, R * c.sz * 0.6, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }
      // collarette
      const rc = rp + (R - rp) * 0.33;
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      for (let i = 0; i <= 96; i++) {
        const a = (i / 96) * sweep;
        const r = rc * (1 + n(Math.cos(a) * 2 + 5, Math.sin(a) * 2) * 0.09);
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
      // limbus
      ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, sweep); ctx.stroke();
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.03, 0, sweep); ctx.stroke();
      // pupil
      ctx.fillStyle = ink;
      ctx.beginPath(); ctx.arc(cx, cy, rp, 0, TAU); ctx.fill();
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.arc(cx - rp * 0.34, cy - rp * 0.36, rp * 0.15, 0, TAU); ctx.fill();

      // tracking arc
      const a0 = -0.9 + ht * 1.5;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2.2;
      ctx.globalAlpha = 0.35 + 0.65 * hover;
      ctx.beginPath(); ctx.arc(hx, hy, R * 1.3, a0, a0 + 0.9 * intro); ctx.stroke();
      // gaze line from HUD centre to the pupil
      if (hover > 0.05) {
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1;
        ctx.globalAlpha = hover * 0.8;
        ctx.setLineDash([2, 3]);
        ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(cx, cy); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.globalAlpha = 1;

      // readout
      ctx.font = mono(Math.round(w * 0.024));
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = ink;
      ctx.fillText(`PUPIL Ø ${(dil * 11.5).toFixed(1)} MM`, w - w * 0.03, h - h * 0.035);
      if (hover > 0.05) {
        ctx.fillStyle = accent;
        ctx.globalAlpha = hover;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText('● TRACKING', hx + b - 6, hy - b + 6);
        ctx.globalAlpha = 1;
      }
    },
  };
}

/* ───────────────────────────────────────── 04 · theta labyrinth
   A real, solvable maze. Hover and the route to the treasure draws itself. */
function maze(seed) {
  const rand = rng(seed);
  const rings = 7, r0 = 1.25;
  const counts = [8];
  for (let i = 1; i < rings; i++) {
    const prev = counts[i - 1];
    const arc = (TAU * (r0 + i + 0.5)) / prev;
    counts.push(arc > 1.9 ? prev * 2 : prev);
  }
  const offset = [0];
  for (let i = 1; i < rings; i++) offset.push(offset[i - 1] + counts[i - 1]);
  const id = (i, j) => offset[i] + j;
  const total = offset[rings - 1] + counts[rings - 1];
  const neighbours = (i, j) => {
    const nC = counts[i];
    const out = [[i, (j + 1) % nC], [i, (j - 1 + nC) % nC]];
    if (i > 0) out.push([i - 1, Math.floor(j / (counts[i] / counts[i - 1]))]);
    if (i < rings - 1) { const r = counts[i + 1] / counts[i]; for (let k = 0; k < r; k++) out.push([i + 1, j * r + k]); }
    return out;
  };
  const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const open = new Set();
  const seen = new Uint8Array(total);
  const stack = [[rings - 1, 0]];
  seen[id(rings - 1, 0)] = 1;
  while (stack.length) {
    const [i, j] = stack[stack.length - 1];
    const next = neighbours(i, j).filter(([a, b]) => !seen[id(a, b)]);
    if (!next.length) { stack.pop(); continue; }
    const [a, b] = next[Math.floor(rand() * next.length)];
    open.add(key(id(i, j), id(a, b)));
    seen[id(a, b)] = 1;
    stack.push([a, b]);
  }
  const centreDoor = Math.floor(rand() * counts[0]);
  const entry = Math.floor(rand() * counts[rings - 1]);

  // BFS entry → centre door
  const prevOf = new Int32Array(total).fill(-1);
  const cell = (k) => { let i = 0; while (i < rings - 1 && k >= offset[i + 1]) i++; return [i, k - offset[i]]; };
  const start = id(rings - 1, entry), goal = id(0, centreDoor);
  const q = [start]; prevOf[start] = start;
  while (q.length) {
    const k = q.shift();
    if (k === goal) break;
    const [i, j] = cell(k);
    for (const [a, b] of neighbours(i, j)) {
      const nk = id(a, b);
      if (prevOf[nk] === -1 && open.has(key(k, nk))) { prevOf[nk] = k; q.push(nk); }
    }
  }
  const route = [];
  for (let k = goal; ; k = prevOf[k]) { route.unshift(cell(k)); if (k === start) break; }

  const mid = (i, j) => [r0 + i + 0.5, ((j + 0.5) / counts[i]) * TAU];
  // route in polar units (radius in ring widths, angle in radians)
  const polar = [[rings + 0.7, mid(rings - 1, entry)[1]]];
  for (let s = 0; s < route.length; s++) {
    const [i, j] = route[s];
    const [r, a] = mid(i, j);
    if (s === 0) { polar.push([r, a]); continue; }
    const [pi, pj] = route[s - 1];
    const [pr, pa] = mid(pi, pj);
    if (pi === i) {
      let d = a - pa;
      if (d > Math.PI) d -= TAU;
      if (d < -Math.PI) d += TAU;
      for (let k = 1; k <= 6; k++) polar.push([r, pa + (d * k) / 6]);
    } else {
      // pivot at the angle of whichever cell is narrower (the outer one)
      const pivotA = counts[i] > counts[pi] ? a : pa;
      if (pivotA !== pa) {
        let d = pivotA - pa; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU;
        for (let k = 1; k <= 4; k++) polar.push([pr, pa + (d * k) / 4]);
      }
      polar.push([r, pivotA]);
      if (pivotA !== a) {
        let d = a - pivotA; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU;
        for (let k = 1; k <= 4; k++) polar.push([r, pivotA + (d * k) / 4]);
      }
    }
  }
  polar.push([0.35, polar[polar.length - 1][1]]);
  polar.push([0, 0]);

  return {
    draw(ctx, s) {
      const { w, h, intro, hover, ink, accent } = s;
      const cx = w / 2, cy = h / 2;
      const rw = (h * 0.44) / (r0 + rings);
      const P = (r, a) => [cx + Math.cos(a) * r * rw, cy + Math.sin(a) * r * rw];
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1.4, rw * 0.13);
      for (let i = rings - 1; i >= 0; i--) {
        const alpha = clamp(intro * (rings + 2) - (rings - 1 - i));
        if (alpha <= 0) continue;
        ctx.strokeStyle = withAlpha(ink, alpha);
        const nC = counts[i];
        const rin = (r0 + i) * rw, rout = (r0 + i + 1) * rw;
        const ratio = i > 0 ? counts[i] / counts[i - 1] : 1;
        ctx.beginPath();
        for (let j = 0; j < nC; j++) {
          const a0 = (j / nC) * TAU, a1 = ((j + 1) / nC) * TAU;
          const wallIn = i === 0 ? j !== centreDoor : !open.has(key(id(i, j), id(i - 1, Math.floor(j / ratio))));
          if (wallIn) { ctx.moveTo(cx + Math.cos(a0) * rin, cy + Math.sin(a0) * rin); ctx.arc(cx, cy, rin, a0, a1); }
          if (!open.has(key(id(i, j), id(i, (j + 1) % nC)))) {
            ctx.moveTo(cx + Math.cos(a1) * rin, cy + Math.sin(a1) * rin);
            ctx.lineTo(cx + Math.cos(a1) * rout, cy + Math.sin(a1) * rout);
          }
          if (i === rings - 1 && j !== entry) { ctx.moveTo(cx + Math.cos(a0) * rout, cy + Math.sin(a0) * rout); ctx.arc(cx, cy, rout, a0, a1); }
        }
        ctx.stroke();
      }

      // entry marker + treasure
      const ea = mid(rings - 1, entry)[1];
      const [tx, ty] = P(rings + 1.3, ea);
      ctx.fillStyle = withAlpha(ink, intro);
      ctx.save();
      ctx.translate(tx, ty); ctx.rotate(ea + Math.PI);
      ctx.beginPath(); ctx.moveTo(rw * 0.45, 0); ctx.lineTo(-rw * 0.3, -rw * 0.3); ctx.lineTo(-rw * 0.3, rw * 0.3); ctx.closePath(); ctx.fill();
      ctx.restore();

      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(2, rw * 0.2);
      const xr = rw * 0.38;
      ctx.globalAlpha = intro;
      ctx.beginPath(); ctx.moveTo(cx - xr, cy - xr); ctx.lineTo(cx + xr, cy + xr); ctx.moveTo(cx + xr, cy - xr); ctx.lineTo(cx - xr, cy + xr); ctx.stroke();
      ctx.globalAlpha = 1;

      if (hover > 0.001) {
        ctx.strokeStyle = accent;
        ctx.lineWidth = Math.max(2, rw * 0.26);
        ctx.lineJoin = 'round';
        polyline(ctx, polar.map(([r, a]) => P(r, a)), easeInOut(hover));
      }
    },
  };
}

/* ───────────────────────────────────────── 05 · fingerprint + braille
   Baked once per size into an offscreen bitmap (per-pixel ridge field),
   then pressed in from the core and scanned on hover. */
const BRAILLE = { B: [1, 2], I: [2, 4], O: [1, 3, 5], S: [2, 3, 4], Y: [1, 3, 4, 5, 6], N: [1, 3, 4, 5], C: [1, 4] };
function fingerprint(seed) {
  const n = makeNoise(seed), n2 = makeNoise(seed + 5);
  let baked = null, bakedKey = '';
  const marks = [
    { x: 0.0, y: -0.02, t: 'CORE' },
    { x: 0.38, y: 0.3, t: 'DELTA' },
    { x: -0.34, y: -0.36, t: 'RIDGE END' },
    { x: 0.26, y: -0.5, t: 'BIFURCATION' },
  ];

  function bake(w, h, dpr, ink) {
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const img = g.createImageData(W, H);
    const d = img.data;
    const hex = parseInt(ink.replace('#', ''), 16);
    const ir = (hex >> 16) & 255, ig = (hex >> 8) & 255, ib = hex & 255;
    const cx = W * 0.5, cy = H * 0.47, S = H * 0.4;
    const freq = 13.5;
    for (let y = 0; y < H; y++) {
      const Y = (y - cy) / S;
      for (let x = 0; x < W; x++) {
        const X = (x - cx) / S;
        const m = 1 - ((X / 0.7) ** 2 + (Y / 0.95) ** 2);
        if (m <= 0) continue;
        const edge = smooth(0, 0.14, m) * (1 - smooth(0.52, 0.86, Y));
        if (edge <= 0) continue;
        const wx = X + 0.055 * n(X * 3.2, Y * 3.2);
        const wy = Y + 0.055 * n(X * 3.2 + 9, Y * 3.2 + 9);
        const loop = Math.hypot(wx * 1.18, (wy + 0.04) * 0.92);
        const arch = (wy + 0.04) * 0.92 + 0.3 * wx * wx + 0.12;
        const F = lerp(loop, arch, smooth(0.12, 0.5, wy - 0.25 * Math.abs(wx)));
        const ridge = 0.5 + 0.5 * Math.cos(F * TAU * freq);
        let v = smooth(0.42, 0.68, ridge);
        if (n2(X * 40, Y * 40) > 0.6) v *= 0.2;                     // pores
        v *= 0.35 + 0.65 * smooth(-0.5, -0.25, -Math.abs(n(X * 6 + 30, Y * 6)));   // breaks
        const pressure = 0.7 + 0.3 * n(X * 1.8 + 50, Y * 1.8);
        const a = v * edge * pressure;
        const i = (y * W + x) * 4;
        d[i] = ir; d[i + 1] = ig; d[i + 2] = ib; d[i + 3] = a * 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  return {
    draw(ctx, s) {
      const { w, h, dpr, intro, hover, ht, ink, accent } = s;
      const k = `${w}x${h}@${dpr}${ink}`;
      if (k !== bakedKey) { baked = bake(w, h, dpr, ink); bakedKey = k; }
      const cx = w * 0.5, cy = h * 0.47, S = h * 0.4;

      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, easeOut(intro) * S * 1.25, 0, TAU); ctx.clip();
      ctx.drawImage(baked, 0, 0, w, h);
      ctx.restore();

      if (hover > 0.01) {
        const sy = cy + Math.sin(ht * 2.2) * S * 0.8;
        const grd = ctx.createLinearGradient(0, sy - 22, 0, sy);
        grd.addColorStop(0, withAlpha(accent, 0));
        grd.addColorStop(1, withAlpha(accent, 0.22 * hover));
        ctx.fillStyle = grd;
        ctx.fillRect(cx - S * 0.8, sy - 22, S * 1.6, 22);
        ctx.strokeStyle = withAlpha(accent, hover);
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(cx - S * 0.8, sy); ctx.lineTo(cx + S * 0.8, sy); ctx.stroke();

        ctx.font = mono(Math.max(9, Math.round(w * 0.021)));
        ctx.textBaseline = 'middle';
        marks.forEach((m, i) => {
          const a = clamp(hover * 1.6 - i * 0.15);
          if (a <= 0) return;
          const px = cx + m.x * S, py = cy + m.y * S;
          const right = m.x >= 0;
          const lx = right ? w * 0.8 : w * 0.2;
          ctx.globalAlpha = a;
          ctx.strokeStyle = accent;
          ctx.lineWidth = 1.2;
          ctx.strokeRect(px - 4, py - 4, 8, 8);
          ctx.beginPath(); ctx.moveTo(px + (right ? 4 : -4), py); ctx.lineTo(lx, py); ctx.stroke();
          ctx.fillStyle = accent;
          ctx.textAlign = right ? 'left' : 'right';
          ctx.fillText(m.t, lx + (right ? 4 : -4), py);
        });
        ctx.globalAlpha = 1;
      }

      // "BIOSYNC" in braille — the event is identification by touch
      const dot = Math.max(1.6, w * 0.0065), gap = w * 0.017, cellW = gap * 2.4;
      const bx = w - w * 0.04 - cellW * 7 + gap * 0.4, by = h - h * 0.12;
      [...'BIOSYNC'].forEach((ch, ci) => {
        const on = BRAILLE[ch];
        for (let dIdx = 1; dIdx <= 6; dIdx++) {
          const col = dIdx > 3 ? 1 : 0, row = (dIdx - 1) % 3;
          const x = bx + ci * cellW + col * gap, y = by + row * gap;
          ctx.fillStyle = on.includes(dIdx) ? withAlpha(ink, intro) : withAlpha(ink, 0.14 * intro);
          ctx.beginPath(); ctx.arc(x, y, on.includes(dIdx) ? dot : dot * 0.55, 0, TAU); ctx.fill();
        }
      });
    },
  };
}

/* ───────────────────────────────────────── 06 · aperture / viewfinder
   Seven blades. Hover and the shutter fires — close, flash, frame count +1. */
function aperture() {
  const STOPS = ['2.8', '4', '5.6', '8', '11', '16'];
  return {
    draw(ctx, s) {
      const { w, h, intro, hover, hovering, ht, ink, accent, bg } = s;
      const cx = w / 2, cy = h / 2;
      const R = h * 0.31;
      const base = lerp(0.05, 0.78, easeOut(intro));
      let open = base, flash = 0, frame = 24;
      if (hover > 0.01) {
        const cyc = 1.8;
        const ph = frac(ht / cyc);
        const shut = ph < 0.1 ? 1 - ph / 0.1 : ph < 0.22 ? (ph - 0.1) / 0.12 : 1;
        open = lerp(base, base * shut, hover);
        flash = ph > 0.1 && ph < 0.4 ? (1 - (ph - 0.1) / 0.3) * hover : 0;
        frame = 24 + Math.floor(ht / cyc) + (hovering ? 1 : 0);
      }

      // viewfinder guides
      ctx.strokeStyle = withAlpha(ink, 0.18);
      ctx.lineWidth = 1;
      for (const f of [1 / 3, 2 / 3]) {
        ctx.beginPath(); ctx.moveTo(w * f, h * 0.06); ctx.lineTo(w * f, h * 0.94); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(w * 0.04, h * f); ctx.lineTo(w * 0.96, h * f); ctx.stroke();
      }
      const gw = w * 0.84, gh = (gw * 9) / 16;
      ctx.strokeStyle = withAlpha(ink, 0.55);
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(cx - gw / 2, cy - gh / 2, gw, gh);
      ctx.setLineDash([]);
      ctx.font = mono(Math.max(9, Math.round(w * 0.022)));
      ctx.fillStyle = withAlpha(ink, 0.75);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('16:9', cx - gw / 2 + 5, cy - gh / 2 + 5);
      // 4:3 corner crop marks
      const m = w * 0.045, cl = w * 0.05;
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.6;
      // bottom-left is left free for the figure caption
      for (const [sx, sy] of [[0, 0], [1, 0], [1, 1]]) {
        const x = sx ? w - m : m, y = sy ? h - m : m;
        ctx.beginPath();
        ctx.moveTo(x + (sx ? -cl : cl), y); ctx.lineTo(x, y); ctx.lineTo(x, y + (sy ? -cl : cl));
        ctx.stroke();
      }
      ctx.fillText('4:3', m + 6, m + 6);

      // subject behind the blades
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.2, 0, TAU); ctx.fill();

      // blades
      const N = 7;
      const r = R * (0.05 + 0.82 * open);
      const rot = open * 0.9;
      const V = Array.from({ length: N }, (_, k) => {
        const a = (k / N) * TAU + rot;
        return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
      });
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, TAU);
      ctx.moveTo(V[0][0], V[0][1]);
      for (let k = N - 1; k >= 0; k--) ctx.lineTo(V[k][0], V[k][1]);
      ctx.closePath();
      ctx.fill('evenodd');
      ctx.strokeStyle = bg;
      ctx.lineWidth = 1.2;
      for (let k = 0; k < N; k++) {
        const A = V[k], B = V[(k + 1) % N];
        const dx = B[0] - A[0], dy = B[1] - A[1];
        const L = Math.hypot(dx, dy) || 1;
        const ux = dx / L, uy = dy / L;
        const ox = A[0] - cx, oy = A[1] - cy;
        const bb = ox * ux + oy * uy;
        const cc = ox * ox + oy * oy - R * R;
        const t = -bb + Math.sqrt(Math.max(0, bb * bb - cc));
        ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(A[0] + ux * t, A[1] + uy * t); ctx.stroke();
      }

      // barrel + scale
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.02, 0, TAU); ctx.stroke();
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.12, 0, TAU); ctx.stroke();
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * TAU;
        const l = i % 5 ? 0.03 : 0.06;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * R * 1.12, cy + Math.sin(a) * R * 1.12);
        ctx.lineTo(cx + Math.cos(a) * R * (1.12 + l), cy + Math.sin(a) * R * (1.12 + l));
        ctx.stroke();
      }
      ctx.font = mono(Math.max(8, Math.round(w * 0.02)));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = ink;
      STOPS.forEach((st, i) => {
        const a = lerp(-2.55, -0.6, i / (STOPS.length - 1));
        ctx.fillText(st, cx + Math.cos(a) * R * 1.3, cy + Math.sin(a) * R * 1.3);
      });
      const fIdx = clamp(1 - (open - 0.05) / 0.75) * (STOPS.length - 1);
      const ia = lerp(-2.55, -0.6, fIdx / (STOPS.length - 1));
      ctx.fillStyle = accent;
      ctx.save();
      ctx.translate(cx + Math.cos(ia) * R * 1.19, cy + Math.sin(ia) * R * 1.19);
      ctx.rotate(ia + Math.PI / 2);
      ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(-4, -3); ctx.lineTo(4, -3); ctx.closePath(); ctx.fill();
      ctx.restore();

      // readouts
      const fnum = lerp(2.8, 16, clamp(1 - (open - 0.05) / 0.75));
      ctx.font = mono(Math.max(9, Math.round(w * 0.022)));
      ctx.fillStyle = ink;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(`1/250  ƒ/${fnum.toFixed(1)}  ISO 100`, w - m - 6, h - m - 6);
      ctx.textBaseline = 'top';
      ctx.fillStyle = hover > 0.5 ? accent : ink;
      ctx.fillText(`[ ${String(frame).padStart(3, '0')} ]`, w - m - 6, m + 6);

      if (flash > 0) { ctx.fillStyle = withAlpha(bg, flash * 0.9); ctx.fillRect(0, 0, w, h); }
    },
  };
}

const PAINTERS = { inkblot: () => inkblot(9), schematic: () => schematic(26), iris: () => iris(3), maze: () => maze(1026), fingerprint: () => fingerprint(71), aperture };

export function initPlates({ reduced }) {
  const plates = [];
  const pointer = { x: -1e4, y: -1e4 };
  window.addEventListener('pointermove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; }, { passive: true });
  for (const canvas of document.querySelectorAll('canvas[data-plate]')) {
    const make = PAINTERS[canvas.dataset.plate];
    if (!make) continue;
    const fig = canvas.parentElement;
    const card = canvas.closest('.spec') || fig;
    const p = {
      canvas,
      ctx: canvas.getContext('2d'),
      painter: make(),
      ink: hex(tokenRGB(fig, '--plate-ink')),
      accent: hex(tokenRGB(fig, '--plate-accent')),
      bg: hex(tokenRGB(fig, '--plate-bg')),
      tracks: canvas.dataset.plate === 'iris',
      look: { x: 0, y: 0 },
      w: 0, h: 0, dpr: 1,
      intro: reduced || STILL ? 1 : 0, started: reduced || STILL, hover: 0, hovering: false, ht: 0,
      visible: false, dirty: true,
    };
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      p.dpr = Math.min(2, window.devicePixelRatio || 1);
      p.w = Math.max(1, Math.round(r.width));
      p.h = Math.max(1, Math.round(r.height));
      canvas.width = Math.round(p.w * p.dpr);
      canvas.height = Math.round(p.h * p.dpr);
      p.dirty = true;
    };
    new ResizeObserver(resize).observe(canvas);
    new IntersectionObserver(([e]) => {
      p.visible = e.isIntersecting;
      if (e.isIntersecting && !p.started) { p.started = true; }
      if (e.isIntersecting) p.dirty = true;
    }, { rootMargin: '0px 0px -12% 0px' }).observe(canvas);
    card.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') p.hovering = true; });
    card.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') p.hovering = false; });
    // touch: tap the figure to play its behaviour
    fig.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      p.hovering = !p.hovering;
    });
    card.addEventListener('focusin', () => { p.hovering = true; });
    card.addEventListener('focusout', () => { p.hovering = false; });
    plates.push(p);
  }

  document.fonts?.ready.then(() => plates.forEach((p) => { p.dirty = true; }));

  onFrame((dt) => {
    for (const p of plates) {
      if (!p.visible || !p.w) continue;
      const introing = p.started && p.intro < 1;
      if (introing) p.intro = Math.min(1, p.intro + dt / 1.5);
      const target = p.hovering ? 1 : 0;
      const moving = Math.abs(p.hover - target) > 0.002;
      if (moving) p.hover += (target - p.hover) * Math.min(1, dt * (p.hovering ? 2.2 : 4));
      else p.hover = target;
      if (p.hover > 0 && !reduced) p.ht += dt;
      if (!p.hovering && p.hover === 0) p.ht = 0;
      let looking = false;
      if (p.tracks && !reduced) {
        const r = p.canvas.getBoundingClientRect();
        const tx = clamp((pointer.x - (r.left + r.width / 2)) / (r.width * 0.9), -1, 1);
        const ty = clamp((pointer.y - (r.top + r.height / 2)) / (r.height * 0.9), -1, 1);
        looking = Math.abs(tx - p.look.x) + Math.abs(ty - p.look.y) > 0.002;
        p.look.x += (tx - p.look.x) * Math.min(1, dt * 6);
        p.look.y += (ty - p.look.y) * Math.min(1, dt * 6);
      }
      if (!(p.dirty || introing || moving || looking || (p.hover > 0 && !reduced))) continue;
      const { ctx } = p;
      ctx.setTransform(p.dpr, 0, 0, p.dpr, 0, 0);
      ctx.clearRect(0, 0, p.w, p.h);
      p.painter.draw(ctx, {
        w: p.w, h: p.h, dpr: p.dpr,
        intro: p.intro, hover: p.hover, hovering: p.hovering, ht: p.ht,
        ink: p.ink, accent: p.accent, bg: p.bg, look: p.look,
      });
      p.dirty = false;
    }
  });
}
