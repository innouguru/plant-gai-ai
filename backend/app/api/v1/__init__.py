"""API version 1 router. All /api/v1 endpoints are registered here."""

from fastapi import APIRouter

from app.api.v1.routes import auth, diagnosis, farms, health, invitations, onboarding

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(onboarding.router)
api_router.include_router(farms.router)
api_router.include_router(invitations.router)
api_router.include_router(diagnosis.router)