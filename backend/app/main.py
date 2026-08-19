"""FastAPI application entry point for the Plant-GAI-AI backend."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.errors import provider_error_to_response
from app.api.v1 import api_router
from app.core.config import get_settings
from app.core.observability import ObservabilityMiddleware, unexpected_error_to_response
from app.db.errors import ProviderError

settings = get_settings()

app = FastAPI(
    title="Plant-GAI-AI API",
    description="Backend for the Plant-GAI-AI plant disease diagnosis app.",
    version="0.2.0",
)

app.add_exception_handler(ProviderError, provider_error_to_response)
app.add_exception_handler(Exception, unexpected_error_to_response)

app.add_middleware(ObservabilityMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/")
def root() -> dict[str, str]:
    """Top-level pointer endpoint."""
    return {"message": "Plant-GAI-AI API", "docs": "/docs", "health": settings.api_prefix + "/health"}