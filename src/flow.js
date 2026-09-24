import { pulse, onFrame, STILL } from './pulse.js';
import { tokenRGB, rgba } from './ink.js';

// Longitudinal section of an arteriole. Flow is laminar (Poiseuille): cells
// in the centre stream fastest, cells near the wall crawl and tumble harder
// (shear is highest there). Velocity surges on every systole of the shared
// pulse and the vessel wall dilates with it. Leukocytes marginate and roll
// along the endothelium. The cursor displaces cells like a probe.

const TAU = Math.PI * 2;

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

export function initFlow(canvas, { reduced }) {
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, sc = 1, visible = false, t = 0;
  let cells = [], muscle = [];
  let INK = [234, 240, 255, 1], ACC = [98, 214, 255, 1];
  const probe = { x: -1e4, y: -1e4, on: false };

  function build() {
    const r = rng(7);
    cells = [];
    const nR = Math.round(W / 11);
    for (let i = 0; i < nR; i++) cells.push({ k: 'rbc', x: r() * W, lane: (r() * 2 - 1) * 0.9, z: 0.72 + r() * 0.5, phi: r() * TAU, spin: (r() - 0.5) * 4, dy: 0, vy: 0 });
    for (let i = 0; i < Math.max(2, Math.round(W / 480)); i++) cells.push({ k: 'wbc', x: r() * W, lane: (r() < 0.5 ? -1 : 1) * (0.7 + r() * 0.08), z: 1, phi: r() * TAU, spin: 0.6, dy: 0, vy: 0 });
    for (let i = 0; i < Math.round(W / 50); i++) cells.push({ k: 'plt', x: r() * W, lane: (r() * 2 - 1) * 0.9, z: 0.8 + r() * 0.4, phi: r() * TAU, spin: (r() - 0.5) * 3, dy: 0, vy: 0 });
    cells.sort((a, b) => a.z - b.z);
    muscle = [];
    for (let x = -20; x < W + 40; x += 22 + r() * 10) muscle.push({ x, row: r() < 0.5 ? 0 : 1, len: 14 + r() * 10, off: r() * 3 });
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.round(r.width); H = Math.round(r.height);
    canvas.width = W * dpr; canvas.height = H * dpr;
    sc = H / 220;
    INK = tokenRGB(canvas, '--ink');
    ACC = tokenRGB(canvas, '--accent');
    build();
    draw(0);
  }

  function wall(cy, R, dir) {
    const thick = 26 * sc;
    const yI = cy + dir * R;                        // intima
    ctx.save();
    // media: smooth muscle, cut lengthwise
    for (const m of muscle) {
      const y = yI + dir * (7 + m.row * 9 + m.off) * sc;
      ctx.beginPath();
      ctx.ellipse(m.x, y, m.len * 0.5 * sc, 2.6 * sc, 0, 0, TAU);
      ctx.fillStyle = rgba(ACC, 0.1);
      ctx.fill();
      ctx.strokeStyle = rgba(ACC, 0.28);
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.fillStyle = rgba(INK, 0.45);
      ctx.beginPath(); ctx.ellipse(m.x, y, 2.6 * sc, 1 * sc, 0, 0, TAU); ctx.fill();
    }
    // internal elastic lamina — wavy, and it breathes with the pulse
    ctx.strokeStyle = rgba(INK, 0.85);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 6) {
      const y = yI + Math.sin(x * 0.045 + t * 0.6) * 1.4;
      x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    // endothelial nuclei
    ctx.fillStyle = rgba(INK, 0.7);
    for (let x = 18; x < W; x += 58) {
      ctx.beginPath(); ctx.ellipse(x, yI + dir * 2.2, 6 * sc, 1.5 * sc, 0, 0, TAU); ctx.fill();
    }
    // adventitia
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = rgba(INK, 0.22);
    ctx.lineWidth = 1;
    for (const k of [1, 1.35]) {
      ctx.beginPath(); ctx.moveTo(0, yI + dir * thick * k); ctx.lineTo(W, yI + dir * thick * k); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  function draw(dt) {
    if (!W) return;
    const beat = pulse.beat;
    const flat = pulse.flatline;
    const cy = H / 2;
    const R = H * 0.33 * (1 + beat * 0.03);
    const surge = flat ? 0.12 : 0.42 + beat * 1.1;
    const vmax = Math.max(90, W * 0.085);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // lumen
    const lg = ctx.createLinearGradient(0, cy - R, 0, cy + R);
    lg.addColorStop(0, rgba(ACC, 0.04));
    lg.addColorStop(0.5, rgba(ACC, 0.11));
    lg.addColorStop(1, rgba(ACC, 0.04));
    ctx.fillStyle = lg;
    ctx.fillRect(0, cy - R, W, 2 * R);
    wall(cy, R, -1);
    wall(cy, R, 1);

    for (const c of cells) {
      const size = (c.k === 'rbc' ? 8.5 : c.k === 'wbc' ? 15 : 2.2) * c.z * sc;
      let y = cy + c.lane * (R - size) + c.dy;
      const rn = Math.max(-1, Math.min(1, (y - cy) / R));
      if (dt) {
        let v = vmax * (1 - rn * rn) * surge;
        if (c.k === 'wbc') v = v * 0.35 + 6;      // rolling on selectins
        // probe
        if (probe.on) {
          const dx = c.x - probe.x, dyp = y - probe.y;
          const d = Math.hypot(dx, dyp) || 1;
          const reach = 110 * Math.max(0.8, sc);
          if (d < reach) {
            const f = (1 - d / reach) ** 2;
            c.vy += (dyp / d) * f * 900 * dt;
            v *= 1 - f * 0.8;
          }
        }
        c.vy += -c.dy * 10 * dt;
        c.vy *= Math.exp(-dt * 5);
        c.dy += c.vy * dt;
        const lim = R - size;
        const yy = c.lane * lim + c.dy;
        if (Math.abs(yy) > lim) c.dy = Math.sign(yy) * lim - c.lane * lim;
        c.x += v * dt;
        if (c.x > W + 30) c.x -= W + 60;
        c.phi += c.spin * (0.3 + 2.2 * Math.abs(rn)) * (0.4 + surge) * dt;
        y = cy + c.lane * lim + c.dy;
      }

      if (c.k === 'rbc') {
        const face = Math.abs(Math.cos(c.phi));
        const rx = size, ry = size * Math.max(0.3, face);
        const tilt = Math.sin(c.phi * 0.5) * 0.5;
        ctx.save();
        ctx.translate(c.x, y);
        ctx.rotate(tilt);
        ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
        ctx.fillStyle = `rgba(63,107,255,${0.45 + 0.5 * c.z - 0.2})`;
        ctx.fill();
        ctx.lineWidth = 1.1;
        ctx.strokeStyle = 'rgba(157,185,255,0.9)';
        ctx.stroke();
        if (face > 0.45) {   // central pallor of the biconcave disc
          ctx.beginPath(); ctx.ellipse(0, 0, rx * 0.45, ry * 0.45, 0, 0, TAU);
          ctx.fillStyle = `rgba(18,40,150,${0.6 * (face - 0.45) / 0.55})`;
          ctx.fill();
        }
        ctx.restore();
      } else if (c.k === 'wbc') {
        ctx.beginPath(); ctx.arc(c.x, y, size, 0, TAU);
        ctx.fillStyle = rgba(INK, 0.88);
        ctx.fill();
        ctx.strokeStyle = rgba(INK, 1);
        ctx.lineWidth = 1;
        ctx.stroke();
        // multilobed nucleus (neutrophil), turning as it rolls
        ctx.fillStyle = '#3b52d8';
        for (let i = 0; i < 3; i++) {
          const a = c.phi + i * 2.1;
          ctx.beginPath(); ctx.arc(c.x + Math.cos(a) * size * 0.42, y + Math.sin(a) * size * 0.42, size * 0.3, 0, TAU); ctx.fill();
        }
        ctx.fillStyle = 'rgba(59,82,216,0.45)';
        for (let i = 0; i < 8; i++) {
          const a = i * 0.8 + c.phi * 0.3;
          ctx.beginPath(); ctx.arc(c.x + Math.cos(a) * size * 0.75, y + Math.sin(a) * size * 0.75, 1.1, 0, TAU); ctx.fill();
        }
      } else {
        ctx.save();
        ctx.translate(c.x, y);
        ctx.rotate(c.phi);
        ctx.fillStyle = rgba(ACC, 0.9);
        ctx.fillRect(-size, -size * 0.6, size * 2, size * 1.2);
        ctx.restore();
      }
    }

    // probe ring
    if (probe.on) {
      ctx.strokeStyle = rgba(ACC, 0.6);
      ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.arc(probe.x, probe.y, 24, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  const setProbe = (e) => {
    const r = canvas.getBoundingClientRect();
    probe.x = e.clientX - r.left; probe.y = e.clientY - r.top; probe.on = true;
  };
  canvas.addEventListener('pointermove', setProbe);
  canvas.addEventListener('pointerdown', setProbe);
  canvas.addEventListener('pointerleave', () => { probe.on = false; });
  canvas.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') probe.on = false; });

  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);
  if (reduced || STILL) return;
  onFrame((dt) => {
    if (!visible || document.hidden) return;
    t += dt;
    draw(dt);
  });
}
