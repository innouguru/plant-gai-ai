"""API schemas for the diagnosis endpoint."""

from pydantic import BaseModel, Field


class DiagnosisResult(BaseModel):
    """Result of a real model inference on a single leaf photo."""

    disease: str = Field(..., description="Predicted disease class name.")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Softmax confidence in [0, 1].")
    crop: str = Field(..., description="Derived crop for the prediction.")
    model_version: str = Field(..., description="Version of the model that produced the result.")