import { onFrame, STILL } from './pulse.js';

// A bright-field microscope view of a buccal (cheek) smear stained with
// methylene blue — the first slide every biology student makes. Cells are
// vector shapes in slide coordinates, so the view stays sharp at 1000×.
// Mouse pans the stage; click/tap swaps objective (400× ↔ 1000×).

const TAU = Math.PI * 2;
const SLIDE = 2400;            // slide size, px at 400×
const UM = 2;                  // px per µm at 400×

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

function makeSlide() {
  const r = rng(404);
  const cells = [];
  const pts = [];
  // loose poisson-disc scatter: squames drift apart in the mounting fluid
  for (let tries = 0; tries < 6000 && pts.length < 340; tries++) {
    const x = r() * SLIDE, y = r() * SLIDE;
    if (pts.every(([px, py]) => (px - x) ** 2 + (py - y) ** 2 > 84 ** 2)) pts.push([x, y]);
  }
  for (const [x, y] of pts) {
    const R = (24 + r() * 10) * UM;                 // squames ~50–70 µm across
    const n = 8 + Math.floor(r() * 4);
    const rot = r() * TAU;
    const poly = [];
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * TAU + (r() - 0.5) * 0.45;
      const rr = R * (0.72 + r() * 0.42);
      poly.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    const na = r() * TAU, nd = r() * R * 0.22;
    const granules = Array.from({ length: 22 }, () => {
      const a = r() * TAU, d = Math.sqrt(r()) * R * 0.75;
      return [Math.cos(a) * d, Math.sin(a) * d, 0.6 + r() * 1.1];
    });
    const fold = r() < 0.45 ? { a: r() * TAU, off: (r() - 0.5) * R * 0.8, len: R * (0.6 + r() * 0.6), bend: (r() - 0.5) * R * 0.5 } : null;
    const bacteria = r() < 0.5 ? Array.from({ length: 6 + Math.floor(r() * 14) }, () => {
      const a = r() * TAU, d = R * (0.5 + r() * 0.5);
      return [Math.cos(a) * d + (r() - 0.5) * 14, Math.sin(a) * d + (r() - 0.5) * 14];
    }) : [];
    cells.push({
      x, y, R, poly,
      nuc: { x: Math.cos(na) * nd, y: Math.sin(na) * nd, rx: (4 + r() * 1.6) * UM, ry: (3 + r() * 1.2) * UM, rot: r() * TAU },
      tint: 0.24 + r() * 0.14,
      granules, fold, bacteria,
    });
  }
  // free-floating debris
  const debris = Array.from({ length: 320 }, () => [r() * SLIDE, r() * SLIDE, 0.5 + r() * 1.4]);
  return { cells, debris };
}

function smoothPoly(ctx, poly, ox, oy, s) {
  const n = poly.length;
  const mid = (i) => [(poly[i][0] + poly[(i + 1) % n][0]) / 2, (poly[i][1] + poly[(i + 1) % n][1]) / 2];
  let m = mid(n - 1);
  ctx.moveTo(ox + m[0] * s, oy + m[1] * s);
  for (let i = 0; i < n; i++) {
    m = mid(i);
    ctx.quadraticCurveTo(ox + poly[i][0] * s, oy + poly[i][1] * s, ox + m[0] * s, oy + m[1] * s);
  }
  ctx.closePath();
}

