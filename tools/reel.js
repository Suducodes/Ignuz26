import { initHeart } from '../src/heart.js';
import { ecg, shockTrace, contraction } from '../src/wave.js';
import { PAINTERS } from '../src/painters.js';
import { STOCK, EVENTS, G, make, font, T, mono, head, ground, grain, metaRow, plate, loadImg } from '../src/draw.js';

// Instagram reel, 1080×1920 @ 30 fps, rendered deterministically frame by frame.
// One continuous ECG runs under every scene and every cut lands on an R wave:
//   flatline + charging → shock → heart prints in under the mark →
//   six specimen plates (two beats each) → type → end card.
// Beat and shock times are logged so the soundtrack can be built to match.

const W = 1080, H = 1920, FPS = 30, DT = 1 / FPS;
const SAVE = !new URLSearchParams(location.search).has('preview');
const SHOCK = 1.5, WAKE = 1.75, MAX_T = 24;
const ECG_Y = 1600, ECG_GAIN = 84, PEN = 380;         // strip baseline, px per mV, px per second
const MON = { bg: '#050b1e', aqua: '#5ef0c4', muted: '#7f8ba8', amber: '#f4b840', rule: '#1a2544' };

const log = (m) => { document.getElementById('log').textContent += m + '\n'; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = (t) => 1 - (1 - clamp(t)) ** 3;
const lerp = (a, b, t) => a + (b - a) * t;
const frac = (x) => x - Math.floor(x);

/* ───────────────────────────── clock + scenes */

const clock = { t: 0, phase: 0.95, prev: 0.95, bpm: 72 };
const scene = { name: 'flat', since: 0, beats: 0, event: 0 };
const events = { beats: [], shock: SHOCK, cuts: [] };

function setScene(name) { scene.name = name; scene.since = clock.t; scene.beats = 0; events.cuts.push([name, +clock.t.toFixed(3)]); }
const BPM = { flat: 72, intro: 72, montage: 96, type: 80, end: 72 };

function step() {
  clock.t += DT;
  clock.prev = clock.phase;
  if (clock.t >= WAKE) {
    clock.bpm += (BPM[scene.name] - clock.bpm) * 0.25;
    clock.phase += DT * (clock.bpm / 60);
  }
  const r = Math.floor(clock.prev - 0.25) !== Math.floor(clock.phase - 0.25) && clock.t >= WAKE;
  if (r) { events.beats.push(+clock.t.toFixed(3)); scene.beats++; }
  // scene machine — every cut on an R wave
  if (scene.name === 'flat' && clock.t >= WAKE) setScene('intro');
  else if (scene.name === 'intro' && r && clock.t - scene.since > 3.1) { setScene('montage'); scene.event = 0; }
  else if (scene.name === 'montage' && r && scene.beats >= 2) {
    if (scene.event < 5) { scene.event++; scene.since = clock.t; scene.beats = 0; events.cuts.push(['event', +clock.t.toFixed(3)]); } else setScene('type');
  } else if (scene.name === 'type' && r && scene.beats >= 5) setScene('end');
  return r;
}

/* ───────────────────────────── continuous ECG strip */

const ys = new Float32Array(W).fill(NaN);
let penX = 0;
function writeStrip() {
  const from = penX, to = penX + PEN * DT;
  for (let x = Math.floor(from) + 1; x <= Math.floor(to); x++) {
    const k = (x - from) / (to - from);
    const t = clock.t - DT + DT * k;
    const ph = clock.prev + (clock.phase - clock.prev) * k;
    let v;
    if (t < SHOCK) v = (Math.random() - 0.5) * 0.015;
    else if (t < WAKE) v = shockTrace(t - SHOCK);
    else v = ecg(frac(ph)) + (Math.random() - 0.5) * 0.01;
    ys[x % W] = v;
  }
  penX = to % W;
}
// the trace saturates at the channel's rails, like a real monitor after a shock
const rail = (v) => Math.min(ECG_Y + 110, Math.max(ECG_Y - 150, ECG_Y - v * ECG_GAIN));
function drawStrip(ctx, color, dot, lw = 3.2) {
  const head = Math.floor(penX);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  let pen = false;
  for (let x = 0; x < W; x++) {
    const gap = x > head && x <= head + 36;
    const v = ys[x];
    if (gap || Number.isNaN(v)) { pen = false; continue; }
    const y = rail(v);
    pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    pen = true;
  }
  ctx.stroke();
  const v = ys[head];
  if (!Number.isNaN(v)) {
    const y = rail(v);
    ctx.fillStyle = dot + '44'; ctx.beginPath(); ctx.arc(head, y, 16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = dot; ctx.beginPath(); ctx.arc(head, y, 6, 0, Math.PI * 2); ctx.fill();
  }
}

/* ───────────────────────────── heart */

let HEART, heartCanvas;
async function setupHeart() {
  const root = document.getElementById('heart');
  initHeart(root, { reduced: false, modelUrl: '/models/heart.glb' });
  while (!root._debug) await wait(100);
  await wait(200);
  HEART = root._debug;
  HEART.post.uniforms.uCell.value = 12;
  heartCanvas = root.querySelector('canvas');
}
function drawHeart(ctx, cx, cy, size, grow) {
  const beat = contraction(frac(clock.phase));
  HEART.post.uniforms.uGrow.value = grow;
  HEART.pivot.rotation.set(0.05 + Math.sin(clock.t * 0.4) * 0.03, -0.3 + Math.sin(clock.t * 0.5) * 0.18, 0.02);
  HEART.pivot.scale.setScalar(1 + beat * 0.05);
  HEART.render();
  ctx.drawImage(heartCanvas, cx - size / 2, cy - size / 2, size, size);
}

/* ───────────────────────────── scenes */

let TEX;
function finish(ctx, a = 0.32) {
  grain(ctx, TEX, W, H, a, Math.random() * 256, Math.random() * 256);   // flickering tooth, like film
}

// the mark, each letter rising into its box on its own delay
function wordmarkRise(ctx, st, top, t0) {
  const str = "IGNUZ'26";
  font(ctx, { size: 100, weight: 900, stretch: 'expanded', track: -3.5 });
  const size = (100 * (W - 2 * G + 8)) / ctx.measureText(str).width;
  const o = { size, weight: 900, stretch: 'expanded', track: -0.035 * size, color: st.ink };
  font(ctx, o);
  ctx.save();
  ctx.beginPath(); ctx.rect(0, top - 10, W, size * 0.86); ctx.clip();
  for (let i = 0; i < str.length; i++) {
    const k = ease((clock.t - t0 - i * 0.05) / 0.45);
    const x = G - 4 + ctx.measureText(str.slice(0, i)).width;
    T(ctx, str[i], x, top + size * 0.74 + (1 - k) * size * 0.9, o);
  }
  ctx.restore();
  return size;
}

function sceneFlat(ctx) {
  ctx.fillStyle = MON.bg; ctx.fillRect(0, 0, W, H);
  for (let x = 0; x <= W; x += 36) { ctx.fillStyle = x % 180 ? 'rgba(94,240,196,0.04)' : 'rgba(94,240,196,0.09)'; ctx.fillRect(x, 0, 1, H); }
  for (let y = 0; y <= H; y += 36) { ctx.fillStyle = y % 180 ? 'rgba(94,240,196,0.04)' : 'rgba(94,240,196,0.09)'; ctx.fillRect(0, y, W, 1); }
  const t = clock.t;
  T(ctx, 'MON · BED IGN-26', G, 250, mono(MON.muted, 26));
  if (Math.floor(t * 3) % 2 === 0) T(ctx, 'Asystole', W - G, 250, mono(MON.amber, 26, { align: 'right', weight: 600 }));
  ctx.fillStyle = MON.rule; ctx.fillRect(G, 280, W - 2 * G, 2);
  T(ctx, 'HR', G, 560, mono(MON.aqua, 34, { weight: 600 }));
  T(ctx, '---', G - 12, 860, { family: 'mono', size: 300, weight: 500, color: MON.aqua, track: -10 });
  T(ctx, 'bpm', G + 560, 860, mono(MON.aqua, 34));
  // defib charging
  const k = clamp((t - 0.15) / 1.2);
  T(ctx, 'Defib · charging', G, 1080, mono(MON.muted, 26));
  T(ctx, `${Math.round(k * 200)} J`, W - G, 1080, mono(k >= 1 ? MON.amber : MON.aqua, 26, { align: 'right', weight: 600 }));
  ctx.strokeStyle = MON.aqua; ctx.lineWidth = 2; ctx.strokeRect(G, 1110, W - 2 * G, 30);
  ctx.fillStyle = k >= 1 ? MON.amber : MON.aqua; ctx.fillRect(G + 5, 1115, (W - 2 * G - 10) * k, 20);
  if (k >= 1 && Math.floor(t * 8) % 2 === 0) T(ctx, 'Ready — stand clear', W / 2, 1230, mono(MON.amber, 30, { align: 'center', weight: 600 }));
  drawStrip(ctx, MON.aqua, '#e6ecfa');
  finish(ctx, 0.2);
}

function stamp(ctx, a) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(W / 2, 900);
  ctx.rotate(-0.1);
  const s = 1 + (1 - a) * 0.15;
  ctx.scale(s, s);
  ctx.fillStyle = '#f4f7ff'; ctx.fillRect(-300, -120, 600, 240);
  ctx.strokeStyle = '#0a1633'; ctx.lineWidth = 8; ctx.strokeRect(-300, -120, 600, 240);
  T(ctx, 'CLEAR!', 0, 30, { size: 150, weight: 900, stretch: 'expanded', track: -4, color: '#0a1633', align: 'center' });
  T(ctx, '200 J biphasic', 0, 90, mono('#0a1633', 26, { align: 'center', weight: 600 }));
  ctx.restore();
}

function sceneIntro(ctx) {
  const st = STOCK.blue;
  // also drawn under the shock flash, before the intro scene formally starts
  const t = clock.t, lt = Math.max(0, t - Math.max(scene.since, WAKE));
  ground(ctx, st, W, H);
  metaRow(ctx, st, 250, ['Nº IGN—26', '', '09—10.10.26']);
  T(ctx, 'National-level technical symposium', G, 318, mono(st.ink2, 26));
  drawHeart(ctx, W / 2 + 10, 900, 980, ease(lt / 1.4));
  wordmarkRise(ctx, st, 350, WAKE + 0.35);
  const k = ease((lt - 1.3) / 0.6);
  ctx.globalAlpha = k;
  T(ctx, 'Dept. of Biomedical Engineering', G, 1420 + (1 - k) * 30, head(st.ink, 64));
  T(ctx, 'KPRIET · Coimbatore', G, 1476 + (1 - k) * 30, mono(st.ink2, 28));
  ctx.globalAlpha = 1;
  drawStrip(ctx, st.ink, st.accent);
  finish(ctx);
}

const PAINT = EVENTS.map((ev) => PAINTERS[ev.plate]());
function plateState(ev, lt) {
  switch (ev.plate) {
    case 'inkblot': return { intro: clamp(lt / 0.9), hover: 0, ht: 0 };
    case 'schematic': return { intro: clamp(lt / 0.6), hover: clamp((lt - 0.3) / 0.3), ht: 0.6 + lt * 1.2 };
    case 'iris': return { intro: clamp(lt / 0.9), hover: 0.8, ht: 1 + lt, look: { x: lerp(0.5, -0.45, ease(lt / 1.1)), y: lerp(-0.3, 0.2, ease(lt / 1.1)) } };
    case 'maze': return { intro: clamp(lt / 0.35), hover: clamp((lt - 0.2) / 0.9), ht: 0 };
    case 'fingerprint': return { intro: clamp(lt / 0.55), hover: clamp((lt - 0.3) / 0.3), ht: 1 + lt * 1.4 };
    default: return { intro: 1, hover: 1, ht: 1.62 + lt };            // aperture fires ~0.2 s in
  }
}
const plateBuf = make(952, 714);
function sceneEvent(ctx) {
  const ev = EVENTS[scene.event];
  const st = ev.stock === 'navy' ? STOCK.navy : STOCK.paper;
  const lt = clock.t - scene.since;
  ground(ctx, st, W, H, ev.stock === 'navy');
  T(ctx, ev.code, G, 250, mono(st.ink, 28, { weight: 600 }));
  T(ctx, ev.cat, G + 170, 250, mono(st.accent, 26, { weight: 600 }));
  T(ctx, `${scene.event + 1}/6`, W - G, 250, mono(st.accent, 28, { align: 'right', weight: 600 }));
  ctx.fillStyle = st.ink; ctx.fillRect(G, 280, W - 2 * G, 2);
  // plate, with a slow push-in
  const pg = plateBuf.getContext('2d');
  pg.clearRect(0, 0, 952, 714);
  plate(pg, ev, 0, 0, 952, 714, ev.plateStock || (ev.stock === 'navy' ? 'navy' : 'paper'), true, { painter: PAINT[scene.event], state: plateState(ev, lt) });
  const s = 1 + lt * 0.03;
  ctx.save();
  ctx.beginPath(); ctx.rect(G, 330, 952, 714); ctx.clip();
  ctx.drawImage(plateBuf, G + 476 - 476 * s, 330 + 357 - 357 * s, 952 * s, 714 * s);
  ctx.restore();
  const k = ease(lt / 0.35);
  T(ctx, ev.kind, G, 1130, mono(st.accent, 30, { weight: 600 }));
  font(ctx, head(st.ink, 130));
  const size = Math.min(130, (130 * (W - 2 * G)) / ctx.measureText(ev.name).width);
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 1140, W, size * 1.25); ctx.clip();
  T(ctx, ev.name, G - 3, 1140 + size * 0.92 + (1 - k) * size, head(st.ink, size));
  ctx.restore();
  T(ctx, ev.day, G, 1350, mono(st.ink2, 28));
  drawStrip(ctx, st.ink, st.accent);
  finish(ctx, 0.28);
}

