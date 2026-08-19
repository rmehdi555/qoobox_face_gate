from __future__ import annotations

import urllib.request
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

FERPLUS_LABELS = (
    "neutral",
    "happiness",
    "surprise",
    "sadness",
    "anger",
    "disgust",
    "fear",
    "contempt",
)

EMOTION_LABELS = {
    "neutral": "Neutral",
    "happiness": "Happy",
    "surprise": "Surprised",
    "sadness": "Sad",
    "anger": "Angry",
    "disgust": "Disgusted",
    "fear": "Fearful",
    "contempt": "Contemptuous",
}

EMOTION_ACTIONS = {
    "neutral": "Neutral expression",
    "happiness": "Smiling",
    "surprise": "Looking surprised",
    "sadness": "Looking sad",
    "anger": "Looking angry",
    "disgust": "Looking disgusted",
    "fear": "Looking fearful",
    "contempt": "Looking contemptuous",
}

MODEL_URLS = (
    "https://github.com/onnx/models/raw/main/validated/vision/body_analysis/emotion_ferplus/model/emotion-ferplus-8.onnx",
    "https://media.githubusercontent.com/media/onnx/models/main/validated/vision/body_analysis/emotion_ferplus/model/emotion-ferplus-8.onnx",
)


def _softmax(values: np.ndarray) -> np.ndarray:
    shifted = values - np.max(values)
    exp = np.exp(shifted)
    return exp / np.sum(exp)


class EmotionClassifier:
    """FER+ ONNX when available; InsightFace landmarks as a CPU fallback."""

    def __init__(self) -> None:
        self._session: ort.InferenceSession | None = None
        self._input_name: str | None = None
        self._loaded = False

    @property
    def backend(self) -> str:
        return "ferplus-onnx" if self._session is not None else "landmarks"

    def load(self) -> None:
        if self._loaded:
            return
        model_path = Path(settings.insightface_home) / "emotion" / "emotion-ferplus-8.onnx"
        model_path.parent.mkdir(parents=True, exist_ok=True)
        if not model_path.exists():
            self._download(model_path)
        if model_path.exists():
            try:
                self._session = ort.InferenceSession(
                    str(model_path),
                    providers=settings.onnx_provider_list,
                )
                self._input_name = self._session.get_inputs()[0].name
                logger.info("Emotion FER+ model loaded")
            except Exception:
                logger.exception("Failed to load emotion ONNX model; using landmark fallback")
                self._session = None
        else:
            logger.info("Emotion ONNX model unavailable; using landmark fallback")
        self._loaded = True

    def predict(self, image: np.ndarray, bbox: np.ndarray, kps: np.ndarray | None) -> tuple[str, float]:
        if self._session is not None and self._input_name:
            try:
                return self._predict_onnx(image, bbox)
            except Exception:
                logger.exception("Emotion ONNX inference failed; using landmark fallback")
        return self._predict_landmarks(bbox, kps)

    def describe(self, emotion: str, score: float) -> dict:
        key = emotion if emotion in EMOTION_LABELS else "neutral"
        return {
            "emotion": key,
            "emotion_label": EMOTION_LABELS[key],
            "action": EMOTION_ACTIONS[key],
            "emotion_confidence": round(float(score), 4),
        }

    def _predict_onnx(self, image: np.ndarray, bbox: np.ndarray) -> tuple[str, float]:
        gray = self._crop_face(image, bbox)
        blob = gray.reshape(1, 1, 64, 64).astype(np.float32)
        outputs = self._session.run(None, {self._input_name: blob})[0]
        scores = np.asarray(outputs).reshape(-1)
        if scores.size < len(FERPLUS_LABELS):
            raise RuntimeError("Unexpected emotion model output")
        probabilities = _softmax(scores[: len(FERPLUS_LABELS)].astype(np.float32))
        index = int(np.argmax(probabilities))
        return FERPLUS_LABELS[index], float(probabilities[index])

    def _crop_face(self, image: np.ndarray, bbox: np.ndarray) -> np.ndarray:
        height, width = image.shape[:2]
        x1, y1, x2, y2 = [int(value) for value in bbox]
        box_w = max(x2 - x1, 1)
        box_h = max(y2 - y1, 1)
        pad_x = int(box_w * 0.15)
        pad_y = int(box_h * 0.15)
        x1 = max(0, x1 - pad_x)
        y1 = max(0, y1 - pad_y)
        x2 = min(width, x2 + pad_x)
        y2 = min(height, y2 + pad_y)
        crop = image[y1:y2, x1:x2]
        if crop.size == 0:
            crop = image
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        return cv2.resize(gray, (64, 64), interpolation=cv2.INTER_LINEAR)

    def _predict_landmarks(self, bbox: np.ndarray, kps: np.ndarray | None) -> tuple[str, float]:
        if kps is None or len(kps) < 5:
            return "neutral", 0.4
        left_eye, right_eye, _nose, left_mouth, right_mouth = np.asarray(kps[:5], dtype=np.float32)
        eye_dist = float(np.linalg.norm(left_eye - right_eye)) + 1e-6
        mouth_width = float(np.linalg.norm(left_mouth - right_mouth))
        smile_ratio = mouth_width / eye_dist
        eye_y = float((left_eye[1] + right_eye[1]) / 2)
        mouth_y = float((left_mouth[1] + right_mouth[1]) / 2)
        drop = (mouth_y - eye_y) / eye_dist
        if smile_ratio >= 1.55:
            return "happiness", min(0.92, 0.55 + (smile_ratio - 1.55) * 0.8)
        if smile_ratio <= 1.12 and drop >= 1.45:
            return "sadness", 0.62
        if smile_ratio <= 1.18:
            return "anger", 0.58
        if drop >= 1.7:
            return "surprise", 0.55
        return "neutral", 0.5

    def _download(self, destination: Path) -> None:
        for url in MODEL_URLS:
            try:
                logger.info("Downloading emotion model", extra={"extra_data": {"url": url}})
                with urllib.request.urlopen(url, timeout=30) as response:
                    data = response.read()
                if len(data) < 10_000:
                    continue
                destination.write_bytes(data)
                logger.info("Emotion model saved", extra={"extra_data": {"path": str(destination)}})
                return
            except Exception:
                logger.info("Emotion model download failed", extra={"extra_data": {"url": url}})


emotion_classifier = EmotionClassifier()
