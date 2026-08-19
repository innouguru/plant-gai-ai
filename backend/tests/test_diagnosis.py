"""Tests for the farmer diagnosis endpoint (real ResNet-18 inference)."""

import json
import sys
from io import BytesIO
from pathlib import Path

import pytest
from PIL import Image

from app.api.deps import get_diagnosis_service
from app.services.diagnosis_service import derive_crop

REPO_ROOT = Path(__file__).resolve().parents[2]
URL = "/api/v1/diagnosis"


def _load_class_names() -> list[str]:
    with open(REPO_ROOT / "model" / "metadata" / "class_names.json", encoding="utf-8") as fh:
        return [str(name) for name in json.load(fh)]


CLASS_NAMES = _load_class_names()

WEIGHTS_PATH = REPO_ROOT / "model" / "weights" / "plant_disease_resnet18_best.pth"
SAMPLE_IMAGE = (
    REPO_ROOT / "data" / "processed" / "test" / "Cassava mosaic" / "Cassava mosaic_mosaic1009_.jpg"
)

_HAS_TORCH = True
try:
    import torch  # noqa: F401

    import torchvision  # noqa: F401
except ImportError:  # pragma: no cover - depends on environment
    _HAS_TORCH = False

requires_model = pytest.mark.skipif(
    not (_HAS_TORCH and WEIGHTS_PATH.is_file()),
    reason="model weights and torch are not available",
)
requires_sample_image = pytest.mark.skipif(
    not SAMPLE_IMAGE.is_file(),
    reason="processed dataset images are not available",
)


def _image_bytes(fmt: str = "JPEG", size: tuple[int, int] = (64, 64)) -> bytes:
    buffer = BytesIO()
    Image.new("RGB", size, color=(120, 200, 90)).save(buffer, format=fmt)
    return buffer.getvalue()


class FakeInferenceService:
    """Deterministic stand-in that mirrors InferenceService's decode behavior."""

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


def _upload_image(client, token, *, data=None, content_type="image/jpeg", filename="leaf.jpg"):
    files = {"image": (filename, data if data is not None else _image_bytes(), content_type)}
    headers = _auth(token)
    return client.post(URL, headers=headers, files=files)


# ----------------------------------------------------------------------
# authorization and validation
# ----------------------------------------------------------------------


def test_unauthenticated_rejected(provider, client, diagnosis_service):
    response = client.post(
        URL,
        files={"image": ("leaf.jpg", _image_bytes(), "image/jpeg")},
    )
    assert response.status_code == 401


def test_admin_rejected(provider, client, diagnosis_service, make_token):
    admin = provider.seed_admin(email="admin@test.com", farm_id="farm-1")
    token = make_token(admin.id, email=admin.email)
    response = _upload_image(client, token)
    assert response.status_code == 403


def test_farmer_without_farm_rejected(provider, client, diagnosis_service, make_token):
    farmer = provider.seed_farmer(email="farmer@test.com", farm_id=None)
    token = make_token(farmer.id, email=farmer.email)
    response = _upload_image(client, token)
    assert response.status_code == 403


def test_missing_image_rejected(provider, client, diagnosis_service, make_token):
    farmer = provider.seed_farmer(email="farmer@test.com", farm_id="farm-1")
    token = make_token(farmer.id, email=farmer.email)
    response = client.post(URL, headers=_auth(token))
    assert response.status_code == 422


def test_empty_image_rejected(provider, client, diagnosis_service, make_token):
    farmer = provider.seed_farmer(email="farmer@test.com", farm_id="farm-1")
    token = make_token(farmer.id, email=farmer.email)
    response = _upload_image(client, token, data=b"")
    assert response.status_code == 400


def test_unsupported_media_type_rejected(provider, client, diagnosis_service, make_token):
    farmer = provider.seed_farmer(email="farmer@test.com", farm_id="farm-1")
    token = make_token(farmer.id, email=farmer.email)
    response = _upload_image(client, token, content_type="text/plain")
    assert response.status_code == 415


def test_oversized_image_rejected(provider, client, diagnosis_service, make_token):
    farmer = provider.seed_farmer(email="farmer@test.com", farm_id="farm-1")
    token = make_token(farmer.id, email=farmer.email)
    oversize = b"x" * (10 * 1024 * 1024 + 1)
    response = _upload_image(client, token, data=oversize)
    assert response.status_code == 413


def test_corrupt_image_rejected(provider, client, diagnosis_service, make_token):
    farmer = provider.seed_farmer(email="farmer@test.com", farm_id="farm-1")
    token = make_token(farmer.id, email=farmer.email)
    response = _upload_image(client, token, data=b"not-an-image-at-all")
    assert response.status_code == 422


