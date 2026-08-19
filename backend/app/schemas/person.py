from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class PersonCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)


class PersonUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)


class FaceImageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    person_id: UUID
    original_filename: str
    created_at: datetime


class PersonResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    first_name: str
    last_name: str
    created_at: datetime
    updated_at: datetime
    face_count: int = 0
    thumbnail_id: UUID | None = None


class PersonDetailResponse(PersonResponse):
    faces: list[FaceImageResponse] = Field(default_factory=list)
