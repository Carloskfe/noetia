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
