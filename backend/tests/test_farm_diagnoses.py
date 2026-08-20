"""Tests for the farm-admin diagnosis feed."""

from datetime import datetime, timedelta, timezone


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_farm_diagnoses_requires_authentication(client, provider):
    farm = provider.seed_farm(name="Farm A", admin_id=provider.new_id("a-"))

    response = client.get(f"/api/v1/farms/{farm.id}/diagnoses")

    assert response.status_code == 401


def test_farmer_cannot_list_farm_diagnoses(client, provider, make_token):
    farm = provider.seed_farm(name="Farm A", admin_id=provider.new_id("a-"))
    farmer = provider.seed_farmer(email="farmer@example.com", farm_id=farm.id)

    response = client.get(
        f"/api/v1/farms/{farm.id}/diagnoses",
        headers=_auth(make_token(farmer.id, farmer.email)),
    )

    assert response.status_code == 403


def test_admin_cannot_list_another_farm_diagnoses(client, provider, make_token):
    own = provider.seed_farm(name="Own Farm", admin_id=provider.new_id("o-"))
    other = provider.seed_farm(name="Other Farm", admin_id=provider.new_id("x-"))
    admin = provider.seed_admin(farm_id=own.id)
    farmer = provider.seed_farmer(email="other@example.com", farm_id=other.id)
    diagnosis = provider.seed_diagnosis(farmer_id=farmer.id, farm_id=other.id)

    response = client.get(
        f"/api/v1/farms/{other.id}/diagnoses",
        headers=_auth(make_token(admin.id, admin.email)),
    )

    assert response.status_code == 403
    assert diagnosis.id not in response.text


def test_empty_farm_diagnoses_returns_empty_list(client, provider, make_token):
    farm = provider.seed_farm(name="Farm A", admin_id=provider.new_id("a-"))
    admin = provider.seed_admin(farm_id=farm.id)

    response = client.get(
        f"/api/v1/farms/{farm.id}/diagnoses",
        headers=_auth(make_token(admin.id, admin.email)),
    )

    assert response.status_code == 200
    assert response.json() == []


def test_admin_gets_farm_scoped_rows_with_farmer_names(client, provider, make_token):
    farm = provider.seed_farm(name="Farm A", admin_id=provider.new_id("a-"))
    other_farm = provider.seed_farm(name="Other Farm", admin_id=provider.new_id("x-"))
    admin = provider.seed_admin(farm_id=farm.id)
    farmer = provider.seed_user(
        email="ada@example.com", full_name="Ada Farmer", role="farmer", farm_id=farm.id
    )
    other_farmer = provider.seed_farmer(email="other@example.com", farm_id=other_farm.id)
    timestamp = datetime(2026, 2, 1, tzinfo=timezone.utc)
    expected = provider.seed_diagnosis(
        farmer_id=farmer.id,
        farm_id=farm.id,
        disease="Cassava mosaic",
        confidence=0.88,
        crop="Cassava",
        created_at=timestamp,
    )
    provider.seed_diagnosis(
        farmer_id=other_farmer.id,
        farm_id=other_farm.id,
        disease="Maize healthy",
        created_at=timestamp + timedelta(hours=1),
    )

    response = client.get(
        f"/api/v1/farms/{farm.id}/diagnoses",
        headers=_auth(make_token(admin.id, admin.email)),
    )

    assert response.status_code == 200
    rows = response.json()
    assert len(rows) == 1
    assert rows[0] == {
        "id": expected.id,
        "farmer_id": farmer.id,
        "farmer_name": "Ada Farmer",
        "disease": "Cassava mosaic",
        "confidence": 0.88,
        "crop": "Cassava",
        "model_version": "1.0.0",
        "created_at": timestamp.isoformat().replace("+00:00", "Z"),
    }


def test_farm_diagnoses_supports_limit_offset_and_newest_first(
    client, provider, make_token
):
    farm = provider.seed_farm(name="Farm A", admin_id=provider.new_id("a-"))
    admin = provider.seed_admin(farm_id=farm.id)
    farmer = provider.seed_farmer(email="farmer@example.com", farm_id=farm.id)
    base = datetime(2026, 2, 1, tzinfo=timezone.utc)
    rows = [
        provider.seed_diagnosis(
            farmer_id=farmer.id,
            farm_id=farm.id,
            disease=f"Disease {index}",
            created_at=base + timedelta(hours=index),
        )
        for index in range(5)
    ]

    response = client.get(
        f"/api/v1/farms/{farm.id}/diagnoses?limit=2&offset=1",
        headers=_auth(make_token(admin.id, admin.email)),
    )

    assert response.status_code == 200
    assert [row["id"] for row in response.json()] == [rows[3].id, rows[2].id]


def test_farm_diagnoses_rejects_invalid_pagination(client, provider, make_token):
    farm = provider.seed_farm(name="Farm A", admin_id=provider.new_id("a-"))
    admin = provider.seed_admin(farm_id=farm.id)
    token = make_token(admin.id, admin.email)

    assert client.get(
        f"/api/v1/farms/{farm.id}/diagnoses?limit=0", headers=_auth(token)
    ).status_code == 422
    assert client.get(
        f"/api/v1/farms/{farm.id}/diagnoses?limit=101", headers=_auth(token)
    ).status_code == 422
    assert client.get(
        f"/api/v1/farms/{farm.id}/diagnoses?offset=-1", headers=_auth(token)
    ).status_code == 422
