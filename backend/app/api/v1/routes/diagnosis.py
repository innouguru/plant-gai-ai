"""Farmer diagnosis endpoints: real inference, persistence, and history."""

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status

from app.api.deps import UserContext, get_current_user, get_diagnosis_service, get_provider, require_farmer
from app.core.rate_limit import authenticated_read_rate_limit, diagnosis_rate_limit
from app.db.interface import DataProvider
from app.schemas.diagnosis import DiagnosisDetailItem, DiagnosisHistoryItem, DiagnosisResult
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

DEFAULT_HISTORY_LIMIT = 20
MAX_HISTORY_LIMIT = 100


@router.post("", response_model=DiagnosisResult, dependencies=[Depends(diagnosis_rate_limit())])
async def run_diagnosis(
    image: UploadFile = File(..., description="Leaf photo to analyze"),
    ctx: UserContext = Depends(require_farmer),
    service: InferenceService = Depends(get_diagnosis_service),
    provider: DataProvider = Depends(get_provider),
) -> DiagnosisResult:
    """Analyze one leaf photo, persist the diagnosis, and return the result.

    The farmer must be authenticated and a member of a farm. The diagnosis is
    persisted only after real inference succeeds; ownership (farmer_id/farm_id)
    is derived from the authenticated profile, never from the client.
    """
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

    diagnosis = provider.create_diagnosis(
        token=ctx.token,
        disease=result["disease"],
        confidence=result["confidence"],
        crop=result["crop"],
        model_version=result["model_version"],
    )

    return DiagnosisResult(
        id=diagnosis.id,
        disease=diagnosis.disease,
        confidence=diagnosis.confidence,
        crop=diagnosis.crop,
        model_version=diagnosis.model_version,
        created_at=diagnosis.created_at,
    )


@router.get("/history", response_model=list[DiagnosisHistoryItem], dependencies=[Depends(authenticated_read_rate_limit("diagnosis_reads"))])
def list_history(
    ctx: UserContext = Depends(require_farmer),
    provider: DataProvider = Depends(get_provider),
    limit: int = Query(default=DEFAULT_HISTORY_LIMIT, ge=1, le=MAX_HISTORY_LIMIT),
) -> list[DiagnosisHistoryItem]:
    """Return the authenticated farmer's diagnoses, newest first."""
    rows = provider.list_diagnoses(token=ctx.token, farmer_id=ctx.user_id, limit=limit)
    return [
        DiagnosisHistoryItem(
            id=row.id,
            disease=row.disease,
            confidence=row.confidence,
            crop=row.crop,
            model_version=row.model_version,
            created_at=row.created_at,
        )
        for row in rows
    ]


@router.get("/{diagnosis_id}", response_model=DiagnosisDetailItem, dependencies=[Depends(authenticated_read_rate_limit("diagnosis_reads"))])
def get_history_detail(
    diagnosis_id: str,
    ctx: UserContext = Depends(get_current_user),
    provider: DataProvider = Depends(get_provider),
) -> DiagnosisDetailItem:
    """Return a farmer's own diagnosis or an admin's own-farm diagnosis."""
    if ctx.profile.role.value not in {"farmer", "farm_admin"} or ctx.profile.farm_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view this diagnosis.")
    row = provider.get_authorized_diagnosis(token=ctx.token, diagnosis_id=diagnosis_id)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="That diagnosis could not be found.",
        )
    return DiagnosisDetailItem(
        id=row.id,
        disease=row.disease,
        confidence=row.confidence,
        crop=row.crop,
        model_version=row.model_version,
        created_at=row.created_at,
        farmer_id=row.farmer_id,
        farmer_name=row.farmer_name,
    )