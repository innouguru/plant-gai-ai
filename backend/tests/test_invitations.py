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


def test_invite_uses_current_supabase_invite_endpoint(monkeypatch):
    import httpx

    from app.db.supabase_provider import SupabaseDataProvider

    provider = SupabaseDataProvider(
        url="https://example.supabase.co", anon_key="anon", service_role_key="service"
    )
    captured: dict = {}

    def fake_post(url, headers=None, json=None, params=None):
        captured["url"] = url
        captured["json"] = json
        captured["params"] = params
        captured["headers"] = headers
        request = httpx.Request("POST", url)
        return httpx.Response(200, request=request, content=b'{"id":"user-id"}', headers={"Content-Type": "application/json"})

    monkeypatch.setattr(provider._client, "post", fake_post)

    provider.invite_user_by_email(
        "farmer@example.com",
        {"invited_name": "Jane Farmer", "farm_id": "farm-123"},
        "https://plant-gai-ai.vercel.app/complete-registration",
    )

    assert captured["url"] == "https://example.supabase.co/auth/v1/invite"
    assert captured["json"]["email"] == "farmer@example.com"
    assert captured["json"]["data"]["invited_name"] == "Jane Farmer"
    assert captured["json"]["data"]["farm_id"] == "farm-123"
    assert captured["params"]["redirect_to"] == "https://plant-gai-ai.vercel.app/complete-registration"
    assert "invite" not in captured["json"]
    assert "options" not in captured["json"]
    assert "user_metadata" not in captured["json"]
    # service_role headers used
    assert captured["headers"]["apikey"] == "service"


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


def test_failed_invite_rollback_failure_still_returns_400(client, provider, make_token, monkeypatch, caplog):
    import logging

    from app.db.errors import ProviderError

    farm = provider.seed_farm(name="Farm A", admin_id=provider.new_id("a-"))
    admin = provider.seed_admin(farm_id=farm.id)
    provider.fail_invite_emails.add("rollback-fail@example.com")
    token = make_token(admin.id, email=admin.email)

    def failing_delete(invitation_id: str):
        raise ProviderError("42501", "permission denied for table invitations", supabase_status=403)

    monkeypatch.setattr(provider, "delete_invitation", failing_delete)

    import logging as _logging

    with caplog.at_level(_logging.WARNING, logger="app.observability"):
        response = client.post(
            "/api/v1/invitations",
            json={"email": "rollback-fail@example.com"},
            headers={"Authorization": f"Bearer {token}"},
        )

    # Must still return 400 for original Auth failure, not 502
    assert response.status_code == 400
    assert "could not send" in response.json()["detail"].lower()
    # Rollback was attempted and logged with sanitized fields
    assert any("invitation_rollback_failed" in r.message for r in caplog.records)
    record = next(r for r in caplog.records if "invitation_rollback_failed" in r.message)
    assert "42501" in record.message
    assert "403" in record.message
    assert record.error_code == "42501"
    assert record.supabase_status == 403
    # No secrets in log
    assert "Bearer" not in caplog.text
    assert "rollback-fail@example.com" not in caplog.text
    # Invitation remains as orphan (best-effort rollback failed) but endpoint did not 502
    assert len(provider.invitations) == 1


def test_failed_invite_rollback_does_not_expose_secrets(client, provider, make_token, monkeypatch, caplog):
    import logging

    from app.db.errors import ProviderError

    farm = provider.seed_farm(name="Farm A", admin_id=provider.new_id("a-"))
    admin = provider.seed_admin(farm_id=farm.id)
    provider.fail_invite_emails.add("secret-test@example.com")
    token = make_token(admin.id, email=admin.email)

    def failing_delete(invitation_id: str):
        raise ProviderError("42501", "permission denied", supabase_status=403)

    monkeypatch.setattr(provider, "delete_invitation", failing_delete)

    with caplog.at_level(logging.WARNING, logger="app.observability"):
        response = client.post(
            "/api/v1/invitations",
            json={"email": "secret-test@example.com"},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 400
    # Ensure no token, email, or key material leaked
    assert "secret-test@example.com" not in caplog.text
    assert "Bearer" not in caplog.text
    assert "apikey" not in caplog.text.lower()


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