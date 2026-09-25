import {
  STOCK, EVENTS, G, T, mono, head, font, ground, grain, metaRow, wordmark, strip, plate, barcode,
} from './draw.js';

// The "I'm attending" share card — a patient wristband with the attendee's
// name on it, over the halftone heart. Drawn entirely client-side.

const TAU = Math.PI * 2;
export const SITE = 'suducodes.github.io/Ignuz26';
export const FORMATS = { story: [1080, 1920], post: [1080, 1350] };

// which days someone is coming — one-day passes pick Day 01 or Day 02
export const DAYS = {
  both: { key: 'Both days', date: 'Fri 09 & Sat 10 Oct 2026', short: '09—10.10.26', events: [0, 1, 2, 3, 4, 5] },
  d1: { key: 'Day 01', date: 'Fri 09 Oct 2026', short: '09.10.26', events: [0, 1, 2, 5] },
  d2: { key: 'Day 02', date: 'Sat 10 Oct 2026', short: '10.10.26', events: [3, 4, 5] },
};

// Short, stable ID from the name — a card reference, not a registration number
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function cardId(name, college = '') {
  let h = 0x811c9dc5;
  for (const ch of `${name.trim().toLowerCase()}|${college.trim().toLowerCase()}`) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  let id = '';
  for (let i = 0; i < 4; i++) { id += ALPHA[h % 32]; h = Math.floor(h / 32); }
  return `IGN26-${id}`;
}

function fitSize(ctx, str, maxW, o, max, min) {
  font(ctx, { ...o, size: 100 });
  const s = (100 * maxW) / Math.max(1, ctx.measureText(str).width);
  return Math.max(min, Math.min(max, s));
}

function wristband(ctx, cx, cy, w, h, angle, { name, college, id, day }) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  const x = -w / 2, y = -h / 2;
  const path = () => { ctx.beginPath(); ctx.roundRect(x, y, w, h, [h / 2, 24, 24, h / 2]); };
  ctx.save();
  ctx.shadowColor = 'rgba(5,12,40,0.45)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 26;
  path(); ctx.fillStyle = '#fbfcff'; ctx.fill();
  ctx.restore();
  path(); ctx.lineWidth = 3; ctx.strokeStyle = '#0a1633'; ctx.stroke();

  // snap and punched holes
  const snap = ctx.createRadialGradient(x + 56, -6, 2, x + 62, 0, 22);
  snap.addColorStop(0, '#ffffff'); snap.addColorStop(0.6, '#b3bdd0'); snap.addColorStop(1, '#7d889e');
  ctx.fillStyle = snap; ctx.beginPath(); ctx.arc(x + 62, 0, 20, 0, TAU); ctx.fill();
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = '#c9d3e6';
    ctx.beginPath(); ctx.arc(x + 108 + i * 32, 0, 9, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(10,22,51,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(10,22,51,0.55)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x + 204, y + 12); ctx.lineTo(x + 204, y + h - 12); ctx.stroke();
  ctx.setLineDash([]);

  // barcode block on the right
  const bw = 150, bx = x + w - 44 - bw;
  barcode(ctx, id, bx, y + h * 0.18, bw, h * 0.5, '#0a1633');
  T(ctx, id, bx + bw / 2, y + h * 0.84, mono('#0a1633', 17, { align: 'center', weight: 600 }));

  // name, fitted to whatever room is left
  const ix = x + 234, room = bx - 36 - ix;
  T(ctx, `IGNUZ'26 · Attendee · ${day.key}`, ix, y + h * 0.27, mono('#34425e', 20));
  const o = head('#0a1633', 100);
  const size = fitSize(ctx, name, room, o, h * 0.4, 34);
  T(ctx, name, ix, y + h * 0.27 + size * 0.98, head('#0a1633', size));
  const sub = college ? college : day.date;
  font(ctx, mono('#34425e', 19));
  let line = sub.toUpperCase();
  while (ctx.measureText(line).width > room && line.length > 4) line = `${line.slice(0, -2).trimEnd()}…`;
  T(ctx, line, ix, y + h * 0.86, mono('#34425e', 19, { upper: false }));
  ctx.restore();
}