function sceneType(ctx) {
  const st = STOCK.blue;
  ground(ctx, st, W, H);
  metaRow(ctx, st, 250, ["IGNUZ'26", '', '09—10.10.26']);
  // line 0 lands on the cut, each following line on the next R wave
  const mark = (i) => (i === 0 ? scene.since : events.beats[events.beats.length - scene.beats + i - 1]);
  const lines = [['Six events.', st.ink], ['Two days.', st.ink], ['One pulse.', st.accent]];
  lines.forEach(([str, col], i) => {
    const k = scene.beats >= i ? ease((clock.t - mark(i)) / 0.3) : 0;
    if (k <= 0) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 440 + i * 190, W, 190); ctx.clip();
    T(ctx, str, G - 6, 600 + i * 190 + (1 - k) * 170, head(col, 196));
    ctx.restore();
  });
  if (scene.beats >= 3) {
    const k = ease((clock.t - mark(3)) / 0.3);
    ctx.globalAlpha = k;
    ctx.fillStyle = st.ink; ctx.fillRect(G, 1080, W - 2 * G, 2);
    T(ctx, 'Prize pool', G, 1140, mono(st.ink2, 30));
    font(ctx, { size: 100, weight: 900, stretch: 'expanded', track: -4 });
    const fs = (100 * (W - 2 * G)) / ctx.measureText('₹10,000').width;
    T(ctx, '₹10,000', G - 4, 1150 + fs * 0.78, { size: fs, weight: 900, stretch: 'expanded', track: -0.04 * fs, color: st.ink });
    ctx.globalAlpha = 1;
  }
  drawStrip(ctx, st.ink, st.accent);
  finish(ctx);
}

