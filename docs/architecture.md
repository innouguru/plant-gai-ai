# Architecture

## System overview

Plant-GAI-AI is a mobile-first web application split across three hosted
services, developed and tested natively on Windows (no Docker requirement).

```
Farmer's phone / browser
        │
        ▼
┌───────────────────┐        HTTPS         ┌─────────────────────┐
│  frontend/        │  ──────────────────▶ │  backend/           │
│  React + Vite     │      /api/v1/*       │  FastAPI            │
│  (Vercel)         │                      │  (Render)           │
└───────────────────┘                      └──────────┬──────────┘
        │                                             │
        │ images (Phase 2+)                           │ Supabase service keys
        ▼                                             ▼
┌───────────────────┐                      ┌─────────────────────┐
│  Supabase Storage │                      │  Supabase           │
│  (Phase 2+)       │                      │  Auth + PostgreSQL  │
└───────────────────┘                      └─────────────────────┘
                                                      ▲
                                                      │
                                              ┌───────┴────────┐
                                              │  model/weights │
                                              │  ResNet-18.pth │
                                              └────────────────┘
```

## Frontend

- **Stack**: React 18 + Vite.
- **Routing**: single placeholder dashboard in Phase 0; routing is added in a
  later phase.
- **Layout**: mobile-first shell with a sticky header and a content area.
- **API access**: a thin `src/api/` client layer. In development, requests go
  through the Vite proxy (`/api` -> `http://localhost:8000`), so no CORS is
  needed locally. A `VITE_API_BASE_URL` environment variable can override the
  base URL for other environments.
- **State**: local component state in Phase 0.

## Backend

- **Stack**: Python + FastAPI, run with uvicorn.
- **API versioning**: all endpoints live under `/api/v1/` from day one.
- **Structure**:
  - `app/api/v1/routes/` — versioned route modules (currently `health.py`).
  - `app/core/` — configuration (pydantic-settings, env-driven).
  - `app/schemas/` — request/response Pydantic models.
  - `app/services/ml/` — ML inference scaffolding (Phase 2 implementation).
- **CORS**: configured from the `CORS_ORIGINS` env variable for non-proxy
  environments.
- Future domains (auth, users, farms, diagnoses, messaging) will each get their
  own route module under `app/api/v1/routes/`.

## Database

Supabase PostgreSQL. **No schema exists in Phase 0.** The planned domains
(users/profiles, farms, diagnoses, messages) are documented in
`database.md`; migration files will land in `supabase/migrations/`.

## ML inference

A service in `app/services/ml/` will eventually load the final ResNet-18
checkpoint, preprocess a leaf photo, run prediction, and evaluate confidence.
**Phase 0 contains only stubs** — nothing is loaded or predicted. Details in
`ml-inference.md`.

## Environment configuration

- Real configuration lives in local `.env` files (never committed).
- Placeholders are tracked in `.env.example` at the repo root.
- The backend reads env vars (plus `.env`) via pydantic-settings.
- The frontend reads `VITE_`-prefixed env vars via Vite.

## Deployment targets (future)

- Frontend: Vercel Free.
- Backend: Render Free.
- Database/Auth/Storage: Supabase.
- Docker: optional, deploy-only, never required locally.

## Approved top-level layout

```
plant-gai-ai/
├── frontend/
├── backend/
├── model/
├── docs/
├── supabase/
├── docker/
├── AGENTS.md
├── README.md
└── .env.example
```