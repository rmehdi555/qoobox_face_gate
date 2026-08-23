from fastapi.testclient import TestClient


def test_start_requires_auth(client: TestClient) -> None:
    response = client.post("/api/sessions/start", json={"language": "en"})
    assert response.status_code == 401


def test_session_start_stop_and_result(client: TestClient, auth_headers: dict[str, str]) -> None:
    started = client.post("/api/sessions/start", json={"language": "en"}, headers=auth_headers)
    assert started.status_code == 201
    body = started.json()
    session_id = body["id"]
    assert body["status"] == "recording"
    assert session_id

    events = [
        {
            "at_ms": 800,
            "kind": "presence",
            "speaker": "Unknown 1",
            "speaker_key": "unknown:1",
            "text": "Unknown 1 · Smiling",
            "action": "Smiling",
            "emotion": "Happy",
        },
        {
            "at_ms": 4200,
            "kind": "speech",
            "speaker": "Unknown 1",
            "speaker_key": "unknown:1",
            "text": "Hello there",
        },
    ]
    stopped = client.post(
        f"/api/sessions/{session_id}/stop",
        data={
            "events": __import__("json").dumps(events),
            "duration_seconds": "12",
            "language": "en",
        },
        files={"file": ("session.webm", b"\x1a\x45\xdf\xa3" + b"\x00" * 64, "video/webm")},
        headers=auth_headers,
    )
    assert stopped.status_code == 200
    stopped_body = stopped.json()
    assert stopped_body["status"] == "stopped"
    assert stopped_body["recording_url"] == f"/api/sessions/{session_id}/recording"
    assert stopped_body["transcript"][0]["text"] == "Hello there"
    assert stopped_body["facial_states"][0]["action"] == "Smiling"

    result = client.get(f"/api/sessions/{session_id}", headers=auth_headers)
    assert result.status_code == 200
    assert result.json()["id"] == session_id
    assert result.json()["transcript"][0]["speaker"] == "Unknown 1"

    recording = client.get(f"/api/sessions/{session_id}/recording", headers=auth_headers)
    assert recording.status_code == 200
    assert recording.content.startswith(b"\x1a\x45\xdf\xa3")

    listed = client.get("/api/sessions", headers=auth_headers)
    assert listed.status_code == 200
    assert any(item["id"] == session_id for item in listed.json())


def test_stop_unknown_session(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.post(
        "/api/sessions/00000000-0000-0000-0000-000000000000/stop",
        data={"events": "[]"},
        headers=auth_headers,
    )
    assert response.status_code == 404


def test_stop_twice_conflicts(client: TestClient, auth_headers: dict[str, str]) -> None:
    started = client.post("/api/sessions/start", json={"language": "en"}, headers=auth_headers)
    session_id = started.json()["id"]
    first = client.post(f"/api/sessions/{session_id}/stop", data={"events": "[]"}, headers=auth_headers)
    assert first.status_code == 200
    second = client.post(f"/api/sessions/{session_id}/stop", data={"events": "[]"}, headers=auth_headers)
    assert second.status_code == 409
