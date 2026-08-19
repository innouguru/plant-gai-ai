"""Real ResNet-18 inference service (Phase 2).

Preprocessing follows the authoritative Colab validation/test pipeline:

    Resize((224, 224)) -> ToTensor() -> Normalize(ImageNet mean/std)

It deliberately does NOT use the earlier VS Code notebook's
``Resize(256) + CenterCrop(224)`` pipeline. Inference is deterministic and
runs on CPU.

The model is loaded once and reused across requests. Loading must be lazy:
``torch`` is imported in this module but the checkpoint is never loaded at
application import time.
"""

import json
import logging
from io import BytesIO
from pathlib import Path
from threading import Lock

import torch
import torch.nn as nn
from PIL import Image
from torchvision import models, transforms

from app.services.ml.model_info import (
    CLASS_NAMES_FILE,
    MODEL_CLASS_COUNT,
    MODEL_INPUT_SIZE,
    MODEL_VERSION,
    MODEL_WEIGHTS_PATH,
)

logger = logging.getLogger(__name__)

# Authoritative inference preprocessing (from the Colab training pipeline).
INFERENCE_TRANSFORM = transforms.Compose(
    [
        transforms.Resize((MODEL_INPUT_SIZE, MODEL_INPUT_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ]
)


class ModelLoadError(RuntimeError):
    """Raised when the checkpoint or class metadata cannot be loaded."""


class ImageDecodeError(RuntimeError):
    """Raised when the uploaded bytes are not a decodable image."""


class InferenceError(RuntimeError):
    """Raised when the model forward pass fails."""


def _load_class_metadata(class_names_file: Path, checkpoint_names) -> list[str]:
    """Load the authoritative 22 class names and sanity-check the checkpoint."""
    try:
        with open(class_names_file, encoding="utf-8") as fh:
            names = [str(name).strip() for name in json.load(fh)]
    except Exception as exc:
        raise ModelLoadError("Diagnosis class metadata is missing on the server.") from exc

    if len(names) != MODEL_CLASS_COUNT:
        raise ModelLoadError("Diagnosis class metadata does not match the model.")

    if isinstance(checkpoint_names, (list, tuple)):
        checkpoint_names = [str(name) for name in checkpoint_names]
        if checkpoint_names != names:
            raise ModelLoadError("Diagnosis class metadata does not match the model checkpoint.")

    return names


class InferenceService:
    """Loads the ResNet-18 checkpoint once and reuses it for every request."""

    def __init__(
        self,
        *,
        weights_path=None,
        class_names_file=None,
        device: str = "cpu",
        model_version: str = MODEL_VERSION,
    ) -> None:
        self._weights_path = Path(weights_path or MODEL_WEIGHTS_PATH)
        self._class_names_file = Path(class_names_file or CLASS_NAMES_FILE)
        self._device = device
        self._model_version = model_version
        self._model = None
        self._class_names = None
        self._lock = Lock()

    @property
    def model_version(self) -> str:
        return self._model_version

    @property
    def class_names(self) -> list[str]:
        self._ensure_loaded()
        return list(self._class_names)

    def _ensure_loaded(self) -> None:
        if self._model is not None:
            return
        with self._lock:
            if self._model is None:
                self._model, self._class_names = self._load()

    def _load(self) -> tuple[nn.Module, list[str]]:
        if not self._weights_path.is_file():
            raise ModelLoadError("The diagnosis model is not available on the server.")

        try:
            checkpoint = torch.load(self._weights_path, map_location=self._device, weights_only=True)
            if not isinstance(checkpoint, dict) or "model_state_dict" not in checkpoint:
                raise ModelLoadError("The diagnosis model checkpoint is invalid.")

            state_dict = checkpoint["model_state_dict"]
            class_names = _load_class_metadata(self._class_names_file, checkpoint.get("class_names"))

            model = models.resnet18(weights=None)
            model.fc = nn.Linear(model.fc.in_features, MODEL_CLASS_COUNT)
            model.load_state_dict(state_dict)
            model.eval()
            model.to(self._device)
        except ModelLoadError:
            raise
        except Exception as exc:
            logger.exception("Diagnosis model failed to load")
            raise ModelLoadError("The diagnosis model could not be loaded.") from exc

        return model, class_names

    def preprocess(self, image_bytes: bytes) -> torch.Tensor:
        """Decode raw image bytes into a model-ready batch tensor (224x224 RGB)."""
        try:
            with Image.open(BytesIO(image_bytes)) as image:
                image = image.convert("RGB")
                tensor = INFERENCE_TRANSFORM(image)
        except Exception as exc:
            raise ImageDecodeError("The uploaded image could not be read.") from exc
        return tensor.unsqueeze(0).to(self._device)

    def predict(self, tensor: torch.Tensor) -> dict:
        """Run inference and return the top class, its name and softmax confidence."""
        self._ensure_loaded()
        try:
            with torch.no_grad():
                logits = self._model(tensor)
            probabilities = torch.softmax(logits, dim=1)
            class_index = int(probabilities.argmax(dim=1).item())
            confidence = float(probabilities[0, class_index].item())
        except Exception as exc:
            logger.exception("Diagnosis inference failed")
            raise InferenceError("The model could not analyze the image.") from exc

        return {
            "class_index": class_index,
            "class_name": self._class_names[class_index],
            "confidence": confidence,
        }


_service_instance: InferenceService | None = None


def get_inference_service() -> InferenceService:
    """Return the shared, lazily-loaded inference service (single instance)."""
    global _service_instance
    if _service_instance is None:
        _service_instance = InferenceService()
    return _service_instance