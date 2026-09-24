import { ecg, pleth } from './wave.js';
import { PAINTERS } from './painters.js';

// Canvas layout kit in the site's language — stocks, ECG paper, mono labels,
// condensed heads, the wordmark, wristbands, barcodes and specimen plates.
// Used by the Instagram generator (tools/social.js), the reel (tools/reel.js)
// and the attendee card page (pass.html). Pure drawing; no DOM beyond canvases.

const TAU = Math.PI * 2;
export const G = 64;                    // outer margin on 1080-wide artwork

export const STOCK = {
  blue: { bg: '#1f45e0', ink: '#f4f7ff', ink2: 'rgba(244,247,255,0.9)', ink3: 'rgba(244,247,255,0.74)', accent: '#8fe6ff', line: 'rgba(244,247,255,0.3)', minor: 'rgba(255,255,255,0.075)', major: 'rgba(255,255,255,0.17)' },
  navy: { bg: '#0a1633', ink: '#eaf0ff', ink2: 'rgba(234,240,255,0.86)', ink3: 'rgba(234,240,255,0.66)', accent: '#62d6ff', line: 'rgba(234,240,255,0.2)', minor: 'rgba(98,214,255,0.06)', major: 'rgba(98,214,255,0.14)' },
  paper: { bg: '#eef2f9', ink: '#0a1633', ink2: '#34425e', ink3: '#56627d', accent: '#1f45e0', line: 'rgba(10,22,51,0.18)', minor: 'rgba(31,69,224,0.08)', major: 'rgba(31,69,224,0.18)' },
};
export const PLATE = {
  paper: { bg: '#dde5f2', ink: '#0a1633', accent: '#1f45e0' },
  cyano: { bg: '#133184', ink: '#eaf0ff', accent: '#8fe6ff' },
  navy: { bg: '#152650', ink: '#eaf0ff', accent: '#62d6ff' },
};
// frozen states that show each figure's behaviour in a still
export const PLATE_STATE = {
  inkblot: { hover: 0, ht: 0 },
  schematic: { hover: 1, ht: 1.35 },
  iris: { hover: 0.75, ht: 2.2, look: { x: -0.35, y: -0.2 } },
  maze: { hover: 1, ht: 0 },
  fingerprint: { hover: 1, ht: 1.56 },
  aperture: { hover: 1, ht: 1.25 },
};

export const EVENTS = [
  { code: 'IGN—01', name: 'Ink 2 Impact', kind: 'Paper presentation', cat: 'Technical', day: 'Day 01 · Fri 09.10', plate: 'inkblot', fig: 'Fig. 01 — Inkblot, bilateral', desc: 'Share your take on emerging healthcare tech.', rules: ['Teams of 2–4', '6–7 min talk + 2–3 min Q&A', 'Max 8 slides', 'Cite sources, no plagiarism'], coord: 'Preethisri K', tel: '+91 73959 71312' },
  { code: 'IGN—02', name: 'Beyond the Blueprint', kind: 'Project presentation', cat: 'Technical', day: 'Day 01 · Fri 09.10', plate: 'schematic', plateStock: 'cyano', fig: 'Fig. 02 — Schematic, rev. B', desc: 'Bring your working prototype and walk the judges through the concept, how it works and its real-world impact.', rules: ['Working prototype', 'Judged on concept, working & impact'], coord: 'Sugunadevi I', tel: '+91 96777 27132' },
  { code: 'IGN—03', name: 'VisionX', kind: 'AR / VR hands-on', cat: 'Workshop', day: 'Day 01 · Fri 09.10', plate: 'iris', fig: 'Fig. 03 — Iris, tracking', desc: 'Hands-on AR/VR workshop exploring immersive tech in healthcare through guided, practical activities.', rules: ['Guided sessions', 'Immersive tech in healthcare'], coord: 'Amirthavarshini V', tel: '+91 82481 08600' },
  { code: 'IGN—04', name: 'Tech Heist 3.0', kind: 'Treasure hunt', cat: 'Technical', day: 'Day 02 · Sat 10.10', plate: 'maze', stock: 'navy', fig: 'Fig. 04 — Labyrinth, solved', desc: 'Decode clues, crack technical puzzles and clear every challenge to reach the final stage.', rules: ['Clue-based rounds', 'Technical puzzles'], coord: 'Amritaa Shree V J', tel: '+91 88078 23776' },
  { code: 'IGN—05', name: 'BioSync', kind: 'Blindfold', cat: 'Non-technical', day: 'Day 02 · Sat 10.10', plate: 'fingerprint', fig: 'Fig. 05 — Dermal ridges, by touch', desc: 'Blindfolded, identify 5–6 biomedical instruments by touch alone. How well do you know your equipment?', rules: ['5–6 instruments', 'Touch only'], coord: 'Akshara Patel', tel: '+91 82928 79261' },
  { code: 'IGN—06', name: 'Freeze the Frame', kind: 'Photography', cat: 'Day 1 & 2', day: 'Fri–Sat · 09–10.10', plate: 'aperture', fig: 'Fig. 06 — Aperture, f/2.8', desc: 'Capture campus moments on your mobile phone. Minimal edits.', rules: ['Mobile phone only', 'Minimal edits', '16:9 or 4:3 frame only'], coord: 'Arjun R', tel: '+91 93605 64398' },
];

