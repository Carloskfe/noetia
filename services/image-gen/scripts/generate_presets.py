"""Generate font preset thumbnail PNGs for the ShareModal font picker.

Run from services/image-gen/:
    python3 scripts/generate_presets.py

Outputs 5 PNGs to services/web/public/presets/{font-id}.png
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from templates.base import render_card

FONTS = ['playfair', 'lato', 'merriweather', 'dancing', 'montserrat']

SAMPLE = {
    "text":   "La lectura es un viaje",
    "author": "Noetia",
    "title":  "",
}

OUTPUT_DIR = os.path.join(
    os.path.dirname(__file__), '..', '..', '..', 'services', 'web', 'public', 'presets'
)


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    for font_id in FONTS:
        png = render_card(SAMPLE, width=240, height=80, font=font_id,
                          bg_type='solid', bg_colors=['#0D1B2A'])
        path = os.path.join(OUTPUT_DIR, f"{font_id}.png")
        with open(path, 'wb') as f:
            f.write(png)
        print(f"  wrote {path}")
    print("Done.")


if __name__ == '__main__':
    main()
