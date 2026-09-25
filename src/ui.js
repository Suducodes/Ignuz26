// Page chrome: nav state, mobile drawer, event filters, scroll reveals,
// the mobile register dock, wordmark fitting, ticker loop, wristband barcodes.

import { STILL, ecg } from './pulse.js';

export function initUI() {
  const nav = document.getElementById('nav');
  const stocks = [...document.querySelectorAll('[data-stock]')];
  const navH = () => nav.offsetHeight;
  let ticking = false;
  const onScroll = () => {
    ticking = false;
    nav.classList.toggle('is-scrolled', window.scrollY > 8);
    // the nav takes the stock of whatever section is under it
    const y = navH();
    let stock = '';
    for (const el of stocks) {
      const r = el.getBoundingClientRect();
      if (r.top <= y && r.bottom > y) { stock = el.dataset.stock; break; }
    }
    nav.classList.toggle('theme-blue', stock === 'blue');
    nav.classList.toggle('theme-navy', stock === 'navy');
    const max = document.documentElement.scrollHeight - window.innerHeight;
    nav.style.setProperty('--p', max > 0 ? (window.scrollY / max).toFixed(4) : 0);
  };
  onScroll();
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  buildTrace(nav);
  new ResizeObserver(() => buildTrace(nav)).observe(nav);

  // active section in nav
  const links = [...document.querySelectorAll('.nav__links a')];
  const byId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  const spy = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      links.forEach((a) => a.classList.remove('is-active'));
      byId.get(e.target.id)?.classList.add('is-active');
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  byId.forEach((_, id) => { const s = document.getElementById(id); if (s) spy.observe(s); });

  // mobile drawer
  const menuBtn = document.querySelector('.nav__menu');
  const drawer = document.getElementById('drawer');
  const setDrawer = (open) => {
    drawer.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.textContent = open ? 'Close' : 'Menu';
    document.body.style.overflow = open ? 'hidden' : '';
  };
  menuBtn.addEventListener('click', () => setDrawer(drawer.hidden));
  drawer.addEventListener('click', (e) => { if (e.target.closest('a')) setDrawer(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !drawer.hidden) setDrawer(false); });
  window.matchMedia('(min-width: 901px)').addEventListener('change', (m) => { if (m.matches) setDrawer(false); });

  // event filters
  const chips = [...document.querySelectorAll('.chip')];
  const specs = [...document.querySelectorAll('.spec')];
  const empty = document.querySelector('.filters__empty');
  chips.forEach((chip) => chip.addEventListener('click', () => {
    const f = chip.dataset.filter;
    chips.forEach((c) => { const on = c === chip; c.classList.toggle('is-on', on); c.setAttribute('aria-pressed', String(on)); });
    let shown = 0;
    specs.forEach((s) => {
      const hit = f === 'all' || s.dataset.tags.split(' ').includes(f);
      s.hidden = !hit;
      if (hit) shown++;
    });
    empty.hidden = shown > 0;
  }));

  // links to a card from the programme should reset any active filter
  document.querySelectorAll('.day__list a, .span-both').forEach((a) => a.addEventListener('click', () => {
    const id = a.getAttribute('href').slice(1);
    const target = document.getElementById(id);
    if (target?.hidden) chips[0].click();
  }));

  // reveals (stats count up like a monitor settling on a reading)
  const rev = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('is-in');
      e.target.querySelectorAll('[data-num]').forEach(countUp);
      rev.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('[data-reveal]').forEach((el, i) => {
    if (STILL) return el.classList.add('is-in');
    el.style.transitionDelay = `${(i % 4) * 70}ms`;
    rev.observe(el);
  });

  // mobile dock: after the hero, hidden while the wristbands are on screen
  const hero = document.getElementById('top');
  const bands = document.querySelector('.bands');
  const foot = document.querySelector('.foot__cta');
  let pastHero = false, bandsOn = false, footOn = false;
  const syncDock = () => document.body.classList.toggle('past-hero', pastHero && !bandsOn && !footOn);
  new IntersectionObserver(([e]) => { pastHero = !e.isIntersecting && e.boundingClientRect.top < 0; syncDock(); }).observe(hero);
  new IntersectionObserver(([e]) => { bandsOn = e.isIntersecting; syncDock(); }).observe(bands);
  new IntersectionObserver(([e]) => { footOn = e.isIntersecting; syncDock(); }).observe(foot);

  // ticker: duplicate once so the -50% loop is seamless
  const track = document.querySelector('.ticker__track');
  if (track) track.append(...[...track.children].map((n) => n.cloneNode(true)));

  // barcodes
  document.querySelectorAll('svg[data-code39]').forEach((svg) => code39(svg, svg.dataset.code39));

  // ?still&at=<id> — jump straight to a section (used for screenshots)
  const at = new URLSearchParams(location.search).get('at');
  if (STILL && at) {
    const go = () => document.getElementById(at)?.scrollIntoView({ behavior: 'instant' });
    go();
    document.fonts?.ready.then(go);
  }

  // fit the wordmarks to their measure
  const fits = [document.querySelector('.wordmark__fit'), document.querySelector('.foot__giant > span')].filter(Boolean);
  const fit = () => fits.forEach(fitText);
  fit();
  document.fonts?.ready.then(fit);
  // refit on width changes only — fitting changes the height, which would
  // otherwise re-trigger the observer
  let lastW = 0;
  new ResizeObserver(() => {
    const w = document.body.clientWidth;
    if (w !== lastW) { lastW = w; fit(); }
  }).observe(document.body);
}