export function make(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

export function font(ctx, { size = 32, weight = 500, family = 'sans', stretch = 'normal', track = 0 }) {
  ctx.font = `${weight} ${size}px ${family === 'mono' ? '"IBM Plex Mono"' : 'Archivo'}`;
  ctx.fontStretch = stretch;
  ctx.letterSpacing = `${track}px`;
}
export function T(ctx, str, x, y, o) {
  font(ctx, o);
  ctx.fillStyle = o.color;
  ctx.textAlign = o.align || 'left';
  ctx.textBaseline = o.base || 'alphabetic';
  const s = o.upper ? str.toUpperCase() : str;
  ctx.fillText(s, x, y);
  return ctx.measureText(s).width;
}
export const mono = (color, size = 24, extra = {}) => ({ family: 'mono', size, weight: 500, track: size * 0.09, upper: true, color, ...extra });
export const head = (color, size, extra = {}) => ({ size, weight: 800, stretch: 'condensed', track: -size * 0.02, color, ...extra });

export function wrapLines(ctx, str, maxW, o) {
  font(ctx, o);
  const lines = [];
  let line = '';
  for (const w of str.split(' ')) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}
export function wrap(ctx, str, x, y, maxW, lh, o) {
  const lines = wrapLines(ctx, str, maxW, o);
  lines.forEach((l, i) => T(ctx, l, x, y + i * lh, o));
  return lines.length;
}

export function ground(ctx, st, w, h, grid = true, m = 18) {
  ctx.fillStyle = st.bg;
  ctx.fillRect(0, 0, w, h);
  if (!grid) return;
  for (let i = 0, x = 0; x <= w; i++, x += m) { ctx.fillStyle = i % 5 ? st.minor : st.major; ctx.fillRect(x, 0, i % 5 ? 1 : 1.6, h); }
  for (let i = 0, y = 0; y <= h; i++, y += m) { ctx.fillStyle = i % 5 ? st.minor : st.major; ctx.fillRect(0, y, w, i % 5 ? 1 : 1.6); }
}

export function grain(ctx, texture, w, h, a = 0.4, dx = 0, dy = 0) {
  const p = ctx.createPattern(texture, 'repeat');
  p.setTransform(new DOMMatrix().translate(dx, dy).scale(1.6));
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = p;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

export function metaRow(ctx, st, y, [l, c, r], size = 22) {
  const W = ctx.canvas.width;
  const o = mono(st.ink, size);
  if (l) T(ctx, l, G, y, o);
  if (c) T(ctx, c, W / 2, y, { ...o, align: 'center' });
  if (r) T(ctx, r, W - G, y, { ...o, align: 'right' });
  ctx.fillStyle = st.ink;
  ctx.fillRect(G, y + 18, W - 2 * G, 2);
}

export function sectionHead(ctx, st, y, no, title, meta) {
  const W = ctx.canvas.width;
  ctx.fillStyle = st.ink;
  ctx.fillRect(G, y, W - 2 * G, 3);
  const o = mono(st.ink, 22);
  const a = T(ctx, no, G, y + 42, { ...o, color: st.accent });
  const b = T(ctx, title, G + a + 18, y + 42, o);
  let mw = 0;
  if (meta) mw = T(ctx, meta, W - G, y + 42, { ...o, color: st.ink3, align: 'right' });
  ctx.strokeStyle = st.line;
  ctx.setLineDash([4, 6]);
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(G + a + b + 40, y + 34); ctx.lineTo(W - G - mw - 22, y + 34); ctx.stroke();
  ctx.setLineDash([]);
}

export function wordmark(ctx, st, x, top, width, color) {
  font(ctx, { size: 100, weight: 900, stretch: 'expanded', track: -3.5 });
  const size = (100 * width) / ctx.measureText("IGNUZ'26").width;
  T(ctx, "IGNUZ'26", x, top + size * 0.74, { size, weight: 900, stretch: 'expanded', track: -0.035 * size, color: color || st.ink });
  return size;
}

export function strip(ctx, st, x0, x1, base, gain, { calib = true, beat = 250, off = 0.62, lw = 3, dot = null, color } = {}) {
  ctx.strokeStyle = color || st.ink;
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, base);
  let s = x0;
  if (calib) {
    ctx.lineTo(x0 + 22, base); ctx.lineTo(x0 + 22, base - gain); ctx.lineTo(x0 + 72, base - gain); ctx.lineTo(x0 + 72, base); ctx.lineTo(x0 + 92, base);
    s = x0 + 92;
  }
  const y = (x) => base - ecg((((x - s) / beat + off) % 1 + 1) % 1) * gain;
  for (let x = s; x <= x1; x += 1.5) ctx.lineTo(x, y(x));
  ctx.stroke();
  if (dot != null) {
    ctx.fillStyle = 'rgba(143,230,255,0.28)';
    ctx.beginPath(); ctx.arc(dot, y(dot), lw * 5, 0, TAU); ctx.fill();
    ctx.fillStyle = st.accent;
    ctx.beginPath(); ctx.arc(dot, y(dot), lw * 1.9, 0, TAU); ctx.fill();
  }
}

export function plethTrace(ctx, x0, x1, base, gain, color, beat = 260, lw = 3) {
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let x = x0; x <= x1; x += 1.5) {
    const y = base - pleth((((x - x0) / beat + 0.4) % 1 + 1) % 1) * gain;
    x === x0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
}

export function cross(ctx, x, y, s, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x - s / 2, y - 1, s, 2);
  ctx.fillRect(x - 1, y - s / 2, 2, s);
}

