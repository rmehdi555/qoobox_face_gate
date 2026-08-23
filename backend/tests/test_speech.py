from fastapi.testclient import TestClient

from app.core.exceptions import InvalidAudioError, ServiceUnavailableError


def test_transcribe_requires_auth(client: TestClient) -> None:
    response = client.post(
        "/api/speech/transcribe",
        files={"file": ("clip.wav", b"RIFF" + b"\x00" * 16, "audio/wav")},
    )
    assert response.status_code == 401


def test_transcribe_success(client: TestClient, auth_headers: dict[str, str], monkeypatch) -> None:
    monkeypatch.setattr(
        "app.api.routes.speech.speech_service.transcribe",
        lambda *_args, **_kwargs: {
            "text": "Hello world",
            "language": "en",
            "language_probability": 0.98,
            "duration_seconds": 1.2,
            "model": "tiny",
            "segments": [{"start": 0.0, "end": 1.2, "text": "Hello world"}],
        },
    )
    response = client.post(
        "/api/speech/transcribe",
        files={"file": ("clip.wav", b"RIFF" + b"\x00" * 64, "audio/wav")},
        data={"language": "en"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["text"] == "Hello world"
    assert body["language"] == "en"
    assert body["segments"][0]["text"] == "Hello world"


def test_transcribe_rejects_invalid_audio(client: TestClient, auth_headers: dict[str, str], monkeypatch) -> None:
    monkeypatch.setattr(
        "app.api.routes.speech.speech_service.transcribe",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(InvalidAudioError()),
    )
    response = client.post(
        "/api/speech/transcribe",
        files={"file": ("notes.txt", b"not-audio", "text/plain")},
        headers=auth_headers,
    )
    assert response.status_code == 400


def test_transcribe_when_model_unavailable(client: TestClient, auth_headers: dict[str, str], monkeypatch) -> None:
    monkeypatch.setattr(
        "app.api.routes.speech.speech_service.transcribe",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            ServiceUnavailableError("Speech-to-text is still loading. Try again in a moment.")
        ),
    )
    response = client.post(
        "/api/speech/transcribe",
        files={"file": ("clip.webm", b"\x1a\x45\xdf\xa3" + b"\x00" * 32, "audio/webm")},
        headers=auth_headers,
    )
    assert response.status_code == 503


def test_speech_status(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.get("/api/speech/status", headers=auth_headers)
    assert response.status_code == 200
    assert "model_loaded" in response.json()
