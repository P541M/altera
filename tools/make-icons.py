"""Generates icons/icon-{16,32,48,128,256}.png.

The mark is a single-storey "a" (a ring and a stem) in Altera's text colour
on a squircle in its surface colour. One colour, no gradients or shadows.
It's drawn at 4096px and downsampled so edges stay crisp at every size.

Usage: python tools/make-icons.py [preview.png]   (needs Pillow)
"""
import math
import sys
from pathlib import Path
from PIL import Image, ImageDraw

S = 4096
TILE = (21, 25, 32)  # --alt-surface  #151920
INK = (232, 236, 241)  # --alt-text  #e8ecf1
OUT = Path(__file__).resolve().parent.parent / "icons"


def squircle(size, inset, n=5.0, steps=720):
    c = size / 2
    r = size / 2 - inset
    pts = []
    for i in range(steps):
        t = 2 * math.pi * i / steps
        ct, st = math.cos(t), math.sin(t)
        pts.append((c + r * math.copysign(abs(ct) ** (2 / n), ct), c + r * math.copysign(abs(st) ** (2 / n), st)))
    return pts


img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.polygon(squircle(S, inset=S * 0.035), fill=TILE)

r = S * 0.19  # ring radius
w = S * 0.095  # stroke weight, shared by ring and stem
cx = S * 0.5 - w * 0.06  # optical centre: the stem makes the right side heavier
cy = S * 0.5
d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=INK)
d.ellipse([cx - r + w, cy - r + w, cx + r - w, cy + r - w], fill=TILE)
d.rectangle([cx + r - w, cy - r, cx + r, cy + r], fill=INK)

for size in (16, 32, 48, 128, 256):
    img.resize((size, size), Image.LANCZOS).save(OUT / f"icon-{size}.png", optimize=True)

if len(sys.argv) > 1:
    # Preview on Chrome's light and dark toolbars, plus a 16px blow-up.
    sheet = Image.new("RGBA", (760, 280), (255, 255, 255, 255))
    sd = ImageDraw.Draw(sheet)
    sd.rectangle([0, 140, 760, 280], fill=(53, 54, 58, 255))
    for oy in (0, 140):
        x = 30
        for size in (128, 48, 32, 16):
            sheet.alpha_composite(img.resize((size, size), Image.LANCZOS), (x, oy + 70 - size // 2))
            x += size + 30
        big = img.resize((16, 16), Image.LANCZOS).resize((112, 112), Image.NEAREST)
        sheet.alpha_composite(big, (x + 30, oy + 14))
    sheet.save(sys.argv[1])