export function plate(ctx, ev, x, y, w, h, stockName = 'paper', caption = true, { painter, state } = {}) {
  const col = PLATE[stockName];
  ctx.fillStyle = col.bg;
  ctx.fillRect(x, y, w, h);
  const cssW = 470;
  const dpr = w / cssW;
  const c = make(Math.round(w), Math.round(h));
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const s = { intro: 1, ...PLATE_STATE[ev.plate], ...state };
  (painter || PAINTERS[ev.plate]()).draw(g, {
    w: cssW, h: h / dpr, dpr, intro: s.intro, hover: s.hover, hovering: false, ht: s.ht,
    ink: col.ink, accent: col.accent, bg: col.bg, look: s.look || { x: 0, y: 0 },
  });
  ctx.drawImage(c, x, y);
  const m = Math.max(16, w * 0.024), cs = Math.max(18, w * 0.03);
  // the aperture draws its own crop marks; tiny thumbnails don't need them
  if (w >= 220 && ev.plate !== 'aperture') {
    ctx.globalAlpha = 0.55;
    cross(ctx, x + m + cs / 2, y + m + cs / 2, cs, col.ink);
    cross(ctx, x + w - m - cs / 2, y + m + cs / 2, cs, col.ink);
    ctx.globalAlpha = 1;
  }
  if (caption) T(ctx, ev.fig, x + m, y + h - m, mono(col.ink, Math.max(15, Math.round(w * 0.021)), { color: col.ink }));
}

export function tag(ctx, st, str, x, y, size = 20, filled = false, dashed = false) {
  font(ctx, mono(st.ink, size));
  const s = str.toUpperCase();
  const tw = ctx.measureText(s).width;
  const pw = tw + size * 0.9, ph = size * 1.6;
  if (filled) { ctx.fillStyle = st.accent; ctx.fillRect(x, y - ph + size * 0.45, pw, ph); }
  ctx.strokeStyle = filled ? st.accent : st.ink;
  ctx.lineWidth = 1.6;
  if (dashed) ctx.setLineDash([5, 4]);
  ctx.strokeRect(x, y - ph + size * 0.45, pw, ph);
  ctx.setLineDash([]);
  T(ctx, s, x + size * 0.45, y, mono(filled ? st.bg : st.ink, size, { upper: false }));
  return pw;
}

