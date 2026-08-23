from uuid import UUID

from pydantic import BaseModel, Field


class PersonMatch(BaseModel):
    id: UUID
    first_name: str
    last_name: str


class BoundingBox(BaseModel):
    x: float
    y: float
    width: float
    height: float


class FaceObservation(BaseModel):
    index: int
    bbox: BoundingBox
    recognized: bool = False
    person: PersonMatch | None = None
    confidence: float = 0.0
    emotion: str = "neutral"
    emotion_label: str = "Neutral"
    action: str = "Neutral expression"
    emotion_confidence: float = 0.0
    embedding: list[float] = Field(default_factory=list)


class RecognitionResponse(BaseModel):
    recognized: bool
    person: PersonMatch | None = None
    confidence: float = 0.0
    face_detected: bool = True
    face_count: int = 0
    recognized_face_index: int | None = None
    message: str | None = None
    faces: list[FaceObservation] = Field(default_factory=list)


class RecognitionStatusResponse(BaseModel):
    status: str
    model_loaded: bool
    registered_embeddings: int
    threshold: float
    recognition_interval_ms: int
    model_name: str
    execution_device: str = "cpu"
    onnx_providers: list[str] = Field(default_factory=lambda: ["CPUExecutionProvider"])


class DashboardStatsResponse(BaseModel):
    total_people: int
    total_face_images: int
    recognition_status: str
    model_loaded: bool
    registered_embeddings: int
    threshold: float
    execution_device: str = "cpu"