// ECG ribbon under the nav; the live copy is clipped to scroll progress
function buildTrace(nav) {
  const w = nav.clientWidth;
  if (!w) return;
  const beat = 96;
  let d = 'M0 9';
  for (let x = 0; x <= w; x += 2) {
    const v = ecg(((x % beat) / beat + 0.55) % 1);
    d += `L${x} ${(9 - v * 7).toFixed(2)}`;
  }
  for (const svg of nav.querySelectorAll('.nav__trace svg')) {
    svg.setAttribute('viewBox', `0 0 ${w} 14`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.innerHTML = `<path d="${d}"/>`;
  }
}

function countUp(el) {
  const to = Number(el.dataset.num);
  const pad = el.textContent.trim().length;
  if (STILL || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const t0 = performance.now(), dur = 1200;
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    const v = Math.round(to * (1 - (1 - k) ** 3));
    el.textContent = String(v).padStart(pad, '0');
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// el is an inline-block run of text; its parent carries the font-size
function fitText(el) {
  const host = el.parentElement;
  const box = host.parentElement.getBoundingClientRect();
  const cs = getComputedStyle(host.parentElement);
  const avail = box.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  host.style.fontSize = '100px';
  const natural = el.getBoundingClientRect().width;
  if (!natural) return;
  host.style.fontSize = `${(100 * avail) / natural}px`;
}

// Code 39 — real, scannable (reads e.g. "IGN26-1W" = one-day, white band)
const C39 = {
  0: '000110100', 1: '100100001', 2: '001100001', 3: '101100000', 4: '000110001', 5: '100110000', 6: '001110000',
  7: '000100101', 8: '100100100', 9: '001100100', G: '000001101', I: '001001100', N: '000010011', R: '100000110',
  W: '111000000', B: '001001001', D: '000011001', '-': '010000101', '*': '010010100',
};
function code39(svg, text) {
  const NARROW = 1, WIDE = 2.6;
  let x = 0;
  const rects = [];
  for (const ch of `*${text}*`) {
    const p = C39[ch];
    if (!p) continue;
    for (let i = 0; i < 9; i++) {
      const w = p[i] === '1' ? WIDE : NARROW;
      if (i % 2 === 0) rects.push(`<rect x="${x.toFixed(2)}" width="${w}" height="40"/>`);
      x += w;
    }
    x += NARROW;
  }
  svg.setAttribute('viewBox', `0 0 ${x.toFixed(2)} 40`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('fill', '#0a1633');
  svg.innerHTML = rects.join('');
}
