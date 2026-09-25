import './styles.css';
import './pass.css';
import { loadImg } from './draw.js';
import { drawCard, SITE, DAYS } from './card.js';

// "I'm attending" card maker: form → live canvas preview → download / share.

const form = document.getElementById('pass-form');
const canvas = document.getElementById('card');
const idOut = document.getElementById('card-id');
const dl = document.getElementById('dl');
const shareBtn = document.getElementById('share');
const asset = (p) => new URL(p, document.baseURI).href;

let heart = null, texture = null, queued = false;

function state() {
  const f = new FormData(form);
  const pick = f.get('pick');
  return {
    name: (f.get('name') || '').toString().slice(0, 26),
    college: (f.get('college') || '').toString().slice(0, 40),
    pick: pick === 'all' ? 'all' : Number(pick),
    format: f.get('format') || 'story',
    days: f.get('days') || 'both',
  };
}

function render() {
  queued = false;
  const s = state();
  idOut.textContent = drawCard(canvas, { ...s, heart, texture });
  canvas.parentElement.dataset.format = s.format;
}
const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(render); } };

function fileName() {
  const slug = state().name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'attendee';
  return `ignuz26-attending-${slug}.png`;
}
const toBlob = () => new Promise((r) => canvas.toBlob(r, 'image/png'));

dl.addEventListener('click', async () => {
  render();
  const url = URL.createObjectURL(await toBlob());
  const a = Object.assign(document.createElement('a'), { href: url, download: fileName() });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
});

// native share sheet (phones) — straight into Instagram / WhatsApp stories
async function share() {
  render();
  const file = new File([await toBlob()], fileName(), { type: 'image/png' });
  try {
    await navigator.share({ files: [file], title: "I'm attending IGNUZ'26", text: `I'm attending IGNUZ'26 (${DAYS[state().days].date.replace(' 2026', '')}) at KPRIET. One-day passes from ₹200: https://${SITE}/` });
  } catch { /* dismissed */ }
}
if (navigator.canShare?.({ files: [new File([''], 'x.png', { type: 'image/png' })] })) {
  shareBtn.hidden = false;
  shareBtn.addEventListener('click', share);
}

// a one-day attendee can only be excited about that day's events
function syncPicks() {
  const allowed = DAYS[state().days].events;
  for (const input of form.querySelectorAll('input[name=pick]')) {
    if (input.value === 'all') continue;
    const ok = allowed.includes(Number(input.value));
    input.disabled = !ok;
    input.closest('label').classList.toggle('is-off', !ok);
    if (!ok && input.checked) form.querySelector('input[name=pick][value=all]').checked = true;
  }
}
form.addEventListener('change', (e) => { if (e.target.name === 'days') syncPicks(); });
form.addEventListener('input', schedule);
form.addEventListener('submit', (e) => e.preventDefault());

(async () => {
  render();                                         // layout first, fonts may still be loading
  await Promise.all([
    document.fonts.load('900 100px Archivo'), document.fonts.load('800 100px Archivo'),
    document.fonts.load('500 20px "IBM Plex Mono"'), document.fonts.load('600 20px "IBM Plex Mono"'),
  ]).catch(() => {});
  [heart, texture] = await Promise.all([
    loadImg(asset('heart-still.webp')).catch(() => null),
    loadImg(asset('grain.png')).catch(() => null),
  ]);
  render();
})();
