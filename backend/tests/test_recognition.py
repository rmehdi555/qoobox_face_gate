from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.exceptions import InvalidImageError
from app.recognition.service import FrameRecognitionResult
from app.schemas.recognition import BoundingBox, FaceObservation, PersonMatch


def _empty_result() -> FrameRecognitionResult:
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


def test_health(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] in {"ok", "degraded"}


def test_recognize_requires_auth(client: TestClient) -> None:
    response = client.post(
        "/api/recognition/recognize",
        files={"file": ("frame.jpg", b"\xff\xd8\xff" + b"\x00" * 16, "image/jpeg")},
    )
    assert response.status_code == 401


def test_recognize_no_face(client: TestClient, auth_headers: dict[str, str], monkeypatch) -> None:
    monkeypatch.setattr(
        "app.api.routes.recognition.recognition_service.recognize_frame",
        lambda _data: _empty_result(),
    )
    response = client.post(
        "/api/recognition/recognize",
        files={"file": ("frame.jpg", b"\xff\xd8\xff" + b"\x00" * 16, "image/jpeg")},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["recognized"] is False
    assert body["face_detected"] is False
    assert body["person"] is None
    assert body["faces"] == []


def test_recognize_unknown(client: TestClient, auth_headers: dict[str, str], monkeypatch) -> None:
    unknown = FrameRecognitionResult(
        face_detected=True,
        recognized=False,
        face_count=1,
        person=None,
        confidence=0.0,
        recognized_face_index=None,
        message="Unknown person · Looking sad",
        faces=[
            FaceObservation(
                index=1,
                bbox=BoundingBox(x=0.2, y=0.2, width=0.3, height=0.4),
                recognized=False,
                emotion="sadness",
                emotion_label="Sad",
                action="Looking sad",
                emotion_confidence=0.8,
            )
        ],
    )
    monkeypatch.setattr(
        "app.api.routes.recognition.recognition_service.recognize_frame",
        lambda _data: unknown,
    )
    response = client.post(
        "/api/recognition/recognize",
        files={"file": ("frame.jpg", b"\xff\xd8\xff" + b"\x00" * 16, "image/jpeg")},
        headers=auth_headers,
    )
    body = response.json()
    assert body["recognized"] is False
    assert body["face_detected"] is True
    assert body["faces"][0]["action"] == "Looking sad"


def test_recognize_match_among_multiple(client: TestClient, auth_headers: dict[str, str], monkeypatch) -> None:
    person = PersonMatch(id=uuid4(), first_name="John", last_name="Smith")
    result = FrameRecognitionResult(
        face_detected=True,
        recognized=True,
        face_count=2,
        person=person,
        confidence=0.94,
        recognized_face_index=2,
        message="John Smith recognized as Face 2 of 2 · Smiling",
        faces=[
            FaceObservation(
                index=1,
                bbox=BoundingBox(x=0.05, y=0.2, width=0.2, height=0.3),
                recognized=False,
                emotion="anger",
                emotion_label="Angry",
                action="Looking angry",
                emotion_confidence=0.7,
            ),
            FaceObservation(
                index=2,
                bbox=BoundingBox(x=0.55, y=0.18, width=0.25, height=0.35),
                recognized=True,
                person=person,
                confidence=0.94,
                emotion="happiness",
                emotion_label="Happy",
                action="Smiling",
                emotion_confidence=0.91,
            ),
        ],
    )
    monkeypatch.setattr(
        "app.api.routes.recognition.recognition_service.recognize_frame",
        lambda _data: result,
    )
    response = client.post(
        "/api/recognition/recognize",
        files={"file": ("frame.jpg", b"\xff\xd8\xff" + b"\x00" * 16, "image/jpeg")},
        headers=auth_headers,
    )
    body = response.json()
    assert body["recognized"] is True
    assert body["person"]["first_name"] == "John"
    assert body["recognized_face_index"] == 2
    assert body["face_count"] == 2
    assert body["faces"][1]["action"] == "Smiling"


def test_recognize_invalid_image(client: TestClient, auth_headers: dict[str, str], monkeypatch) -> None:
    def _raise(_data: bytes):
        raise InvalidImageError()

    monkeypatch.setattr(
        "app.api.routes.recognition.recognition_service.recognize_frame",
        _raise,
    )
    response = client.post(
        "/api/recognition/recognize",
        files={"file": ("frame.jpg", b"not-image", "image/jpeg")},
        headers=auth_headers,
    )
    assert response.status_code == 400


def test_recognition_status(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.get("/api/recognition/status", headers=auth_headers)
    assert response.status_code == 200
    assert "threshold" in response.json()
    assert "recognition_interval_ms" in response.json()
