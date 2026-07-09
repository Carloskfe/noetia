import base64
import io
import os
import textwrap
import urllib.request

from PIL import Image, ImageDraw, ImageFont, ImageOps

# ── Font registry ─────────────────────────────────────────────────────────────

_FONT_DIR = os.path.join(os.path.dirname(__file__), '..', 'fonts')

FONT_REGISTRY = {
    'playfair':     os.path.join(_FONT_DIR, 'playfair.ttf'),
    'montserrat':   os.path.join(_FONT_DIR, 'montserrat.ttf'),
    'merriweather': os.path.join(_FONT_DIR, 'merriweather.ttf'),
    'oswald':       os.path.join(_FONT_DIR, 'oswald.ttf'),
    'baskerville':  os.path.join(_FONT_DIR, 'baskerville.ttf'),
    'dancing':      os.path.join(_FONT_DIR, 'dancing.ttf'),
    'pacifico':     os.path.join(_FONT_DIR, 'pacifico.ttf'),
}
# Keep old name for backwards compat with scripts that import VALID_FONTS
VALID_FONTS = FONT_REGISTRY

VALID_BG_TYPES = {'solid', 'gradient', 'image'}

_DARK_NAVY = (13, 27, 42)
_WHITE = (255, 255, 255)

# ── Watermark logo assets ───────────────────────────────────────────────────────
# Two monochrome, transparent variants of the Noetia logo (N + open book +
# wordmark). The light (white) one reads on dark/photo backgrounds; the dark
# (navy) one reads on light backgrounds. If the files are missing the renderer
# falls back to a plain "Noetia" text watermark.
_ASSET_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets')
_LOGO_LIGHT = os.path.join(_ASSET_DIR, 'noetia-logo-light.png')
_LOGO_DARK = os.path.join(_ASSET_DIR, 'noetia-logo-dark.png')

# Gradient direction → (dx_start, dy_start) normalised vectors used to compute t
_GRADIENT_DIRS = {
    'to-bottom':       lambda x, y, w, h: y / max(h - 1, 1),
    'to-top':          lambda x, y, w, h: 1 - y / max(h - 1, 1),
    'to-right':        lambda x, y, w, h: x / max(w - 1, 1),
    'to-left':         lambda x, y, w, h: 1 - x / max(w - 1, 1),
    'to-bottom-right': lambda x, y, w, h: (x / max(w - 1, 1) + y / max(h - 1, 1)) / 2,
    'to-bottom-left':  lambda x, y, w, h: ((w - 1 - x) / max(w - 1, 1) + y / max(h - 1, 1)) / 2,
    'to-top-right':    lambda x, y, w, h: (x / max(w - 1, 1) + (h - 1 - y) / max(h - 1, 1)) / 2,
    'to-top-left':     lambda x, y, w, h: ((w - 1 - x) / max(w - 1, 1) + (h - 1 - y) / max(h - 1, 1)) / 2,
    'radial':          lambda x, y, w, h: min(1.0, ((x - w / 2) ** 2 + (y - h / 2) ** 2) ** 0.5 / (((w / 2) ** 2 + (h / 2) ** 2) ** 0.5)),
}


# ── Colour helpers ────────────────────────────────────────────────────────────

def parse_hex_color(hex_str: str) -> tuple:
    h = hex_str.lstrip('#')
    if len(h) != 6:
        raise ValueError(f"Invalid hex colour: {hex_str!r}")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def _linearise(c: float) -> float:
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def relative_luminance(r: int, g: int, b: int) -> float:
    return 0.2126 * _linearise(r) + 0.7152 * _linearise(g) + 0.0722 * _linearise(b)


def text_color_for_bg(bg_colors: list) -> tuple:
    rgbs = [parse_hex_color(c) for c in bg_colors]
    avg_r = sum(c[0] for c in rgbs) // len(rgbs)
    avg_g = sum(c[1] for c in rgbs) // len(rgbs)
    avg_b = sum(c[2] for c in rgbs) // len(rgbs)
    lum = relative_luminance(avg_r, avg_g, avg_b)
    return _WHITE if lum <= 0.179 else _DARK_NAVY


# ── Background rendering ──────────────────────────────────────────────────────

def _render_solid(img: Image.Image, color: tuple) -> None:
    img.paste(color, [0, 0, img.width, img.height])


