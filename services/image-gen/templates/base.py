import base64
import http.client
import io
import ipaddress
import os
import re
import socket
import ssl
import textwrap
import urllib.parse

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps

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
VALID_BG_FITS = {'cover', 'contain', 'blur'}

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

# Watermark logo height as a fraction of card width. Kept deliberately subtle:
# reduced 35% (0.06 → 0.039) so the wordmark reads as a mark, not a sticker.
_LOGO_WIDTH_RATIO = 0.039
_LOGO_MIN_H = 16

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


# ── Background image sources (NEM-016 S12) ─────────────────────────────────────
# The renderer must never fetch an arbitrary URL. It fails closed:
#   • data:image/{png,jpeg,webp};base64,…  (web presets and uploads) — no fetch.
#   • https://noetia.app|staging.noetia.app/backgrounds/imagen-N.jpg, N = 1–18
#     (the preset gallery, sent as an absolute URL by mobile).
#   • Hosts added via SHARE_BG_ALLOWED_HOSTS (comma-separated; the same variable
#     the API reads, from the shared .env) — for local development only. Only
#     these may use plain http or resolve to a private / loopback address.
# Built-in hosts must resolve exclusively to public (global) addresses. The
# connection is pinned to the address that was checked, so a DNS answer that
# changes between check and connect (rebinding) cannot redirect the request.
# Redirects are never followed. An empty or unset variable never widens access.
_BG_DATA_URI_RE = re.compile(r'^data:image/(?:png|jpe?g|webp);base64,')
_BG_PRESET_PATH_RE = re.compile(r'^/backgrounds/imagen-(\d{1,2})\.jpg$')
_BG_PRESET_COUNT = 18
_BG_MAX_BYTES = 10 * 1024 * 1024
_BG_TIMEOUT_S = 10
_BG_DEFAULT_HOSTS = frozenset({'noetia.app', 'staging.noetia.app'})


def _configured_bg_hosts() -> frozenset:
    raw = os.environ.get('SHARE_BG_ALLOWED_HOSTS', '')
    return frozenset(h.strip().lower() for h in raw.split(',') if h.strip())


def _validate_bg_url(bg_image: str) -> tuple:
    """Return (scheme, host, port, path, trusted_local) for an allowed preset URL.

    Raises ValueError for anything else. `trusted_local` is True only for hosts
    explicitly configured via SHARE_BG_ALLOWED_HOSTS.
    """
    parts = urllib.parse.urlsplit(bg_image)
    if parts.scheme not in ('http', 'https'):
        raise ValueError('unsupported background scheme')
    if parts.username or parts.password or parts.query or parts.fragment:
        raise ValueError('unsupported background url')
    m = _BG_PRESET_PATH_RE.match(parts.path or '')
    if not m or not 1 <= int(m.group(1)) <= _BG_PRESET_COUNT:
        raise ValueError('background url is not a preset image')
    host = (parts.hostname or '').lower()
    configured = _configured_bg_hosts()
    if host in _BG_DEFAULT_HOSTS and host not in configured:
        if parts.scheme != 'https':
            raise ValueError('preset backgrounds must use https')
        trusted_local = False
    elif host in configured:
        trusted_local = True
    else:
        raise ValueError('background host not allowed')
    try:
        port = parts.port or (443 if parts.scheme == 'https' else 80)
    except ValueError as exc:
        raise ValueError('invalid background port') from exc
    return parts.scheme, host, port, parts.path, trusted_local


def _resolve_pinned_ip(host: str, port: int, trusted_local: bool) -> str:
    """Resolve once; every address must be public unless the host is configured."""
    infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    addrs = sorted({info[4][0] for info in infos})
    if not addrs:
        raise ValueError('background host did not resolve')
    if not trusted_local:
        for a in addrs:
            if not ipaddress.ip_address(a.split('%', 1)[0]).is_global:
                raise ValueError('background host resolves to a non-public address')
    return addrs[0]


class _PinnedHTTPConnection(http.client.HTTPConnection):
    def __init__(self, host, port, ip, timeout):
        super().__init__(host, port, timeout=timeout)
        self._pinned_ip = ip

    def connect(self):
        self.sock = socket.create_connection((self._pinned_ip, self.port), self.timeout)


class _PinnedHTTPSConnection(http.client.HTTPSConnection):
    def __init__(self, host, port, ip, timeout):
        super().__init__(host, port, timeout=timeout, context=ssl.create_default_context())
        self._pinned_ip = ip

    def connect(self):
        sock = socket.create_connection((self._pinned_ip, self.port), self.timeout)
        # Certificate is verified against the original hostname (SNI + hostname check).
        self.sock = self._context.wrap_socket(sock, server_hostname=self.host)


