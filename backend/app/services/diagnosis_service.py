"""Diagnosis orchestration: real inference + deterministic crop derivation."""

from app.services.ml.inference_service import InferenceService

# Crop names are derived from the class-name prefix (the dataset structure),
# so no second independent disease list is maintained.
KNOWN_CROPS = ("Cashew", "Cassava", "Maize", "Tomato")


def derive_crop(class_name: str) -> str:
    """Return the crop for a predicted class name.

    "Cassava mosaic" -> "Cassava"; "Maize healthy" -> "Maize".
    Falls back to the leading word for unexpected classes.
    """
    if not class_name:
        return "Unknown"
    for crop in KNOWN_CROPS:
        if class_name.startswith(f"{crop} "):
            return crop
    return class_name.split(" ")[0]


def diagnose_image(service: InferenceService, image_bytes: bytes) -> dict:
    """Run real inference and build the API result dict."""
    tensor = service.preprocess(image_bytes)
    prediction = service.predict(tensor)

    return {
        "disease": prediction["class_name"],
        "confidence": prediction["confidence"],
        "crop": derive_crop(prediction["class_name"]),
        "model_version": service.model_version,
    }