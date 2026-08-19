from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

import numpy as np

from app.core.logging import get_logger

logger = get_logger(__name__)


@dataclass(frozen=True)
class IndexedEmbedding:
    embedding_id: UUID
    person_id: UUID
    face_image_id: UUID
    first_name: str
    last_name: str
    vector: np.ndarray


@dataclass(frozen=True)
class MatchResult:
    person_id: UUID
    first_name: str
    last_name: str
    confidence: float
    embedding_id: UUID
    face_image_id: UUID


class InMemoryEmbeddingIndex:
    """Cosine-similarity index that can later be swapped for a vector database."""

    def __init__(self) -> None:
        self._items: list[IndexedEmbedding] = []
        self._matrix: np.ndarray | None = None

    def __len__(self) -> int:
        return len(self._items)

    def rebuild(self, items: list[IndexedEmbedding]) -> None:
        self._items = items
        if not items:
            self._matrix = None
            return
        matrix = np.vstack([item.vector for item in items]).astype(np.float32)
        norms = np.linalg.norm(matrix, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        self._matrix = matrix / norms

    def add(self, item: IndexedEmbedding) -> None:
        current = list(self._items)
        current.append(item)
        self.rebuild(current)

    def remove_by_image(self, face_image_id: UUID) -> None:
        remaining = [item for item in self._items if item.face_image_id != face_image_id]
        self.rebuild(remaining)

    def remove_by_person(self, person_id: UUID) -> None:
        remaining = [item for item in self._items if item.person_id != person_id]
        self.rebuild(remaining)

    def search(self, query: np.ndarray, threshold: float) -> MatchResult | None:
        if self._matrix is None or not self._items:
            return None

        vector = np.asarray(query, dtype=np.float32).reshape(-1)
        norm = np.linalg.norm(vector)
        if norm == 0:
            return None
        vector = vector / norm

        scores = self._matrix @ vector
        best_index = int(np.argmax(scores))
        best_score = float(scores[best_index])
        if best_score < threshold:
            return None

        item = self._items[best_index]
        return MatchResult(
            person_id=item.person_id,
            first_name=item.first_name,
            last_name=item.last_name,
            confidence=best_score,
            embedding_id=item.embedding_id,
            face_image_id=item.face_image_id,
        )
