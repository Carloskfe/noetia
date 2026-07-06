"""Generate themed book cover PNGs for specific titles.

Run from the project root:
    python3 services/image-gen/scripts/generate_themed_covers.py

Outputs PNG files to services/web/public/covers/
"""
import io
import math
import os
import sys
import textwrap

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from PIL import Image, ImageDraw, ImageFont
from templates.base import FONT_REGISTRY

OUTPUT_DIR = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '..', '..', '..', 'services', 'web', 'public', 'covers')
)

W, H = 400, 600


# ── Font helpers ──────────────────────────────────────────────────────────────

def _font(name: str, size: int) -> ImageFont.FreeTypeFont:
    path = FONT_REGISTRY.get(name)
    if path and os.path.exists(path):
        return ImageFont.truetype(path, size)
    return ImageFont.load_default(size)


def _center_text(draw, text, font, y, width, color, wrap=18):
    for line in textwrap.wrap(text, wrap) or [text]:
        bb = draw.textbbox((0, 0), line, font=font)
        x = (width - (bb[2] - bb[0])) // 2
        draw.text((x, y), line, font=font, fill=color)
        y += (bb[3] - bb[1]) + 6
    return y


def _gradient(img, c1, c2, direction='tb'):
    w, h = img.size
    px = img.load()
    for y in range(h):
        for x in range(w):
            t = y / (h - 1) if direction == 'tb' else x / (w - 1)
            px[x, y] = (
                int(c1[0] + (c2[0] - c1[0]) * t),
                int(c1[1] + (c2[1] - c1[1]) * t),
                int(c1[2] + (c2[2] - c1[2]) * t),
            )


def _save(img, slug):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    path = os.path.join(OUTPUT_DIR, f'{slug}.png')
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    with open(path, 'wb') as f:
        f.write(buf.getvalue())
    print(f'  wrote {path}')


# ── Individual cover generators ───────────────────────────────────────────────

def make_biblia_reina_valera():
    """Spanish Reina-Valera edition cover."""
    _make_bible_cover('biblia-reina-valera', 'SANTA BIBLIA', 'Reina-Valera')


def make_bible_kjv():
    """English King James Version cover — same art, English text."""
    _make_bible_cover('bible-kjv', 'HOLY BIBLE', 'King James Version')


