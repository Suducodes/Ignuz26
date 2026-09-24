// Canvas drawings take their colours from the CSS stock they sit on, so a
// canvas inside a .theme-navy section re-inks itself without any JS palette.

const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });

/** Resolve any CSS colour string to [r, g, b, a(0–1)]. */
export function rgbOf(color) {
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = '#000';
  probe.fillStyle = color;
  probe.fillRect(0, 0, 1, 1);
  const d = probe.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2], d[3] / 255];
}

/** A custom property off `el`, resolved to rgb. */
export function tokenRGB(el, name, fallback = '#0a1633') {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return rgbOf(v || fallback);
}

export const rgba = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${(c[3] ?? 1) * a})`;
export const hex = (c) => `#${c.slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('')}`;
