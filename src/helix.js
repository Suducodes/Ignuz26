import { onFrame, STILL } from './pulse.js';
import { tokenRGB, rgba } from './ink.js';

// A B-form double helix laid on its side: ten base pairs per turn, one strand
// per day. Each rung is a real Watson–Crick pair split between its strands.
// Hover reads the pair (A–T holds with 2 hydrogen bonds, G–C with 3); drag
// twists it; scrolling past spins it.

const TAU = Math.PI * 2;
const PAIR = { A: 'T', T: 'A', G: 'C', C: 'G' };

function sequence(n, seed = 26) {
  let s = seed;
  const out = [];
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    out.push('ATGC'[(s >> 16) & 3]);
  }
  return out;
}

export function initHelix(canvas, { reduced }) {
  const ctx = canvas.getContext('2d');
  const read = document.getElementById('helix-read');
  const seq = sequence(512);
  let W = 0, H = 0, dpr = 1, visible = false;
  let phase = 0.6, spin = 0;
  let px = -1, dragX = null, hovered = -1;
  let A = [234, 240, 255, 1], B = [98, 214, 255, 1];

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.round(r.width); H = Math.round(r.height);
    canvas.width = W * dpr; canvas.height = H * dpr;
    A = tokenRGB(canvas, '--ink');
    B = tokenRGB(canvas, '--accent');
    draw();
  }

  function draw() {
    if (!W) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const cy = H / 2;
    const amp = H * 0.34;
    const lambda = Math.max(220, Math.min(380, W / 4.6));
    const k = TAU / lambda;
    const pairStep = lambda / 10;

    // nearest rung to the pointer
    hovered = px < 0 ? -1 : Math.round((px - pairStep / 2) / pairStep);

    ctx.lineCap = 'round';
    ctx.font = '600 10px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0, x = pairStep / 2; x < W; i++, x += pairStep) {
      const a = k * x + phase;
      const ya = cy + amp * Math.sin(a), yb = cy - amp * Math.sin(a);
      const depth = Math.abs(Math.cos(a));
      const ym = (ya + yb) / 2;
      const hot = i === hovered;
      const near = px < 0 ? 0 : Math.max(0, 1 - Math.abs(x - px) / 150);
      const al = hot ? 1 : 0.16 + 0.4 * depth + near * 0.3;
      ctx.lineWidth = hot ? 3 : 1.4;
      ctx.strokeStyle = rgba(A, al);
      ctx.beginPath(); ctx.moveTo(x, ya); ctx.lineTo(x, ym - 2); ctx.stroke();
      ctx.strokeStyle = rgba(B, al);
      ctx.beginPath(); ctx.moveTo(x, ym + 2); ctx.lineTo(x, yb); ctx.stroke();

      // base letters fade in around the cursor, and hide when the rung is edge-on
      const open = Math.min(1, Math.abs(ya - yb) / 40);
      if (near > 0 && open > 0.1) {
        const b1 = seq[i % seq.length], b2 = PAIR[b1];
        ctx.fillStyle = rgba(A, near * open * (hot ? 1 : 0.85));
        ctx.fillText(b1, x + 9, ya + (ym - ya) * 0.4);
        ctx.fillStyle = rgba(B, near * open * (hot ? 1 : 0.85));
        ctx.fillText(b2, x + 9, yb + (ym - yb) * 0.4);
      }
    }

    // backbone dots — back half first, then front
    for (const front of [false, true]) {
      for (let x = 0; x < W; x += 5) {
        const a = k * x + phase;
        const za = Math.cos(a);          // strand A depth, strand B is -za
        for (const [sign, col, z] of [[1, A, za], [-1, B, -za]]) {
          if ((z >= 0) !== front) continue;
          const y = cy + sign * amp * Math.sin(a);
          const r = 0.9 + 1.9 * ((z + 1) / 2);
          ctx.fillStyle = rgba(col, 0.35 + 0.65 * ((z + 1) / 2));
          ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
        }
      }
    }

    if (read) {
      const on = hovered >= 0 && hovered * pairStep < W;
      read.classList.toggle('is-on', on);
      if (on) {
        const b1 = seq[hovered % seq.length], b2 = PAIR[b1];
        read.textContent = `BP ${String(hovered + 1).padStart(3, '0')} · ${b1}–${b2} · ${'AT'.includes(b1) ? 2 : 3} H-bonds`;
        read.style.left = `${Math.max(90, Math.min(W - 90, pairStep / 2 + hovered * pairStep))}px`;
      }
    }
  }

  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    if (dragX !== null) { spin += (x - dragX) * 0.004; dragX = x; }
    px = x;
    if (reduced) draw();
  });
  canvas.addEventListener('pointerdown', (e) => { dragX = e.clientX - canvas.getBoundingClientRect().left; });
  window.addEventListener('pointerup', () => { dragX = null; });
  canvas.addEventListener('pointerleave', () => { px = -1; dragX = null; if (reduced) draw(); });

  let lastY = window.scrollY;
  window.addEventListener('scroll', () => {
    const dy = window.scrollY - lastY;
    lastY = window.scrollY;
    if (visible) spin = Math.max(-0.6, Math.min(0.6, spin + dy * 0.0015));
  }, { passive: true });

  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);
  if (reduced || STILL) return;
  onFrame((dt) => {
    if (!visible || document.hidden) return;
    phase -= dt * 0.7 + spin;
    spin *= Math.exp(-dt * 3);
    draw();
  });
}
