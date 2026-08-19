"""Tests for Phase 3: diagnosis persistence and the farmer history API."""

from datetime import datetime, timedelta, timezone
from io import BytesIO

import pytest
from PIL import Image

from app.api.deps import get_diagnosis_service
from app.schemas.domain import Role

URL = "/api/v1/diagnosis"


def _image_bytes(fmt: str = "JPEG", size: tuple[int, int] = (64, 64)) -> bytes:
    buffer = BytesIO()
    Image.new("RGB", size, color=(120, 200, 90)).save(buffer, format=fmt)
    return buffer.getvalue()


class FakeInferenceService:
    """Deterministic inference stand-in used to drive the route."""

    model_version = "1.0.0"

    def preprocess(self, image_bytes: bytes):
        from app.services.ml.inference_service import ImageDecodeError

        try:
            with Image.open(BytesIO(image_bytes)) as img:
                img.convert("RGB")
        except Exception as exc:
            raise ImageDecodeError("uploaded image could not be read") from exc
        return "tensor"

    def predict(self, tensor):
        return {"class_index": 9, "class_name": "Cassava mosaic", "confidence": 0.91}


class FailingInferenceService(FakeInferenceService):
    def predict(self, tensor):
        from app.services.ml.inference_service import InferenceError

        raise InferenceError("inference failed")


@pytest.fixture()
def diagnosis_service():
    """Override the inference dependency with a deterministic fake."""
    fake = FakeInferenceService()
    from app.main import app

    app.dependency_overrides[get_diagnosis_service] = lambda: fake
    yield fake
    app.dependency_overrides.pop(get_diagnosis_service, None)


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _upload(client, token, *, data=None, content_type="image/jpeg", extra_fields=None):
    files = {"image": ("leaf.jpg", data if data is not None else _image_bytes(), content_type)}
    return client.post(URL, headers=_auth(token), files=files, data=extra_fields or {})


def _seed_farmer(provider, make_token, *, email="farmer@test.com", farm_id="farm-1"):
    farmer = provider.seed_farmer(email=email, farm_id=farm_id)
    return farmer, make_token(farmer.id, email=farmer.email)


# ----------------------------------------------------------------------
# persistence: ownership and immutability of client input
# ----------------------------------------------------------------------


def test_successful_diagnosis_is_persisted_for_authenticated_farmer(
    provider, client, diagnosis_service, make_token
):
    farmer, token = _seed_farmer(provider, make_token)

    response = _upload(client, token)

    assert response.status_code == 200
    body = response.json()
    assert body["id"]
    assert body["created_at"]
    assert body["disease"] == "Cassava mosaic"
    assert body["confidence"] == 0.91
    assert body["crop"] == "Cassava"
    assert body["model_version"] == "1.0.0"

    assert len(provider.diagnoses) == 1
    row = next(iter(provider.diagnoses.values()))
    assert row.farmer_id == farmer.id
    assert row.farm_id == farmer.farm_id == "farm-1"


def test_client_cannot_choose_farmer_id_farm_id_or_result_values(
    provider, client, diagnosis_service, make_token
):
    farmer, token = _seed_farmer(provider, make_token)

    response = _upload(
        client,
        token,
        extra_fields={
            "farmer_id": "attacker-farmer-id",
            "farm_id": "attacker-farm-id",
            "disease": "Maize healthy",
            "confidence": "0.999",
            "crop": "Maize",
            "model_version": "0.0.0",
        },
    )

    assert response.status_code == 200
    row = next(iter(provider.diagnoses.values()))
    assert row.farmer_id == farmer.id
    assert row.farm_id == "farm-1"
    assert row.disease == "Cassava mosaic"
    assert row.confidence == 0.91
    assert row.crop == "Cassava"
    assert row.model_version == "1.0.0"


def test_failed_inference_does_not_create_diagnosis(provider, client, make_token):
    from app.main import app

    app.dependency_overrides[get_diagnosis_service] = lambda: FailingInferenceService()
    try:
        _, token = _seed_farmer(provider, make_token)
        response = _upload(client, token)
        assert response.status_code == 500
    finally:
        app.dependency_overrides.pop(get_diagnosis_service, None)
    assert len(provider.diagnoses) == 0


def test_invalid_image_does_not_create_diagnosis(provider, client, diagnosis_service, make_token):
    _, token = _seed_farmer(provider, make_token)
    response = _upload(client, token, data=b"not-an-image-at-all")
    assert response.status_code == 422
    assert len(provider.diagnoses) == 0


def test_unauthenticated_request_rejected_without_diagnosis(provider, client, diagnosis_service):
    response = _upload(client, "")
    assert response.status_code == 401
    assert len(provider.diagnoses) == 0


def test_admin_rejected_without_diagnosis(provider, client, diagnosis_service, make_token):
    admin = provider.seed_admin(email="admin@test.com", farm_id="farm-1")
    token = make_token(admin.id, email=admin.email)
    response = _upload(client, token)
    assert response.status_code == 403
    assert len(provider.diagnoses) == 0


