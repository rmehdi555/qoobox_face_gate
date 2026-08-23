from __future__ import annotations

from dataclasses import dataclass, field
from uuid import UUID

import numpy as np
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import get_logger
from app.recognition.emotion import emotion_classifier
from app.recognition.engine import face_engine
from app.recognition.index import IndexedEmbedding, InMemoryEmbeddingIndex, MatchResult
from app.repositories.repositories import FaceRepository
from app.schemas.recognition import BoundingBox, FaceObservation, PersonMatch, RecognitionResponse

logger = get_logger(__name__)


@dataclass
class FrameRecognitionResult:
    face_detected: bool
    recognized: bool
    face_count: int
    person: PersonMatch | None
    confidence: float
    recognized_face_index: int | None
    message: str
    faces: list[FaceObservation] = field(default_factory=list)

    def to_response(self) -> RecognitionResponse:
        return RecognitionResponse(
            recognized=self.recognized,
            person=self.person,
            confidence=self.confidence,
            face_detected=self.face_detected,
            face_count=self.face_count,
            recognized_face_index=self.recognized_face_index,
            message=self.message,
            faces=self.faces,
        )


class RecognitionService:
    def __init__(self) -> None:
        self.index = InMemoryEmbeddingIndex()

    def load_model(self) -> None:
        face_engine.load()
        emotion_classifier.load()

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

    def recognize_frame(self, image_bytes: bytes) -> FrameRecognitionResult:
        image = face_engine.decode_image(image_bytes)
        detections = face_engine.analyze_faces(image)
        if not detections:
            return FrameRecognitionResult(
                face_detected=False,
                recognized=False,
                face_count=0,
                person=None,
                confidence=0.0,
                recognized_face_index=None,
                message="No face detected",
                faces=[],
            )

        observations: list[FaceObservation] = []
        for position, detection in enumerate(detections, start=1):
            embedding = detection["embedding"]
            match: MatchResult | None = None
            if embedding is not None and embedding.size > 0:
                match = self.index.search(embedding, settings.face_recognition_threshold)
            emotion_key, emotion_score = emotion_classifier.predict(
                image,
                detection["bbox"],
                detection["kps"],
            )
            emotion = emotion_classifier.describe(emotion_key, emotion_score)
            person = None
            if match is not None:
                person = PersonMatch(
                    id=match.person_id,
                    first_name=match.first_name,
                    last_name=match.last_name,
                )
            embedding_list = (
                [round(float(value), 5) for value in embedding.tolist()]
                if embedding is not None and embedding.size > 0
                else []
            )
            observations.append(
                FaceObservation(
                    index=position,
                    bbox=BoundingBox(**detection["normalized_bbox"]),
                    recognized=match is not None,
                    person=person,
                    confidence=round(match.confidence, 4) if match is not None else 0.0,
                    embedding=embedding_list,
                    **emotion,
                )
            )

        recognized_faces = [face for face in observations if face.recognized]
        primary = max(recognized_faces, key=lambda face: face.confidence) if recognized_faces else None
        if recognized_faces:
            parts = [
                f"{face.person.first_name} {face.person.last_name} is Face {face.index} of {len(observations)} · {face.action}"
                for face in recognized_faces
                if face.person is not None
            ]
            message = " · ".join(parts)
        elif len(observations) == 1:
            message = f"Unknown person · {observations[0].action}"
        else:
            message = f"{len(observations)} faces detected; no registered person matched"

        return FrameRecognitionResult(
            face_detected=True,
            recognized=primary is not None,
            face_count=len(observations),
            person=primary.person if primary else None,
            confidence=primary.confidence if primary else 0.0,
            recognized_face_index=primary.index if primary else None,
            message=message,
            faces=observations,
        )

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