function sceneEnd(ctx) {
  const st = STOCK.blue;
  const lt = clock.t - scene.since;
  ground(ctx, st, W, H);
  metaRow(ctx, st, 250, ['Nº IGN—26', '', 'KPRIET']);
  drawHeart(ctx, W / 2 + 10, 700, 760, 1);
  const size = wordmarkRise(ctx, st, 330, scene.since - 0.2);
  void size;
  const k = ease((lt - 0.15) / 0.5);
  ctx.globalAlpha = k;
  T(ctx, '09—10', G - 4, 1230, { size: 150, weight: 900, stretch: 'semi-expanded', track: -5, color: st.ink });
  T(ctx, 'October 2026', W - G, 1170, head(st.ink, 60, { align: 'right' }));
  T(ctx, 'KPRIET, Coimbatore', W - G, 1228, mono(st.ink2, 26, { align: 'right' }));
  const k2 = ease((lt - 0.5) / 0.5);
  ctx.globalAlpha = k2;
  ctx.fillStyle = st.ink; ctx.fillRect(G, 1290, W - 2 * G, 130);
  T(ctx, 'One-day pass from ₹200', G + 40, 1378, head(st.bg, 68));
  T(ctx, '↗', W - G - 40, 1382, { size: 70, weight: 700, color: st.bg, align: 'right' });
  T(ctx, 'Link in bio · suducodes.github.io/Ignuz26', W / 2, 1488, mono(st.accent, 26, { align: 'center', weight: 600, upper: false }));
  ctx.globalAlpha = 1;
  drawStrip(ctx, st.ink, st.accent);
  finish(ctx);
}

