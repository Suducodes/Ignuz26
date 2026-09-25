import { initHeart } from '../src/heart.js';
import { ecg } from '../src/pulse.js';

const log = (m) => { document.getElementById('log').textContent += m + '\n'; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function save(canvas, name) {
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  return (await fetch(`/__save?name=${name}`, { method: 'POST', body: blob })).text();
}

async function heartImage() {
  const root = document.getElementById('heart');
  initHeart(root, { reduced: false, modelUrl: '/models/heart.glb' });
  while (!root._debug) await wait(100);
  const { render, pivot, post } = root._debug;
  post.uniforms.uGrow.value = 1;
  pivot.rotation.set(0.05, -0.3, 0.02);
  pivot.scale.setScalar(1);
  render();
  const src = root.querySelector('canvas');
  const copy = document.createElement('canvas');
  copy.width = src.width; copy.height = src.height;
  copy.getContext('2d').drawImage(src, 0, 0);
  return copy;
}

const PAPER = '#1f45e0', INK = '#f4f7ff', ACC = '#8fe6ff', NAVY = '#0a1633';

function grid(ctx, W, H) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  for (let x = 0; x <= W; x += 8) {
    ctx.fillStyle = x % 40 ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.16)';
    ctx.fillRect(x, 0, 1, H);
  }
  for (let y = 0; y <= H; y += 8) {
    ctx.fillStyle = y % 40 ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.16)';
    ctx.fillRect(0, y, W, 1);
  }
}

function text(ctx, str, x, y, { font, stretch = 'normal', color = INK, align = 'left', spacing = '0px' }) {
  ctx.font = font;
  ctx.fontStretch = stretch;
  ctx.letterSpacing = spacing;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(str, x, y);
}

async function main() {
  await document.fonts.load('900 100px Archivo');
  await document.fonts.load('800 100px Archivo');
  await document.fonts.load('500 16px "IBM Plex Mono"');
  await document.fonts.load('600 16px "IBM Plex Mono"');
  const heart = await heartImage();
  log('heart ' + heart.width);

  // static fallback for browsers without WebGL
  log(await save(heart, 'heart-still.png') /* converted to .webp afterwards */);

  const c = document.getElementById('og');
  const ctx = c.getContext('2d');
  const W = 1200, H = 630, G = 48;
  grid(ctx, W, H);

  const mono = '500 15px "IBM Plex Mono"';
  ctx.textBaseline = 'alphabetic';
  text(ctx, 'Nº IGN—26', G, 58, { font: mono, spacing: '1px' });
  text(ctx, 'DEPT. OF BIOMEDICAL ENGINEERING · KPRIET', W / 2, 58, { font: mono, align: 'center', spacing: '1px' });
  text(ctx, '11.08°N 77.14°E', W - G, 58, { font: mono, align: 'right', spacing: '1px' });
  ctx.fillStyle = INK;
  ctx.fillRect(G, 72, W - 2 * G, 1.5);

  // wordmark, fitted to the measure
  ctx.font = '900 100px Archivo';
  ctx.fontStretch = 'expanded';
  ctx.letterSpacing = '-3.5px';
  const natural = ctx.measureText("IGNUZ'26").width;
  const size = (100 * (W - 2 * G)) / natural;
  text(ctx, "IGNUZ'26", G - 4, 110 + size * 0.74, { font: `900 ${size}px Archivo`, stretch: 'expanded', spacing: `${-0.035 * size}px` });

  // heart, printed over the mark
  const hs = 470;
  ctx.drawImage(heart, W / 2 - hs / 2 + 40, 58, hs, hs);

  // ECG strip
  const base = 560, gain = 64, x0 = 0;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, base);
  ctx.lineTo(16, base); ctx.lineTo(16, base - gain); ctx.lineTo(56, base - gain); ctx.lineTo(56, base); ctx.lineTo(72, base);
  const perBeat = 166;
  for (let x = 72; x <= W; x++) ctx.lineTo(x, base - ecg(((x - 72) / perBeat + 0.62) % 1) * gain);
  ctx.stroke();
  ctx.fillStyle = 'rgba(143,230,255,0.3)';
  ctx.beginPath(); ctx.arc(W - 90, base - ecg(((W - 90 - 72) / perBeat + 0.62) % 1) * gain, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ACC;
  ctx.beginPath(); ctx.arc(W - 90, base - ecg(((W - 90 - 72) / perBeat + 0.62) % 1) * gain, 4.5, 0, Math.PI * 2); ctx.fill();

  // lede + date
  text(ctx, 'Six events.', G, 368, { font: '800 50px Archivo', stretch: 'condensed', spacing: '-0.5px' });
  text(ctx, 'Two days.', G, 416, { font: '800 50px Archivo', stretch: 'condensed', spacing: '-0.5px' });
  text(ctx, 'One pulse.', G, 464, { font: '800 50px Archivo', stretch: 'condensed', spacing: '-0.5px', color: ACC });

  text(ctx, '09—10', W - G, 400, { font: '900 86px Archivo', stretch: 'semi-expanded', align: 'right', spacing: '-3px' });
  text(ctx, 'October 2026', W - G, 440, { font: '800 30px Archivo', stretch: 'condensed', align: 'right' });
  text(ctx, 'KPRIET · COIMBATORE', W - G, 470, { font: mono, align: 'right', spacing: '1px', color: 'rgba(244,247,255,0.85)' });

  // register tab
  ctx.fillStyle = INK;
  ctx.fillRect(W - G - 330, 586, 330, 44);
  text(ctx, 'ONE-DAY PASS FROM ₹200 ↗', W - G - 165, 614, { font: '600 16px "IBM Plex Mono"', align: 'center', color: PAPER, spacing: '1px' });
  text(ctx, 'NATIONAL-LEVEL TECHNICAL SYMPOSIUM · ₹10,000 PRIZE POOL', G, 614, { font: mono, spacing: '1px', color: 'rgba(244,247,255,0.85)' });

  log(await save(c, 'og.png') /* converted to og.jpg afterwards */);
  document.title = 'done';
}
main().catch((e) => log('ERR ' + e.stack));
