from unittest.mock import MagicMock, patch

import pytest

from app import app


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


_VALID_BODY = {
    "text": "El conocimiento es poder.",
    "author": "Francis Bacon",
    "title": "Meditationes Sacrae",
    "platform": "linkedin",
}

_MOCK_URL = "http://storage:9000/images/abc.png?X-Amz-Signature=sig"


def _patched_minio(url=_MOCK_URL):
    mock_client = MagicMock()
    mock_client.upload.return_value = url
    return mock_client


# ── health ────────────────────────────────────────────────────────────────────

def test_health_returns_200(client):
    assert client.get("/health").status_code == 200


def test_health_returns_ok_json(client):
    assert client.get("/health").get_json() == {"status": "ok"}


def test_health_content_type_is_json(client):
    assert "application/json" in client.get("/health").content_type


def test_unknown_route_returns_404(client):
    assert client.get("/unknown-route").status_code == 404


# ── /generate — required fields ───────────────────────────────────────────────

def test_generate_returns_200_with_url(client):
    with patch("app.MinioClient", return_value=_patched_minio()):
        response = client.post("/generate", json=_VALID_BODY)
    assert response.status_code == 200
    data = response.get_json()
    assert "url" in data and data["url"].startswith("http")


def test_generate_missing_text_returns_400(client):
    body = {k: v for k, v in _VALID_BODY.items() if k != "text"}
    assert client.post("/generate", json=body).status_code == 400


def test_generate_missing_author_returns_400(client):
    body = {k: v for k, v in _VALID_BODY.items() if k != "author"}
    assert client.post("/generate", json=body).status_code == 400


def test_generate_missing_title_returns_400(client):
    body = {k: v for k, v in _VALID_BODY.items() if k != "title"}
    assert client.post("/generate", json=body).status_code == 400


def test_generate_missing_platform_returns_400(client):
    body = {k: v for k, v in _VALID_BODY.items() if k != "platform"}
    assert client.post("/generate", json=body).status_code == 400


# ── /generate — platform validation ──────────────────────────────────────────

def test_generate_unknown_platform_returns_400(client):
    body = {**_VALID_BODY, "platform": "tiktok"}
    resp = client.post("/generate", json=body)
    assert resp.status_code == 400
    assert resp.get_json()["error"] == "unsupported platform"


def test_generate_platform_case_insensitive(client):
    with patch("app.MinioClient", return_value=_patched_minio()):
        resp = client.post("/generate", json={**_VALID_BODY, "platform": "LinkedIn"})
    assert resp.status_code == 200


# ── /generate — font validation ───────────────────────────────────────────────

def test_generate_unknown_font_returns_400(client):
    body = {**_VALID_BODY, "font": "comic-sans"}
    resp = client.post("/generate", json=body)
    assert resp.status_code == 400
    assert "unsupported font" in resp.get_json()["error"]


def test_generate_valid_font_returns_200(client):
    with patch("app.MinioClient", return_value=_patched_minio()):
        for font in ("playfair", "montserrat", "merriweather", "oswald", "dancing"):
            resp = client.post("/generate", json={**_VALID_BODY, "font": font})
            assert resp.status_code == 200, f"Font {font} failed"


def test_generate_font_case_insensitive(client):
    with patch("app.MinioClient", return_value=_patched_minio()):
        resp = client.post("/generate", json={**_VALID_BODY, "font": "PLAYFAIR"})
    assert resp.status_code == 200


# ── /generate — bgType validation ────────────────────────────────────────────

def test_generate_unknown_bg_type_returns_400(client):
    body = {**_VALID_BODY, "bgType": "pattern"}
    resp = client.post("/generate", json=body)
    assert resp.status_code == 400
    assert "unsupported bgType" in resp.get_json()["error"]


def test_generate_solid_bg_type_returns_200(client):
    with patch("app.MinioClient", return_value=_patched_minio()):
        resp = client.post("/generate", json={**_VALID_BODY, "bgType": "solid", "bgColors": ["#FF0000"]})
    assert resp.status_code == 200


