import io
import os
import uuid

from minio import Minio


class MinioClient:
    def __init__(self):
        endpoint = os.getenv("MINIO_ENDPOINT", "storage")
        port = os.getenv("MINIO_PORT", "9000")
        access_key = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
        secret_key = os.getenv("MINIO_SECRET_KEY", "changeme")
        use_ssl = os.getenv("MINIO_USE_SSL", "false").lower() == "true"

        # Public URL rewrites the internal Docker hostname in presigned URLs so
        # browsers can reach MinIO directly (e.g. http://localhost:9000 in dev).
        scheme = "https" if use_ssl else "http"
        self._internal_origin = f"{scheme}://{endpoint}:{port}"
        self._public_origin = (os.getenv("MINIO_PUBLIC_URL") or "").rstrip("/") or None

        self._client = Minio(
            f"{endpoint}:{port}",
            access_key=access_key,
            secret_key=secret_key,
            secure=use_ssl,
        )

    def upload(self, data: bytes, bucket: str = "images") -> str:
        object_name = f"{uuid.uuid4()}.png"
        self._client.put_object(
            bucket,
            object_name,
            io.BytesIO(data),
            length=len(data),
            content_type="image/png",
        )
        # The images/ bucket is public-read, so return a permanent public URL —
        # NOT a presigned one. Presigned URLs expire (7-day cards shared to social
        # would break) and, signed against the internal host then rewritten, get
        # rejected by MinIO behind the proxy (SignatureDoesNotMatch → broken
        # download/preview). A plain public URL avoids both and is cacheable.
        base = self._public_origin or self._internal_origin
        return f"{base}/{bucket}/{object_name}"
