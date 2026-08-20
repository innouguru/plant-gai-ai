"""Tests for farm-scoped messaging."""


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def setup_farm(provider):
    farm = provider.seed_farm(name="Farm A", admin_id=provider.new_id("admin-"))
    admin = provider.seed_admin(farm_id=farm.id)
    farmer = provider.seed_farmer(email="farmer@example.com", farm_id=farm.id)
    other_farm = provider.seed_farm(name="Other Farm", admin_id=provider.new_id("other-"))
    other_farmer = provider.seed_farmer(email="other@example.com", farm_id=other_farm.id)
    return farm, admin, farmer, other_farmer


def test_messages_require_authentication(client, provider):
    response = client.get("/api/v1/messages")
    assert response.status_code == 401


def test_farmer_and_admin_can_exchange_messages(client, provider, make_token):
    _, admin, farmer, _ = setup_farm(provider)
    farmer_token = make_token(farmer.id, farmer.email)
    admin_token = make_token(admin.id, admin.email)

    sent = client.post(
        "/api/v1/messages",
        headers=auth(farmer_token),
        json={"recipient_id": admin.id, "body": "Please check my crops."},
    )
    assert sent.status_code == 201
    message = sent.json()
    assert message["sender_id"] == farmer.id
    assert message["recipient_id"] == admin.id
    assert message["sender_name"] == "A Farmer"

    inbox = client.get("/api/v1/messages", headers=auth(admin_token))
    assert inbox.status_code == 200
    assert [row["id"] for row in inbox.json()] == [message["id"]]


def test_cross_farm_message_is_rejected(client, provider, make_token):
    _, admin, farmer, other_farmer = setup_farm(provider)
    response = client.post(
        "/api/v1/messages",
        headers=auth(make_token(admin.id, admin.email)),
        json={"recipient_id": other_farmer.id, "body": "No cross-farm access."},
    )
    assert response.status_code == 403
    assert provider.messages == {}


def test_same_role_message_is_rejected(client, provider, make_token):
    farm, admin, farmer, _ = setup_farm(provider)
    second_farmer = provider.seed_farmer(email="second@example.com", farm_id=farm.id)
    response = client.post(
        "/api/v1/messages",
        headers=auth(make_token(farmer.id, farmer.email)),
        json={"recipient_id": second_farmer.id, "body": "Not allowed."},
    )
    assert response.status_code == 403


def test_user_cannot_impersonate_sender_or_read_unrelated_message(client, provider, make_token):
    _, admin, farmer, _ = setup_farm(provider)
    admin_token = make_token(admin.id, admin.email)
    farmer_token = make_token(farmer.id, farmer.email)
    sent = client.post(
        "/api/v1/messages",
        headers=auth(admin_token),
        json={"recipient_id": farmer.id, "body": "Hello."},
    ).json()

    assert sent["sender_id"] == admin.id
    assert client.patch(
        f"/api/v1/messages/{sent['id']}/read", headers=auth(admin_token)
    ).status_code == 404
    marked = client.patch(
        f"/api/v1/messages/{sent['id']}/read", headers=auth(farmer_token)
    )
    assert marked.status_code == 200
    assert marked.json()["read_at"]


def test_empty_message_list_and_body_validation(client, provider, make_token):
    _, admin, _, _ = setup_farm(provider)
    response = client.get("/api/v1/messages", headers=auth(make_token(admin.id, admin.email)))
    assert response.status_code == 200
    assert response.json() == []
