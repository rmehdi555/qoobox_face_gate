from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SessionStartRequest(BaseModel):
    language: str = "en"


class SessionStartResponse(BaseModel):
    id: UUID
    status: str
    language: str | None = None
    started_at: datetime


class SessionEventIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str | None = None
    at_ms: int = Field(default=0, alias="atMs")
    kind: Literal["presence", "speech"]
    speaker: str
    speaker_key: str = Field(default="", alias="speakerKey")
    text: str = ""
    action: str | None = None
    emotion: str | None = None


class TranscriptLine(BaseModel):
    at_ms: int
    speaker: str
    text: str


class FacialState(BaseModel):
    at_ms: int
    speaker: str
    action: str | None = None
    emotion: str | None = None


class SessionEventOut(BaseModel):
    id: str | None = None
    at_ms: int
    kind: str
    speaker: str
    speaker_key: str = ""
    text: str = ""
    action: str | None = None
    emotion: str | None = None


class SessionDetailResponse(BaseModel):
    id: UUID
    status: str
    language: str | None = None
    started_at: datetime
    ended_at: datetime | None = None
    duration_seconds: float | None = None
    recording_url: str | None = None
    recording_filename: str | None = None
    transcript: list[TranscriptLine] = Field(default_factory=list)
    facial_states: list[FacialState] = Field(default_factory=list)
    events: list[SessionEventOut] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class SessionSummaryResponse(BaseModel):
    id: UUID
    status: str
    language: str | None = None
    started_at: datetime
    ended_at: datetime | None = None
    duration_seconds: float | None = None
    recording_url: str | None = None
    transcript_count: int = 0
    facial_state_count: int = 0