// Code 39 — same scannable encoding as the site's wristbands
export const C39 = {
  0: '000110100', 1: '100100001', 2: '001100001', 3: '101100000', 4: '000110001', 5: '100110000', 6: '001110000',
  7: '000100101', 8: '100100100', 9: '001100100', A: '100001001', B: '001001001', C: '101001000', D: '000011001',
  E: '100011000', F: '001011000', G: '000001101', H: '100001100', I: '001001100', J: '000011100', K: '100000011',
  L: '001000011', M: '101000010', N: '000010011', O: '100010010', P: '001010010', Q: '000000111', R: '100000110',
  S: '001000110', T: '000010110', U: '110000001', V: '011000001', W: '111000000', X: '010010001', Y: '110010000',
  Z: '011010000', '-': '010000101', '.': '110000100', ' ': '011000100', '*': '010010100',
};
export function barcode(ctx, text, x, y, w, h, color) {
  const bars = [];
  let u = 0;
  for (const ch of `*${text}*`) {
    const p = C39[ch];
    if (!p) continue;
    for (let i = 0; i < 9; i++) { const bw = p[i] === '1' ? 2.6 : 1; if (i % 2 === 0) bars.push([u, bw]); u += bw; }
    u += 1;
  }
  ctx.fillStyle = color;
  for (const [bx, bw] of bars) ctx.fillRect(x + (bx / u) * w, y, (bw / u) * w, h);
}

export function band(ctx, x, y, w, h, { blue, type, price, code, bandName }) {
  const bg = blue ? '#1f45e0' : '#fbfcff';
  const fg = blue ? '#f4f7ff' : '#0a1633';
  const r = h / 2;
  const path = () => { ctx.beginPath(); ctx.roundRect(x, y, w, h, [r, 22, 22, r]); };
  ctx.save();
  ctx.shadowColor = 'rgba(10,22,51,0.35)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 22;
  path(); ctx.fillStyle = bg; ctx.fill();
  ctx.restore();
  path(); ctx.lineWidth = 2.5; ctx.strokeStyle = blue ? '#1631a8' : '#0a1633'; ctx.stroke();
  // snap + holes
  const cy = y + h / 2;
  const snap = ctx.createRadialGradient(x + 52, cy - 6, 2, x + 58, cy, 20);
  snap.addColorStop(0, '#ffffff'); snap.addColorStop(0.6, '#b3bdd0'); snap.addColorStop(1, '#7d889e');
  ctx.fillStyle = snap; ctx.beginPath(); ctx.arc(x + 58, cy, 18, 0, TAU); ctx.fill();
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = '#c9d3e6';
    ctx.beginPath(); ctx.arc(x + 100 + i * 30, cy, 8.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(10,22,51,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  ctx.strokeStyle = fg; ctx.globalAlpha = 0.6; ctx.setLineDash([6, 6]); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x + 190, y + 10); ctx.lineTo(x + 190, y + h - 10); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  // id
  const ix = x + 220;
  const sub = blue ? 'rgba(244,247,255,0.8)' : '#34425e';
  const kW = T(ctx, "IGNUZ'26 · Admit one", ix, y + h * 0.3, mono(fg, 19, { color: sub }));
  const tW = T(ctx, type, ix, y + h * 0.63, head(fg, h * 0.29));
  const fW = T(ctx, 'Both days · 09–10.10.26', ix, y + h * 0.84, mono(fg, 17, { color: sub }));
  const idRight = ix + Math.max(kW, tW, fW);
  // price
  const pw = T(ctx, price, x + w - 40, y + h * 0.7, { size: h * 0.5, weight: 900, stretch: 'semi-expanded', track: -h * 0.02, color: fg, align: 'right' });
  const rw = T(ctx, '₹', x + w - 44 - pw, y + h * 0.4, { size: h * 0.18, weight: 700, color: fg, align: 'right' });
  // barcode in the space between the two — fixed width so both bands match
  const bw = 100, bx = x + w - 44 - pw - rw - 30 - bw;
  if (bx >= idRight + 16) {
    if (blue) { ctx.fillStyle = '#fbfcff'; ctx.fillRect(bx - 10, y + h * 0.2 - 8, bw + 20, h * 0.6 + 16); }
    barcode(ctx, code, bx, y + h * 0.2, bw, h * 0.6, '#0a1633');
  }
}

export function footer(ctx, st, h, left, right = 'Link in bio ↗') {
  const W = ctx.canvas.width;
  ctx.fillStyle = st.ink;
  ctx.fillRect(G, h - 92, W - 2 * G, 2);
  T(ctx, left, G, h - 50, mono(st.ink, 21));
  T(ctx, right, W - G, h - 50, mono(st.accent, 21, { align: 'right' }));
}

export function recolor(img, color) {
  const c = make(img.width, img.height);
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

export function loadImg(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}
