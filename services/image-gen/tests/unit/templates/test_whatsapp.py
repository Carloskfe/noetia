import struct
import pytest
from templates.whatsapp import render


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


def test_render_dimensions_are_800x800():
    result = render({})
    w, h = _png_dimensions(result)
    assert w == 800
    assert h == 800


def test_render_is_square():
    result = render({})
    w, h = _png_dimensions(result)
    assert w == h


def test_render_accepts_populated_fragment():
    fragment = {"text": "Para WhatsApp.", "author": "Autor", "book": "Libro"}
    result = render(fragment)
    assert isinstance(result, bytes)
    assert len(result) > 0
