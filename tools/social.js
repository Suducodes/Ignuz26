import { initHeart } from '../src/heart.js';
import {
  STOCK, EVENTS, G, make, font, T, mono, head, wrapLines, wrap, ground, grain as grainWith, metaRow, sectionHead,
  wordmark, strip, plethTrace, plate, tag, band, footer, loadImg,
} from '../src/draw.js';

// Instagram kit, drawn from the site's own parts: the halftone heart, the six
// specimen plates, the ECG paper, the wristbands and the bedside monitor.
// Feed posts are 1080×1350 (4:5); stories are 1080×1920 with key content kept
// inside the 250–1650 px band that Instagram's own UI leaves clear.

const log = (m) => { document.getElementById('log').textContent += m + '\n'; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const TAU = Math.PI * 2;
const W = 1080;
let GRAIN;
const grain = (ctx, w, h, a) => grainWith(ctx, GRAIN, w, h, a);

async function save(c, name) {
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  await fetch(`/__save?name=social/${name}.png`, { method: 'POST', body: blob });
  const thumb = make(c.width, c.height);
  thumb.getContext('2d').drawImage(c, 0, 0);
  document.getElementById('out').append(thumb);
  log(`saved ${name}`);
}

/* ───────────────────────────── heart */

let HEART;
async function renderHeart() {
  const root = document.getElementById('heart');
  initHeart(root, { reduced: false, modelUrl: '/models/heart.glb' });
  while (!root._debug) await wait(100);
  const { render, pivot, post } = root._debug;
  await wait(200);
  post.uniforms.uGrow.value = 1;
  post.uniforms.uCell.value = 12;          // coarser screen so the dots survive Instagram's compression
  pivot.rotation.set(0.05, -0.3, 0.02);
  pivot.scale.setScalar(1);
  render();
  const src = root.querySelector('canvas');
  HEART = make(src.width, src.height);
  HEART.getContext('2d').drawImage(src, 0, 0);
}

/* ───────────────────────────── feed posts (1080 × 1350) */

function postAnnounce() {
  const H = 1350, c = make(W, H), ctx = c.getContext('2d'), st = STOCK.blue;
  ground(ctx, st, W, H);
  metaRow(ctx, st, 86, ['Nº IGN—26', 'National-level technical symposium', '09—10.10.26']);
  T(ctx, 'BMESI & Medico Sapiens × IEEE EMBS KPRIET SBC present', G, 158, mono(st.ink2, 21));
  const size = wordmark(ctx, st, G - 4, 188, W - 2 * G + 8);
  const hs = 830;
  ctx.drawImage(HEART, W / 2 - hs / 2 + 20, 120, hs, hs);
  T(ctx, 'Where ideas meet', G, 1012, head(st.ink, 56));
  T(ctx, 'real-world solutions.', G, 1066, head(st.ink, 56));
  T(ctx, '09—10', W - G, 1050, { size: 100, weight: 900, stretch: 'semi-expanded', track: -3.5, color: st.ink, align: 'right' });
  T(ctx, 'October 2026', W - G, 1096, head(st.ink, 40, { align: 'right' }));
  strip(ctx, st, 0, W, 1212, 64, { dot: W - 150 });
  T(ctx, 'II  25 mm/s · 10 mm/mV', 104, 1132, mono(st.ink3, 16));
  ctx.fillStyle = st.ink;
  ctx.fillRect(W - G - 430, 1262, 430, 58);
  T(ctx, 'Register — from ₹400  ↗', W - G - 215, 1300, mono(st.bg, 22, { align: 'center', weight: 600 }));
  T(ctx, 'KPRIET Campus · Coimbatore', G, 1300, mono(st.ink, 21));
  grain(ctx, W, H);
  return c;
}

function postCover() {
  const H = 1350, c = make(W, H), ctx = c.getContext('2d'), st = STOCK.paper;
  ground(ctx, st, W, H, false);
  sectionHead(ctx, st, 64, '§02', 'Event guide', 'Swipe →');
  T(ctx, 'Six events.', G, 232, head(st.ink, 108));
  T(ctx, 'Two days.', G, 336, head(st.ink, 108));
  T(ctx, 'One pulse.', G, 440, head(st.accent, 108));
  ctx.fillStyle = st.ink; ctx.fillRect(W - G - 330, 336, 2, 110);
  T(ctx, 'Prize pool', W - G - 304, 368, mono(st.ink3, 20));
  T(ctx, '₹10,000', W - G, 440, { size: 76, weight: 900, track: -2.6, color: st.accent, align: 'right' });

  const top = 492, cw = (W - 2 * G) / 3, ch = 382;
  ctx.strokeStyle = st.ink; ctx.lineWidth = 2;
  EVENTS.forEach((ev, i) => {
    const x = G + (i % 3) * cw, y = top + Math.floor(i / 3) * ch;
    const evStock = ev.stock === 'navy' ? STOCK.navy : st;
    if (ev.stock === 'navy') { ctx.fillStyle = STOCK.navy.bg; ctx.fillRect(x, y, cw, ch); }
    const pw = cw - 28, ph = pw * 0.75;
    plate(ctx, ev, x + 14, y + 14, pw, ph, ev.plateStock || (ev.stock === 'navy' ? 'navy' : 'paper'), false);
    T(ctx, ev.code, x + 16, y + ph + 50, mono(evStock.ink3, 17));
    T(ctx, ev.cat, x + cw - 16, y + ph + 50, mono(evStock.accent, 17, { align: 'right' }));
    font(ctx, head(evStock.ink, 40));
    const ns = Math.min(40, (40 * (cw - 32)) / ctx.measureText(ev.name).width);
    T(ctx, ev.name, x + 16, y + ph + 100, head(evStock.ink, ns));
    T(ctx, ev.kind, x + 16, y + ch - 20, mono(evStock.ink2, 16));
    ctx.strokeRect(x, y, cw, ch);
  });
  footer(ctx, st, H, "IGNUZ'26 · 09—10 Oct · KPRIET");
  grain(ctx, W, H, 0.3);
  return c;
}

function postEvent(ev, i) {
  const H = 1350, c = make(W, H), ctx = c.getContext('2d');
  const st = ev.stock === 'navy' ? STOCK.navy : STOCK.paper;
  ground(ctx, st, W, H, ev.stock === 'navy');
  // header
  const o = mono(st.ink, 22);
  const a = T(ctx, ev.code, G, 86, { ...o, weight: 600 });
  tag(ctx, st, ev.cat, G + a + 22, 86, 18, ev.cat === 'Workshop', ev.cat !== 'Technical' && ev.cat !== 'Workshop');
  T(ctx, `${String(i + 1).padStart(2, '0')}/06`, W - G, 86, mono(st.accent, 22, { align: 'right', weight: 600 }));
  T(ctx, ev.day, W - G - 120, 86, mono(st.ink3, 20, { align: 'right' }));
  ctx.fillStyle = st.ink; ctx.fillRect(G, 108, W - 2 * G, 2);
  // plate
  const pw = W - 2 * G, ph = pw * 0.75;
  plate(ctx, ev, G, 132, pw, ph, ev.plateStock || (ev.stock === 'navy' ? 'navy' : 'paper'));
  // copy
  let y = 132 + ph + 60;
  T(ctx, ev.kind, G, y, mono(st.accent, 24, { weight: 600 }));
  y += 92;
  T(ctx, ev.name, G - 3, y, head(st.ink, 100));
  y += 54;
  const n = wrap(ctx, ev.desc, G, y, W - 2 * G, 42, { size: 31, weight: 450, color: st.ink2 });
  y += n * 42 + 8;
  // rules: two columns if they fit, otherwise one
  const colW = (W - 2 * G) / 2;
  const ro = mono(st.ink2, 21, { upper: false });
  font(ctx, ro);
  const cols = ev.rules.every((r) => ctx.measureText(r).width < colW - 50) ? 2 : 1;
  ev.rules.forEach((r, k) => {
    const rx = G + (k % cols) * colW, ry = y + Math.floor(k / cols) * 40;
    T(ctx, '+', rx, ry, mono(st.accent, 22, { weight: 600 }));
    T(ctx, r, rx + 26, ry, ro);
  });
  const after = y + Math.ceil(ev.rules.length / cols) * 40;
  if (after < H - 170) strip(ctx, st, G, W - G, H - 142, 24, { calib: false, beat: 190, off: 0.1, lw: 2, color: st.line });
  // coordinator
  ctx.fillStyle = st.ink; ctx.fillRect(G, H - 110, W - 2 * G, 2);
  T(ctx, 'Coordinator', G, H - 72, mono(st.ink3, 18));
  T(ctx, ev.coord, G, H - 36, { size: 32, weight: 650, color: st.ink });
  T(ctx, ev.tel, W - G, H - 38, mono(st.ink, 26, { align: 'right', upper: false }));
  grain(ctx, W, H, 0.3);
  return c;
}

function postRegister() {
  const H = 1350, c = make(W, H), ctx = c.getContext('2d'), st = STOCK.paper;
  ground(ctx, st, W, H, false);
  sectionHead(ctx, st, 64, '§04', 'Admission', 'Both days');
  T(ctx, 'One registration.', G, 238, head(st.ink, 106));
  T(ctx, 'Both days.', G, 340, head(st.accent, 106));
  band(ctx, G, 410, W - 2 * G, 200, { blue: false, type: 'Without lunch', price: '400', code: 'IGN26-W', bandName: 'White' });
  band(ctx, G, 648, W - 2 * G, 200, { blue: true, type: 'With lunch', price: '600', code: 'IGN26-B', bandName: 'Blue' });
  ctx.fillStyle = st.ink; ctx.fillRect(G, 912, W - 2 * G, 2);
  T(ctx, 'Prize pool', G, 958, mono(st.ink3, 20));
  T(ctx, '₹10,000', G - 4, 1068, { size: 118, weight: 900, track: -4, color: st.accent });
  const notes = ['Covers Fri 09 & Sat 10 Oct', 'Accommodation not provided', 'Seats are limited'];
  notes.forEach((n, k) => {
    T(ctx, `0${k + 1}`, 620, 968 + k * 44, mono(st.accent, 19));
    T(ctx, n, 668, 968 + k * 44, { size: 27, weight: 500, color: st.ink });
  });
  ctx.fillStyle = st.ink; ctx.fillRect(G, 1114, W - 2 * G, 124);
  T(ctx, 'Register now', G + 36, 1194, head(st.bg, 62));
  T(ctx, 'Link in bio ↗', W - G - 36, 1188, mono('#8fe6ff', 24, { align: 'right', weight: 600 }));
  footer(ctx, st, H + 12, "IGNUZ'26 · KPRIET Campus, Coimbatore", '09—10.10.2026');
  grain(ctx, W, H, 0.3);
  return c;
}

/* ───────────────────────────── stories (1080 × 1920) */

function storyHero() {
  const H = 1920, c = make(W, H), ctx = c.getContext('2d'), st = STOCK.blue;
  ground(ctx, st, W, H);
  metaRow(ctx, st, 250, ['Nº IGN—26', '', '09—10.10.26']);
  T(ctx, 'National-level technical symposium', G, 316, mono(st.ink2, 22));
  const size = wordmark(ctx, st, G - 4, 350, W - 2 * G + 8);
  const hs = 1000;
  ctx.drawImage(HEART, W / 2 - hs / 2 + 10, 300, hs, hs);
  T(ctx, 'Where ideas meet', G, 1390, head(st.ink, 76));
  T(ctx, 'real-world solutions.', G, 1462, head(st.ink, 76));
  ctx.fillStyle = st.ink; ctx.fillRect(G, 1510, W - 2 * G, 2);
  T(ctx, '09—10', G - 4, 1640, { size: 132, weight: 900, stretch: 'semi-expanded', track: -5, color: st.ink });
  T(ctx, 'October 2026', W - G, 1586, head(st.ink, 48, { align: 'right' }));
  T(ctx, 'KPRIET · Coimbatore', W - G, 1636, mono(st.ink2, 22, { align: 'right' }));
  strip(ctx, st, 0, W, 1790, 70, { dot: W - 170 });
  T(ctx, 'Tap the link to register · from ₹400', W / 2, 1712, mono(st.accent, 23, { align: 'center', weight: 600 }));
  grain(ctx, W, H);
  return c;
}

function storyLineup() {
  const H = 1920, c = make(W, H), ctx = c.getContext('2d'), st = STOCK.navy;
  ground(ctx, st, W, H);
  metaRow(ctx, st, 250, ["IGNUZ'26", 'Event guide', '01—06']);
  T(ctx, 'Six events.', G, 420, head(st.ink, 124));
  T(ctx, 'Two days.', G, 538, head(st.ink, 124));
  T(ctx, 'One pulse.', G, 656, head(st.accent, 124));
  const top = 716, rh = 148;
  EVENTS.forEach((ev, i) => {
    const y = top + i * rh;
    ctx.fillStyle = st.line; ctx.fillRect(G, y, W - 2 * G, 1.5);
    plate(ctx, ev, G, y + 16, 156, 117, ev.plateStock || 'navy', false);
    T(ctx, `${ev.code} · ${ev.day}`, G + 184, y + 50, mono(st.ink3, 18));
    T(ctx, ev.name, G + 182, y + 104, head(st.ink, 52));
    T(ctx, ev.kind, W - G, y + 104, mono(st.accent, 19, { align: 'right' }));
  });
  ctx.fillStyle = st.line; ctx.fillRect(G, top + 6 * rh, W - 2 * G, 1.5);
  T(ctx, 'Prize pool ₹10,000 · Tap the link to register', W / 2, 1690, mono(st.ink, 23, { align: 'center', weight: 600 }));
  grain(ctx, W, H, 0.3);
  return c;
}

function storyRegister() {
  const H = 1920, c = make(W, H), ctx = c.getContext('2d'), st = STOCK.paper;
  ground(ctx, st, W, H, false);
  sectionHead(ctx, st, 240, '§04', 'Admission', "IGNUZ'26");
  T(ctx, 'One registration.', G, 430, head(st.ink, 116));
  T(ctx, 'Both days.', G, 542, head(st.accent, 116));
  band(ctx, G, 636, W - 2 * G, 200, { blue: false, type: 'Without lunch', price: '400', code: 'IGN26-W', bandName: 'White' });
  band(ctx, G, 890, W - 2 * G, 200, { blue: true, type: 'With lunch', price: '600', code: 'IGN26-B', bandName: 'Blue' });
  ctx.fillStyle = st.ink; ctx.fillRect(G, 1180, W - 2 * G, 2);
  T(ctx, 'Prize pool', G, 1228, mono(st.ink3, 21));
  T(ctx, '₹10,000', G - 4, 1356, { size: 140, weight: 900, track: -5, color: st.accent });
  T(ctx, 'Covers Fri 09 & Sat 10 October 2026', G, 1418, { size: 30, weight: 500, color: st.ink });
  T(ctx, 'Accommodation not provided · Seats limited', G, 1460, { size: 30, weight: 500, color: st.ink2 });
  ctx.fillStyle = st.ink; ctx.fillRect(G, 1516, W - 2 * G, 132);
  T(ctx, 'Tap the link to register', G + 36, 1600, head(st.bg, 60));
  T(ctx, '↗', W - G - 40, 1604, { size: 64, weight: 700, color: '#8fe6ff', align: 'right' });
  strip(ctx, st, 0, W, 1800, 64, { dot: W - 170 });
  grain(ctx, W, H, 0.3);
  return c;
}

function storyPrize() {
  const H = 1920, c = make(W, H), ctx = c.getContext('2d'), st = STOCK.blue;
  ground(ctx, st, W, H);
  metaRow(ctx, st, 250, ["IGNUZ'26", '', '09—10.10.26']);
  T(ctx, 'Prize pool', G, 470, mono(st.ink, 40, { weight: 600 }));
  font(ctx, { size: 100, weight: 900, stretch: 'expanded', track: -4 });
  const fs = (100 * (W - 2 * G)) / ctx.measureText('₹10,000').width;
  T(ctx, '₹10,000', G - 4, 720, { size: fs, weight: 900, stretch: 'expanded', track: -0.04 * fs, color: st.ink });
  // one big beat underneath, as if the figure were the reading it produced
  strip(ctx, st, 0, W, 1000, 170, { calib: false, beat: 1080, off: 0.03, lw: 5, color: '#8fe6ff', dot: 890 });
  T(ctx, 'across six events', G, 1100, head(st.ink, 70));
  ctx.fillStyle = st.ink; ctx.fillRect(G, 1150, W - 2 * G, 2);
  EVENTS.forEach((ev, i) => {
    const x = G + (i % 2) * ((W - 2 * G) / 2), y = 1216 + Math.floor(i / 2) * 84;
    T(ctx, ev.code.replace('IGN—', ''), x, y, mono(st.accent, 22, { weight: 600 }));
    T(ctx, ev.name, x + 52, y + 2, head(st.ink, 44));
  });
  ctx.fillStyle = st.ink; ctx.fillRect(G, 1500, W - 2 * G, 132);
  T(ctx, 'Register — from ₹400', G + 36, 1586, head(st.bg, 58));
  T(ctx, '↗', W - G - 40, 1590, { size: 64, weight: 700, color: st.bg, align: 'right' });
  grain(ctx, W, H);
  return c;
}

function storyCountdown(days) {
  const H = 1920, c = make(W, H), ctx = c.getContext('2d'), st = STOCK.navy;
  ground(ctx, st, W, H);
  metaRow(ctx, st, 250, ['Nº IGN—26', 'Monitor', '09—10.10.26']);
  wordmark(ctx, st, G - 4, 300, W - 2 * G + 8);

  // the bedside monitor
  const mx = G, my = 520, mw = W - 2 * G, mh = 1010;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 30;
  ctx.fillStyle = '#1b2440'; ctx.beginPath(); ctx.roundRect(mx - 14, my - 14, mw + 28, mh + 28, 34); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#050b1e'; ctx.beginPath(); ctx.roundRect(mx, my, mw, mh, 22); ctx.fill();
  const P = 38, x0 = mx + P, x1 = mx + mw - P;
  const muted = '#7f8ba8', aqua = '#5ef0c4', sat = '#56c8ff', amber = '#f4b840', cream = '#e6ecfa', rule = '#1a2544';
  const hr = (y) => { ctx.fillStyle = rule; ctx.fillRect(x0, y, x1 - x0, 2); };
  T(ctx, 'MON · BED IGN-26', x0, my + 62, mono(muted, 22));
  ctx.fillStyle = aqua; ctx.beginPath(); ctx.arc(x1 - 100, my + 54, 8, 0, TAU); ctx.fill();
  T(ctx, 'LIVE', x1, my + 62, mono(aqua, 22, { align: 'right', weight: 600 }));
  hr(my + 90);
  // ECG channel
  T(ctx, 'II', x0, my + 140, mono(aqua, 22, { weight: 600 }));
  strip(ctx, { ink: aqua, accent: cream }, x0 + 40, x1, my + 262, 120, { calib: false, beat: 230, off: 0.5, lw: 3.5, color: aqua, dot: x1 - 90 });
  hr(my + 300);
  // countdown
  T(ctx, days === 1 ? 'T-minus · tomorrow' : 'T-minus · Day 01', x0, my + 352, mono(muted, 24));
  T(ctx, String(days).padStart(2, '0'), x0 - 10, my + 690, { family: 'mono', size: 380, weight: 500, track: -20, color: cream });
  T(ctx, days === 1 ? 'day to go' : 'days to go', x0, my + 752, mono(cream, 30, { weight: 600 }));
  // right column: HR + SpO2
  const rx = mx + mw * 0.62;
  ctx.fillStyle = rule; ctx.fillRect(rx - 30, my + 330, 2, 440);
  T(ctx, 'HR', rx, my + 400, mono(aqua, 24, { weight: 600 }));
  T(ctx, '72', rx, my + 520, { family: 'mono', size: 132, weight: 500, color: aqua, track: -4 });
  T(ctx, 'bpm', rx + 170, my + 520, mono(aqua, 22));
  T(ctx, 'SpO₂', rx, my + 610, mono(sat, 24, { weight: 600, upper: false }));
  T(ctx, '98', rx, my + 722, { family: 'mono', size: 110, weight: 500, color: sat, track: -4 });
  T(ctx, '%', rx + 140, my + 722, mono(sat, 22));
  hr(my + 790);
  plethTrace(ctx, x0, x1, my + 900, 80, sat, 240, 3.5);
  hr(my + 930);
  T(ctx, 'Seats', x0, my + 978, mono(muted, 22));
  T(ctx, 'Limited — register now', x1, my + 978, mono(amber, 22, { align: 'right', weight: 600 }));

  T(ctx, 'Fri 09 & Sat 10 October 2026 · KPRIET, Coimbatore', W / 2, 1640, mono(st.ink2, 22, { align: 'center' }));
  T(ctx, 'Tap the link to register · from ₹400', W / 2, 1700, mono(st.accent, 24, { align: 'center', weight: 600 }));
  grain(ctx, W, H, 0.3);
  return c;
}

/* ───────────────────────────── run */

async function main() {
  for (const f of ['900 100px Archivo', '800 100px Archivo', '650 40px Archivo', '500 30px Archivo', '500 20px "IBM Plex Mono"', '600 20px "IBM Plex Mono"']) await document.fonts.load(f);
  GRAIN = await loadImg('/grain.png');
  await renderHeart();
  log('heart ready');

  await save(postAnnounce(), 'post-01-announce');
  await save(postCover(), 'carousel-00-lineup');
  for (let i = 0; i < EVENTS.length; i++) await save(postEvent(EVENTS[i], i), `carousel-0${i + 1}-${EVENTS[i].plate}`);
  await save(postRegister(), 'carousel-07-register');

  await save(storyHero(), 'story-01-hero');
  await save(storyLineup(), 'story-02-lineup');
  await save(storyRegister(), 'story-03-register');
  await save(storyPrize(), 'story-04-prize');
  for (const d of [14, 7, 3, 1]) await save(storyCountdown(d), `story-countdown-${String(d).padStart(2, '0')}`);
  document.title = 'done';
}
main().catch((e) => log('ERR ' + e.stack));