def _render_gradient(img: Image.Image, color1: tuple, color2: tuple, direction: str = 'to-bottom') -> None:
    w, h = img.width, img.height
    t_fn = _GRADIENT_DIRS.get(direction, _GRADIENT_DIRS['to-bottom'])
    pixels = img.load()
    for py in range(h):
        for px in range(w):
            t = max(0.0, min(1.0, t_fn(px, py, w, h)))
            pixels[px, py] = (
                int(color1[0] + (color2[0] - color1[0]) * t),
                int(color1[1] + (color2[1] - color1[1]) * t),
                int(color1[2] + (color2[2] - color1[2]) * t),
            )


def _render_image_bg(img: Image.Image, bg_image: str, bg_flip: bool = False) -> None:
    """Fill the card with a background image (URL or base64 data URI, cover-scaled).

    When bg_flip is True the background is mirrored horizontally (left↔right).
    Only the image is flipped — the quote text is composited afterwards and
    stays upright and readable.
    """
    try:
        if bg_image.startswith('data:'):
            _, data = bg_image.split(',', 1)
            bg_bytes = base64.b64decode(data)
            bg = Image.open(io.BytesIO(bg_bytes)).convert('RGB')
        else:
            with urllib.request.urlopen(bg_image, timeout=10) as resp:
                bg = Image.open(resp).convert('RGB')

        # Cover-scale: fill card without distortion
        bg_w, bg_h = bg.size
        card_w, card_h = img.width, img.height
        scale = max(card_w / bg_w, card_h / bg_h)
        new_w, new_h = int(bg_w * scale), int(bg_h * scale)
        bg = bg.resize((new_w, new_h), Image.LANCZOS)
        offset_x = (new_w - card_w) // 2
        offset_y = (new_h - card_h) // 2
        bg = bg.crop((offset_x, offset_y, offset_x + card_w, offset_y + card_h))
        if bg_flip:
            bg = ImageOps.mirror(bg)  # horizontal mirror only
        img.paste(bg)
    except Exception:
        # Fallback to dark navy if image can't be loaded
        _render_solid(img, _DARK_NAVY)


# ── Text drawing helpers ──────────────────────────────────────────────────────

def _draw_text(draw: ImageDraw.ImageDraw, pos: tuple, text: str, font, fill: tuple, bold: bool = False) -> None:
    """Draw text; if bold=True, use a multi-pass offset simulation."""
    x, y = int(pos[0]), int(pos[1])
    if bold:
        for dx, dy in [(0, 0), (1, 0), (0, 1), (1, 1)]:
            draw.text((x + dx, y + dy), text, font=font, fill=fill)
    else:
        draw.text((x, y), text, font=font, fill=fill)


# ── Watermark ─────────────────────────────────────────────────────────────────

def _watermark_logo_path(text_color: tuple) -> str:
    """White logo on dark backgrounds, dark-navy logo on light backgrounds.

    text_color is already computed to contrast with the background, so we reuse
    that decision: white text ⇒ dark bg ⇒ white logo; otherwise dark logo.
    """
    return _LOGO_LIGHT if text_color == _WHITE else _LOGO_DARK


def _draw_watermark(img, draw, text_color: tuple, attr_color: tuple, font_wm, margin: int) -> None:
    """Composite the Noetia logo watermark in the bottom-right corner.

    Falls back to a plain "Noetia" text watermark if the logo asset is missing
    or can't be loaded.
    """
    try:
        logo = Image.open(_watermark_logo_path(text_color)).convert('RGBA')
        target_h = max(24, int(img.width * 0.06))
        target_w = max(1, int(target_h * logo.width / logo.height))
        logo = logo.resize((target_w, target_h), Image.LANCZOS)
        # Slightly translucent so it reads as a watermark, not a sticker
        alpha = logo.split()[3].point(lambda a: int(a * 0.9))
        logo.putalpha(alpha)
        pos = (img.width - margin - target_w, img.height - margin - target_h)
        img.paste(logo, pos, logo)
    except (OSError, IOError, ValueError):
        wm = "Noetia"
        bb = draw.textbbox((0, 0), wm, font=font_wm)
        draw.text(
            (img.width - margin - (bb[2] - bb[0]), img.height - margin - (bb[3] - bb[1])),
            wm, font=font_wm, fill=attr_color,
        )


# ── Card renderer ─────────────────────────────────────────────────────────────

