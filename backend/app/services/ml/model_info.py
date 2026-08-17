"""Model metadata and configuration for the ML inference service."""

from pathlib import Path

from app.core.config import get_settings

_REPO_ROOT = Path(__file__).resolve().parents[4]

# Metadata source files (committed to Git; weights are not)
MODEL_METADATA_DIR = _REPO_ROOT / "model" / "metadata"
CLASS_NAMES_FILE = MODEL_METADATA_DIR / "class_names.json"

# Fixed properties of the final trained model (see docs/ml-inference.md)
MODEL_ARCHITECTURE = "resnet18"
MODEL_INPUT_SIZE = 224
MODEL_CLASS_COUNT = 22
MODEL_TEST_ACCURACY = 0.8804

# Frozen, in-scope configuration loaded from environment variables.
_provider_settings = get_settings()
MODEL_VERSION = _provider_settings.model_version
MODEL_DEVICE = _provider_settings.model_device
MODEL_WEIGHTS_PATH = MODEL_METADATA_DIR.parent / "weights" / Path(
    _provider_settings.model_weights_path
).name