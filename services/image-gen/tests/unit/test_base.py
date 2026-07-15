"""Tests for templates/base.py — colour helpers, font registry, and render_card."""
import base64
import io
import struct
from unittest.mock import MagicMock, patch

import pytest
from PIL import Image

import os

from templates.base import (
    _DARK_NAVY,
    _LOGO_DARK,
    _LOGO_LIGHT,
    _WHITE,
    VALID_FONTS,
    _render_image_bg,
    _watermark_logo_path,
    parse_hex_color,
    relative_luminance,
    render_card,
    text_color_for_bg,
)


def _png_dimensions(data: bytes):
    assert data[:8] == b'\x89PNG\r\n\x1a\n', "Not a valid PNG"
    w = struct.unpack('>I', data[16:20])[0]
    h = struct.unpack('>I', data[20:24])[0]
    return w, h


def _asymmetric_bg_data_uri(size: int = 800) -> str:
    """Data URI for a bg whose left half is red and right half is blue —
    lets a horizontal mirror be detected by inspecting corner pixels."""
    src = Image.new('RGB', (size, size), (255, 0, 0))
    src.paste((0, 0, 255), [size // 2, 0, size, size])  # right half blue
    buf = io.BytesIO()
    src.save(buf, format='PNG')
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()


# ── parse_hex_color ───────────────────────────────────────────────────────────

def test_parse_hex_color_with_hash():
    assert parse_hex_color('#0D1B2A') == (13, 27, 42)


def test_parse_hex_color_without_hash():
    assert parse_hex_color('FFFFFF') == (255, 255, 255)


def test_parse_hex_color_black():
    assert parse_hex_color('#000000') == (0, 0, 0)


def test_parse_hex_color_white():
    assert parse_hex_color('#FFFFFF') == (255, 255, 255)


def test_parse_hex_color_invalid_raises():
    with pytest.raises(ValueError):
        parse_hex_color('#XYZ')


def test_parse_hex_color_short_raises():
    with pytest.raises(ValueError):
        parse_hex_color('#FFF')


# ── relative_luminance ────────────────────────────────────────────────────────

def test_relative_luminance_black_is_zero():
    assert relative_luminance(0, 0, 0) == pytest.approx(0.0)


def test_relative_luminance_white_is_one():
    assert relative_luminance(255, 255, 255) == pytest.approx(1.0, abs=0.001)


def test_relative_luminance_dark_navy_is_low():
    r, g, b = parse_hex_color('#0D1B2A')
    lum = relative_luminance(r, g, b)
    assert lum < 0.1


def test_relative_luminance_white_background_is_high():
    assert relative_luminance(255, 255, 255) > 0.9


# ── text_color_for_bg ─────────────────────────────────────────────────────────

def test_text_color_for_dark_bg_returns_white():
    result = text_color_for_bg(['#000000'])
    assert result == (255, 255, 255)


def test_text_color_for_light_bg_returns_dark_navy():
    result = text_color_for_bg(['#FFFFFF'])
    assert result == (13, 27, 42)


def test_text_color_for_navy_bg_returns_white():
    result = text_color_for_bg(['#0D1B2A'])
    assert result == (255, 255, 255)


def test_text_color_averages_gradient_stops():
    # Average of white + black = grey ~luminance 0.21 → above threshold → dark text
    result = text_color_for_bg(['#FFFFFF', '#000000'])
    # Average RGB = (127,127,127) → luminance ~0.216 > 0.179 → dark navy
    assert result == (13, 27, 42)


def test_text_color_two_dark_stops_returns_white():
    result = text_color_for_bg(['#0D1B2A', '#1A4A4A'])
    assert result == (255, 255, 255)


# ── VALID_FONTS ───────────────────────────────────────────────────────────────

def test_valid_fonts_has_seven_entries():
    assert len(VALID_FONTS) == 7


def test_valid_fonts_contains_expected_keys():
    assert set(VALID_FONTS.keys()) == {
        'playfair', 'montserrat', 'merriweather', 'oswald', 'baskerville', 'dancing', 'pacifico',
    }


def test_valid_fonts_paths_end_with_ttf():
    for font_id, path in VALID_FONTS.items():
        assert path.endswith('.ttf'), f"{font_id} path does not end with .ttf"


# ── render_card ───────────────────────────────────────────────────────────────

_FRAGMENT = {"text": "El liderazgo es una práctica.", "author": "Robin Sharma", "title": "El Líder"}


def test_render_card_returns_valid_png():
    result = render_card(_FRAGMENT, 800, 800)
    assert result[:8] == b'\x89PNG\r\n\x1a\n'


def test_render_card_correct_dimensions():
    result = render_card(_FRAGMENT, 1080, 1080)
    assert _png_dimensions(result) == (1080, 1080)


def test_render_card_story_dimensions():
    result = render_card(_FRAGMENT, 1080, 1920)
    assert _png_dimensions(result) == (1080, 1920)


def test_render_card_respects_text_align():
    # A quote long enough to wrap, so alignment visibly shifts the text pixels.
    frag = {"text": "El liderazgo es una práctica constante y diaria de servicio a los demás.",
            "author": "R", "title": "T"}
    left = render_card({**frag, "textAlign": "left"}, 800, 800)
    right = render_card({**frag, "textAlign": "right"}, 800, 800)
    center = render_card({**frag, "textAlign": "center"}, 800, 800)
    for img in (left, right, center):
        assert img[:8] == b'\x89PNG\r\n\x1a\n'
    # Alignment must actually move the text.
    assert left != right
    assert left != center


def test_render_card_defaults_to_center_align():
    frag = {"text": "El liderazgo es una práctica constante y diaria de servicio.",
            "author": "R", "title": "T"}
    assert render_card(frag, 800, 800) == render_card({**frag, "textAlign": "center"}, 800, 800)


def test_render_card_solid_background():
    result = render_card(_FRAGMENT, 800, 800, bg_type='solid', bg_colors=['#FF6B6B'])
    assert result[:8] == b'\x89PNG\r\n\x1a\n'


def test_render_card_gradient_background():
    result = render_card(_FRAGMENT, 800, 800, bg_type='gradient', bg_colors=['#0D1B2A', '#1A4A4A'])
    assert result[:8] == b'\x89PNG\r\n\x1a\n'


def test_render_card_gradient_single_color_fallback():
    result = render_card(_FRAGMENT, 800, 800, bg_type='gradient', bg_colors=['#0D1B2A'])
    assert result[:8] == b'\x89PNG\r\n\x1a\n'


def test_render_card_empty_fragment():
    result = render_card({}, 800, 800)
    assert result[:8] == b'\x89PNG\r\n\x1a\n'


def test_render_card_all_fonts_produce_valid_png():
    for font_id in ('playfair', 'montserrat', 'merriweather', 'oswald', 'baskerville', 'dancing', 'pacifico'):
        result = render_card(_FRAGMENT, 800, 800, font=font_id)
        assert result[:8] == b'\x89PNG\r\n\x1a\n', f"Font {font_id} did not produce valid PNG"


def test_render_card_light_bg_uses_dark_text():
    # White background → dark text; just verify the card renders without error
    result = render_card(_FRAGMENT, 800, 800, bg_colors=['#FFFFFF'])
    assert _png_dimensions(result) == (800, 800)


def test_render_card_dark_bg_uses_light_text():
    result = render_card(_FRAGMENT, 800, 800, bg_colors=['#000000'])
    assert _png_dimensions(result) == (800, 800)


def test_render_card_text_color_override_bypasses_luminance():
    result = render_card(_FRAGMENT, 800, 800, bg_colors=['#FFFFFF'], text_color_override='#FF0000')
    assert _png_dimensions(result) == (800, 800)


def test_render_card_text_color_override_on_dark_bg():
    result = render_card(_FRAGMENT, 800, 800, bg_colors=['#000000'], text_color_override='#FF6B6B')
    assert _png_dimensions(result) == (800, 800)


def test_render_card_no_override_preserves_auto_luminance_dark():
    result = render_card(_FRAGMENT, 800, 800, bg_colors=['#000000'], text_color_override=None)
    assert _png_dimensions(result) == (800, 800)


def test_render_card_no_override_preserves_auto_luminance_light():
    result = render_card(_FRAGMENT, 800, 800, bg_colors=['#FFFFFF'], text_color_override=None)
    assert _png_dimensions(result) == (800, 800)


# ── background image horizontal flip (mirror) ─────────────────────────────────

def test_render_image_bg_no_flip_keeps_orientation():
    img = Image.new('RGB', (800, 800), (0, 0, 0))
    _render_image_bg(img, _asymmetric_bg_data_uri(), bg_flip=False)
    # left half stays red, right half stays blue
    assert img.getpixel((10, 400))[0] > 200      # left is red
    assert img.getpixel((790, 400))[2] > 200     # right is blue


def test_render_image_bg_flip_mirrors_horizontally():
    img = Image.new('RGB', (800, 800), (0, 0, 0))
    _render_image_bg(img, _asymmetric_bg_data_uri(), bg_flip=True)
    # after horizontal mirror the halves swap: left blue, right red
    assert img.getpixel((10, 400))[2] > 200      # left is now blue
    assert img.getpixel((790, 400))[0] > 200     # right is now red


def test_render_image_bg_flip_only_swaps_horizontally_not_vertically():
    img = Image.new('RGB', (800, 800), (0, 0, 0))
    _render_image_bg(img, _asymmetric_bg_data_uri(), bg_flip=True)
    # top and bottom of a given column share the same colour (no vertical flip)
    assert img.getpixel((10, 20)) == img.getpixel((10, 780))


def test_render_card_image_bg_flip_returns_valid_png():
    result = render_card(_FRAGMENT, 800, 800, bg_type='image',
                         bg_image=_asymmetric_bg_data_uri(), bg_flip=True)
    assert _png_dimensions(result) == (800, 800)


def test_render_card_image_flip_differs_from_no_flip():
    uri = _asymmetric_bg_data_uri()
    flipped = render_card(_FRAGMENT, 800, 800, bg_type='image', bg_image=uri, bg_flip=True)
    normal  = render_card(_FRAGMENT, 800, 800, bg_type='image', bg_image=uri, bg_flip=False)
    assert flipped != normal


def test_render_card_flip_is_noop_on_solid_bg():
    # bg_flip only affects image backgrounds — solid renders identically
    flipped = render_card(_FRAGMENT, 800, 800, bg_type='solid', bg_colors=['#FF6B6B'], bg_flip=True)
    normal  = render_card(_FRAGMENT, 800, 800, bg_type='solid', bg_colors=['#FF6B6B'], bg_flip=False)
    assert flipped == normal


# ── quote text scale (S/M/L) ──────────────────────────────────────────────────

_LONG_FRAGMENT = {
    "text": "El liderazgo es una práctica constante y diaria de servicio a los demás.",
    "author": "Robin Sharma", "title": "El Líder",
}


def test_render_card_default_scale_matches_explicit_one():
    # Omitting textScale must behave identically to textScale == 1.0
    assert render_card(_LONG_FRAGMENT, 800, 800) == \
        render_card({**_LONG_FRAGMENT, "textScale": 1.0}, 800, 800)


def test_render_card_larger_scale_changes_output():
    small = render_card({**_LONG_FRAGMENT, "textScale": 0.7}, 800, 800)
    large = render_card({**_LONG_FRAGMENT, "textScale": 1.5}, 800, 800)
    assert small[:8] == b'\x89PNG\r\n\x1a\n'
    assert large[:8] == b'\x89PNG\r\n\x1a\n'
    assert small != large


def test_render_card_scale_clamped_below_minimum():
    # 0.1 is below the 0.7 floor → must render as if clamped to 0.7
    clamped = render_card({**_LONG_FRAGMENT, "textScale": 0.1}, 800, 800)
    floor   = render_card({**_LONG_FRAGMENT, "textScale": 0.7}, 800, 800)
    assert clamped == floor


def test_render_card_scale_clamped_above_maximum():
    # 5.0 is above the 1.5 ceiling → must render as if clamped to 1.5
    clamped = render_card({**_LONG_FRAGMENT, "textScale": 5.0}, 800, 800)
    ceiling = render_card({**_LONG_FRAGMENT, "textScale": 1.5}, 800, 800)
    assert clamped == ceiling


def test_render_card_scale_invalid_falls_back_to_one():
    bad = render_card({**_LONG_FRAGMENT, "textScale": "huge"}, 800, 800)
    default = render_card(_LONG_FRAGMENT, 800, 800)
    assert bad == default


def test_render_card_scale_none_falls_back_to_one():
    none_scale = render_card({**_LONG_FRAGMENT, "textScale": None}, 800, 800)
    default = render_card(_LONG_FRAGMENT, 800, 800)
    assert none_scale == default


def test_render_card_scale_produces_valid_png_at_extremes():
    for scale in (0.7, 1.0, 1.5):
        result = render_card({**_LONG_FRAGMENT, "textScale": scale}, 1080, 1920)
        assert _png_dimensions(result) == (1080, 1920), f"scale {scale} failed"


# ── watermark logo ────────────────────────────────────────────────────────────

def test_watermark_logo_assets_exist():
    assert os.path.exists(_LOGO_LIGHT), "light logo watermark asset missing"
    assert os.path.exists(_LOGO_DARK), "dark logo watermark asset missing"


def test_watermark_light_logo_for_dark_bg():
    # white text ⇒ dark background ⇒ white (light) logo
    assert _watermark_logo_path(_WHITE) == _LOGO_LIGHT


def test_watermark_dark_logo_for_light_bg():
    # dark-navy text ⇒ light background ⇒ dark logo
    assert _watermark_logo_path(_DARK_NAVY) == _LOGO_DARK


def test_render_card_composites_logo_watermark_dark_bg():
    result = render_card(_FRAGMENT, 800, 800, bg_colors=['#000000'])
    assert result[:8] == b'\x89PNG\r\n\x1a\n'


def test_render_card_composites_logo_watermark_light_bg():
    result = render_card(_FRAGMENT, 800, 800, bg_colors=['#FFFFFF'])
    assert result[:8] == b'\x89PNG\r\n\x1a\n'


def test_render_card_watermark_falls_back_to_text_when_asset_missing():
    from templates import base as base_module
    orig_light, orig_dark = base_module._LOGO_LIGHT, base_module._LOGO_DARK
    base_module._LOGO_LIGHT = '/nonexistent/logo-light.png'
    base_module._LOGO_DARK = '/nonexistent/logo-dark.png'
    try:
        result = render_card(_FRAGMENT, 800, 800, bg_colors=['#000000'])
        assert result[:8] == b'\x89PNG\r\n\x1a\n'
    finally:
        base_module._LOGO_LIGHT, base_module._LOGO_DARK = orig_light, orig_dark


def test_render_card_falls_back_to_default_font_on_missing_file():
    from templates import base as base_module
    original = base_module.VALID_FONTS.copy()
    base_module.VALID_FONTS['oswald'] = '/nonexistent/path/oswald.ttf'
    try:
        result = render_card(_FRAGMENT, 800, 800, font='oswald')
        assert result[:8] == b'\x89PNG\r\n\x1a\n'
    finally:
        base_module.VALID_FONTS.update(original)
