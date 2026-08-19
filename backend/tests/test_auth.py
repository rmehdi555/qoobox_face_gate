from fastapi.testclient import TestClient


def test_login_success(client: TestClient, admin) -> None:
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": "password123"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]


def test_login_rejects_invalid_password(client: TestClient, admin) -> None:
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": "wrong-password"},
    )
    assert response.status_code == 401
    assert "password" not in response.text.lower() or "invalid" in response.json()["detail"].lower()


def test_me_requires_auth(client: TestClient) -> None:
    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_me_returns_current_admin(client: TestClient, auth_headers: dict[str, str], admin) -> None:
    response = client.get("/api/auth/me", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["email"] == admin.email
