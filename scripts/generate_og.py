"""
Generates public/og.png — a 1200x630 social share card matching the site's
design language (deep navy, indigo accents, fine grid). Re-run after edits:
    py -3 scripts/generate_og.py
"""

from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

W, H = 1200, 630
INK = (5, 8, 22)          # #050816
PANEL = (10, 15, 31)      # #0A0F1F
INDIGO = (99, 102, 241)   # #6366F1
INDIGO_LIGHT = (165, 180, 252)  # #A5B4FC
SKY = (96, 165, 250)      # #60A5FA
MUTED = (148, 163, 184)   # #94A3B8

FONT_DIR = Path(r"C:\Windows\Fonts")
BOLD = str(FONT_DIR / "arialbd.ttf")
REG = str(FONT_DIR / "arial.ttf")

name_font = ImageFont.truetype(BOLD, 92)
tag_font = ImageFont.truetype(REG, 30)
url_font = ImageFont.truetype(BOLD, 24)
small_font = ImageFont.truetype(REG, 20)

img = Image.new("RGB", (W, H), INK)
draw = ImageDraw.Draw(img, "RGBA")

# fine grid
for x in range(0, W, 54):
    draw.line([(x, 0), (x, H)], fill=(148, 163, 184, 10), width=1)
for y in range(0, H, 54):
    draw.line([(0, y), (W, y)], fill=(148, 163, 184, 10), width=1)

# soft indigo glow (concentric alpha circles)
for r in range(420, 40, -12):
    a = int(26 * (1 - r / 420))
    draw.ellipse(
        [760 - r, 200 - r, 760 + r, 200 + r],
        fill=(79, 70, 229, a),
    )

# constellation: core + nodes + links
core = (760, 200)
nodes = [
    (660, 90), (880, 70), (960, 180), (900, 320), (640, 330),
    (560, 190), (760, 30), (1050, 110), (1060, 300),
]
for n in nodes:
    draw.line([core, n], fill=(99, 102, 241, 90), width=1)
for i in range(len(nodes) - 1):
    draw.line([nodes[i], nodes[i + 1]], fill=(99, 102, 241, 55), width=1)
for n in nodes:
    draw.ellipse([n[0] - 6, n[1] - 6, n[0] + 6, n[1] + 6], fill=SKY)
draw.ellipse([core[0] - 46, core[1] - 46, core[0] + 46, core[1] + 46], fill=INDIGO_LIGHT)
draw.ellipse(
    [core[0] - 78, core[1] - 78, core[0] + 78, core[1] + 78],
    outline=(99, 102, 241, 120),
    width=2,
)

# text block
draw.text((90, 200), "ADITYA", font=name_font, fill=(248, 250, 252))
draw.text((90, 300), "MENGAR", font=name_font, fill=INDIGO_LIGHT)
draw.text(
    (94, 425),
    "Computer Engineering  ·  Data  ·  AI",
    font=tag_font,
    fill=MUTED,
)
draw.line([(94, 486), (500, 486)], fill=(99, 102, 241, 150), width=2)
draw.text((94, 510), "aditya-mengar.vercel.app", font=url_font, fill=SKY)

img.save(Path(__file__).resolve().parent.parent / "public" / "og.png", optimize=True)
print("og.png generated")