def _fetch_preset(bg_image: str) -> bytes:
    scheme, host, port, path, trusted_local = _validate_bg_url(bg_image)
    ip = _resolve_pinned_ip(host, port, trusted_local)
    cls = _PinnedHTTPSConnection if scheme == 'https' else _PinnedHTTPConnection
    conn = cls(host, port, ip, _BG_TIMEOUT_S)
    try:
        conn.request('GET', path, headers={'Host': host, 'User-Agent': 'noetia-image-gen'})
        resp = conn.getresponse()
        if resp.status != 200:  # includes 3xx — redirects are never followed
            raise ValueError(f'background fetch returned {resp.status}')
        raw = resp.read(_BG_MAX_BYTES + 1)
    finally:
        conn.close()
    if len(raw) > _BG_MAX_BYTES:
        raise ValueError('background image too large')
    return raw


def _load_bg_image(bg_image: str) -> Image.Image:
    """Load a background from an inline image data URI or an allowed preset URL."""
    if bg_image.startswith('data:'):
        if not _BG_DATA_URI_RE.match(bg_image):
            raise ValueError('unsupported background data uri')
        _, data = bg_image.split(',', 1)
        raw = base64.b64decode(data)
        if len(raw) > _BG_MAX_BYTES:
            raise ValueError('background image too large')
    else:
        raw = _fetch_preset(bg_image)
    return Image.open(io.BytesIO(raw)).convert('RGB')


def _cover_scale(bg: Image.Image, card_w: int, card_h: int) -> Image.Image:
    """Scale to fully COVER the card, centre-cropping the overflow.

    Fills every pixel but sacrifices the image edges — the source of the
    "animals/flowers cut off the sides" complaint. Kept as an explicit opt-in
    fit and reused to build the blurred backdrop for the 'blur' fit.
    """
    bg_w, bg_h = bg.size
    scale = max(card_w / bg_w, card_h / bg_h)
    new_w, new_h = max(1, round(bg_w * scale)), max(1, round(bg_h * scale))
    scaled = bg.resize((new_w, new_h), Image.LANCZOS)
    ox, oy = (new_w - card_w) // 2, (new_h - card_h) // 2
    return scaled.crop((ox, oy, ox + card_w, oy + card_h))


def _contain_fit(bg: Image.Image, card_w: int, card_h: int) -> tuple:
    """Scale so the WHOLE image fits inside the card (no cropping).

    Returns the scaled image and the top-left offset to centre it. The bands
    left around it are filled by the caller (matte colour or blurred backdrop).
    """
    bg_w, bg_h = bg.size
    scale = min(card_w / bg_w, card_h / bg_h)
    new_w, new_h = max(1, round(bg_w * scale)), max(1, round(bg_h * scale))
    scaled = bg.resize((new_w, new_h), Image.LANCZOS)
    return scaled, (card_w - new_w) // 2, (card_h - new_h) // 2