/* ───────────────────────────── run */

async function main() {
  for (const f of ['900 100px Archivo', '800 100px Archivo', '500 30px "IBM Plex Mono"', '600 30px "IBM Plex Mono"']) await document.fonts.load(f);
  TEX = await loadImg('/grain.png');
  await setupHeart();
  const out = document.getElementById('frame');
  const ctx = out.getContext('2d');
  let f = 0, endAt = Infinity;
  while (clock.t < MAX_T && clock.t < endAt) {
    step();
    writeStrip();
    if (scene.name === 'flat' && clock.t >= SHOCK) {
      sceneIntro(ctx);                                   // the page behind the flash
      ctx.fillStyle = `rgba(255,255,255,${1 - (clock.t - SHOCK) / (WAKE - SHOCK)})`;
      ctx.fillRect(0, 0, W, H);
    } else if (scene.name === 'flat') sceneFlat(ctx);
    else if (scene.name === 'intro') sceneIntro(ctx);
    else if (scene.name === 'montage') sceneEvent(ctx);
    else if (scene.name === 'type') sceneType(ctx);
    else { sceneEnd(ctx); if (endAt === Infinity && scene.beats >= 5) endAt = clock.t + 0.4; }
    stamp(ctx, clock.t >= SHOCK ? 1 - clamp((clock.t - SHOCK - 0.35) / 0.3) : 0);

    if (SAVE) {
      const blob = await new Promise((r) => out.toBlob(r, 'image/jpeg', 0.93));
      await fetch(`/__save?name=reel/f_${String(f).padStart(4, '0')}.jpg`, { method: 'POST', body: blob });
    } else await wait(0);
    f++;
    if (f % 30 === 0) log(`frame ${f} · t=${clock.t.toFixed(2)} · ${scene.name}`);
  }
  window.REEL = { frames: f, fps: FPS, ...events };
  if (SAVE) await fetch('/__save?name=reel/timeline.json', { method: 'POST', body: JSON.stringify(window.REEL) });
  log(`done: ${f} frames`);
  document.title = 'done';
}
main().catch((e) => { log('ERR ' + e.stack); document.title = 'error'; });
