from unittest.mock import patch

from fastapi.testclient import TestClient

from app.core.exceptions import MultipleFacesError, NoFaceDetectedError


def _create_person(client: TestClient, headers: dict[str, str]) -> str:
    response = client.post(
        "/api/persons",
        json={"first_name": "Jane", "last_name": "Doe"},
        headers=headers,
    )
    return response.json()["id"]


def test_upload_rejects_invalid_extension(client: TestClient, auth_headers: dict[str, str]) -> None:
    person_id = _create_person(client, auth_headers)
    response = client.post(
        f"/api/persons/{person_id}/faces",
        files={"file": ("notes.txt", b"not-an-image", "text/plain")},
        headers=auth_headers,
    )
    assert response.status_code == 400


def test_upload_rejects_no_face(client: TestClient, auth_headers: dict[str, str]) -> None:
    person_id = _create_person(client, auth_headers)
    jpeg = b"\xff\xd8\xff" + b"\x00" * 32
    with patch(
        "app.services.person_service.recognition_service.embed_registration_image",
        side_effect=NoFaceDetectedError(),
    ):
        response = client.post(
            f"/api/persons/{person_id}/faces",
            files={"file": ("face.jpg", jpeg, "image/jpeg")},
            headers=auth_headers,
        )
    assert response.status_code == 422
    assert "face" in response.json()["detail"].lower()


def test_upload_rejects_multiple_faces(client: TestClient, auth_headers: dict[str, str]) -> None:
    person_id = _create_person(client, auth_headers)
    jpeg = b"\xff\xd8\xff" + b"\x00" * 32
    with patch(
        "app.services.person_service.recognition_service.embed_registration_image",
        side_effect=MultipleFacesError(),
    ):
        response = client.post(
            f"/api/persons/{person_id}/faces",
            files={"file": ("group.jpg", jpeg, "image/jpeg")},
            headers=auth_headers,
        )
    assert response.status_code == 422
    assert "exactly one face" in response.json()["detail"]


def test_upload_success_and_delete(client: TestClient, auth_headers: dict[str, str], tmp_path, monkeypatch) -> None:
    from app.services import storage_service as storage_module

    monkeypatch.setattr(storage_module.storage_service, "root", tmp_path)
    person_id = _create_person(client, auth_headers)
    jpeg = b"\xff\xd8\xff" + b"\x00" * 32
    fake_embedding = [0.1] * 8
    with patch(
        "app.services.person_service.recognition_service.embed_registration_image",
        return_value=fake_embedding,
    ):
        uploaded = client.post(
            f"/api/persons/{person_id}/faces",
            files={"file": ("face.jpg", jpeg, "image/jpeg")},
            headers=auth_headers,
        )
    assert uploaded.status_code == 201
    image_id = uploaded.json()["id"]

    deleted = client.delete(f"/api/faces/{image_id}", headers=auth_headers)
    assert deleted.status_code == 200
