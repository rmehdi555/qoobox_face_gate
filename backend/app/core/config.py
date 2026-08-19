from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "FaceGate"
    app_version: str = "1.0.0"

    database_url: str = Field(
        default="postgresql+psycopg://facegate:facegate@postgres:5432/facegate"
    )

    jwt_secret_key: str = Field(default="change-me-to-a-long-random-secret")
    jwt_access_token_expire_minutes: int = 60
    jwt_algorithm: str = "HS256"

    face_recognition_threshold: float = 0.5
    face_recognition_model: str = "buffalo_s"
    recognition_interval_ms: int = 500
    insightface_det_size: int = 640
    onnx_execution_providers: str = "CPUExecutionProvider"

    max_upload_size_mb: int = 10
    max_audio_upload_size_mb: int = 25
    storage_path: str = "/app/storage/faces"
    insightface_home: str = "/app/storage/models"
    whisper_model: str = "tiny"
    whisper_device: str = "cpu"
    whisper_compute_type: str = "int8"
    whisper_download_root: str = "/app/storage/whisper"

    cors_origins: str = (
        "http://localhost:3000,http://localhost:5173,"
        "http://127.0.0.1:3000,http://127.0.0.1:5173"
    )
    log_level: str = "INFO"

    allowed_image_types: tuple[str, ...] = (
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
    )
    allowed_image_extensions: tuple[str, ...] = (".jpg", ".jpeg", ".png", ".webp")

    @field_validator("jwt_secret_key")
    @classmethod
    def secret_must_not_be_empty(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("JWT_SECRET_KEY must not be empty")
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def max_upload_size_bytes(self) -> int:
        return self.max_upload_size_mb * 1024 * 1024

    @property
    def max_audio_upload_size_bytes(self) -> int:
        return self.max_audio_upload_size_mb * 1024 * 1024

    @property
    def onnx_provider_list(self) -> list[str]:
        providers = [item.strip() for item in self.onnx_execution_providers.split(",") if item.strip()]
        return providers or ["CPUExecutionProvider"]


settings = Settings()
