import { pulse, onFrame } from './pulse.js';
import { sound } from './sound.js';

// Doors assumed at 09:00 IST on Day 01 — change here if the schedule says otherwise.
const START = Date.UTC(2026, 9, 9, 3, 30);   // Fri 09 Oct 2026, 09:00 IST
const DAY2 = Date.UTC(2026, 9, 10, 3, 30);   // Sat 10 Oct 2026, 09:00 IST
const END = Date.UTC(2026, 9, 10, 13, 30);   // Sat 10 Oct 2026, 19:00 IST

const pad = (n) => String(n).padStart(2, '0');
const $ = (id) => document.getElementById(id);

export function initCountdown() {
  const el = {
    d: $('cd-d'), h: $('cd-h'), m: $('cd-m'), s: $('cd-s'),
    label: $('cd-label'),
    bpm: $('bpm'), spo2: $('spo2'), state: $('mon-state'), snd: $('snd'),
    echoes: document.querySelectorAll('#strip-bpm, .flow__hr'),
  };
  if (!el.d) return;
  const monitor = el.d.closest('.monitor');

  function tick() {
    const now = Date.now();
    let left = Math.max(0, START - now);
    if (now >= START) {
      el.label.textContent = now >= END ? 'Record complete · thank you' : now >= DAY2 ? 'In session · Day 02' : 'In session · Day 01';
      left = 0;
    }
    const s = Math.floor(left / 1000);
    el.d.textContent = pad(Math.floor(s / 86400));
    el.h.textContent = pad(Math.floor((s % 86400) / 3600));
    el.m.textContent = pad(Math.floor((s % 3600) / 60));
    el.s.textContent = pad(s % 60);
  }
  tick();
  setInterval(tick, 1000);

  // audio opt-in
  el.snd?.addEventListener('click', () => {
    sound.set(!sound.on);
    el.snd.setAttribute('aria-pressed', String(sound.on));
    el.snd.textContent = sound.on ? 'Audio on' : 'Audio off';
  });

  // shock: the monitor shows the discharge, then "---" through asystole
  pulse.onShock(() => {
    sound.zap();
    monitor.classList.remove('is-shock');
    void monitor.offsetWidth;
    monitor.classList.add('is-shock');
    el.state.lastChild.textContent = 'SHOCK 200J';
    el.bpm.textContent = '---';
    setTimeout(() => {
      monitor.classList.remove('is-shock');
      el.state.lastChild.textContent = 'LIVE';
    }, pulse.FLATLINE * 1000);
  });

  // HR / SpO₂: updated once per beat, with the ±1 wobble a real monitor shows
  let shown = 72, sat = 98, beats = 0;
  onFrame(() => {
    if (!pulse.rWave) return;
    beats++;
    const v = Math.round(pulse.bpm + (Math.random() - 0.5) * 2);
    if (beats % 6 === 0) sat = 97 + Math.round(Math.random() * 2);
    sound.beep(sat);
    if (v !== shown || el.bpm.textContent === '---') {
      shown = v;
      el.bpm.textContent = v;
      el.echoes.forEach((n) => { n.textContent = v; });
    }
    if (el.spo2.textContent !== String(sat)) el.spo2.textContent = sat;
  });
}
