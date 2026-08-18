"""Tests for admin onboarding (POST /api/v1/onboarding)."""

from app.schemas.domain import Role


def test_onboarding_requires_authentication(client):
    response = client.post("/api/v1/onboarding", json={"farm_name": "Green Farm"})

    assert response.status_code == 401


def test_admin_creates_farm_and_becomes_admin(client, provider, make_token):
    user = provider.seed_user(email="owner@example.com", full_name="Owner", role=Role.farmer)
    token = make_token(user.id, email="owner@example.com")

    response = client.post(
        "/api/v1/onboarding", json={"farm_name": "Sunrise Farm"}, headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 201
    body = response.json()
    farm = body["farm"]
    assert farm["name"] == "Sunrise Farm"
    assert farm["admin_id"] == user.id

    profile = provider.profiles[user.id]
    assert profile.role == Role.farm_admin
    assert profile.farm_id == farm["id"]

    profile_body = body["profile"]
    assert profile_body["role"] == Role.farm_admin.value
    assert profile_body["farm_id"] == farm["id"]
    assert profile_body["requires_onboarding"] is False


def test_onboarding_cannot_be_done_twice(client, provider, make_token):
    user = provider.seed_user(email="owner@example.com", full_name="Owner", role=Role.farmer)
    token = make_token(user.id, email="owner@example.com")

    first = client.post(
        "/api/v1/onboarding", json={"farm_name": "First Farm"}, headers={"Authorization": f"Bearer {token}"}
    )
    assert first.status_code == 201

    second = client.post(
        "/api/v1/onboarding", json={"farm_name": "Second Farm"}, headers={"Authorization": f"Bearer {token}"}
    )

    assert second.status_code == 409
    assert len(provider.farms) == 1
    assert provider.profiles[user.id].farm_id == first.json()["farm"]["id"]


def test_onboarding_validates_farm_name(client, provider, make_token):
    user = provider.seed_user(email="owner@example.com", full_name="Owner", role=Role.farmer)
    token = make_token(user.id, email="owner@example.com")

    response = client.post("/api/v1/onboarding", json={"farm_name": ""}, headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 422


def test_user_with_pending_invitation_cannot_become_admin(client, provider, make_token):
    """Regression: an invited farmer must claim their invitation, not onboard
    a new farm and become its farm_admin."""
    existing_farm = provider.seed_farm(name="Existing Farm", admin_id="admin-1")
    invited = provider.seed_farmer(email="invited@example.com", farm_id=None)
    provider.seed_invitation(farm_id=existing_farm.id, email=invited.email, invited_name="Invited Farmer")
    token = make_token(invited.id, email=invited.email)

    response = client.post(
        "/api/v1/onboarding",
        json={"farm_name": "Hijacked Farm"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == (
        "You have a pending invitation. Accept it before setting up a new farm."
    )

    # No farm was created and the user was not promoted.
    assert len(provider.farms) == 1
    assert provider.farms[existing_farm.id].name == "Existing Farm"
    profile = provider.profiles[invited.id]
    assert profile.role == Role.farmer
    assert profile.farm_id is None