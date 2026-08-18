"""Tests for GET /api/v1/auth/me."""

from app.schemas.domain import Role


def test_me_requires_authentication(client):
    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401


def test_me_rejects_invalid_token(client, make_token):
    token = make_token("some-user-id", email="someone@example.com")
    bad = "not-a-real-token"
    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {bad}"})

    assert response.status_code == 401
    assert bad != token


def test_me_rejects_expired_token(client, provider, make_token):
    token = make_token("expired-user", email="expired@example.com", expires_seconds=-60)

    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
    assert "expired" in response.json()["detail"].lower()


def test_me_returns_profile_and_farm_for_admin(client, provider, make_token):
    admin = provider.seed_admin(farm_id=provider.new_id("farm-"))
    farm = provider.seed_farm(name="Green Farm", admin_id=admin.id)
    admin.farm_id = farm.id
    token = make_token(admin.id, email=admin.email)

    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == admin.id
    assert body["email"] == admin.email
    assert body["role"] == Role.farm_admin.value
    assert body["farm_id"] == farm.id
    assert body["requires_onboarding"] is False
    assert body["farm"]["id"] == farm.id
    assert body["farm"]["name"] == "Green Farm"


def test_me_returns_profile_for_farmer(client, provider, make_token):
    farm = provider.seed_farm(name="Yam Farm", admin_id=provider.new_id("a-"))
    farmer = provider.seed_farmer(email="farmer@example.com", farm_id=farm.id)
    provider.seed_admin(farm_id=farm.id)
    token = make_token(farmer.id, email="farmer@example.com")

    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    body = response.json()
    assert body["role"] == Role.farmer.value
    assert body["requires_onboarding"] is False
    assert body["farm"]["id"] == farm.id


def test_me_marks_unassigned_user_as_needing_onboarding(client, provider, make_token):
    pending = provider.seed_user(email="pending@example.com", full_name="Pending", role=Role.farmer)
    token = make_token(pending.id, email="pending@example.com")

    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    body = response.json()
    assert body["farm_id"] is None
    assert body["farm"] is None
    assert body["requires_onboarding"] is True


def test_me_returns_401_when_profile_missing(client, provider, make_token):
    token = make_token("ghost-user", email="ghost@example.com")

    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401