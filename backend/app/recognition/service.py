from __future__ import annotations

from uuid import UUID

import numpy as np
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import get_logger
from app.recognition.engine import face_engine
from app.recognition.index import IndexedEmbedding, InMemoryEmbeddingIndex, MatchResult
from app.repositories.repositories import FaceRepository

logger = get_logger(__name__)


class RecognitionService:
    def __init__(self) -> None:
        self.index = InMemoryEmbeddingIndex()

    def load_model(self) -> None:
        face_engine.load()

    def reload_index(self, db: Session) -> None:
        rows = FaceRepository(db).list_all_embeddings()
        items: list[IndexedEmbedding] = []
        for embedding_id, person_id, face_image_id, embedding, first_name, last_name in rows:
            items.append(
                IndexedEmbedding(
                    embedding_id=embedding_id,
                    person_id=person_id,
                    face_image_id=face_image_id,
                    first_name=first_name,
                    last_name=last_name,
                    vector=np.asarray(embedding, dtype=np.float32),
                )
            )
        self.index.rebuild(items)
        logger.info(
            "Embedding index rebuilt",
            extra={"extra_data": {"count": len(items)}},
        )

    def add_embedding(
        self,
        embedding_id: UUID,
        person_id: UUID,
        face_image_id: UUID,
        first_name: str,
        last_name: str,
        embedding: list[float],
    ) -> None:
        self.index.add(
            IndexedEmbedding(
                embedding_id=embedding_id,
                person_id=person_id,
                face_image_id=face_image_id,
                first_name=first_name,
                last_name=last_name,
                vector=np.asarray(embedding, dtype=np.float32),
            )
        )

    def remove_image(self, face_image_id: UUID) -> None:
        self.index.remove_by_image(face_image_id)

    def remove_person(self, person_id: UUID) -> None:
        self.index.remove_by_person(person_id)

    def embed_registration_image(self, image_bytes: bytes) -> list[float]:
        image = face_engine.decode_image(image_bytes)
        embedding = face_engine.extract_single_embedding(image)
        return embedding.astype(float).tolist()

    def recognize_frame(self, image_bytes: bytes) -> tuple[bool, MatchResult | None]:
        """Returns (face_detected, match_or_none)."""
        image = face_engine.decode_image(image_bytes)
        embedding = face_engine.extract_best_embedding(image)
        if embedding is None:
            return False, None
        match = self.index.search(embedding, settings.face_recognition_threshold)
        return True, match

    @property
    def status(self) -> dict:
        loaded = face_engine.is_loaded
        return {
            "status": "ready" if loaded else "unavailable",
            "model_loaded": loaded,
            "registered_embeddings": len(self.index),
            "threshold": settings.face_recognition_threshold,
            "recognition_interval_ms": settings.recognition_interval_ms,
            "model_name": settings.face_recognition_model,
            "execution_device": "cpu",
            "onnx_providers": settings.onnx_provider_list,
        }


recognition_service = RecognitionService()
