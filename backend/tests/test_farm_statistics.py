"""Tests for farm-admin statistics."""

from datetime import datetime, timedelta, timezone


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_statistics_requires_authentication(client, provider):
    farm = provider.seed_farm(name="Farm A", admin_id=provider.new_id("a-"))

    response = client.get(f"/api/v1/farms/{farm.id}/statistics")

    assert response.status_code == 401


def test_farmer_cannot_view_statistics(client, provider, make_token):
    farm = provider.seed_farm(name="Farm A", admin_id=provider.new_id("a-"))
    farmer = provider.seed_farmer(email="farmer@example.com", farm_id=farm.id)

    response = client.get(
        f"/api/v1/farms/{farm.id}/statistics",
        headers=_auth(make_token(farmer.id, farmer.email)),
    )

    assert response.status_code == 403


def test_admin_cannot_view_another_farm_statistics(client, provider, make_token):
    other = provider.seed_farm(name="Other Farm", admin_id=provider.new_id("o-"))
    own = provider.seed_farm(name="Own Farm", admin_id=provider.new_id("w-"))
    admin = provider.seed_admin(email="admin@example.com", farm_id=own.id)

    response = client.get(
        f"/api/v1/farms/{other.id}/statistics",
        headers=_auth(make_token(admin.id, admin.email)),
    )

    assert response.status_code == 403


def test_empty_farm_statistics_are_zeroed(client, provider, make_token):
    farm = provider.seed_farm(name="Farm A", admin_id=provider.new_id("a-"))
    admin = provider.seed_admin(farm_id=farm.id)

    response = client.get(
        f"/api/v1/farms/{farm.id}/statistics",
        headers=_auth(make_token(admin.id, admin.email)),
    )

    assert response.status_code == 200
    assert response.json() == {
        "farm_id": farm.id,
        "farmer_count": 1,
        "total_diagnoses": 0,
        "healthy_diagnoses": 0,
        "diseased_diagnoses": 0,
        "disease_counts": {},
        "crop_counts": {},
        "top_diseases": [],
        "top_crops": [],
        "recent_diagnoses": [],
    }


def test_admin_gets_aggregated_isolated_statistics(client, provider, make_token):
    farm = provider.seed_farm(name="Farm A", admin_id=provider.new_id("a-"))
    other_farm = provider.seed_farm(name="Other Farm", admin_id=provider.new_id("o-"))
    admin = provider.seed_admin(farm_id=farm.id)
    farmer_a = provider.seed_farmer(email="a@example.com", farm_id=farm.id)
    farmer_b = provider.seed_farmer(email="b@example.com", farm_id=farm.id)
    other_farmer = provider.seed_farmer(email="other@example.com", farm_id=other_farm.id)
    base = datetime(2026, 1, 10, tzinfo=timezone.utc)

    provider.seed_diagnosis(
        farmer_id=farmer_a.id,
        farm_id=farm.id,
        disease="Tomato healthy",
        crop="Tomato",
        created_at=base,
    )
    newest = provider.seed_diagnosis(
        farmer_id=farmer_b.id,
        farm_id=farm.id,
        disease="Cassava mosaic",
        crop="Cassava",
        confidence=0.77,
        created_at=base + timedelta(hours=3),
    )
    provider.seed_diagnosis(
        farmer_id=farmer_a.id,
        farm_id=farm.id,
        disease="Cassava mosaic",
        crop="Cassava",
        created_at=base + timedelta(hours=2),
    )
    provider.seed_diagnosis(
        farmer_id=other_farmer.id,
        farm_id=other_farm.id,
        disease="Maize healthy",
        crop="Maize",
        created_at=base + timedelta(hours=4),
    )

    response = client.get(
        f"/api/v1/farms/{farm.id}/statistics",
        headers=_auth(make_token(admin.id, admin.email)),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["farmer_count"] == 3
    assert body["total_diagnoses"] == 3
    assert body["healthy_diagnoses"] == 1
    assert body["diseased_diagnoses"] == 2
    assert body["disease_counts"] == {"Tomato healthy": 1, "Cassava mosaic": 2}
    assert body["crop_counts"] == {"Tomato": 1, "Cassava": 2}
    assert body["top_diseases"] == [{"disease": "Cassava mosaic", "count": 2}, {"disease": "Tomato healthy", "count": 1}]
    assert body["top_crops"] == [{"crop": "Cassava", "count": 2}, {"crop": "Tomato", "count": 1}]
    assert [row["id"] for row in body["recent_diagnoses"]] == [newest.id, body["recent_diagnoses"][1]["id"], body["recent_diagnoses"][2]["id"]]
    assert body["recent_diagnoses"][0]["farmer_name"] == "A Farmer"
    assert body["recent_diagnoses"][0]["confidence"] == 0.77
