"""Build the reel's soundtrack from the render timeline and encode the MP4.

Run after tools/reel.html has written public/reel/f_*.jpg + timeline.json:
    python scripts/encode-reel.py

Audio is synthesised to match the picture exactly: flatline alarm tone, the
defibrillator charging whine, the discharge, then a pulse-ox beep plus a soft
lub-dub thump on every R wave the renderer logged.
"""
import json
import shutil
import subprocess
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
FRAMES = ROOT / 'public' / 'reel'
OUT = ROOT / 'social-kit' / 'reel'
SR = 48000

tl = json.loads((FRAMES / 'timeline.json').read_text())
fps, frames = tl['fps'], tl['frames']
dur = frames / fps
n = int(dur * SR) + SR // 2
mix = np.zeros(n)
t = np.arange(n) / SR


def add(start, sig):
    i = int(start * SR)
    j = min(n, i + len(sig))
    if i < n:
        mix[i:j] += sig[: j - i]


def env(length, attack=0.005, decay=None):
    k = np.arange(int(length * SR)) / SR
    e = np.minimum(1, k / attack)
    if decay:
        e *= np.exp(-k / decay)
    return k, e


shock = tl['shock']

# flatline alarm: the continuous tone of asystole, cut dead by the shock
k, e = env(shock - 0.02, attack=0.04)
add(0.0, 0.10 * np.sin(2 * np.pi * 880 * k) * e)

# capacitor charging whine, rising
k, _ = env(shock - 0.2)
f = 500 * (2400 / 500) ** (k / k[-1])
phase = 2 * np.pi * np.cumsum(f) / SR
add(0.15, 0.05 * (k / k[-1]) ** 1.5 * (np.sin(phase) + 0.3 * np.sin(2 * phase)))

# discharge: filtered noise crack + low thump
k, e = env(0.4, attack=0.002, decay=0.07)
noise = np.random.default_rng(26).standard_normal(len(k))
lp = np.zeros_like(noise)
for i in range(1, len(noise)):                    # one-pole low-pass
    lp[i] = lp[i - 1] + 0.18 * (noise[i] - lp[i - 1])
add(shock, 0.9 * lp * e)
k, e = env(0.35, attack=0.004, decay=0.09)
add(shock, 0.6 * np.sin(2 * np.pi * 52 * k) * e)

# every R wave: monitor beep + lub-dub
beats = tl['beats']
for i, b in enumerate(beats):
    period = (beats[i + 1] - b) if i + 1 < len(beats) else 0.8
    k, e = env(0.11, attack=0.004, decay=0.045)
    add(b, 0.20 * (np.sin(2 * np.pi * 880 * k) + 0.15 * np.sin(2 * np.pi * 1760 * k)) * e)
    k, e = env(0.16, attack=0.006, decay=0.05)
    add(b + 0.01, 0.42 * np.sin(2 * np.pi * 58 * k) * e)                  # lub
    add(b + 0.32 * period, 0.26 * np.sin(2 * np.pi * 50 * k) * e)         # dub

# master: gentle saturation, normalise to -1 dBFS, short fade out
mix = np.tanh(mix * 1.4)
mix *= 10 ** (-1 / 20) / np.max(np.abs(mix))
fade = int(0.35 * SR)
end = int(dur * SR)
mix[end - fade:end] *= np.linspace(1, 0, fade)
mix[end:] = 0
pcm = (np.stack([mix, mix], axis=1)[:end] * 32767).astype('<i2')

OUT.mkdir(parents=True, exist_ok=True)
wav = FRAMES / 'soundtrack.wav'
with wave.open(str(wav), 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())

mp4 = OUT / 'ignuz26-reel.mp4'
subprocess.run([
    'ffmpeg', '-y', '-loglevel', 'error',
    '-framerate', str(fps), '-i', str(FRAMES / 'f_%04d.jpg'), '-i', str(wav),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-r', str(fps), '-c:a', 'aac', '-b:a', '192k', '-ar', str(SR), '-shortest', '-movflags', '+faststart',
    str(mp4),
], check=True)

# covers: the heart title and the end card
cover_i = min(frames - 1, int((tl['cuts'][1][1] - 0.4) * fps))   # just before the montage starts
shutil.copy(FRAMES / f'f_{cover_i:04d}.jpg', OUT / 'cover-heart.jpg')
shutil.copy(FRAMES / f'f_{frames - 1:04d}.jpg', OUT / 'cover-endcard.jpg')
print(f'{mp4.name}: {dur:.2f}s, {frames} frames, {len(beats)} beats · {mp4.stat().st_size // 1024} KB')
