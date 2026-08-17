"""Placeholder inference service.

Phase 0 scaffolding only. None of the methods below are implemented yet;
they are stubs that document the responsibilities of the Phase 2 inference
service. Calling them raises ``NotImplementedError``.
"""

from pathlib import Path


class InferenceService:
    """Will eventually handle model loading, preprocessing and prediction.

    Planned responsibilities (Phase 2):

    - load the ResNet-18 checkpoint from ``model/weights/``
    - preprocess a leaf photo (resize, normalization, tensor conversion)
    - run prediction and return the top classes with confidence scores
    - surface the model version used for a prediction
    """

    def __init__(self, weights_path: Path, model_version: str, device: str = "cpu") -> None:
        self.weights_path = Path(weights_path)
        self.model_version = model_version
        self.device = device
        self._model = None

    def load_model(self) -> None:
        """Load the trained model into memory. Implemented in Phase 2."""
        raise NotImplementedError("Model loading is implemented in Phase 2.")

    def preprocess(self, image: bytes) -> object:
        """Transform raw image bytes into a model-ready tensor."""
        raise NotImplementedError("Preprocessing is implemented in Phase 2.")

    def predict(self, tensor: object) -> list[dict[str, object]]:
        """Run inference and return predictions with confidence scores."""
        raise NotImplementedError("Prediction is implemented in Phase 2.")