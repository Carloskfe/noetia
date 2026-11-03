import base64
import io

from PIL import Image

from templates.base import (
    render_card,
    text_color_for_bg,
    _logo_target_height,
    _LOGO_MIN_H,
    _WHITE,
    _DARK_NAVY,
)


def _png_data_uri(color=(120, 120, 120), size=(8, 8)) -> str:
    """A tiny solid-colour PNG as a data: URI, for image-background tests."""
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"


def _card(**kwargs) -> bytes:
    fragment = kwargs.pop("fragment", {"text": "Una cita.", "author": "Autor", "title": "Libro"})
    return render_card(fragment, 600, 600, **kwargs)


# ── text_color_for_bg ─────────────────────────────────────────────────────────

class TestTextColorForBg:
    def test_dark_background_gets_white_text(self):
        assert text_color_for_bg(["#0D1B2A"]) == _WHITE

    def test_light_background_gets_dark_text(self):
        assert text_color_for_bg(["#FFFFFF"]) == _DARK_NAVY

    def test_averages_multiple_colours(self):
        # Two dark colours average dark → white text.
        assert text_color_for_bg(["#000000", "#0D1B2A"]) == _WHITE


# ── render_card colour override ───────────────────────────────────────────────

class TestRenderCardOverride:
    def test_returns_valid_png(self):
        data = _card()
        assert data[:8] == b"\x89PNG\r\n\x1a\n"

    def test_override_changes_solid_render(self):
        # Same dark background, but forcing a dark (navy) text override must
        # differ from the auto white the background would otherwise pick.
        auto = _card(bg_type="solid", bg_colors=["#0D1B2A"])
        overridden = _card(bg_type="solid", bg_colors=["#0D1B2A"], text_color_override="#FF0000")
        assert auto != overridden

    def test_image_bg_honours_text_colour_override(self):
        # Bug fix: over a photo background the render used to force white and
        # ignore the override, so the download didn't match the preview. An
        # explicit navy override must now actually change the output.
        uri = _png_data_uri()
        forced_white = _card(bg_type="image", bg_image=uri)  # no override → white
        overridden = _card(bg_type="image", bg_image=uri, text_color_override="#0D1B2A")
        assert forced_white != overridden

    def test_italic_changes_the_render(self):
        # Italic must actually slant the quote text, so the output differs from
        # the upright render (previously italic was ignored entirely).
        upright = _card(fragment={"text": "Una cita en cursiva.", "author": "A", "title": "L"})
        italic = _card(fragment={"text": "Una cita en cursiva.", "author": "A", "title": "L", "italic": True})
        assert upright != italic

    def test_bold_and_italic_combine(self):
        italic = _card(fragment={"text": "Cita.", "author": "A", "title": "L", "italic": True})
        bold_italic = _card(fragment={"text": "Cita.", "author": "A", "title": "L", "italic": True, "bold": True})
        assert italic != bold_italic

    def test_non_italic_render_is_unchanged_by_the_flag(self):
        # italic=False must be byte-identical to omitting the flag.
        default = _card(fragment={"text": "Cita.", "author": "A", "title": "L"})
        explicit = _card(fragment={"text": "Cita.", "author": "A", "title": "L", "italic": False})
        assert default == explicit

    def test_image_bg_white_override_matches_auto_white(self):
        # Sanity: an explicit white override equals the auto-white default over
        # an image, so the fix doesn't change the common case.
        uri = _png_data_uri()
        auto = _card(bg_type="image", bg_image=uri)
        white_override = _card(bg_type="image", bg_image=uri, text_color_override="#FFFFFF")
        assert auto == white_override


# ── Watermark logo size ───────────────────────────────────────────────────────

class TestLogoTargetHeight:
    def test_height_is_3_9_percent_of_width(self):
        # 1080px card → int(1080 * 0.039) = 42px.
        assert _logo_target_height(1080) == 42

    def test_reduced_35_percent_from_the_old_6_percent(self):
        # The logo was 6% of card width; it is now ~35% smaller. Allow ±1px for
        # int() truncation across the size range.
        for width in (1000, 1080, 1200, 1920):
            old = int(width * 0.06)
            assert abs(_logo_target_height(width) - old * 0.65) <= 1

    def test_floors_at_the_minimum_height(self):
        # Very narrow cards clamp to the minimum so the mark stays legible.
        assert _logo_target_height(100) == _LOGO_MIN_H


