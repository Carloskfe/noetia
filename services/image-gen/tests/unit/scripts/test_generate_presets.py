"""Tests for scripts/generate_presets.py"""
import os
import struct
import tempfile
from unittest.mock import patch

import pytest

from PIL import Image


FONTS = ['playfair', 'montserrat', 'merriweather', 'oswald', 'baskerville', 'dancing', 'pacifico']


def _png_dimensions(data: bytes):
    assert data[:8] == b'\x89PNG\r\n\x1a\n', "Not a valid PNG"
    w = struct.unpack('>I', data[16:20])[0]
    h = struct.unpack('>I', data[20:24])[0]
    return w, h


def test_generate_presets_creates_seven_pngs():
    with tempfile.TemporaryDirectory() as tmpdir:
        with patch('scripts.generate_presets.OUTPUT_DIR', tmpdir):
            import scripts.generate_presets as gp
            gp.OUTPUT_DIR = tmpdir
            gp.main()
        files = os.listdir(tmpdir)
        assert len(files) == 7
        for font_id in FONTS:
            assert f"{font_id}.png" in files, f"Missing {font_id}.png"


def test_generate_presets_png_dimensions():
    with tempfile.TemporaryDirectory() as tmpdir:
        import scripts.generate_presets as gp
        gp.OUTPUT_DIR = tmpdir
        gp.main()
        for font_id in FONTS:
            path = os.path.join(tmpdir, f"{font_id}.png")
            with open(path, 'rb') as f:
                data = f.read()
            w, h = _png_dimensions(data)
            assert w == 240, f"{font_id}: expected width 240, got {w}"
            assert h == 80, f"{font_id}: expected height 80, got {h}"


def test_generate_presets_pngs_are_valid_images():
    with tempfile.TemporaryDirectory() as tmpdir:
        import scripts.generate_presets as gp
        gp.OUTPUT_DIR = tmpdir
        gp.main()
        for font_id in FONTS:
            path = os.path.join(tmpdir, f"{font_id}.png")
            img = Image.open(path)
            img.verify()
