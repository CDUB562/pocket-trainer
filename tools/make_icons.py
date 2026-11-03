"""Draw the app icon (orange tile, 'YES' in white) at the sizes iOS and Android ask for."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / "pwa"
ORANGE, INK = (224, 86, 26), (255, 255, 255)

def icon(size):
    img = Image.new("RGB", (size, size), ORANGE)
    d = ImageDraw.Draw(img)
    # Keep the word inside the central 70% so maskable crops never clip it.
    font = ImageFont.truetype("C:/Windows/Fonts/impact.ttf", int(size * 0.34))
    box = d.textbbox((0, 0), "YES", font=font)
    w, h = box[2] - box[0], box[3] - box[1]
    d.text(((size - w) / 2 - box[0], (size - h) / 2 - box[1]), "YES", font=font, fill=INK)
    return img

for s in (180, 192, 512):
    icon(s).save(OUT / f"icon-{s}.png", optimize=True)
print("icons written to", OUT)