function eventBlock(ctx, st, x, y, w, h, pick, day) {
  const plateW = Math.round(h * 4 / 3);
  if (pick === 'all') {
    const cols = day.events.length > 4 ? 3 : 2, cw = plateW / cols, ch = h / 2;
    day.events.forEach((ei, i) => {
      const ev = EVENTS[ei];
      plate(ctx, ev, x + (i % cols) * cw + 3, y + Math.floor(i / cols) * ch + 3, cw - 6, ch - 6, ev.plateStock || 'navy', false);
    });
  } else {
    const ev = EVENTS[pick];
    plate(ctx, ev, x, y, plateW, h, ev.plateStock || 'navy', false);
  }
  const tx = x + plateW + 40, tw = w - plateW - 40;
  T(ctx, 'Most excited for', tx, y + 34, mono(st.ink3, 21));
  const name = pick !== 'all' ? EVENTS[pick].name : day.events.length === 6 ? 'All six events' : `All of ${day.key}`;
  const words = name.split(' ');
  // break the name over at most two lines
  let l1 = name, l2 = '';
  font(ctx, head(st.ink, 64));
  if (ctx.measureText(name).width > tw) {
    for (let k = words.length - 1; k > 0; k--) {
      const a = words.slice(0, k).join(' ');
      if (ctx.measureText(a).width <= tw) { l1 = a; l2 = words.slice(k).join(' '); break; }
    }
  }
  const size = Math.min(64, fitSize(ctx, l1.length > l2.length ? l1 : l2, tw, head(st.ink, 64), 64, 36));
  T(ctx, l1, tx, y + 34 + size * 1.25, head(st.ink, size));
  if (l2) T(ctx, l2, tx, y + 34 + size * 2.2, head(st.ink, size));
  const kind = pick === 'all' ? (day.events.length === 6 ? 'Two days · one pulse' : `${day.events.length} events · ${day.date.replace(' 2026', '')}`) : `${EVENTS[pick].kind} · ${EVENTS[pick].day.split(' · ')[0]}`;
  T(ctx, kind, tx, y + h - 8, mono(st.accent, 20, { weight: 600 }));
}

export function drawCard(canvas, { name, college, pick, format, days = 'both', heart, texture }) {
  const day = DAYS[days] || DAYS.both;
  const [W, H] = FORMATS[format];
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const st = STOCK.blue;
  const nm = name.trim() || 'Your Name';
  const id = cardId(nm, college);
  ground(ctx, st, W, H);

  if (format === 'story') {
    metaRow(ctx, st, 250, ['Nº IGN—26', 'Attendee', day.short]);
    wordmark(ctx, st, G - 4, 290, W - 2 * G + 8);
    if (heart) ctx.drawImage(heart, 400, 420, 820, 820);
    T(ctx, "I'm", G - 4, 660, head(st.ink, 176));
    T(ctx, 'attending.', G - 4, 818, head(st.accent, 176));
    wristband(ctx, W / 2, 1010, W - 60, 250, -0.045, { name: nm, college: college.trim(), id, day });
    eventBlock(ctx, st, G, 1230, W - 2 * G, 300, pick, day);
    ctx.fillStyle = st.ink; ctx.fillRect(G, 1590, W - 2 * G, 2);
    T(ctx, `${day.date} · KPRIET, Coimbatore`, W / 2, 1644, mono(st.ink2, 22, { align: 'center' }));
    T(ctx, SITE, W / 2, 1700, mono(st.accent, 24, { align: 'center', weight: 600, upper: false }));
    strip(ctx, st, 0, W, 1810, 60, { dot: W - 170 });
  } else {
    metaRow(ctx, st, 86, ['Nº IGN—26', 'Attendee', day.short]);
    wordmark(ctx, st, G - 4, 124, W - 2 * G + 8);
    if (heart) ctx.drawImage(heart, 470, 250, 700, 700);
    T(ctx, "I'm", G - 4, 450, head(st.ink, 150));
    T(ctx, 'attending.', G - 4, 586, head(st.accent, 150));
    wristband(ctx, W / 2, 760, W - 60, 230, -0.045, { name: nm, college: college.trim(), id, day });
    eventBlock(ctx, st, G, 948, W - 2 * G, 230, pick, day);
    ctx.fillStyle = st.ink; ctx.fillRect(G, H - 92, W - 2 * G, 2);
    T(ctx, `${day.date.replace(' 2026', '')} · KPRIET`, G, H - 50, mono(st.ink, 21));
    T(ctx, SITE, W - G, H - 50, mono(st.accent, 21, { align: 'right', weight: 600, upper: false }));
  }
  if (texture) grain(ctx, texture, W, H, 0.4);
  return id;
}
