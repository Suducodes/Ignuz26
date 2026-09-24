// Pure waveform maths shared by the live page, the Instagram kit and the
// attendee cards. No side effects, so importing it never starts an animation loop.

const g = (x, mu, s) => Math.exp(-((x - mu) ** 2) / (2 * s * s));
const frac = (x) => x - Math.floor(x);

/** Synthetic lead-II complex, input in [0,1) of one beat, output in mV. */
export function ecg(p) {
  return (
    g(p, 0.12, 0.022) * 0.13 +     // P
    g(p, 0.232, 0.007) * -0.13 +   // Q
    g(p, 0.25, 0.0095) * 1.05 +    // R
    g(p, 0.268, 0.009) * -0.26 +   // S
    g(p, 0.46, 0.042) * 0.29       // T
  );
}

/** Finger plethysmograph: arrives ~0.3 beat after R, sharp upstroke, dicrotic notch. */
export function pleth(p) {
  const q = frac(p - 0.3);
  const up = q < 0.12 ? g(q, 0.12, 0.045) : g(q, 0.12, 0.12);
  return up * 0.92 + g(q, 0.37, 0.045) * 0.22;
}

/** What the ECG pen reads `s` seconds after a shock: rail, rebound, then asystole. */
export function shockTrace(s) {
  if (s < 0.035) return 3.4;
  if (s < 0.08) return -2.2;
  if (s < 0.5) return -2.2 * Math.exp(-(s - 0.08) * 11);
  return (Math.random() - 0.5) * 0.02;
}

/** Mechanical "lub-dub" envelope for things that should visibly beat. */
export function contraction(p) {
  return g(p, 0.29, 0.03) + 0.4 * g(p, 0.47, 0.035);
}
