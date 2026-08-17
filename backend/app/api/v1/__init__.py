"""API version 1 router. All /api/v1 endpoints are registered here."""

from fastapi import APIRouter

from app.api.v1.routes import health

api_router = APIRouter()
api_router.include_router(health.router)