def test_generate_gradient_bg_type_returns_200(client):
    with patch("app.MinioClient", return_value=_patched_minio()):
        resp = client.post("/generate", json={**_VALID_BODY, "bgType": "gradient", "bgColors": ["#0D1B2A", "#1A4A4A"]})
    assert resp.status_code == 200


# ── /generate — format validation ────────────────────────────────────────────

def test_generate_post_format_returns_200(client):
    with patch("app.MinioClient", return_value=_patched_minio()):
        resp = client.post("/generate", json={**_VALID_BODY, "format": "post"})
    assert resp.status_code == 200


def test_generate_story_format_returns_200(client):
    with patch("app.MinioClient", return_value=_patched_minio()):
        resp = client.post("/generate", json={**_VALID_BODY, "format": "story"})
    assert resp.status_code == 200


def test_generate_unknown_format_returns_400(client):
    body = {**_VALID_BODY, "format": "tiktok-story"}
    resp = client.post("/generate", json=body)
    assert resp.status_code == 400
    assert "unsupported format: tiktok-story" in resp.get_json()["error"]


def test_generate_reel_format_returns_200(client):
    with patch("app.MinioClient", return_value=_patched_minio()):
        resp = client.post("/generate", json={**_VALID_BODY, "platform": "instagram", "format": "reel"})
    assert resp.status_code == 200


def test_generate_pinterest_pin_format_returns_200(client):
    with patch("app.MinioClient", return_value=_patched_minio()):
        resp = client.post("/generate", json={**_VALID_BODY, "platform": "pinterest", "format": "pin"})
    assert resp.status_code == 200


def test_generate_pinterest_square_format_returns_200(client):
    with patch("app.MinioClient", return_value=_patched_minio()):
        resp = client.post("/generate", json={**_VALID_BODY, "platform": "pinterest", "format": "pin-square"})
    assert resp.status_code == 200


def test_generate_twitter_card_format_returns_200(client):
    with patch("app.MinioClient", return_value=_patched_minio()):
        resp = client.post("/generate", json={**_VALID_BODY, "platform": "linkedin", "format": "twitter-card"})
    assert resp.status_code == 200


# ── /generate — param pass-through ───────────────────────────────────────────

def test_generate_passes_all_params_to_renderer(client):
    mock_render = MagicMock(return_value=b"\x89PNG\r\n\x1a\n" + b"\x00" * 100)
    with patch("app.MinioClient", return_value=_patched_minio()), \
         patch.dict("app._RENDERERS", {"instagram": mock_render}):
        client.post("/generate", json={
            **_VALID_BODY,
            "platform": "instagram",
            "format": "story",
            "font": "playfair",
            "bgType": "gradient",
            "bgColors": ["#0D1B2A", "#1A4A4A"],
        })
    mock_render.assert_called_once()
    _, kwargs = mock_render.call_args
    assert kwargs["format"] == "story"
    assert kwargs["font"] == "playfair"
    assert kwargs["bg_type"] == "gradient"
    assert kwargs["bg_colors"] == ["#0D1B2A", "#1A4A4A"]


def test_generate_renderer_failure_returns_500_and_logs(client):
    boom = MagicMock(side_effect=RuntimeError("render blew up"))
    with patch("app.MinioClient", return_value=_patched_minio()), \
         patch.dict("app._RENDERERS", {"instagram": boom}), \
         patch("app.app.logger.exception") as log_exc:
        resp = client.post("/generate", json={**_VALID_BODY, "platform": "instagram"})
    assert resp.status_code == 500
    assert resp.get_json()["error"] == "image generation failed"
    # the real cause must be logged, not swallowed silently
    log_exc.assert_called_once()


