"""Farm endpoints (member management within the admin's own farm)."""

from fastapi import APIRouter, Depends

from app.api.deps import UserContext, get_provider, require_farm_admin
from app.db.interface import DataProvider
from app.schemas.farms import FarmMember
from app.services.farm_service import list_farm_members

router = APIRouter(
    prefix="/farms",
    tags=["farms"],
    dependencies=[Depends(require_farm_admin)],
)


@router.get("/{farm_id}/members", response_model=list[FarmMember])
def get_farm_members(
    farm_id: str,
    ctx: UserContext = Depends(require_farm_admin),
    provider: DataProvider = Depends(get_provider),
) -> list[FarmMember]:
    """List the members of the caller's own farm (admin only)."""
    return list_farm_members(provider, ctx.token, ctx.profile, farm_id)