from unittest.mock import ANY, MagicMock, patch

import pytest

from storage import MinioClient, _bounded_http_client


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
        http_client=ANY,
    )


def test_http_client_has_a_read_deadline_and_does_not_retry_a_stalled_read():
    client = _bounded_http_client()
    pool_kw = client.connection_pool_kw
    assert pool_kw["timeout"].connect_timeout == 3
    assert pool_kw["timeout"].read_timeout == 8
    assert pool_kw["retries"].read == 0


def test_http_client_keeps_minio_default_retries():
    retries = _bounded_http_client().connection_pool_kw["retries"]
    assert retries.total == 5
    assert retries.backoff_factor == 0.2
    assert {500, 502, 503, 504} == set(retries.status_forcelist)


def test_http_client_keeps_certificate_verification():
    kw = _bounded_http_client().connection_pool_kw
    assert kw["cert_reqs"] == "CERT_REQUIRED"
    assert kw["ca_certs"]


def test_http_client_honours_ssl_cert_file():
    with patch.dict("os.environ", {"SSL_CERT_FILE": "/custom/ca.pem"}):
        assert _bounded_http_client().connection_pool_kw["ca_certs"] == "/custom/ca.pem"


def test_http_client_matches_minio_default_except_timeouts_and_stalled_reads():
    """Fails if minio-py's own defaults change, so a difference can't go unnoticed."""
    from minio import Minio
    with patch.dict("os.environ", {"SSL_CERT_FILE": ""}):
        default = Minio("x:9000", access_key="a", secret_key="b", secure=False)._http.connection_pool_kw
        ours = _bounded_http_client().connection_pool_kw
    assert default["maxsize"] == ours["maxsize"]
    assert default["cert_reqs"] == ours["cert_reqs"]
    assert default["ca_certs"] == ours["ca_certs"]
    assert default["retries"].total == ours["retries"].total
    assert default["retries"].backoff_factor == ours["retries"].backoff_factor
    assert set(default["retries"].status_forcelist) == set(ours["retries"].status_forcelist)
    assert default["timeout"].read_timeout == 300
    assert ours["timeout"].read_timeout == 8


def test_every_minio_client_is_built_with_the_bounded_http_client(mock_minio):
    mock_cls, _ = mock_minio
    MinioClient()
    assert mock_cls.call_args.kwargs["http_client"].connection_pool_kw["timeout"].read_timeout == 8