def test_generate_upload_failure_returns_500_and_logs(client):
    failing_minio = MagicMock()
    failing_minio.upload.side_effect = OSError("minio unreachable")
    ok_render = MagicMock(return_value=b"\x89PNG\r\n\x1a\n" + b"\x00" * 100)
    with patch("app.MinioClient", return_value=failing_minio), \
         patch.dict("app._RENDERERS", {"instagram": ok_render}), \
         patch("app.app.logger.exception") as log_exc:
        resp = client.post("/generate", json={**_VALID_BODY, "platform": "instagram"})
    assert resp.status_code == 500
    log_exc.assert_called_once()


def test_generate_defaults_applied_when_optional_params_omitted(client):
    mock_render = MagicMock(return_value=b"\x89PNG\r\n\x1a\n" + b"\x00" * 100)
    with patch("app.MinioClient", return_value=_patched_minio()), \
         patch.dict("app._RENDERERS", {"instagram": mock_render}):
        client.post("/generate", json={**_VALID_BODY, "platform": "instagram"})
    _, kwargs = mock_render.call_args
    assert kwargs["format"] == "post"
    assert kwargs["font"] == "playfair"
    assert kwargs["bg_type"] == "solid"
    assert kwargs["bg_colors"] == ["#0D1B2A"]


# ── /generate — textColor param ──────────────────────────────────────────────

def test_generate_with_text_color_returns_200(client):
    with patch("app.MinioClient", return_value=_patched_minio()):
        resp = client.post("/generate", json={**_VALID_BODY, "textColor": "#FF0000"})
    assert resp.status_code == 200


def test_generate_text_color_forwarded_to_renderer(client):
    mock_render = MagicMock(return_value=b"\x89PNG\r\n\x1a\n" + b"\x00" * 100)
    with patch("app.MinioClient", return_value=_patched_minio()), \
         patch.dict("app._RENDERERS", {"linkedin": mock_render}):
        client.post("/generate", json={**_VALID_BODY, "textColor": "#FF0000"})
    _, kwargs = mock_render.call_args
    assert kwargs["text_color_override"] == "#FF0000"


def test_generate_without_text_color_passes_none(client):
    mock_render = MagicMock(return_value=b"\x89PNG\r\n\x1a\n" + b"\x00" * 100)
    with patch("app.MinioClient", return_value=_patched_minio()), \
         patch.dict("app._RENDERERS", {"linkedin": mock_render}):
        client.post("/generate", json=_VALID_BODY)
    _, kwargs = mock_render.call_args
    assert kwargs["text_color_override"] is None


# ── /generate — bgFlip param ─────────────────────────────────────────────────

def test_generate_bg_flip_forwarded_to_renderer(client):
    mock_render = MagicMock(return_value=b"\x89PNG\r\n\x1a\n" + b"\x00" * 100)
    with patch("app.MinioClient", return_value=_patched_minio()), \
         patch.dict("app._RENDERERS", {"linkedin": mock_render}):
        client.post("/generate", json={**_VALID_BODY, "bgFlip": True})
    _, kwargs = mock_render.call_args
    assert kwargs["bg_flip"] is True


def test_generate_bg_flip_defaults_to_false(client):
    mock_render = MagicMock(return_value=b"\x89PNG\r\n\x1a\n" + b"\x00" * 100)
    with patch("app.MinioClient", return_value=_patched_minio()), \
         patch.dict("app._RENDERERS", {"linkedin": mock_render}):
        client.post("/generate", json=_VALID_BODY)
    _, kwargs = mock_render.call_args
    assert kwargs["bg_flip"] is False


# ── /generate — bgFit param ──────────────────────────────────────────────────

def test_generate_bg_fit_forwarded_to_renderer(client):
    mock_render = MagicMock(return_value=b"\x89PNG\r\n\x1a\n" + b"\x00" * 100)
    with patch("app.MinioClient", return_value=_patched_minio()), \
         patch.dict("app._RENDERERS", {"linkedin": mock_render}):
        client.post("/generate", json={**_VALID_BODY, "bgFit": "contain"})
    _, kwargs = mock_render.call_args
    assert kwargs["bg_fit"] == "contain"