export function initScope(fig, { reduced }) {
  const canvas = fig.querySelector('canvas');
  const eye = fig.querySelector('.scope__eye');
  const magLabel = document.getElementById('scope-mag');
  const ctx = canvas.getContext('2d');
  const slide = makeSlide();
  let D = 0, dpr = 1, visible = false, dirty = true;
  const view = { x: SLIDE / 2, y: SLIDE / 2, z: 1 };
  const target = { x: SLIDE / 2, y: SLIDE / 2, z: 1 };
  let hoverOff = null, t = 0, blur = 0;

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    D = Math.round(r.width);
    canvas.width = canvas.height = Math.round(D * dpr);
    dirty = true;
  }

  function draw() {
    const s = view.z;
    const R = D / 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, D, D);
    ctx.save();
    ctx.beginPath(); ctx.arc(R, R, R, 0, TAU); ctx.clip();

    // bright field with a condenser falloff
    const bg = ctx.createRadialGradient(R * 0.92, R * 0.88, 0, R, R, R);
    bg.addColorStop(0, '#f1f6ff');
    bg.addColorStop(0.7, '#dfe9ff');
    bg.addColorStop(1, '#a9bde8');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, D, D);
    if (blur > 0.05) ctx.filter = `blur(${blur.toFixed(2)}px)`;

    const vx = view.x - R / s, vy = view.y - R / s;
    const toX = (x) => (x - vx) * s, toY = (y) => (y - vy) * s;

    for (const [x, y, rr] of slide.debris) {
      const X = toX(x), Y = toY(y);
      if (X < -4 || Y < -4 || X > D + 4 || Y > D + 4) continue;
      ctx.fillStyle = 'rgba(40,70,170,0.35)';
      ctx.beginPath(); ctx.arc(X, Y, rr * s, 0, TAU); ctx.fill();
    }

    for (const c of slide.cells) {
      const X = toX(c.x), Y = toY(c.y);
      const reach = c.R * 1.2 * s;
      if (X < -reach || Y < -reach || X > D + reach || Y > D + reach) continue;
      // cytoplasm
      ctx.beginPath();
      smoothPoly(ctx, c.poly, X, Y, s);
      ctx.fillStyle = `rgba(70,115,235,${c.tint})`;
      ctx.fill();
      ctx.lineWidth = 1.1 * Math.min(1.6, s);
      ctx.strokeStyle = 'rgba(28,56,180,0.7)';
      ctx.stroke();
      // fold
      if (c.fold) {
        const { a, off, len, bend } = c.fold;
        const cx = X + Math.cos(a + 1.57) * off * s, cy = Y + Math.sin(a + 1.57) * off * s;
        ctx.beginPath();
        ctx.moveTo(cx - Math.cos(a) * len * 0.5 * s, cy - Math.sin(a) * len * 0.5 * s);
        ctx.quadraticCurveTo(cx + Math.cos(a + 1.57) * bend * s, cy + Math.sin(a + 1.57) * bend * s, cx + Math.cos(a) * len * 0.5 * s, cy + Math.sin(a) * len * 0.5 * s);
        ctx.strokeStyle = 'rgba(32,64,190,0.28)';
        ctx.stroke();
      }
      // granules
      ctx.fillStyle = 'rgba(30,60,170,0.28)';
      for (const [gx, gy, gr] of c.granules) {
        ctx.beginPath(); ctx.arc(X + gx * s, Y + gy * s, gr * Math.min(1.8, s), 0, TAU); ctx.fill();
      }
      // nucleus: dense, with chromatin speckle at high power
      ctx.save();
      ctx.translate(X + c.nuc.x * s, Y + c.nuc.y * s);
      ctx.rotate(c.nuc.rot);
      ctx.beginPath(); ctx.ellipse(0, 0, c.nuc.rx * s, c.nuc.ry * s, 0, 0, TAU);
      ctx.fillStyle = 'rgba(16,36,130,0.88)';
      ctx.fill();
      if (s > 1.4) {
        ctx.fillStyle = 'rgba(8,20,80,0.6)';
        for (let i = 0; i < 7; i++) {
          const a = i * 2.4, d = (i % 3) * 0.28;
          ctx.beginPath(); ctx.arc(Math.cos(a) * c.nuc.rx * d * s, Math.sin(a) * c.nuc.ry * d * s, 1.1 * s, 0, TAU); ctx.fill();
        }
      }
      ctx.restore();
      // oral bacteria clinging to the squame
      ctx.fillStyle = 'rgba(12,30,110,0.75)';
      for (const [bx, by] of c.bacteria) {
        ctx.beginPath(); ctx.arc(X + bx * s, Y + by * s, 0.9 * Math.max(1, s * 0.9), 0, TAU); ctx.fill();
      }
    }
    ctx.filter = 'none';

    // vignette
    const vg = ctx.createRadialGradient(R, R, R * 0.78, R, R, R);
    vg.addColorStop(0, 'rgba(8,19,56,0)');
    vg.addColorStop(1, 'rgba(8,19,56,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, D, D);

    // reticle + scale bar
    ctx.strokeStyle = 'rgba(10,22,51,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(R, R * 0.35); ctx.lineTo(R, R * 1.65);
    ctx.moveTo(R * 0.35, R); ctx.lineTo(R * 1.65, R);
    ctx.stroke();
    for (let i = -6; i <= 6; i++) {
      const l = i % 5 === 0 ? 7 : 4;
      ctx.beginPath(); ctx.moveTo(R + i * 10, R - l); ctx.lineTo(R + i * 10, R + l); ctx.stroke();
    }
    const bar = 20 * UM * s;               // 20 µm
    const bx = R - bar / 2, by = D * 0.82;
    ctx.fillStyle = '#0a1633';
    ctx.fillRect(bx, by, bar, 3);
    ctx.font = '600 10px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('20 µm', R, by - 7);
    ctx.restore();
  }

  function toggleZoom() {
    target.z = target.z > 1.5 ? 1 : 2.5;
    blur = 3;                                   // refocus as the objective swings in
    fig.classList.toggle('is-zoomed', target.z > 1.5);
    if (magLabel) magLabel.textContent = target.z > 1.5 ? '1000×' : '400×';
  }

  eye.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const r = eye.getBoundingClientRect();
    hoverOff = [(e.clientX - r.left) / r.width - 0.5, (e.clientY - r.top) / r.height - 0.5];
  });
  eye.addEventListener('pointerleave', () => { hoverOff = null; });
  eye.addEventListener('click', toggleZoom);

  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; dirty = true; }).observe(canvas);

  const start = { x: SLIDE / 2, y: SLIDE / 2 };
  onFrame((dt) => {
    if (!visible || !D) return;
    let moving = false;
    if (!reduced && !STILL) {
      t += dt;
      // the stage drifts on its own; the cursor steers it
      const driftX = start.x + Math.sin(t * 0.05) * 420 + Math.sin(t * 0.13) * 90;
      const driftY = start.y + Math.cos(t * 0.04) * 380;
      if (hoverOff) {
        start.x = Math.max(700, Math.min(SLIDE - 700, start.x + hoverOff[0] * dt * 260));
        start.y = Math.max(700, Math.min(SLIDE - 700, start.y + hoverOff[1] * dt * 260));
      }
      target.x = driftX; target.y = driftY;
      const k = Math.min(1, dt * 2.4);
      const dz = target.z - view.z;
      view.x += (target.x - view.x) * k;
      view.y += (target.y - view.y) * k;
      view.z += dz * Math.min(1, dt * 5);
      blur = Math.max(0, blur - dt * 6);
      moving = true;
    } else if (Math.abs(target.z - view.z) > 0.001) {
      view.z = target.z;
      moving = true;
    }
    if (moving || dirty) { draw(); dirty = false; }
  });
}
