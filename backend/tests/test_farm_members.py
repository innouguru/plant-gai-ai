"""Tests for farm member access (GET /api/v1/farms/{id}/members)."""

from app.schemas.domain import Role


def test_members_requires_authentication(client, provider):
    farm = provider.seed_farm(name="Farm A", admin_id=provider.new_id("a-"))

    response = client.get(f"/api/v1/farms/{farm.id}/members")

    assert response.status_code == 401


def test_admin_can_list_own_farm_members(client, provider, make_token):
    farm = provider.seed_farm(name="Farm A", admin_id=provider.new_id("a-"))
    admin = provider.seed_admin(farm_id=farm.id)
    provider.seed_farmer(email="f1@example.com", farm_id=farm.id)
    provider.seed_farmer(email="f2@example.com", farm_id=farm.id)
    token = make_token(admin.id, email=admin.email)

    response = client.get(
        f"/api/v1/farms/{farm.id}/members", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    members = response.json()
    assert len(members) == 3
    emails = {member["email"] for member in members}
    assert emails == {"admin@example.com", "f1@example.com", "f2@example.com"}
    assert all(member["role"] in (Role.farmer.value, Role.farm_admin.value) for member in members)


def test_farmer_cannot_list_members(client, provider, make_token):
    farm = provider.seed_farm(name="Farm A", admin_id=provider.new_id("a-"))
    provider.seed_admin(farm_id=farm.id)
    farmer = provider.seed_farmer(email="farmer@example.com", farm_id=farm.id)
    token = make_token(farmer.id, email="farmer@example.com")

    response = client.get(
        f"/api/v1/farms/{farm.id}/members", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 403


def test_admin_cannot_access_another_farm_members(client, provider, make_token):
    other_farm = provider.seed_farm(name="Other Farm", admin_id=provider.new_id("o-"))
    provider.seed_farmer(email="otherf@example.com", farm_id=other_farm.id)

    own_farm = provider.seed_farm(name="Own Farm", admin_id=provider.new_id("w-"))
    admin = provider.seed_admin(email="admin2@example.com", farm_id=own_farm.id)
    token = make_token(admin.id, email=admin.email)

    response = client.get(
        f"/api/v1/farms/{other_farm.id}/members", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 403


def test_unassigned_user_cannot_list_members(client, provider, make_token):
    farm = provider.seed_farm(name="Farm A", admin_id=provider.new_id("a-"))
    user = provider.seed_user(email="nobody@example.com", full_name="Nobody", role=Role.farmer)
    token = make_token(user.id, email="nobody@example.com")

    response = client.get(
        f"/api/v1/farms/{farm.id}/members", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 403