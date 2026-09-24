# IGNUZ'26 — event site

National-level technical symposium, Dept. of Biomedical Engineering, KPRIET · 09–10 Oct 2026.

Static site (Vite + vanilla JS + three.js). The whole page is designed as a clinical
record printed on ECG paper, in a blue system: sections switch between three stocks
(cool paper / cobalt `.theme-blue` / navy `.theme-navy`) by redefining the same CSS
tokens, and every canvas reads its ink from the stock it sits on.

One shared heartbeat clock (`src/pulse.js`) drives the ECG sweep, the SpO₂ pleth,
the halftone 3D heart, the blood-flow band, part of the neuron network and the nav dot.

## Interactive pieces

| Where | What it does |
|---|---|
| Hero heart | hover = heart rate climbs everywhere · click/tap = defibrillator (shock artefact on the ECG, asystole, rhythm returns) |
| Monitor | live HR + SpO₂ with pleth trace; "Audio" toggle turns on a synthesised monitor beep whose pitch follows SpO₂ |
| Nav | re-inks to the section under it; an ECG ribbon under it fills with scroll progress |
| §01 microscope | methylene-blue cheek-cell smear; cursor pans the stage, click swaps 400× ↔ 1000× |
| Blood-flow band | laminar (Poiseuille) flow that surges on each beat; cursor pushes cells; leukocytes roll along the wall |
| Event plates | each figure animates on hover; the VisionX eye tracks the cursor and constricts its pupil |
| §03 helix | hover reads Watson–Crick pairs (A–T 2 H-bonds, G–C 3); drag twists it; scrolling spins it |
| Footer | cortical network — cursor/tap fires neurons, spikes propagate to neighbours |

## Run / build

```bash
npm install
npm run dev        # http://localhost:5326  (?still freezes intros; ?still&at=<id> jumps to a section)
npm run build      # → dist/  (relative paths — works on any host or sub-folder)
npm run preview    # serve dist/ locally
```

## Deploy

`dist/` is plain static files. Upload it anywhere: the KPRIET web server, GitHub Pages,
Netlify, Vercel or Cloudflare Pages. It needs no server code.

**Before the final build, set the site's public URL** so WhatsApp/LinkedIn link previews
show the share image (they ignore relative `og:image` paths):

```bash
SITE_URL=https://your-domain.example/ npm run build
```

## Things you may want to change

| What | Where |
|---|---|
| Registration link (Google Form) | search-replace `forms.gle/512N3yDsMZzTYqtH9` in `index.html`, then re-run `node scripts/make-static.mjs` to regenerate the QR + calendar file |
| Countdown target (assumed 09:00 IST, Day 01) | `src/countdown.js` → `START` |
| Event copy, coordinators, phone numbers | `index.html` (§02 cards, §03 programme, §05 contacts) |
| Colours / type | `:root`, `.theme-blue`, `.theme-navy` tokens at the top of `src/styles.css`; heart plates via `--heart-light/mid/dark` on `.hero__heart` |

## Generated assets

Everything visual is made in this repo. Nothing is stock.

- `public/models/heart.glb`: the Bio-Vision anatomical heart, cut from 7.5 MB to 405 KB (`scripts/optimize-heart.mjs`)
- Halftone heart: live WebGL three-plate screen (white 15°, cyan 75°, navy 45°) in `src/heart.js`
- Six event plates (inkblot, schematic, iris, labyrinth, fingerprint, aperture): generative canvas in `src/plates.js`
- Microscope `src/scope.js` · blood flow `src/flow.js` · neurons `src/neurons.js` · DNA helix `src/helix.js`
- ECG + pleth sweeps `src/trace.js` · monitor audio `src/sound.js` (WebAudio, no files)
- `scripts/shot.sh <out.png> "?still" [w] [h]`: headless-Chrome capture of the dev server (use a tall
  height for a full page; headless can't go below ~500 px wide, so check phones in device emulation)
- `public/logos/*.png`: single-ink partner logos cut from the brochure (`scripts/make-logos.py`)
- `public/register-qr.svg`, `public/ignuz26.ics`: `scripts/make-static.mjs`
- `public/og.jpg` (share image) and `public/heart-still.webp` (no-WebGL fallback): rendered by
  the dev tool at `/tools/og.html` while `npm run dev` is running. It writes PNGs into `public/`,
  which were then converted to jpg/webp.
