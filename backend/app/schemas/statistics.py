"""Request/response schemas for farm statistics."""

from datetime import datetime

from pydantic import BaseModel, Field


class DiseaseCount(BaseModel):
    """One disease and how often it was predicted on a farm."""

    disease: str
    count: int


class CropCount(BaseModel):
    """One crop and how often it was scanned on a farm."""

    crop: str
    count: int


class RecentDiagnosis(BaseModel):
    """A recent diagnosis summary included in farm statistics."""

    id: str
    farmer_id: str
    farmer_name: str | None = None
    disease: str
    crop: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    created_at: datetime


class FarmStatistics(BaseModel):
    """Aggregate statistics for a farm (farm admin only)."""

    farm_id: str
    # Everyone linked to the farm via profiles.farm_id (mirrors the members
    # endpoint, which also includes the farm admin).
    farmer_count: int = Field(..., ge=0)
    total_diagnoses: int = Field(..., ge=0)
    healthy_diagnoses: int = Field(..., ge=0)
    diseased_diagnoses: int = Field(..., ge=0)
    # Full occurrence counts keyed by disease/crop name.
    disease_counts: dict[str, int]
    crop_counts: dict[str, int]
    # Order-ranked subsets for the dashboard.
    top_diseases: list[DiseaseCount]
    top_crops: list[CropCount]
    recent_diagnoses: list[RecentDiagnosis]