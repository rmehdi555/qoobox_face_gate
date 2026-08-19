from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Person(Base):
    __tablename__ = "persons"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    first_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    face_images: Mapped[list[FaceImage]] = relationship(
        "FaceImage",
        back_populates="person",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    face_embeddings: Mapped[list[FaceEmbedding]] = relationship(
        "FaceEmbedding",
        back_populates="person",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()
