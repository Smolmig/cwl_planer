#!/usr/bin/env python3
"""Derive every raster branding asset from the single SVG brand source."""
from io import BytesIO
from pathlib import Path
import cairosvg
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SVG = (ROOT / "brand-mark.svg").read_bytes()

def icon(size):
    data = cairosvg.svg2png(bytestring=SVG, output_width=size, output_height=size)
    return Image.open(BytesIO(data)).convert("RGBA")

for size in (192, 512):
    target = ROOT / f"brand-icon-{size}.png"
    icon(size).quantize(colors=64, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(
        target, optimize=True, compress_level=9
    )

# Static 1200 x 630 PNG: messaging previews must not depend on an SVG-only icon.
out = Image.new("RGB", (1200, 630), "#0f141d")
draw = ImageDraw.Draw(out)
draw.rounded_rectangle((48, 46, 1152, 584), radius=42, fill="#19212d", outline="#3e3525", width=3)
shield = icon(375)
out.paste(shield, (90, 126), shield)
font_file = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
heavy_file = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
headline = ImageFont.truetype(heavy_file, 87)
subtitle = ImageFont.truetype(font_file, 31)
eyebrow = ImageFont.truetype(heavy_file, 25)
draw.text((505, 187), "CWL PLANER", font=headline, fill="#dfbd7a")
draw.text((509, 323), "Dein Clan. Deine Planung.", font=subtitle, fill="#f3e8d5")
draw.text((510, 412), "CWL  •  Einsätze  •  Statistik", font=eyebrow, fill="#aeaeaa")
out.save(ROOT / "brand-social-preview.png", optimize=True)