def test_inference_failure_maps_to_server_error(
    provider, client, make_token, monkeypatch
):
    from app.main import app

    app.dependency_overrides[get_diagnosis_service] = lambda: FailingInferenceService()
    try:
        farmer = provider.seed_farmer(email="farmer@test.com", farm_id="farm-1")
        token = make_token(farmer.id, email=farmer.email)
        response = _upload_image(client, token)
        assert response.status_code == 500
    finally:
        app.dependency_overrides.pop(get_diagnosis_service, None)


# ----------------------------------------------------------------------
# successful inference (fake + endpoint schema)
# ----------------------------------------------------------------------


def test_valid_image_returns_result(provider, client, diagnosis_service, make_token):
    farmer = provider.seed_farmer(email="farmer@test.com", farm_id="farm-1")
    token = make_token(farmer.id, email=farmer.email)
    response = _upload_image(client, token, data=_image_bytes(fmt="PNG"), content_type="image/png")

    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {"id", "disease", "confidence", "crop", "model_version", "created_at"}
    assert body["disease"] == "Cassava mosaic"
    assert body["disease"] in CLASS_NAMES
    assert isinstance(body["confidence"], float)
    assert 0.0 <= body["confidence"] <= 1.0
    assert body["crop"] == "Cassava"
    assert body["model_version"] == "1.0.0"
    assert body["id"]
    assert body["created_at"]

    # The diagnosis was persisted for the authenticated farmer and their farm.
    assert len(provider.diagnoses) == 1
    persisted = next(iter(provider.diagnoses.values()))
    assert persisted.farmer_id == farmer.id
    assert persisted.farm_id == "farm-1"
    assert persisted.disease == "Cassava mosaic"
    assert persisted.confidence == 0.91
    assert persisted.crop == "Cassava"


# ----------------------------------------------------------------------
# crop derivation (pure logic, no torch)
# ----------------------------------------------------------------------


@pytest.mark.parametrize(
    ("class_name", "expected"),
    [
        ("Cassava mosaic", "Cassava"),
        ("Cassava healthy", "Cassava"),
        ("Maize healthy", "Maize"),
        ("Maize grasshoper", "Maize"),
        ("Tomato septoria leaf spot", "Tomato"),
        ("Cashew anthracnose", "Cashew"),
        ("", "Unknown"),
        ("Unexpected class", "Unexpected"),
    ],
)
def test_derive_crop(class_name, expected):
    assert derive_crop(class_name) == expected


# ----------------------------------------------------------------------
# real model tests (skipped when weights/data/torch are unavailable)
# ----------------------------------------------------------------------


@requires_model
def test_inference_transform_matches_authoritative_pipeline():
    from torchvision import transforms

    from app.services.ml.inference_service import INFERENCE_TRANSFORM

    composed = INFERENCE_TRANSFORM.transforms

    assert isinstance(composed[0], transforms.Resize)
    assert composed[0].size == (224, 224)
    assert isinstance(composed[1], transforms.ToTensor)

    normalize = composed[2]
    assert isinstance(normalize, transforms.Normalize)
    assert list(normalize.mean) == [0.485, 0.456, 0.406]
    assert list(normalize.std) == [0.229, 0.224, 0.225]

    for step in composed:
        assert not isinstance(step, transforms.CenterCrop), "CenterCrop is not part of the pipeline"
        if isinstance(step, transforms.Resize):
            assert step.size != (256, 256), "Resize(256)+CenterCrop is not part of the pipeline"


@requires_model
def test_real_model_loads_and_predicts_single_image():
    from app.services.ml.inference_service import InferenceService

    service = InferenceService()
    assert service.class_names == CLASS_NAMES

    with open(SAMPLE_IMAGE, "rb") as fh:
        image_bytes = fh.read()

    tensor = service.preprocess(image_bytes)
    prediction = service.predict(tensor)

    assert prediction["class_name"] in CLASS_NAMES
    assert 0.0 <= prediction["confidence"] <= 1.0
    assert SAMPLE_IMAGE.name.startswith("Cassava mosaic")
    assert prediction["class_name"].startswith("Cassava")


@requires_model
@requires_sample_image
def test_real_inference_through_endpoint(provider, client, make_token):
    from app.main import app
    from app.services.ml.inference_service import InferenceService

    app.dependency_overrides[get_diagnosis_service] = lambda: InferenceService()
    try:
        farmer = provider.seed_farmer(email="farmer@test.com", farm_id="farm-1")
        token = make_token(farmer.id, email=farmer.email)

        with open(SAMPLE_IMAGE, "rb") as fh:
            image_bytes = fh.read()

        response = _upload_image(
            client, token, data=image_bytes, content_type="image/jpeg", filename=SAMPLE_IMAGE.name
        )

        assert response.status_code == 200
        body = response.json()
        assert body["disease"] in CLASS_NAMES
        assert 0.0 <= body["confidence"] <= 1.0
        assert body["crop"]
        assert body["disease"].startswith(body["crop"])
    finally:
        app.dependency_overrides.pop(get_diagnosis_service, None)