def _make_bible_cover(slug: str, title: str, subtitle: str):
    """Gold & cream — celestial light rays + cross silhouette."""
    img = Image.new('RGB', (W, H))
    _gradient(img, (20, 15, 40), (100, 75, 20))
    draw = ImageDraw.Draw(img)

    # Radial light rays from top-center
    cx, cy = W // 2, H // 4
    for angle in range(0, 360, 15):
        rad = math.radians(angle)
        x2 = cx + int(math.cos(rad) * W)
        y2 = cy + int(math.sin(rad) * H)
        draw.line([(cx, cy), (x2, y2)], fill=(255, 215, 100, 30), width=1)

    # Glowing halo behind cross
    for r, alpha in [(90, 15), (70, 25), (50, 40), (35, 60)]:
        col = (255, 220, 120, alpha)
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(
            min(255, 80 + int(alpha * 1.5)),
            min(255, 60 + int(alpha * 1.2)),
            20,
        ))

    # Cross
    cw, ch = 28, 60
    arm_w, arm_h = 60, 20
    cross_y = cy - ch // 2
    draw.rectangle([cx - cw // 2, cross_y, cx + cw // 2, cross_y + ch], fill=(255, 230, 140))
    draw.rectangle([cx - arm_w // 2, cross_y + 15, cx + arm_w // 2, cross_y + 15 + arm_h], fill=(255, 230, 140))

    # Divider
    draw.line([(50, H // 2 + 20), (W - 50, H // 2 + 20)], fill=(200, 170, 80), width=2)

    # Text
    y = H // 2 + 40
    y = _center_text(draw, title, _font('playfair', 32), y, W, (255, 230, 140))
    y = _center_text(draw, subtitle, _font('lato', 18), y + 6, W, (220, 190, 100))

    _save(img, slug)


def make_quijote(volume: int):
    """Sky blue + rolling hills + windmill + lance."""
    img = Image.new('RGB', (W, H))
    _gradient(img, (100, 160, 220), (220, 200, 140))  # sky top to dusty horizon
    draw = ImageDraw.Draw(img)

    # Sun
    draw.ellipse([W - 90, 30, W - 30, 90], fill=(255, 220, 80))

    # Rolling hills
    hill_points = [(0, H - 180)]
    for x in range(0, W + 20, 20):
        y = H - 180 + int(20 * math.sin(x * 0.04))
        hill_points.append((x, y))
    hill_points += [(W, H), (0, H)]
    draw.polygon(hill_points, fill=(140, 160, 80))

    # Second hill (darker)
    hill2 = [(0, H - 100)]
    for x in range(0, W + 20, 20):
        y = H - 100 + int(15 * math.sin(x * 0.07 + 1))
        hill2.append((x, y))
    hill2 += [(W, H), (0, H)]
    draw.polygon(hill2, fill=(100, 120, 60))

    # Windmill tower (trapezoid)
    mx, my = W // 2 - 20, H - 200
    tower_pts = [
        (mx - 12, H - 100),
        (mx + 12, H - 100),
        (mx + 8, my),
        (mx - 8, my),
    ]
    draw.polygon(tower_pts, fill=(210, 195, 160))
    draw.polygon(tower_pts, outline=(160, 140, 100), width=2)

    # Windmill body (small house at top)
    body_pts = [
        (mx - 18, my),
        (mx + 18, my),
        (mx + 18, my - 25),
        (mx, my - 38),
        (mx - 18, my - 25),
    ]
    draw.polygon(body_pts, fill=(200, 180, 140))
    draw.polygon(body_pts, outline=(150, 130, 90), width=2)

    # Windmill blades (4 arms)
    blade_cx, blade_cy = mx, my - 12
    blade_len = 45
    blade_w = 7
    for angle in [30, 120, 210, 300]:
        rad = math.radians(angle)
        ex = blade_cx + int(blade_len * math.cos(rad))
        ey = blade_cy + int(blade_len * math.sin(rad))
        perp = math.radians(angle + 90)
        pts = [
            (blade_cx + int(blade_w * math.cos(perp)), blade_cy + int(blade_w * math.sin(perp))),
            (ex + int((blade_w // 2) * math.cos(perp)), ey + int((blade_w // 2) * math.sin(perp))),
            (ex - int((blade_w // 2) * math.cos(perp)), ey - int((blade_w // 2) * math.sin(perp))),
            (blade_cx - int(blade_w * math.cos(perp)), blade_cy - int(blade_w * math.sin(perp))),
        ]
        draw.polygon(pts, fill=(190, 170, 130))
        draw.polygon(pts, outline=(140, 120, 80), width=1)
    draw.ellipse([blade_cx - 5, blade_cy - 5, blade_cx + 5, blade_cy + 5], fill=(160, 140, 100))

    # Lance (diagonal, lower right)
    lx1, ly1 = W - 30, H - 60
    lx2, ly2 = 80, H // 3 + 30
    draw.line([(lx1, ly1), (lx2, ly2)], fill=(130, 100, 60), width=6)
    # Lance tip
    tip_rad = math.atan2(ly2 - ly1, lx2 - lx1)
    tip_pts = [
        (lx2, ly2),
        (lx2 + int(18 * math.cos(tip_rad + 0.5)), ly2 + int(18 * math.sin(tip_rad + 0.5))),
        (lx2 + int(18 * math.cos(tip_rad - 0.5)), ly2 + int(18 * math.sin(tip_rad - 0.5))),
    ]
    draw.polygon(tip_pts, fill=(180, 150, 90))

    # Dark overlay for title area at bottom
    overlay = Image.new('RGBA', (W, 130), (0, 0, 0, 140))
    img.paste(Image.alpha_composite(img.convert('RGBA').crop((0, H - 130, W, H)), overlay).convert('RGB'), (0, H - 130))

    draw = ImageDraw.Draw(img)
    vol_label = 'Volumen I' if volume == 1 else 'Volumen II'
    _center_text(draw, 'Don Quijote', _font('playfair', 30), H - 120, W, (255, 240, 180))
    _center_text(draw, 'de la Mancha', _font('playfair', 22), H - 86, W, (255, 240, 180))
    _center_text(draw, vol_label, _font('lato', 16), H - 54, W, (220, 200, 140))
    _center_text(draw, 'Cervantes', _font('lato', 13), H - 32, W, (180, 160, 110))

    _save(img, f'quijote-vol-{volume}')


def make_don_juan_tenorio():
    """Deep crimson + roses + mask silhouette."""
    img = Image.new('RGB', (W, H))
    _gradient(img, (80, 10, 20), (160, 20, 40))
    draw = ImageDraw.Draw(img)

    # Decorative corner ornaments — bounding box always x0<x1, y0<y1
    # arc angles match each corner quadrant (PIL arc is clockwise)
    def corner_ornament(cx, cy, a_start, a_end):
        for i, r in enumerate([40, 30, 22]):
            c = (min(255, 180 + i * 20), min(255, 50 + i * 15), min(255, 50 + i * 15))
            draw.arc([cx - r, cy - r, cx + r, cy + r], a_start, a_end, fill=c, width=2)

    corner_ornament(30,      30,      180, 270)   # top-left
    corner_ornament(W - 30,  30,      270, 360)   # top-right
    corner_ornament(30,      H - 30,   90, 180)   # bottom-left
    corner_ornament(W - 30,  H - 30,    0,  90)   # bottom-right

    # Theatrical mask (simple oval + eye cuts)
    mx, my = W // 2, H // 3
    mw, mh = 100, 70
    draw.ellipse([mx - mw, my - mh, mx + mw, my + mh], fill=(200, 160, 80))
    draw.ellipse([mx - mw + 2, my - mh + 2, mx + mw - 2, my + mh - 2], outline=(230, 195, 110), width=3)
    # Eye holes
    draw.ellipse([mx - 55, my - 20, mx - 20, my + 10], fill=(80, 10, 20))
    draw.ellipse([mx + 20, my - 20, mx + 55, my + 10], fill=(80, 10, 20))
    # Nose bridge
    draw.line([(mx, my - 10), (mx, my + 20)], fill=(170, 130, 60), width=3)

    # Roses (simplified circles + petals)
    def rose(cx, cy, r, col):
        for angle in range(0, 360, 45):
            rad = math.radians(angle)
            px2 = cx + int(r * 0.7 * math.cos(rad))
            py2 = cy + int(r * 0.7 * math.sin(rad))
            draw.ellipse([px2 - r // 2, py2 - r // 2, px2 + r // 2, py2 + r // 2], fill=col)
        draw.ellipse([cx - r // 3, cy - r // 3, cx + r // 3, cy + r // 3], fill=(
            min(255, col[0] + 30), max(0, col[1] - 10), max(0, col[2] - 10)
        ))

    rose(60, H // 2 + 30, 22, (180, 20, 30))
    rose(W - 65, H // 2 + 50, 18, (160, 15, 25))
    rose(W // 2, H * 2 // 3, 20, (200, 30, 40))

    # Decorative line
    draw.line([(40, H // 2 - 20), (W - 40, H // 2 - 20)], fill=(200, 140, 60), width=2)

    y = H // 2
    y = _center_text(draw, 'DON JUAN', _font('playfair', 36), y, W, (255, 220, 140))
    y = _center_text(draw, 'TENORIO', _font('playfair', 36), y + 2, W, (255, 220, 140))
    _center_text(draw, 'José Zorrilla', _font('lato', 16), y + 16, W, (220, 170, 100))

    _save(img, 'don-juan-tenorio')


def make_divina_comedia():
    """Dark infernal gradient + Dante's path of concentric circles."""
    img = Image.new('RGB', (W, H))
    _gradient(img, (8, 5, 15), (100, 40, 10))
    draw = ImageDraw.Draw(img)

    # Fire gradient overlay at bottom
    fire_img = Image.new('RGB', (W, H // 2))
    fp = fire_img.load()
    for y in range(H // 2):
        for x in range(W):
            t = 1 - y / (H // 2 - 1)
            fp[x, y] = (int(180 * t), int(60 * t), 0)
    fire_img.putalpha(Image.fromarray(
        __import__('numpy').array([[int(180 * (1 - y / (H // 2))) for _ in range(W)] for y in range(H // 2)],
        dtype='uint8')) if False else Image.new('L', (W, H // 2), 0))

    # Concentric circles (Dante's infernal rings)
    cx, cy = W // 2, H * 2 // 3
    for i, r in enumerate(range(200, 20, -30)):
        alpha = 30 + i * 15
        col = (min(255, 80 + i * 25), max(0, 30 - i * 3), 0)
        draw.ellipse([cx - r, cy - r // 2, cx + r, cy + r // 2], outline=col, width=2)

    # Dante's silhouette (simplified figure walking)
    sx, sy = W // 2 - 10, H // 2 + 10
    draw.ellipse([sx - 8, sy - 40, sx + 8, sy - 20], fill=(40, 30, 20))  # head
    draw.line([(sx, sy - 20), (sx, sy + 20)], fill=(40, 30, 20), width=6)  # body
    draw.line([(sx, sy), (sx - 20, sy + 20)], fill=(40, 30, 20), width=4)  # left arm
    draw.line([(sx, sy), (sx + 15, sy + 15)], fill=(40, 30, 20), width=4)  # right arm
    draw.line([(sx, sy + 20), (sx - 12, sy + 40)], fill=(40, 30, 20), width=4)  # left leg
    draw.line([(sx, sy + 20), (sx + 12, sy + 40)], fill=(40, 30, 20), width=4)  # right leg

    # Fire licks at bottom
    for fx in range(20, W - 20, 25):
        fh = 30 + int(25 * math.sin(fx * 0.15))
        pts = [(fx, H), (fx + 8, H - fh), (fx + 4, H - fh // 2), (fx - 4, H - fh * 3 // 4), (fx - 8, H)]
        col = (200 + int(55 * math.sin(fx * 0.2)), 60, 0)
        draw.polygon(pts, fill=col)

    # Top decorative border
    draw.line([(30, 30), (W - 30, 30)], fill=(180, 100, 20), width=2)
    draw.line([(30, 36), (W - 30, 36)], fill=(120, 60, 10), width=1)

    y = 50
    y = _center_text(draw, 'LA DIVINA', _font('playfair', 34), y, W, (255, 190, 80))
    y = _center_text(draw, 'COMEDIA', _font('playfair', 34), y + 4, W, (255, 190, 80))
    _center_text(draw, 'Dante Alighieri', _font('lato', 16), y + 16, W, (200, 140, 60))

    _save(img, 'la-divina-comedia')


def make_lider_cargo():
    """Dark navy with ascending geometric shapes — leadership/growth theme."""
    img = Image.new('RGB', (W, H))
    _gradient(img, (8, 15, 35), (20, 40, 80))
    draw = ImageDraw.Draw(img)

    # Ascending bar chart / growth silhouette
    bars = [
        (60, 80, 40),
        (120, 130, 40),
        (180, 190, 40),
        (240, 250, 40),
        (300, 310, 40),
    ]
    heights = [100, 160, 200, 260, 320]
    for i, (bx, _, bw) in enumerate(bars):
        bh = heights[i]
        by = H // 2 + 80 - bh
        col = (40 + i * 20, 100 + i * 15, 200)
        draw.rectangle([bx, by, bx + bw, H // 2 + 80], fill=col)
        # Highlight top
        draw.rectangle([bx, by, bx + bw, by + 6], fill=(min(255, col[0] + 60), min(255, col[1] + 40), 255))

    # Upward arrow
    ax = W - 50
    ay = H // 5
    draw.line([(ax, ay + 60), (ax, ay)], fill=(100, 220, 255), width=4)
    draw.polygon([(ax - 12, ay + 20), (ax + 12, ay + 20), (ax, ay - 10)], fill=(100, 220, 255))

    # Grid lines (subtle)
    for gy in range(H // 4, H // 2 + 90, 40):
        draw.line([(40, gy), (W - 40, gy)], fill=(255, 255, 255, 15), width=1)

    # Title
    draw.line([(40, H // 2 + 110), (W - 40, H // 2 + 110)], fill=(60, 120, 220), width=2)
    y = H // 2 + 125
    y = _center_text(draw, 'EL LÍDER', _font('montserrat', 30), y, W, (100, 200, 255))
    y = _center_text(draw, 'QUE NO TENÍA', _font('montserrat', 22), y + 4, W, (80, 180, 240))
    y = _center_text(draw, 'CARGO', _font('montserrat', 30), y + 2, W, (100, 200, 255))
    _center_text(draw, 'Robin Sharma', _font('lato', 14), y + 12, W, (100, 150, 200))

    _save(img, 'el-lider-cargo')


# ── Main ──────────────────────────────────────────────────────────────────────

def make_fabulas_pombo():
    """Warm orange-to-green — playful frog, lily pad, tropical leaves. Pombo's children's fables."""
    img = Image.new('RGB', (W, H))
    _gradient(img, (200, 100, 20), (30, 100, 50))
    draw = ImageDraw.Draw(img)

    # Background leaf shapes (simple arcs)
    for angle, r, col in [(0, 180, (20, 120, 40)), (60, 160, (15, 90, 35)), (120, 190, (25, 110, 45))]:
        rad = math.radians(angle)
        cx = int(W // 2 + 80 * math.cos(rad))
        cy = int(H // 2 + 60 * math.sin(rad))
        draw.ellipse([cx - r, cy - r // 2, cx + r, cy + r // 2], fill=col)

    # Lily pad (ellipse at bottom center)
    pad_cx, pad_cy = W // 2, H * 3 // 4
    draw.ellipse([pad_cx - 70, pad_cy - 30, pad_cx + 70, pad_cy + 30], fill=(20, 100, 30))
    draw.ellipse([pad_cx - 68, pad_cy - 28, pad_cx + 68, pad_cy + 28], outline=(30, 140, 45), width=2)

    # Frog body (cartoon style with circles)
    fx, fy = W // 2, pad_cy - 45
    draw.ellipse([fx - 32, fy - 22, fx + 32, fy + 22], fill=(50, 180, 60))  # body
    draw.ellipse([fx - 28, fy - 20, fx + 28, fy + 18], fill=(70, 200, 80))  # belly highlight
    # Head
    draw.ellipse([fx - 28, fy - 44, fx + 28, fy - 10], fill=(50, 180, 60))
    # Eyes
    draw.ellipse([fx - 22, fy - 48, fx - 8, fy - 32], fill=(255, 255, 200))
    draw.ellipse([fx + 8, fy - 48, fx + 22, fy - 32], fill=(255, 255, 200))
    draw.ellipse([fx - 18, fy - 44, fx - 12, fy - 38], fill=(20, 80, 20))
    draw.ellipse([fx + 12, fy - 44, fx + 18, fy - 38], fill=(20, 80, 20))
    # Mouth (smile)
    draw.arc([fx - 14, fy - 26, fx + 14, fy - 14], start=0, end=180, fill=(20, 80, 20), width=3)
    # Legs
    draw.ellipse([fx - 55, fy, fx - 35, fy + 20], fill=(50, 180, 60))
    draw.ellipse([fx + 35, fy, fx + 55, fy + 20], fill=(50, 180, 60))

    # Water ripples
    for r in [90, 110, 130]:
        draw.arc([pad_cx - r, pad_cy - r // 3, pad_cx + r, pad_cy + r // 3], start=180, end=0,
                 fill=(30, 140, 180, 60), width=2)

    # Decorative stars / sparkles
    for sx, sy in [(40, 60), (W - 50, 80), (30, H // 3), (W - 40, H // 3 + 30)]:
        for d in [(0, -8), (0, 8), (-8, 0), (8, 0)]:
            draw.line([(sx, sy), (sx + d[0], sy + d[1])], fill=(255, 230, 100), width=2)

    # Dark overlay for title area
    overlay = Image.new('RGBA', (W, 150), (0, 0, 0, 160))
    img.paste(Image.alpha_composite(img.convert('RGBA').crop((0, H - 150, W, H)), overlay).convert('RGB'), (0, H - 150))

    draw = ImageDraw.Draw(img)
    _center_text(draw, 'Fábulas y Verdades', _font('playfair', 28), H - 140, W, (255, 235, 120))
    _center_text(draw, 'Rafael Pombo', _font('lato', 16), H - 96, W, (220, 200, 100))
    _center_text(draw, 'Literatura Infantil', _font('lato', 12), H - 66, W, (180, 210, 150))

    _save(img, 'fabulas-pombo')


def make_edad_de_oro():
    """Warm gold and amber — open book with a sunburst, children's stars, Martí's spirit."""
    img = Image.new('RGB', (W, H))
    _gradient(img, (120, 70, 10), (200, 140, 30))
    draw = ImageDraw.Draw(img)

    # Sunburst rays
    cx, cy = W // 2, H // 3
    for angle in range(0, 360, 20):
        rad = math.radians(angle)
        x2 = cx + int(math.cos(rad) * W)
        y2 = cy + int(math.sin(rad) * W)
        alpha = 30 + int(20 * abs(math.sin(math.radians(angle * 2))))
        col = (min(255, 220 + alpha), min(255, 160 + alpha // 2), 20)
        draw.line([(cx, cy), (x2, y2)], fill=col, width=2)

    # Central circle (sun glow)
    for r, col in [(80, (240, 180, 40)), (60, (255, 210, 60)), (40, (255, 230, 100))]:
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)

    # Open book at bottom
    bx, by = W // 2, H * 2 // 3
    bw, bh = 120, 80
    # Left page
    draw.polygon([(bx - bw, by + bh // 2), (bx, by - 5), (bx, by + bh), (bx - bw, by + bh)], fill=(255, 248, 220))
    draw.polygon([(bx - bw, by + bh // 2), (bx, by - 5), (bx, by + bh), (bx - bw, by + bh)], outline=(200, 160, 60), width=2)
    # Right page
    draw.polygon([(bx + bw, by + bh // 2), (bx, by - 5), (bx, by + bh), (bx + bw, by + bh)], fill=(255, 245, 200))
    draw.polygon([(bx + bw, by + bh // 2), (bx, by - 5), (bx, by + bh), (bx + bw, by + bh)], outline=(200, 160, 60), width=2)
    # Spine
    draw.line([(bx, by - 5), (bx, by + bh)], fill=(160, 110, 30), width=4)
    # Lines on pages (text simulation)
    for i in range(3):
        lx = bx - bw + 15
        ly = by + 25 + i * 14
        draw.line([(lx, ly), (bx - 15, ly)], fill=(180, 140, 60), width=1)
        draw.line([(bx + 15, ly), (bx + bw - 15, ly)], fill=(180, 140, 60), width=1)

    # Stars scattered
    for sx, sy in [(50, 80), (W - 55, 60), (70, H * 2 // 5), (W - 60, H * 2 // 5 + 20), (W // 4, 40), (3 * W // 4, 50)]:
        pts = []
        for i in range(5):
            outer_rad = math.radians(i * 72 - 90)
            inner_rad = math.radians(i * 72 + 36 - 90)
            pts.append((sx + int(14 * math.cos(outer_rad)), sy + int(14 * math.sin(outer_rad))))
            pts.append((sx + int(6 * math.cos(inner_rad)), sy + int(6 * math.sin(inner_rad))))
        draw.polygon(pts, fill=(255, 240, 100))

    # Title overlay
    overlay = Image.new('RGBA', (W, 140), (60, 30, 0, 180))
    img.paste(Image.alpha_composite(img.convert('RGBA').crop((0, H - 140, W, H)), overlay).convert('RGB'), (0, H - 140))

    draw = ImageDraw.Draw(img)
    _center_text(draw, 'La Edad de Oro', _font('playfair', 30), H - 130, W, (255, 235, 120))
    _center_text(draw, 'José Martí', _font('lato', 17), H - 90, W, (220, 200, 100))
    _center_text(draw, 'Literatura Infantil', _font('lato', 12), H - 62, W, (200, 220, 160))

    _save(img, 'la-edad-de-oro')


def make_cuentos_selva():
    """Deep jungle greens + tropical animals silhouettes. Quiroga's Amazon children's stories."""
    img = Image.new('RGB', (W, H))
    _gradient(img, (5, 40, 15), (20, 80, 30))
    draw = ImageDraw.Draw(img)

    # Dense canopy layer (overlapping dark ellipses at top)
    for cx_off, r, col in [
        (-80, 110, (10, 60, 20)), (20, 130, (8, 50, 18)), (120, 100, (12, 65, 22)),
        (-30, 90, (6, 45, 16)), (170, 80, (15, 70, 25)), (-150, 95, (9, 55, 19))
    ]:
        draw.ellipse([W // 2 + cx_off - r, -30, W // 2 + cx_off + r, 80], fill=col)

    # Tree trunks
    for tx, tw in [(60, 18), (W - 70, 16), (W // 2 - 20, 14)]:
        draw.rectangle([tx - tw // 2, H // 3, tx + tw // 2, H], fill=(40, 25, 10))
        # Bark lines
        for ly in range(H // 3, H, 30):
            draw.arc([tx - tw // 2, ly - 5, tx + tw // 2, ly + 5], start=0, end=180, fill=(55, 35, 15), width=1)

    # Ground / jungle floor
    ground_pts = [(0, H * 3 // 4)]
    for x in range(0, W + 20, 15):
        y = H * 3 // 4 + int(10 * math.sin(x * 0.12))
        ground_pts.append((x, y))
    ground_pts += [(W, H), (0, H)]
    draw.polygon(ground_pts, fill=(20, 50, 15))

    # Flamingo (standing on one leg — pink bird)
    px, py = W * 3 // 4, H * 2 // 3
    # Leg
    draw.line([(px, py), (px - 3, py + 50)], fill=(220, 120, 130), width=5)
    draw.line([(px - 3, py + 50), (px - 15, py + 55)], fill=(220, 120, 130), width=4)  # foot
    draw.line([(px - 3, py + 50), (px + 8, py + 55)], fill=(220, 120, 130), width=4)
    # Body
    draw.ellipse([px - 28, py - 30, px + 20, py + 15], fill=(240, 140, 160))
    # Neck + head
    draw.line([(px - 10, py - 30), (px - 25, py - 70)], fill=(240, 140, 160), width=10)
    draw.ellipse([px - 36, py - 82, px - 16, py - 62], fill=(240, 140, 160))
    # Beak
    draw.line([(px - 26, py - 72), (px - 10, py - 68)], fill=(40, 30, 10), width=4)
    # Eye
    draw.ellipse([px - 33, py - 79, px - 27, py - 73], fill=(30, 20, 10))

    # Turtle (on the ground)
    tx2, ty2 = W // 4, H * 3 // 4 + 10
    draw.ellipse([tx2 - 35, ty2 - 18, tx2 + 35, ty2 + 18], fill=(60, 100, 40))
    # Shell pattern
    draw.ellipse([tx2 - 30, ty2 - 14, tx2 + 30, ty2 + 14], outline=(40, 70, 25), width=2)
    draw.line([(tx2, ty2 - 14), (tx2, ty2 + 14)], fill=(40, 70, 25), width=1)
    draw.line([(tx2 - 30, ty2), (tx2 + 30, ty2)], fill=(40, 70, 25), width=1)
    # Head + legs
    draw.ellipse([tx2 + 30, ty2 - 10, tx2 + 46, ty2 + 6], fill=(50, 90, 35))
    for leg_x, leg_y in [(tx2 - 25, ty2 + 14), (tx2 + 15, ty2 + 14), (tx2 - 15, ty2 - 14), (tx2 + 5, ty2 - 14)]:
        draw.ellipse([leg_x - 6, leg_y - 5, leg_x + 6, leg_y + 5], fill=(50, 90, 35))

    # Fireflies (small glowing dots)
    for fx2, fy2 in [(100, H // 2), (W - 80, H // 2 + 20), (W // 2, H // 2 - 30), (150, H // 3 + 40), (W - 120, H // 3 + 60)]:
        for r2 in [6, 4, 2]:
            draw.ellipse([fx2 - r2, fy2 - r2, fx2 + r2, fy2 + r2], fill=(200, 255, 100, 60 + (6 - r2) * 30))

    # Title overlay
    overlay = Image.new('RGBA', (W, 140), (0, 20, 5, 200))
    img.paste(Image.alpha_composite(img.convert('RGBA').crop((0, H - 140, W, H)), overlay).convert('RGB'), (0, H - 140))

    draw = ImageDraw.Draw(img)
    _center_text(draw, 'Cuentos de la Selva', _font('playfair', 26), H - 130, W, (180, 255, 150))
    _center_text(draw, 'Horacio Quiroga', _font('lato', 16), H - 92, W, (150, 220, 130))
    _center_text(draw, 'Literatura Infantil', _font('lato', 12), H - 64, W, (120, 200, 110))

    _save(img, 'cuentos-selva')


def make_literatura_infantil_collection():
    """Collection cover — warm multicolor patchwork with frog, star, turtle motifs."""
    img = Image.new('RGB', (W, H))
    _gradient(img, (180, 80, 20), (20, 100, 60))
    draw = ImageDraw.Draw(img)

    # Colorful patch blocks in background
    patches = [
        (0, 0, W // 2, H // 2, (200, 80, 30)),
        (W // 2, 0, W, H // 2, (30, 120, 50)),
        (0, H // 2, W // 2, H, (30, 80, 150)),
        (W // 2, H // 2, W, H, (160, 40, 100)),
    ]
    for x1, y1, x2, y2, col in patches:
        faded = tuple(max(0, c - 40) for c in col)
        draw.rectangle([x1, y1, x2, y2], fill=faded)

    # Decorative connecting lines
    draw.line([(0, H // 2), (W, H // 2)], fill=(255, 220, 100), width=3)
    draw.line([(W // 2, 0), (W // 2, H)], fill=(255, 220, 100), width=3)
    draw.ellipse([W // 2 - 18, H // 2 - 18, W // 2 + 18, H // 2 + 18], fill=(255, 220, 100))

    # Mini frog (top-left quadrant)
    fx, fy = W // 4, H // 4
    draw.ellipse([fx - 22, fy - 16, fx + 22, fy + 16], fill=(60, 200, 80))
    draw.ellipse([fx - 18, fy - 28, fx + 18, fy - 6], fill=(60, 200, 80))
    draw.ellipse([fx - 14, fy - 30, fx - 6, fy - 22], fill=(255, 255, 200))
    draw.ellipse([fx + 6, fy - 30, fx + 14, fy - 22], fill=(255, 255, 200))
    draw.ellipse([fx - 12, fy - 27, fx - 8, fy - 25], fill=(20, 80, 20))
    draw.ellipse([fx + 8, fy - 27, fx + 12, fy - 25], fill=(20, 80, 20))

    # Mini star (top-right quadrant)
    sx, sy = W * 3 // 4, H // 4
    pts = []
    for i in range(5):
        outer_r = math.radians(i * 72 - 90)
        inner_r = math.radians(i * 72 + 36 - 90)
        pts.append((sx + int(28 * math.cos(outer_r)), sy + int(28 * math.sin(outer_r))))
        pts.append((sx + int(12 * math.cos(inner_r)), sy + int(12 * math.sin(inner_r))))
    draw.polygon(pts, fill=(255, 230, 60))

    # Mini turtle (bottom-left)
    tx2, ty2 = W // 4, H * 3 // 4
    draw.ellipse([tx2 - 28, ty2 - 14, tx2 + 28, ty2 + 14], fill=(50, 160, 60))
    draw.ellipse([tx2 - 24, ty2 - 10, tx2 + 24, ty2 + 10], outline=(30, 120, 40), width=2)
    draw.ellipse([tx2 + 24, ty2 - 8, tx2 + 38, ty2 + 4], fill=(40, 130, 50))

    # Mini open book (bottom-right)
    bx, by = W * 3 // 4, H * 3 // 4
    draw.polygon([(bx - 35, by + 20), (bx, by - 5), (bx, by + 25), (bx - 35, by + 25)], fill=(255, 245, 210))
    draw.polygon([(bx + 35, by + 20), (bx, by - 5), (bx, by + 25), (bx + 35, by + 25)], fill=(255, 250, 230))
    draw.line([(bx, by - 5), (bx, by + 25)], fill=(150, 100, 30), width=3)

    # Title
    draw.rectangle([20, H // 2 - 80, W - 20, H // 2 + 80], fill=(0, 0, 0, 0))
    y = H // 2 - 60
    y = _center_text(draw, 'LITERATURA', _font('montserrat', 26), y, W, (255, 240, 120))
    y = _center_text(draw, 'INFANTIL', _font('montserrat', 34), y + 4, W, (255, 240, 120))
    _center_text(draw, 'Pombo · Martí · Quiroga', _font('lato', 14), y + 12, W, (220, 210, 180))

    _save(img, 'literatura-infantil')


if __name__ == '__main__':
    print('Generating themed book covers...')
    make_biblia_reina_valera()
    make_bible_kjv()
    make_quijote(1)
    make_quijote(2)
    make_don_juan_tenorio()
    make_divina_comedia()
    make_lider_cargo()
    make_fabulas_pombo()
    make_edad_de_oro()
    make_cuentos_selva()
    make_literatura_infantil_collection()
    print(f'\nDone. Files saved to:\n  {OUTPUT_DIR}')
    print('\nRun migration 028/029 to update coverUrl in the database.')