# ── Background image sources (NEM-016 S12) ────────────────────────────────────

import pytest
from unittest import mock

from templates import base as base_mod


class _FakeResp:
    def __init__(self, data: bytes):
        self._data = data

    def read(self, n=-1):
        return self._data if n < 0 else self._data[:n]

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def _png_bytes(color=(10, 200, 10)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (4, 4), color).save(buf, format="PNG")
    return buf.getvalue()


class TestLoadBgImage:
    def test_accepts_inline_png_data_uri(self):
        img = base_mod._load_bg_image(_png_data_uri((1, 2, 3)))
        assert img.getpixel((0, 0)) == (1, 2, 3)

    @pytest.mark.parametrize("uri", [
        "data:text/html;base64,PGgxPg==",
        "data:image/svg+xml;base64,PHN2Zz4=",
    ])
    def test_rejects_non_raster_data_uris(self, uri):
        with pytest.raises(ValueError):
            base_mod._load_bg_image(uri)

    def test_rejects_oversized_data_uri(self, monkeypatch):
        monkeypatch.setattr(base_mod, "_BG_MAX_BYTES", 10)
        with pytest.raises(ValueError):
            base_mod._load_bg_image(_png_data_uri())

    @pytest.mark.parametrize("url", [
        "file:///etc/passwd",
        "ftp://noetia.app/backgrounds/imagen-1.jpg",
        "http://api:4000/health",
        "http://169.254.169.254/latest/meta-data/",
        "https://noetia.app/backgrounds/../secret.jpg",
        "https://noetia.app/backgrounds/imagen-1.jpg?x=1",
        "https://user:pw@noetia.app/backgrounds/imagen-1.jpg",
        "https://noetia.app/images/abc.png",
    ])
    def test_rejects_non_preset_urls_without_fetching(self, url):
        with mock.patch.object(base_mod._BG_OPENER, "open") as opener:
            with pytest.raises(ValueError):
                base_mod._load_bg_image(url)
            opener.assert_not_called()

    def test_fetches_allowed_preset_url(self, monkeypatch):
        monkeypatch.delenv("BG_IMAGE_ALLOWED_HOSTS", raising=False)
        with mock.patch.object(base_mod._BG_OPENER, "open", return_value=_FakeResp(_png_bytes())) as opener:
            img = base_mod._load_bg_image("https://noetia.app/backgrounds/imagen-3.jpg")
        opener.assert_called_once()
        assert img.getpixel((0, 0)) == (10, 200, 10)

    def test_host_allowlist_enforced_when_configured(self, monkeypatch):
        monkeypatch.setenv("BG_IMAGE_ALLOWED_HOSTS", "noetia.app, staging.noetia.app")
        with mock.patch.object(base_mod._BG_OPENER, "open") as opener:
            with pytest.raises(ValueError):
                base_mod._load_bg_image("https://evil.example/backgrounds/imagen-1.jpg")
            opener.assert_not_called()
        with mock.patch.object(base_mod._BG_OPENER, "open", return_value=_FakeResp(_png_bytes())):
            assert base_mod._load_bg_image("https://staging.noetia.app/backgrounds/imagen-1.jpg")

    def test_rejects_oversized_download(self, monkeypatch):
        monkeypatch.setattr(base_mod, "_BG_MAX_BYTES", 5)
        with mock.patch.object(base_mod._BG_OPENER, "open", return_value=_FakeResp(_png_bytes())):
            with pytest.raises(ValueError):
                base_mod._load_bg_image("https://noetia.app/backgrounds/imagen-1.jpg")

    def test_redirects_are_not_followed(self):
        handler = base_mod._NoRedirect()
        assert handler.redirect_request(None, None, 302, "Found", {}, "http://internal/") is None

    def test_rejected_source_falls_back_to_default_card(self):
        # The card still renders with the navy fallback — no fetch, no crash —
        # identical to any other unloadable background.
        with mock.patch.object(base_mod._BG_OPENER, "open") as opener:
            rejected = _card(bg_type="image", bg_image="http://api:4000/internal")
        opener.assert_not_called()
        unloadable = _card(bg_type="image", bg_image="data:image/png;base64,AAAA")
        assert rejected == unloadable
