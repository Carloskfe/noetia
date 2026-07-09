from unittest.mock import MagicMock, patch

import pytest

from storage import MinioClient


@pytest.fixture
def mock_minio():
    with patch("storage.Minio") as mock_cls:
        mock_instance = MagicMock()
        mock_cls.return_value = mock_instance
        yield mock_cls, mock_instance


def test_upload_calls_put_object(mock_minio):
    _, mock_instance = mock_minio
    client = MinioClient()
    data = b"\x89PNG test bytes"
    client.upload(data)
    mock_instance.put_object.assert_called_once()
    args = mock_instance.put_object.call_args
    assert args[0][0] == "images"  # bucket
    assert args[0][1].endswith(".png")  # object name
    assert args[1]["content_type"] == "image/png"


def test_upload_returns_a_permanent_public_url_not_presigned(mock_minio):
    """images/ is public, so upload returns a plain public URL and never presigns
    (presigned URLs expire and 403 behind the proxy)."""
    _, mock_instance = mock_minio
    with patch.dict("os.environ", {"MINIO_PUBLIC_URL": "https://storage.noetia.app"}):
        client = MinioClient()
        result = client.upload(b"data")
    mock_instance.presigned_get_object.assert_not_called()
    assert result.startswith("https://storage.noetia.app/images/")
    assert result.endswith(".png")
    assert "?" not in result  # no signature/query string


def test_upload_falls_back_to_internal_origin_without_public_url(mock_minio):
    _, _mock_instance = mock_minio
    with patch.dict("os.environ", {}, clear=False):
        __import__("os").environ.pop("MINIO_PUBLIC_URL", None)
        client = MinioClient()
        result = client.upload(b"data")
    assert result.startswith("http://storage:9000/images/")


def test_upload_strips_trailing_slash_in_public_url(mock_minio):
    _, _mock_instance = mock_minio
    with patch.dict("os.environ", {"MINIO_PUBLIC_URL": "https://storage.noetia.app/"}):
        client = MinioClient()
        result = client.upload(b"data")
    assert result.startswith("https://storage.noetia.app/images/")
    assert "noetia.app//" not in result


def test_upload_uses_custom_bucket(mock_minio):
    _, _mock_instance = mock_minio
    with patch.dict("os.environ", {"MINIO_PUBLIC_URL": "https://storage.noetia.app"}):
        client = MinioClient()
        result = client.upload(b"data", bucket="custom-bucket")
    assert result.startswith("https://storage.noetia.app/custom-bucket/")


def test_minio_client_uses_env_vars(mock_minio):
    mock_cls, _ = mock_minio
    mock_cls.return_value.presigned_get_object.return_value = "http://x.com/img.png"
    with patch.dict("os.environ", {
        "MINIO_ENDPOINT": "myhost",
        "MINIO_PORT": "9001",
        "MINIO_ACCESS_KEY": "mykey",
        "MINIO_SECRET_KEY": "mysecret",
        "MINIO_USE_SSL": "false",
    }):
        MinioClient()
    mock_cls.assert_called_with(
        "myhost:9001",
        access_key="mykey",
        secret_key="mysecret",
        secure=False,
    )
