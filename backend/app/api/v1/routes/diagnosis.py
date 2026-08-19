"""Farmer diagnosis endpoint backed by the real ResNet-18 model."""

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.api.deps import UserContext, get_diagnosis_service, require_farmer
from app.schemas.diagnosis import DiagnosisResult
from app.services.diagnosis_service import diagnose_image
from app.services.ml.inference_service import (
    ImageDecodeError,
    InferenceError,
    InferenceService,
    ModelLoadError,
)

router = APIRouter(prefix="/diagnosis", tags=["diagnosis"])

MAX_IMAGE_BYTES = 10 * 1024 * 1024
SUPPORTED_IMAGE_MEDIA_TYPES = {"image/jpeg", "image/png", "image/webp", "image/bmp"}


@router.post("", response_model=DiagnosisResult)
async def run_diagnosis(
    image: UploadFile = File(..., description="Leaf photo to analyze"),
    ctx: UserContext = Depends(require_farmer),
    service: InferenceService = Depends(get_diagnosis_service),
) -> DiagnosisResult:
    """Analyze one farm leaf photo and return the predicted disease.

    The farmer must be authenticated and a member of a farm. The model and all
    derived values (disease, confidence, crop) are computed server-side.
    """
    del ctx  # authorization already enforced by require_farmer

    if image.content_type not in SUPPORTED_IMAGE_MEDIA_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported image format. Please upload a JPEG, PNG, WebP or BMP photo.",
        )

    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide a photo of the leaf to analyze.",
        )
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="The photo is too large. Please upload one that is 10 MB or smaller.",
        )

    try:
        result = diagnose_image(service, image_bytes)
    except (ModelLoadError, InferenceError) as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="We could not analyze the photo right now. Please try again.",
        ) from exc
    except ImageDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The photo could not be read. Please try a different photo.",
        ) from exc

    return DiagnosisResult(**result)