def render_card(
    fragment: dict,
    width: int,
    height: int,
    font: str = 'playfair',
    bg_type: str = 'solid',
    bg_colors: list | None = None,
    text_color_override: str | None = None,
    bg_gradient_dir: str = 'to-bottom',
    bg_image: str | None = None,
    bg_flip: bool = False,
) -> bytes:
    if bg_colors is None:
        bg_colors = ['#0D1B2A']

    font_path = FONT_REGISTRY.get(font, FONT_REGISTRY['playfair'])
    text_color = parse_hex_color(text_color_override) if text_color_override else text_color_for_bg(bg_colors)
    attr_color = tuple(min(255, c + 60) for c in text_color) if text_color == _DARK_NAVY \
        else (176, 186, 197)
    rule_color = attr_color

    quote_text = fragment.get("text", "")
    author     = fragment.get("author", "")
    title      = fragment.get("title", "")
    citation   = fragment.get("citation") or ""
    bold       = bool(fragment.get("bold", False))
    align      = fragment.get("textAlign", "center")

    img = Image.new("RGB", (width, height), color=(0, 0, 0))

    # ── Background ──────────────────────────────────────────────────────────
    if bg_type == 'image' and bg_image:
        _render_image_bg(img, bg_image, bg_flip=bg_flip)
        # Semi-transparent dark overlay for text readability on photo backgrounds
        overlay = Image.new('RGBA', (width, height), (0, 0, 0, 100))
        img_rgba = img.convert('RGBA')
        img_rgba = Image.alpha_composite(img_rgba, overlay)
        img = img_rgba.convert('RGB')
        # Recalculate text color over dark overlay → almost always white
        text_color = _WHITE
        attr_color = (200, 210, 220)
        rule_color = attr_color
    elif bg_type == 'gradient' and len(bg_colors) >= 2:
        _render_gradient(img, parse_hex_color(bg_colors[0]), parse_hex_color(bg_colors[1]), bg_gradient_dir)
    else:
        _render_solid(img, parse_hex_color(bg_colors[0]))

    draw = ImageDraw.Draw(img)

    margin = int(width * 0.08)
    text_area_w = width - 2 * margin

    quote_size = max(16, int(width * 0.026))
    attr_size  = max(12, int(width * 0.018))
    cite_size  = max(10, int(width * 0.014))
    wm_size    = max(10, int(width * 0.015))

    try:
        font_quote = ImageFont.truetype(font_path, size=quote_size)
        font_attr  = ImageFont.truetype(font_path, size=attr_size)
        font_cite  = ImageFont.truetype(font_path, size=cite_size)
        font_wm    = ImageFont.truetype(font_path, size=wm_size)
    except (OSError, IOError):
        font_quote = ImageFont.load_default(size=quote_size)
        font_attr  = ImageFont.load_default(size=attr_size)
        font_cite  = ImageFont.load_default(size=cite_size)
        font_wm    = ImageFont.load_default(size=wm_size)

    chars_per_line = max(20, int(text_area_w / (quote_size * 0.58)))
    lines = textwrap.wrap(quote_text, width=chars_per_line) if quote_text else [""]

    line_h  = quote_size * 1.6
    block_h = len(lines) * line_h
    rule_gap = 14
    attr_h  = attr_size * 1.4
    cite_h  = (cite_size * 1.4 + 4) if citation else 0

    total_h = block_h + rule_gap + 2 + rule_gap + attr_h + cite_h
    y = (height - total_h) / 2

    def _line_x(line_w: float) -> float:
        if align == 'left':
            return margin
        if align == 'right':
            return width - margin - line_w
        return (width - line_w) / 2

    for line in lines:
        bb = draw.textbbox((0, 0), line, font=font_quote)
        lw = bb[2] - bb[0]
        _draw_text(draw, (_line_x(lw), y), line, font_quote, text_color, bold=bold)
        y += line_h

    rule_y = int(y + rule_gap)
    draw.line([(margin, rule_y), (width - margin, rule_y)], fill=rule_color, width=2)

    attr_parts = [p for p in (author, title) if p]
    attr_text  = " · ".join(attr_parts)
    if attr_text:
        attr_y = rule_y + rule_gap
        bb = draw.textbbox((0, 0), attr_text, font=font_attr)
        draw.text(((width - (bb[2] - bb[0])) / 2, attr_y), attr_text, font=font_attr, fill=attr_color)

    if citation:
        cite_color = tuple(max(0, c - 30) for c in attr_color)
        cite_y = rule_y + rule_gap + attr_h + 4
        bb = draw.textbbox((0, 0), citation, font=font_cite)
        draw.text(((width - (bb[2] - bb[0])) / 2, cite_y), citation, font=font_cite, fill=cite_color)

    _draw_watermark(img, draw, text_color, attr_color, font_wm, margin)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()
