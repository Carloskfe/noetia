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
        for font in ("playfair", "lato", "merriweather", "dancing", "montserrat"):
            resp = client.post("/generate", json={**_VALID_BODY, "font": font})
            assert resp.status_code == 200, f"Font {font} failed"


def test_generate_font_case_insensitive(client):
    with patch("app.MinioClient", return_value=_patched_minio()):
        resp = client.post("/generate", json={**_VALID_BODY, "font": "LATO"})
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
    body = {**_VALID_BODY, "format": "reel"}
    resp = client.post("/generate", json=body)
    assert resp.status_code == 400
    assert "unsupported format" in resp.get_json()["error"]


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


def test_generate_defaults_applied_when_optional_params_omitted(client):
    mock_render = MagicMock(return_value=b"\x89PNG\r\n\x1a\n" + b"\x00" * 100)
    with patch("app.MinioClient", return_value=_patched_minio()), \
         patch.dict("app._RENDERERS", {"instagram": mock_render}):
        client.post("/generate", json={**_VALID_BODY, "platform": "instagram"})
    _, kwargs = mock_render.call_args
    assert kwargs["format"] == "post"
    assert kwargs["font"] == "lato"
    assert kwargs["bg_type"] == "solid"
    assert kwargs["bg_colors"] == ["#0D1B2A"]


# ── /generate — error handling ────────────────────────────────────────────────

def test_generate_minio_error_returns_500(client):
    mock_client = MagicMock()
    mock_client.upload.side_effect = Exception("connection refused")
    with patch("app.MinioClient", return_value=mock_client):
        resp = client.post("/generate", json=_VALID_BODY)
    assert resp.status_code == 500
    assert resp.get_json()["error"] == "image generation failed"
