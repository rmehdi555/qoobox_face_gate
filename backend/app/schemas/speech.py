from pydantic import BaseModel, Field


class TranscriptionResponse(BaseModel):
    text: str
    language: str | None = None
    language_probability: float = 0.0
    duration_seconds: float = 0.0
    model: str


class SpeechStatusResponse(BaseModel):
    status: str
    model_loaded: bool
    model_name: str
    device: str
    error: str | None = Field(default=None)