def test_generate_bg_fit_defaults_to_blur(client):
    mock_render = MagicMock(return_value=b"\x89PNG\r\n\x1a\n" + b"\x00" * 100)
    with patch("app.MinioClient", return_value=_patched_minio()), \
         patch.dict("app._RENDERERS", {"linkedin": mock_render}):
        client.post("/generate", json=_VALID_BODY)
    _, kwargs = mock_render.call_args
    assert kwargs["bg_fit"] == "blur"


def test_generate_unknown_bg_fit_falls_back_to_blur(client):
    # Unlike bgType, an unknown bgFit must NOT 400 — it silently defaults so a
    # client passing a future/typo'd value still gets a (safe, uncropped) card.
    mock_render = MagicMock(return_value=b"\x89PNG\r\n\x1a\n" + b"\x00" * 100)
    with patch("app.MinioClient", return_value=_patched_minio()), \
         patch.dict("app._RENDERERS", {"linkedin": mock_render}):
        resp = client.post("/generate", json={**_VALID_BODY, "bgFit": "zoomzoom"})
    assert resp.status_code == 200
    _, kwargs = mock_render.call_args
    assert kwargs["bg_fit"] == "blur"


def test_generate_bg_fit_case_insensitive(client):
    mock_render = MagicMock(return_value=b"\x89PNG\r\n\x1a\n" + b"\x00" * 100)
    with patch("app.MinioClient", return_value=_patched_minio()), \
         patch.dict("app._RENDERERS", {"linkedin": mock_render}):
        client.post("/generate", json={**_VALID_BODY, "bgFit": "COVER"})
    _, kwargs = mock_render.call_args
    assert kwargs["bg_fit"] == "cover"


# ── /generate — textScale param ──────────────────────────────────────────────

def test_generate_with_text_scale_returns_200(client):
    with patch("app.MinioClient", return_value=_patched_minio()):
        resp = client.post("/generate", json={**_VALID_BODY, "textScale": 1.5})
    assert resp.status_code == 200


def test_generate_text_scale_forwarded_in_fragment(client):
    mock_render = MagicMock(return_value=b"\x89PNG\r\n\x1a\n" + b"\x00" * 100)
    with patch("app.MinioClient", return_value=_patched_minio()), \
         patch.dict("app._RENDERERS", {"linkedin": mock_render}):
        client.post("/generate", json={**_VALID_BODY, "textScale": 1.3})
    args, _ = mock_render.call_args
    assert args[0]["textScale"] == 1.3


def test_generate_without_text_scale_defaults_to_one(client):
    mock_render = MagicMock(return_value=b"\x89PNG\r\n\x1a\n" + b"\x00" * 100)
    with patch("app.MinioClient", return_value=_patched_minio()), \
         patch.dict("app._RENDERERS", {"linkedin": mock_render}):
        client.post("/generate", json=_VALID_BODY)
    args, _ = mock_render.call_args
    assert args[0]["textScale"] == 1.0


def test_generate_invalid_text_scale_defaults_to_one(client):
    mock_render = MagicMock(return_value=b"\x89PNG\r\n\x1a\n" + b"\x00" * 100)
    with patch("app.MinioClient", return_value=_patched_minio()), \
         patch.dict("app._RENDERERS", {"linkedin": mock_render}):
        client.post("/generate", json={**_VALID_BODY, "textScale": "big"})
    args, _ = mock_render.call_args
    assert args[0]["textScale"] == 1.0


# ── /generate — error handling ────────────────────────────────────────────────

def test_generate_minio_error_returns_500(client):
    mock_client = MagicMock()
    mock_client.upload.side_effect = Exception("connection refused")
    with patch("app.MinioClient", return_value=mock_client):
        resp = client.post("/generate", json=_VALID_BODY)
    assert resp.status_code == 500
    assert resp.get_json()["error"] == "image generation failed"
