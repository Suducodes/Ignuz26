import { onFrame, STILL } from './pulse.js';
import { tokenRGB, hex } from './ink.js';
import { PAINTERS, clamp } from './painters.js';

// Drives the six specimen plates on the page: draws each in when it scrolls
// into view and plays its behaviour on hover / tap.

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
