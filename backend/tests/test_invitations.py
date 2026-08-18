"""Tests for farmer invitations (POST /api/v1/invitations, accept)."""

from app.schemas.domain import InvitationStatus, Role


def test_invite_requires_authentication(client, provider):
    response = client.post(
        "/api/v1/invitations", json={"email": "farmer@example.com", "full_name": "New Farmer"}
    )

    assert response.status_code == 401


def test_admin_can_invite_farmer_to_own_farm(client, provider, make_token):
    farm = provider.seed_farm(name="Farm A", admin_id=provider.new_id("a-"))
    admin = provider.seed_admin(farm_id=farm.id)
    token = make_token(admin.id, email=admin.email)

    response = client.post(
        "/api/v1/invitations",
        json={"email": "farmer@example.com", "full_name": "Jane Farmer"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["farm_id"] == farm.id
    assert body["email"] == "farmer@example.com"
    assert body["status"] == InvitationStatus.pending.value
    assert body["id"]

    assert len(provider.invite_calls) == 1
    sent = provider.invite_calls[0]
    assert sent["email"] == "farmer@example.com"
    assert "complete-registration" in sent["redirect_to"]
    assert sent["metadata"]["farm_id"] == farm.id


def test_farmer_cannot_create_invitation(client, provider, make_token):
    farm = provider.seed_farm(name="Farm A", admin_id=provider.new_id("a-"))
    provider.seed_admin(farm_id=farm.id)
    farmer = provider.seed_farmer(email="farmer@example.com", farm_id=farm.id)
    token = make_token(farmer.id, email="farmer@example.com")

    response = client.post(
        "/api/v1/invitations",
        json={"email": "other@example.com"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403


def test_user_without_farm_cannot_invite(client, provider, make_token):
    user = provider.seed_user(email="nobody@example.com", full_name="Nobody", role=Role.farmer)
    token = make_token(user.id, email="nobody@example.com")

    response = client.post(
        "/api/v1/invitations",
        json={"email": "other@example.com"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403


def test_failed_invite_is_cleaned_up(client, provider, make_token):
    farm = provider.seed_farm(name="Farm A", admin_id=provider.new_id("a-"))
    admin = provider.seed_admin(farm_id=farm.id)
    provider.fail_invite_emails.add("taken@example.com")
    token = make_token(admin.id, email=admin.email)

    response = client.post(
        "/api/v1/invitations",
        json={"email": "taken@example.com"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 400
    assert "could not send" in response.json()["detail"].lower()
    assert provider.invitations == {}


# ---------------------------------------------------------------------------
# Invitation acceptance
# ---------------------------------------------------------------------------


def test_accept_requires_authentication(client, provider):
    response = client.post("/api/v1/invitations/accept", json={"full_name": "New Farmer"})

    assert response.status_code == 401


def test_invited_farmer_is_bound_to_inviting_farm(client, provider, make_token):
    farm = provider.seed_farm(name="Yam Farm", admin_id=provider.new_id("a-"))
    provider.seed_admin(farm_id=farm.id)
    provider.seed_invitation(farm_id=farm.id, email="jane@example.com", invited_name="Jane")
    farmer = provider.seed_farmer(email="jane@example.com")
    token = make_token(farmer.id, email="jane@example.com")

    response = client.post(
        "/api/v1/invitations/accept",
        json={"full_name": "Jane Farmer"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    body = response.json()
    profile_body = body["profile"]
    assert profile_body["role"] == Role.farmer.value
    assert profile_body["farm_id"] == farm.id
    assert profile_body["farm"]["id"] == farm.id
    assert profile_body["full_name"] == "Jane Farmer"

    updated = provider.profiles[farmer.id]
    assert updated.farm_id == farm.id
    assert updated.role == Role.farmer

    invitation = list(provider.invitations.values())[0]
    assert invitation.status == InvitationStatus.accepted


def test_invited_farmer_cannot_choose_different_farm(client, provider, make_token):
    target_farm = provider.seed_farm(name="Target Farm", admin_id=provider.new_id("t-"))
    other_farm = provider.seed_farm(name="Other Farm", admin_id=provider.new_id("o-"))
    provider.seed_admin(farm_id=target_farm.id)
    provider.seed_invitation(farm_id=target_farm.id, email="jane@example.com", invited_name="Jane")
    farmer = provider.seed_farmer(email="jane@example.com")
    token = make_token(farmer.id, email="jane@example.com")

    response = client.post(
        "/api/v1/invitations/accept",
        json={"full_name": "Jane Farmer"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json()["profile"]["farm_id"] == target_farm.id
    assert response.json()["profile"]["farm_id"] != other_farm.id


def test_accept_without_pending_invitation_rejected(client, provider, make_token):
    farmer = provider.seed_farmer(email="stranger@example.com")
    token = make_token(farmer.id, email="stranger@example.com")

    response = client.post(
        "/api/v1/invitations/accept",
        json={"full_name": "Stranger"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 400
    assert "no invitation" in response.json()["detail"].lower()


def test_accept_for_already_assigned_account_rejected(client, provider, make_token):
    farm = provider.seed_farm(name="Farm A", admin_id=provider.new_id("a-"))
    provider.seed_admin(farm_id=farm.id)
    farmer = provider.seed_farmer(email="farmer@example.com", farm_id=farm.id)
    token = make_token(farmer.id, email="farmer@example.com")

    response = client.post(
        "/api/v1/invitations/accept",
        json={"full_name": "Already Assigned"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 409