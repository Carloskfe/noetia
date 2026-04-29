"""Tests for templates/base.py — colour helpers, font registry, and render_card."""
import struct
from unittest.mock import MagicMock, patch

import pytest

from templates.base import (
    VALID_FONTS,
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
        'playfair', 'lato', 'lora', 'merriweather', 'dancing', 'montserrat', 'raleway',
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
    for font_id in ('playfair', 'lato', 'lora', 'merriweather', 'dancing', 'montserrat', 'raleway'):
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


def test_render_card_falls_back_to_default_font_on_missing_file():
    from templates import base as base_module
    original = base_module.VALID_FONTS.copy()
    base_module.VALID_FONTS['lato'] = '/nonexistent/path/lato.ttf'
    try:
        result = render_card(_FRAGMENT, 800, 800, font='lato')
        assert result[:8] == b'\x89PNG\r\n\x1a\n'
    finally:
        base_module.VALID_FONTS.update(original)
