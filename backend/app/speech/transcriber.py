from __future__ import annotations

import os
import tempfile
import threading
from pathlib import Path

from app.core.config import settings
from app.core.exceptions import InvalidAudioError, ServiceUnavailableError
from app.core.logging import get_logger

logger = get_logger(__name__)

ALLOWED_AUDIO_EXTENSIONS = {".wav", ".mp3", ".webm", ".ogg", ".m4a", ".mp4", ".mpeg", ".mpga"}
ALLOWED_AUDIO_TYPES = {
    "audio/wav",
    "audio/x-wav",
    "audio/mpeg",
    "audio/mp3",
    "audio/webm",
    "audio/ogg",
    "audio/mp4",
    "audio/x-m4a",
    "video/webm",
    "video/mp4",
}


class SpeechToTextService:
    def __init__(self) -> None:
        self._model = None
        self._lock = threading.Lock()
        self._loaded = False
        self._load_error: str | None = None

    @property
    def is_loaded(self) -> bool:
        return self._loaded and self._model is not None

    def load(self) -> None:
        with self._lock:
            if self._loaded:
                return
            Path(settings.whisper_download_root).mkdir(parents=True, exist_ok=True)
            os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
            try:
                from faster_whisper import WhisperModel

                logger.info(
                    "Loading Whisper model on CPU",
                    extra={"extra_data": {"model": settings.whisper_model}},
                )
                self._model = WhisperModel(
                    settings.whisper_model,
                    device=settings.whisper_device,
                    compute_type=settings.whisper_compute_type,
                    download_root=settings.whisper_download_root,
                )
                self._loaded = True
                self._load_error = None
                logger.info("Whisper CPU model loaded")
            except Exception as exc:
                self._loaded = False
                self._model = None
                self._load_error = str(exc)
                logger.exception("Failed to load Whisper model")
                raise

    def transcribe(self, data: bytes, filename: str | None, content_type: str | None, language: str | None) -> dict:
        if not self.is_loaded:
            raise ServiceUnavailableError(
                "Speech-to-text is still loading. Try again in a moment."
            )
        extension = self._validate(filename, content_type, data)
        language_code = language.strip().lower() if language and language.strip() and language != "auto" else None
        tmp_path = ""
        try:
            with tempfile.NamedTemporaryFile(suffix=extension, delete=False) as tmp:
                tmp.write(data)
                tmp_path = tmp.name
            segments, info = self._model.transcribe(
                tmp_path,
                language=language_code,
                beam_size=1,
                vad_filter=True,
            )
            text = " ".join(segment.text.strip() for segment in segments).strip()
            detected = getattr(info, "language", None)
            probability = float(getattr(info, "language_probability", 0.0) or 0.0)
            duration = float(getattr(info, "duration", 0.0) or 0.0)
            return {
                "text": text,
                "language": detected,
                "language_probability": round(probability, 4),
                "duration_seconds": round(duration, 2),
                "model": settings.whisper_model,
            }
        except ServiceUnavailableError:
            raise
        except InvalidAudioError:
            raise
        except Exception:
            logger.exception("Speech transcription failed")
            raise InvalidAudioError("Unable to transcribe this audio. Use WAV, MP3, WEBM, OGG, or M4A.")
        finally:
            if tmp_path:
                Path(tmp_path).unlink(missing_ok=True)

    def _validate(self, filename: str | None, content_type: str | None, data: bytes) -> str:
        if not data:
            raise InvalidAudioError("Empty audio file")
        if len(data) > settings.max_audio_upload_size_bytes:
            raise InvalidAudioError(
                f"Audio exceeds the maximum allowed size of {settings.max_audio_upload_size_mb} MB"
            )
        extension = ""
        if filename and "." in filename:
            extension = "." + filename.rsplit(".", 1)[-1].lower()
        if content_type:
            mime = content_type.split(";")[0].strip().lower()
            if mime and mime not in ALLOWED_AUDIO_TYPES and not mime.startswith("audio/"):
                raise InvalidAudioError("Unsupported audio type. Use WAV, MP3, WEBM, OGG, or M4A.")
        if extension and extension not in ALLOWED_AUDIO_EXTENSIONS:
            if content_type and content_type.startswith("audio/"):
                extension = ".webm"
            else:
                raise InvalidAudioError("Unsupported audio format. Use WAV, MP3, WEBM, OGG, or M4A.")
        if not extension:
            extension = ".webm"
        return extension

    @property
    def status(self) -> dict:
        return {
            "status": "ready" if self.is_loaded else "unavailable",
            "model_loaded": self.is_loaded,
            "model_name": settings.whisper_model,
            "device": settings.whisper_device,
            "error": self._load_error,
        }


speech_service = SpeechToTextService()