def test_farmer_without_farm_rejected_without_diagnosis(
    provider, client, diagnosis_service, make_token
):
    _, token = _seed_farmer(provider, make_token, farm_id=None)
    response = _upload(client, token)
    assert response.status_code == 403
    assert len(provider.diagnoses) == 0


# ----------------------------------------------------------------------
# history: farmer-scoped listing
# ----------------------------------------------------------------------


def test_farmer_can_retrieve_own_history(provider, client, diagnosis_service, make_token):
    farmer, token = _seed_farmer(provider, make_token)
    provider.seed_diagnosis(farmer_id=farmer.id, farm_id="farm-1", disease="Tomato healthy")
    provider.seed_diagnosis(farmer_id=farmer.id, farm_id="farm-1", disease="Maize leaf blight")

    response = client.get(f"{URL}/history", headers=_auth(token))

    assert response.status_code == 200
    rows = response.json()
    assert len(rows) == 2
    for row in rows:
        assert set(row.keys()) == {
            "id",
            "disease",
            "confidence",
            "crop",
            "model_version",
            "created_at",
        }


def test_history_is_newest_first(provider, client, diagnosis_service, make_token):
    farmer, token = _seed_farmer(provider, make_token)
    base = datetime(2026, 1, 10, tzinfo=timezone.utc)
    provider.seed_diagnosis(
        farmer_id=farmer.id,
        farm_id="farm-1",
        disease="Maize leaf blight",
        created_at=base + timedelta(hours=1),
    )
    provider.seed_diagnosis(
        farmer_id=farmer.id,
        farm_id="farm-1",
        disease="Cassava mosaic",
        created_at=base + timedelta(hours=3),
    )
    provider.seed_diagnosis(
        farmer_id=farmer.id,
        farm_id="farm-1",
        disease="Tomato healthy",
        created_at=base + timedelta(hours=2),
    )

    response = client.get(f"{URL}/history", headers=_auth(token))

    assert response.status_code == 200
    diseases = [row["disease"] for row in response.json()]
    assert diseases == ["Cassava mosaic", "Tomato healthy", "Maize leaf blight"]


def test_history_respects_limit(provider, client, diagnosis_service, make_token):
    farmer, token = _seed_farmer(provider, make_token)
    base = datetime(2026, 1, 10, tzinfo=timezone.utc)
    for index in range(10):
        provider.seed_diagnosis(
            farmer_id=farmer.id,
            farm_id="farm-1",
            disease=f"Maize healthy {index}",
            created_at=base + timedelta(hours=index),
        )

    response = client.get(f"{URL}/history?limit=3", headers=_auth(token))

    assert response.status_code == 200
    diseases = [row["disease"] for row in response.json()]
    assert len(diseases) == 3
    assert diseases == ["Maize healthy 9", "Maize healthy 8", "Maize healthy 7"]


def test_farmer_history_does_not_leak_other_farmers(provider, client, diagnosis_service, make_token):
    farmer_a, token_a = _seed_farmer(provider, make_token, email="a@test.com")
    farmer_b, _ = _seed_farmer(provider, make_token, email="b@test.com")
    provider.seed_diagnosis(farmer_id=farmer_a.id, farm_id="farm-1", disease="Cassava mosaic")
    other = provider.seed_diagnosis(farmer_id=farmer_b.id, farm_id="farm-1", disease="Maize blight")

    history = client.get(f"{URL}/history", headers=_auth(token_a))
    assert [row["disease"] for row in history.json()] == ["Cassava mosaic"]

    detail = client.get(f"{URL}/{other.id}", headers=_auth(token_a))
    assert detail.status_code == 404


def test_history_detail_returns_own_diagnosis(provider, client, diagnosis_service, make_token):
    farmer, token = _seed_farmer(provider, make_token)
    row = provider.seed_diagnosis(
        farmer_id=farmer.id,
        farm_id="farm-1",
        disease="Tomato leaf curl",
        confidence=0.77,
        crop="Tomato",
    )

    response = client.get(f"{URL}/{row.id}", headers=_auth(token))

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == row.id
    assert body["disease"] == "Tomato leaf curl"
    assert body["confidence"] == 0.77
    assert body["crop"] == "Tomato"
    assert body["model_version"] == "1.0.0"
    assert body["created_at"]


def test_history_detail_unknown_id_returns_404(provider, client, diagnosis_service, make_token):
    _, token = _seed_farmer(provider, make_token)
    response = client.get(f"{URL}/does-not-exist", headers=_auth(token))
    assert response.status_code == 404


def test_history_requires_authenticated_farmer(provider, client, diagnosis_service, make_token):
    no_auth = client.get(f"{URL}/history")
    assert no_auth.status_code == 401

    admin = provider.seed_admin(email="admin@test.com", farm_id="farm-1")
    admin_token = make_token(admin.id, email=admin.email)
    admin_response = client.get(f"{URL}/history", headers=_auth(admin_token))
    assert admin_response.status_code == 403