def _edge_matte_color(bg: Image.Image) -> tuple:
    """Average colour of the image's border pixels — a matte that blends with
    the artwork rather than an arbitrary bar colour."""
    small = bg.resize((max(1, bg.width // 8), max(1, bg.height // 8)), Image.LANCZOS)
    px = small.load()
    w, h = small.size
    edge = (
        [(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)]
        + [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)]
    )
    n = len(edge)
    r = sum(px[x, y][0] for x, y in edge) // n
    g = sum(px[x, y][1] for x, y in edge) // n
    b = sum(px[x, y][2] for x, y in edge) // n
    return (r, g, b)


def _render_image_bg(img: Image.Image, bg_image: str, bg_flip: bool = False,
                     bg_fit: str = 'blur') -> None:
    """Fill the card with a background image without distorting it.

    bg_fit controls how the image maps onto the (usually differently-shaped)
    card:
      • 'cover'   — scale up and centre-crop: fills the card but cuts the edges.
      • 'contain' — fit the whole image; fill the leftover bands with a matte
                    colour sampled from the image's own edges (no crop).
      • 'blur'    — fit the whole image over a blurred, slightly darkened cover
                    of itself, so nothing is cropped and there are no hard bars
                    (default).

    When bg_flip is True the source image is mirrored horizontally first; the
    quote text is composited afterwards and stays upright and readable.
    """
    try:
        bg = _load_bg_image(bg_image)
        if bg_flip:
            bg = ImageOps.mirror(bg)  # horizontal mirror only
        card_w, card_h = img.width, img.height

        if bg_fit == 'cover':
            img.paste(_cover_scale(bg, card_w, card_h))
            return

        foreground, ox, oy = _contain_fit(bg, card_w, card_h)

        if bg_fit == 'contain':
            img.paste(_edge_matte_color(bg), [0, 0, card_w, card_h])
        else:  # 'blur' — default backdrop; no hard letterbox bars
            radius = max(8, card_w // 40)
            backdrop = _cover_scale(bg, card_w, card_h).filter(
                ImageFilter.GaussianBlur(radius=radius))
            backdrop = ImageEnhance.Brightness(backdrop).enhance(0.85)
            img.paste(backdrop)

        img.paste(foreground, (ox, oy))
    except Exception:
        # Fallback to dark navy if the image can't be loaded/decoded.
        _render_solid(img, _DARK_NAVY)


# ── Text drawing helpers ──────────────────────────────────────────────────────

_ITALIC_SHEAR = 0.22  # faux-italic slant; we only ship upright font files


def _draw_text(img, draw: ImageDraw.ImageDraw, pos: tuple, text: str, font,
               fill: tuple, bold: bool = False, italic: bool = False) -> None:
    """Draw text with optional faux bold (offset passes) and faux italic (shear).

    Non-italic output is unchanged: it draws straight onto ``draw``. Italic
    renders the line to its own layer, shears it, and pastes it back so the
    slant matches the share-modal preview (which uses CSS font-style: italic).
    """
    x, y = int(pos[0]), int(pos[1])

    def _stamp(target_draw, ox, oy):
        if bold:
            for dx, dy in ((0, 0), (1, 0), (0, 1), (1, 1)):
                target_draw.text((ox + dx, oy + dy), text, font=font, fill=fill)
        else:
            target_draw.text((ox, oy), text, font=font, fill=fill)

    if not italic:
        _stamp(draw, x, y)
        return

    bb = draw.textbbox((0, 0), text, font=font)
    pad = 6
    layer_w = (bb[2] - bb[0]) + 2 * pad + 1
    layer_h = (bb[3] - bb[1]) + 2 * pad + 1
    layer = Image.new('RGBA', (max(1, layer_w), max(1, layer_h)), (0, 0, 0, 0))
    _stamp(ImageDraw.Draw(layer), pad - bb[0], pad - bb[1])  # ink top-left at (pad, pad)

    xshift = _ITALIC_SHEAR * layer.height
    sheared = layer.transform(
        (layer.width + int(round(xshift)), layer.height),
        Image.AFFINE, (1, _ITALIC_SHEAR, -xshift, 0, 1, 0),
        resample=Image.BICUBIC,
    )
    # The ink top-left sits at (pad, pad) in the layer; place it where the
    # upright glyph would land so the baseline matches the non-italic path.
    img.paste(sheared, (x + bb[0] - pad, y + bb[1] - pad), sheared)


# ── Watermark ─────────────────────────────────────────────────────────────────

def _watermark_logo_path(text_color: tuple) -> str:
    """White logo on dark backgrounds, dark-navy logo on light backgrounds.

    text_color is already computed to contrast with the background, so we reuse
    that decision: white text ⇒ dark bg ⇒ white logo; otherwise dark logo.
    """
    return _LOGO_LIGHT if text_color == _WHITE else _LOGO_DARK


def _logo_target_height(card_width: int) -> int:
    """Watermark logo height in px for a card of the given width."""
    return max(_LOGO_MIN_H, int(card_width * _LOGO_WIDTH_RATIO))


def _draw_watermark(img, draw, text_color: tuple, attr_color: tuple, font_wm, margin: int) -> None:
    """Composite the Noetia logo watermark in the bottom-right corner.

    Falls back to a plain "Noetia" text watermark if the logo asset is missing
    or can't be loaded.
    """
    try:
        logo = Image.open(_watermark_logo_path(text_color)).convert('RGBA')
        target_h = _logo_target_height(img.width)
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
    bg_fit: str = 'blur',
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
    italic     = bool(fragment.get("italic", False))
    align      = fragment.get("textAlign", "center")

    # Quote text size multiplier (user-adjustable S/M/L). Only the quote scales;
    # attribution/citation/watermark stay fixed. Clamped so extreme values can't
    # blow the text off the card.
    try:
        text_scale = float(fragment.get("textScale", 1.0))
    except (TypeError, ValueError):
        text_scale = 1.0
    text_scale = max(0.7, min(1.5, text_scale))

    img = Image.new("RGB", (width, height), color=(0, 0, 0))

    # ── Background ──────────────────────────────────────────────────────────
    if bg_type == 'image' and bg_image:
        _render_image_bg(img, bg_image, bg_flip=bg_flip, bg_fit=bg_fit)
        # Semi-transparent dark overlay for text readability on photo backgrounds
        overlay = Image.new('RGBA', (width, height), (0, 0, 0, 100))
        img_rgba = img.convert('RGBA')
        img_rgba = Image.alpha_composite(img_rgba, overlay)
        img = img_rgba.convert('RGB')
        # Over the dark overlay white is the safe default, but honour an explicit
        # text-colour override so the render matches what the share preview showed
        # (the preview lets the user recolour text on photo backgrounds too).
        if not text_color_override:
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

    quote_size = max(16, int(width * 0.026 * text_scale))
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
        _draw_text(img, draw, (_line_x(lw), y), line, font_quote, text_color, bold=bold, italic=italic)
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
