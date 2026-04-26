import struct
from unittest.mock import MagicMock, patch

import pytest

from templates.instagram import render


def _png_dimensions(data: bytes):
    assert data[:8] == b'\x89PNG\r\n\x1a\n', "Not a valid PNG"
    w = struct.unpack('>I', data[16:20])[0]
    h = struct.unpack('>I', data[20:24])[0]
    return w, h


def test_render_returns_bytes():
    result = render({})
    assert isinstance(result, bytes)


def test_render_is_non_empty():
    result = render({})
    assert len(result) > 0


def test_render_produces_valid_png():
    result = render({})
    assert result[:8] == b'\x89PNG\r\n\x1a\n'


def test_render_post_dimensions_are_1080x1080():
    result = render({}, format='post')
    w, h = _png_dimensions(result)
    assert w == 1080
    assert h == 1080


def test_render_story_dimensions_are_1080x1920():
    result = render({}, format='story')
    w, h = _png_dimensions(result)
    assert w == 1080
    assert h == 1920


def test_render_default_format_is_post():
    result = render({})
    w, h = _png_dimensions(result)
    assert w == 1080 and h == 1080


def test_render_accepts_populated_fragment():
    fragment = {"text": "Una cita para Instagram.", "author": "Autor", "title": "Mi Libro"}
    result = render(fragment, format='post')
    assert isinstance(result, bytes)
    assert len(result) > 0


def test_render_all_fonts_produce_valid_png():
    for font in ("playfair", "lato", "merriweather", "dancing", "montserrat"):
        result = render({}, font=font)
        assert result[:8] == b'\x89PNG\r\n\x1a\n', f"Font {font} did not produce valid PNG"


def test_render_gradient_background():
    result = render({}, bg_type='gradient', bg_colors=['#0D1B2A', '#1A4A4A'])
    assert result[:8] == b'\x89PNG\r\n\x1a\n'


def test_render_draws_quote_text():
    fragment = {"text": "Cita Instagram", "author": "Autor", "title": "Libro"}
    with patch("templates.base.ImageDraw") as mock_draw_module:
        mock_draw = MagicMock()
        mock_draw.textbbox.return_value = (0, 0, 100, 20)
        mock_draw_module.Draw.return_value = mock_draw
        render(fragment)
    all_text = " ".join(str(c) for c in mock_draw.text.call_args_list)
    assert "Cita" in all_text or "Instagram" in all_text


def test_render_draws_attribution():
    fragment = {"text": "Quote", "author": "Autor IG", "title": "Libro IG"}
    with patch("templates.base.ImageDraw") as mock_draw_module:
        mock_draw = MagicMock()
        mock_draw.textbbox.return_value = (0, 0, 100, 20)
        mock_draw_module.Draw.return_value = mock_draw
        render(fragment)
    all_text = " ".join(str(c) for c in mock_draw.text.call_args_list)
    assert "Autor IG" in all_text
    assert "Libro IG" in all_text
