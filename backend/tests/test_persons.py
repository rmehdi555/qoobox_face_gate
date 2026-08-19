from fastapi.testclient import TestClient


def test_create_and_get_person(client: TestClient, auth_headers: dict[str, str]) -> None:
    created = client.post(
        "/api/persons",
        json={"first_name": "John", "last_name": "Smith"},
        headers=auth_headers,
    )
    assert created.status_code == 201
    person_id = created.json()["id"]
    assert created.json()["first_name"] == "John"

    fetched = client.get(f"/api/persons/{person_id}", headers=auth_headers)
    assert fetched.status_code == 200
    assert fetched.json()["last_name"] == "Smith"


def test_list_and_search_people(client: TestClient, auth_headers: dict[str, str]) -> None:
    client.post("/api/persons", json={"first_name": "Ada", "last_name": "Lovelace"}, headers=auth_headers)
    client.post("/api/persons", json={"first_name": "Alan", "last_name": "Turing"}, headers=auth_headers)

    listing = client.get("/api/persons", headers=auth_headers)
    assert listing.status_code == 200
    assert len(listing.json()) == 2

    search = client.get("/api/persons", params={"search": "Ada"}, headers=auth_headers)
    assert search.status_code == 200
    assert len(search.json()) == 1
    assert search.json()[0]["first_name"] == "Ada"


def test_update_person(client: TestClient, auth_headers: dict[str, str]) -> None:
    created = client.post(
        "/api/persons",
        json={"first_name": "Grace", "last_name": "Hopper"},
        headers=auth_headers,
    )
    person_id = created.json()["id"]
    updated = client.put(
        f"/api/persons/{person_id}",
        json={"first_name": "Grace", "last_name": "Murray"},
        headers=auth_headers,
    )
    assert updated.status_code == 200
    assert updated.json()["last_name"] == "Murray"


def test_delete_person(client: TestClient, auth_headers: dict[str, str]) -> None:
    created = client.post(
        "/api/persons",
        json={"first_name": "Linus", "last_name": "Torvalds"},
        headers=auth_headers,
    )
    person_id = created.json()["id"]
    deleted = client.delete(f"/api/persons/{person_id}", headers=auth_headers)
    assert deleted.status_code == 200
    missing = client.get(f"/api/persons/{person_id}", headers=auth_headers)
    assert missing.status_code == 404
