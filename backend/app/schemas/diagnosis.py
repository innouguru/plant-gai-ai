"""API schemas for the diagnosis endpoints."""

from datetime import datetime

from pydantic import BaseModel, Field


class DiagnosisResult(BaseModel):
    """A persisted diagnosis returned right after real model inference."""

    id: str = Field(..., description="Persisted diagnosis id.")
    disease: str = Field(..., description="Predicted disease class name.")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Softmax confidence in [0, 1].")
    crop: str = Field(..., description="Derived crop for the prediction.")
    model_version: str = Field(..., description="Version of the model that produced the result.")
    created_at: datetime = Field(..., description="When the diagnosis record was created.")


class DiagnosisHistoryItem(BaseModel):
    """A diagnosis record as returned by the history and detail endpoints."""

    id: str = Field(..., description="Diagnosis id.")
    disease: str = Field(..., description="Predicted disease class name.")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Softmax confidence in [0, 1].")
    crop: str = Field(..., description="Derived crop for the prediction.")
    model_version: str = Field(..., description="Model version used for the prediction.")
    created_at: datetime = Field(..., description="When the diagnosis record was created.")