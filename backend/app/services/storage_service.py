from pathlib import Path
from uuid import uuid4

from app.core.config import settings
from app.core.exceptions import FileTooLargeError, InvalidImageError
from app.core.logging import get_logger

logger = get_logger(__name__)

class StorageService:
    def __init__(self) -> None:
        self.root = Path(settings.storage_path)
        self.root.mkdir(parents=True, exist_ok=True)

    def validate_upload(self, filename: str | None, content_type: str | None, data: bytes) -> str:
        if not data:
            raise InvalidImageError("Empty file")
        if len(data) > settings.max_upload_size_bytes:
            raise FileTooLargeError(settings.max_upload_size_mb)

        extension = self._safe_extension(filename)
        if extension not in settings.allowed_image_extensions:
            raise InvalidImageError("Unsupported image format. Use JPG, JPEG, PNG, or WEBP.")

        detected = self._detect_mime(data)
        if detected is None:
            raise InvalidImageError("The uploaded file is not a valid image")

        if content_type and content_type.lower() not in settings.allowed_image_types:
            raise InvalidImageError("Unsupported image content type. Use JPG, JPEG, PNG, or WEBP.")

        if detected == "image/webp" and not data[8:12] == b"WEBP":
            raise InvalidImageError("The uploaded file is not a valid WEBP image")

        return extension

    def save(self, data: bytes, extension: str) -> str:
        relative = f"{uuid4().hex}{extension}"
        destination = self.root / relative
        destination.write_bytes(data)
        logger.info("Stored face image", extra={"extra_data": {"path": relative}})
        return str(destination)

    def delete(self, file_path: str) -> None:
        path = Path(file_path)
        try:
            if path.exists() and path.is_file():
                path.unlink()
        except OSError:
            logger.exception("Failed to delete stored image", extra={"extra_data": {"path": file_path}})

    def read(self, file_path: str) -> bytes:
        return Path(file_path).read_bytes()

    def _safe_extension(self, filename: str | None) -> str:
        if not filename or "." not in filename:
            return ""
        return "." + filename.rsplit(".", 1)[-1].lower()

    def _detect_mime(self, data: bytes) -> str | None:
        if data.startswith(b"\xff\xd8\xff"):
            return "image/jpeg"
        if data.startswith(b"\x89PNG\r\n\x1a\n"):
            return "image/png"
        if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
            return "image/webp"
        return None


storage_service = StorageService()
