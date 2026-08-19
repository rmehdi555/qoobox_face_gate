from unittest.mock import patch
from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.exceptions import InvalidImageError
from app.recognition.index import MatchResult


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


def test_recognize_no_face(client: TestClient, auth_headers: dict[str, str]) -> None:
    with patch(
        "app.api.routes.recognition.recognition_service.recognize_frame",
        return_value=(False, None),
    ):
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


def test_recognize_unknown(client: TestClient, auth_headers: dict[str, str]) -> None:
    with patch(
        "app.api.routes.recognition.recognition_service.recognize_frame",
        return_value=(True, None),
    ):
        response = client.post(
            "/api/recognition/recognize",
            files={"file": ("frame.jpg", b"\xff\xd8\xff" + b"\x00" * 16, "image/jpeg")},
            headers=auth_headers,
        )
    body = response.json()
    assert body["recognized"] is False
    assert body["face_detected"] is True


def test_recognize_match(client: TestClient, auth_headers: dict[str, str]) -> None:
    match = MatchResult(
        person_id=uuid4(),
        first_name="John",
        last_name="Smith",
        confidence=0.94,
        embedding_id=uuid4(),
        face_image_id=uuid4(),
    )
    with patch(
        "app.api.routes.recognition.recognition_service.recognize_frame",
        return_value=(True, match),
    ):
        response = client.post(
            "/api/recognition/recognize",
            files={"file": ("frame.jpg", b"\xff\xd8\xff" + b"\x00" * 16, "image/jpeg")},
            headers=auth_headers,
        )
    body = response.json()
    assert body["recognized"] is True
    assert body["person"]["first_name"] == "John"
    assert body["confidence"] == 0.94


def test_recognize_invalid_image(client: TestClient, auth_headers: dict[str, str]) -> None:
    with patch(
        "app.api.routes.recognition.recognition_service.recognize_frame",
        side_effect=InvalidImageError(),
    ):
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
