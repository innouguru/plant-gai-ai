# Docker (optional, deploy-only)

Docker files in this folder are **optional deploy-only assets**. They are NOT
required for local development or for running the Phase 0 test suites.

This developer machine has no hardware virtualization and no BIOS access, so
everything must run natively (Node, npm, Python venv, FastAPI, PyTorch).

Planned additions (later phases, when deployment is prepared):

- `backend.dockerfile` — FastAPI image for Render
- `frontend.dockerfile` — Node build stage for Vercel
- `docker-compose.yml` — optional local orchestration

Until then, this folder intentionally stays minimal.