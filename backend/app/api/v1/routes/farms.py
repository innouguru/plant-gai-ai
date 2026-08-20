"""Farm endpoints (member management within the admin's own farm)."""

from fastapi import APIRouter, Depends, Query

from app.api.deps import UserContext, get_provider, require_farm_admin
from app.db.interface import DataProvider
from app.schemas.farms import FarmDiagnosis, FarmMember
from app.schemas.statistics import FarmStatistics
from app.services.farm_service import get_farm_statistics, list_farm_diagnoses, list_farm_members

router = APIRouter(
    prefix="/farms",
    tags=["farms"],
    dependencies=[Depends(require_farm_admin)],
)

DEFAULT_DIAGNOSIS_LIMIT = 20
MAX_DIAGNOSIS_LIMIT = 100


@router.get("/{farm_id}/members", response_model=list[FarmMember])
def get_farm_members(
    farm_id: str,
    ctx: UserContext = Depends(require_farm_admin),
    provider: DataProvider = Depends(get_provider),
) -> list[FarmMember]:
    """List the members of the caller's own farm (admin only)."""
    return list_farm_members(provider, ctx.token, ctx.profile, farm_id)


@router.get("/{farm_id}/statistics", response_model=FarmStatistics)
def get_statistics(
    farm_id: str,
    ctx: UserContext = Depends(require_farm_admin),
    provider: DataProvider = Depends(get_provider),
) -> FarmStatistics:
    """Return bounded farm-level diagnostic statistics for the farm admin."""
    return get_farm_statistics(provider, ctx.token, ctx.profile, farm_id)


@router.get("/{farm_id}/diagnoses", response_model=list[FarmDiagnosis])
def get_farm_diagnoses(
    farm_id: str,
    limit: int = Query(default=DEFAULT_DIAGNOSIS_LIMIT, ge=1, le=MAX_DIAGNOSIS_LIMIT),
    offset: int = Query(default=0, ge=0),
    ctx: UserContext = Depends(require_farm_admin),
    provider: DataProvider = Depends(get_provider),
) -> list[FarmDiagnosis]:
    """Return newest diagnoses for the authenticated admin's own farm."""
    return list_farm_diagnoses(
        provider,
        ctx.token,
        ctx.profile,
        farm_id,
        limit=limit,
        offset=offset,
    )