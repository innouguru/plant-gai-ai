"""ML inference scaffolding.

Real ResNet-18 loading, image preprocessing, prediction, and confidence
evaluation live in ``app.services.ml.inference_service`` (implemented in
Phase 2). Preprocessing follows the authoritative Colab pipeline.

The checkpoint must NOT be loaded at import time; the model service is
loaded lazily on first request.
"""