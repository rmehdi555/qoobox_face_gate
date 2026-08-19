from __future__ import annotations

import os
import threading
from pathlib import Path

import cv2
import numpy as np

from app.core.config import settings
from app.core.exceptions import InvalidImageError, MultipleFacesError, NoFaceDetectedError
from app.core.logging import get_logger

logger = get_logger(__name__)


class FaceEngine:
    """Loads InsightFace once and reuses it for detection and embedding."""

    def __init__(self) -> None:
        self._app = None
        self._lock = threading.Lock()
        self._loaded = False
        self._load_error: str | None = None

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    @property
    def load_error(self) -> str | None:
        return self._load_error

    def load(self) -> None:
        with self._lock:
            if self._loaded:
                return
            os.environ["CUDA_VISIBLE_DEVICES"] = "-1"
            os.environ["NVIDIA_VISIBLE_DEVICES"] = "void"
            os.environ.setdefault("INSIGHTFACE_HOME", settings.insightface_home)
            Path(settings.insightface_home).mkdir(parents=True, exist_ok=True)
            try:
                from insightface.app import FaceAnalysis

                providers = settings.onnx_provider_list
                logger.info(
                    "Loading InsightFace model on CPU",
                    extra={
                        "extra_data": {
                            "model": settings.face_recognition_model,
                            "providers": providers,
                        }
                    },
                )
                app = FaceAnalysis(
                    name=settings.face_recognition_model,
                    root=settings.insightface_home,
                    providers=providers,
                )
                det = settings.insightface_det_size
                app.prepare(ctx_id=-1, det_size=(det, det))
                self._app = app
                self._loaded = True
                self._load_error = None
                logger.info("InsightFace CPU model loaded")
            except Exception as exc:
                self._loaded = False
                self._load_error = str(exc)
                logger.exception("Failed to load InsightFace model")
                raise

    def decode_image(self, data: bytes) -> np.ndarray:
        if not data:
            raise InvalidImageError("Empty image payload")
        array = np.frombuffer(data, dtype=np.uint8)
        image = cv2.imdecode(array, cv2.IMREAD_COLOR)
        if image is None:
            raise InvalidImageError("The uploaded file is not a valid image")
        return image

    def detect_faces(self, image: np.ndarray) -> list:
        if not self._loaded or self._app is None:
            raise RuntimeError("Face recognition model is not loaded")
        return self._app.get(image)

    def extract_single_embedding(self, image: np.ndarray) -> np.ndarray:
        faces = self.detect_faces(image)
        if not faces:
            raise NoFaceDetectedError()
        if len(faces) > 1:
            raise MultipleFacesError()
        embedding = np.asarray(faces[0].embedding, dtype=np.float32)
        if embedding.size == 0:
            raise NoFaceDetectedError()
        return embedding

    def extract_best_embedding(self, image: np.ndarray) -> np.ndarray | None:
        """Used for live recognition: largest face wins, or None if no face."""
        faces = self.detect_faces(image)
        if not faces:
            return None
        best = max(faces, key=lambda face: float((face.bbox[2] - face.bbox[0]) * (face.bbox[3] - face.bbox[1])))
        embedding = np.asarray(best.embedding, dtype=np.float32)
        if embedding.size == 0:
            return None
        return embedding

    def analyze_faces(self, image: np.ndarray) -> list[dict]:
        """Return every detected face with geometry and embedding, left to right."""
        height, width = image.shape[:2]
        detections = self.detect_faces(image)
        detections = sorted(
            detections,
            key=lambda face: float(face.bbox[0]) if face.bbox is not None else 0.0,
        )
        results: list[dict] = []
        for face in detections:
            bbox = np.asarray(face.bbox, dtype=np.float32)
            x1, y1, x2, y2 = bbox.tolist()
            embedding = np.asarray(getattr(face, "embedding", []), dtype=np.float32)
            kps = np.asarray(face.kps, dtype=np.float32) if getattr(face, "kps", None) is not None else None
            results.append(
                {
                    "bbox": bbox,
                    "normalized_bbox": {
                        "x": round(max(x1, 0) / width, 4),
                        "y": round(max(y1, 0) / height, 4),
                        "width": round(max(x2 - x1, 1) / width, 4),
                        "height": round(max(y2 - y1, 1) / height, 4),
                    },
                    "embedding": embedding,
                    "kps": kps,
                    "det_score": float(getattr(face, "det_score", 0.0) or 0.0),
                }
            )
        return results


face_engine = FaceEngine()
