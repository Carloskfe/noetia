import io
import os
import textwrap

from PIL import Image, ImageDraw, ImageFont

# ── Font registry ─────────────────────────────────────────────────────────────

_FONT_DIR = os.path.join(os.path.dirname(__file__), '..', 'fonts')

VALID_FONTS = {
    'playfair':     os.path.join(_FONT_DIR, 'playfair.ttf'),
    'lato':         os.path.join(_FONT_DIR, 'lato.ttf'),
    'lora':         os.path.join(_FONT_DIR, 'lora.ttf'),
    'merriweather': os.path.join(_FONT_DIR, 'merriweather.ttf'),
    'dancing':      os.path.join(_FONT_DIR, 'dancing.ttf'),
    'montserrat':   os.path.join(_FONT_DIR, 'montserrat.ttf'),
    'raleway':      os.path.join(_FONT_DIR, 'raleway.ttf'),
}

VALID_BG_TYPES = {'solid', 'gradient'}

_DARK_NAVY = (13, 27, 42)
_WHITE = (255, 255, 255)


# ── Colour helpers ────────────────────────────────────────────────────────────

def parse_hex_color(hex_str: str) -> tuple:
    """Convert '#RRGGBB' or 'RRGGBB' to (R, G, B) tuple."""
    h = hex_str.lstrip('#')
    if len(h) != 6:
        raise ValueError(f"Invalid hex colour: {hex_str!r}")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def _linearise(c: float) -> float:
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def relative_luminance(r: int, g: int, b: int) -> float:
    """WCAG 2.1 relative luminance, range [0, 1]."""
    return 0.2126 * _linearise(r) + 0.7152 * _linearise(g) + 0.0722 * _linearise(b)


def text_color_for_bg(bg_colors: list) -> tuple:
    """Return white or dark navy based on average background luminance."""
    rgbs = [parse_hex_color(c) for c in bg_colors]
    avg_r = sum(c[0] for c in rgbs) // len(rgbs)
    avg_g = sum(c[1] for c in rgbs) // len(rgbs)
    avg_b = sum(c[2] for c in rgbs) // len(rgbs)
    lum = relative_luminance(avg_r, avg_g, avg_b)
    return _WHITE if lum <= 0.179 else _DARK_NAVY


# ── Background rendering ──────────────────────────────────────────────────────

def _render_solid(img: Image.Image, color: tuple) -> None:
    img.paste(color, [0, 0, img.width, img.height])


def _render_gradient(img: Image.Image, color1: tuple, color2: tuple) -> None:
    """Vertical top-to-bottom two-stop linear gradient."""
    w, h = img.width, img.height
    pixels = img.load()
    for y in range(h):
        t = y / max(h - 1, 1)
        r = int(color1[0] + (color2[0] - color1[0]) * t)
        g = int(color1[1] + (color2[1] - color1[1]) * t)
        b = int(color1[2] + (color2[2] - color1[2]) * t)
        for x in range(w):
            pixels[x, y] = (r, g, b)


# ── Card renderer ─────────────────────────────────────────────────────────────

def render_card(
    fragment: dict,
    width: int,
    height: int,
    font: str = 'lato',
    bg_type: str = 'solid',
    bg_colors: list | None = None,
    text_color_override: str | None = None,
) -> bytes:
    if bg_colors is None:
        bg_colors = ['#0D1B2A']

    font_path = VALID_FONTS.get(font, VALID_FONTS['lato'])
    text_color = parse_hex_color(text_color_override) if text_color_override else text_color_for_bg(bg_colors)
    attr_color = tuple(min(255, c + 60) for c in text_color) if text_color == _DARK_NAVY \
        else (176, 186, 197)
    rule_color = attr_color

    quote_text = fragment.get("text", "")
    author = fragment.get("author", "")
    title = fragment.get("title", "")

    img = Image.new("RGB", (width, height), color=(0, 0, 0))

    # Background
    if bg_type == 'gradient' and len(bg_colors) >= 2:
        _render_gradient(img, parse_hex_color(bg_colors[0]), parse_hex_color(bg_colors[1]))
    else:
        _render_solid(img, parse_hex_color(bg_colors[0]))

    draw = ImageDraw.Draw(img)

    margin = int(width * 0.08)
    text_area_w = width - 2 * margin

    quote_size = max(16, int(width * 0.026))
    attr_size = max(12, int(width * 0.018))
    wm_size = max(10, int(width * 0.015))

    try:
        font_quote = ImageFont.truetype(font_path, size=quote_size)
        font_attr = ImageFont.truetype(font_path, size=attr_size)
        font_wm = ImageFont.truetype(font_path, size=wm_size)
    except (OSError, IOError):
        font_quote = ImageFont.load_default(size=quote_size)
        font_attr = ImageFont.load_default(size=attr_size)
        font_wm = ImageFont.load_default(size=wm_size)

    chars_per_line = max(20, int(text_area_w / (quote_size * 0.58)))
    lines = textwrap.wrap(quote_text, width=chars_per_line) if quote_text else [""]

    line_h = quote_size * 1.6
    block_h = len(lines) * line_h
    rule_gap = 14
    attr_h = attr_size * 1.4

    total_h = block_h + rule_gap + 2 + rule_gap + attr_h
    y = (height - total_h) / 2

    for line in lines:
        bb = draw.textbbox((0, 0), line, font=font_quote)
        lw = bb[2] - bb[0]
        draw.text(((width - lw) / 2, y), line, font=font_quote, fill=text_color)
        y += line_h

    rule_y = int(y + rule_gap)
    draw.line([(margin, rule_y), (width - margin, rule_y)], fill=rule_color, width=2)

    attr_parts = [p for p in (author, title) if p]
    attr_text = " · ".join(attr_parts)
    if attr_text:
        attr_y = rule_y + rule_gap
        bb = draw.textbbox((0, 0), attr_text, font=font_attr)
        draw.text(((width - (bb[2] - bb[0])) / 2, attr_y), attr_text, font=font_attr, fill=attr_color)

    wm = "Alexandria"
    bb = draw.textbbox((0, 0), wm, font=font_wm)
    draw.text(
        (width - margin - (bb[2] - bb[0]), height - margin - (bb[3] - bb[1])),
        wm,
        font=font_wm,
        fill=attr_color,
    )

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()
