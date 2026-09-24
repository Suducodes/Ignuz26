"""Cut the partner logos out of the brochure scan and turn them into single-ink
PNGs with real transparency, so they sit on the paper background like print."""
import sys, glob
import numpy as np
from PIL import Image

src = glob.glob(r'C:\Users\Sudarshan\Downloads\IGNUZ*Brochure (1).pdf')[0]
import fitz
doc = fitz.open(src)
xref = doc[0].get_images(full=True)[0][0]
import io
page = Image.open(io.BytesIO(doc.extract_image(xref)['image'])).convert('RGB')
s = page.width / 662  # crop boxes were measured on a 662px-wide preview

BOXES = {
    'kpriet': (38, 24, 232, 96),
    'bmesi':  (460, 38, 511, 88),
    'embs':   (536, 38, 622, 92),
}
INK = (10, 22, 51)

for name, box in BOXES.items():
    c = page.crop(tuple(int(v * s) for v in box))
    a = np.asarray(c).astype(np.float32) / 255
    lum = a @ np.array([0.2126, 0.7152, 0.0722])
    # anything lighter than ~0.82 (paper + faint brochure swooshes) drops out;
    # darker tones keep proportional density so the marks retain detail
    alpha = np.clip((0.82 - lum) / (0.82 - 0.18), 0, 1) ** 0.85
    out = np.zeros((*alpha.shape, 4), np.uint8)
    out[..., :3] = INK
    out[..., 3] = (alpha * 255).astype(np.uint8)
    img = Image.fromarray(out, 'RGBA')
    bbox = img.getbbox()
    img = img.crop(bbox)
    img.save(f'public/logos/{name}.png', optimize=True)
    print(name, img.size)
