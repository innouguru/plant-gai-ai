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

- **Stack**: React 18 + Vite, `@supabase/supabase-js`, `react-router-dom`.
- **Auth**: the frontend talks to Supabase Auth directly (sign-up, sign-in,
  password reset, invited-registration). The backend never issues tokens; it
  verifies Supabase access JWTs.
- **Routing**: `BrowserRouter` with public auth pages (`/login`, `/signup`,
  `/forgot-password`, `/reset-password`, `/complete-registration`,
  `/onboarding`) and role-based guarded routes for farmers (`/home`,
  `/diagnose`, `/history` — the latter two are placeholders) and farm admins
  (`/admin`, `/admin/farmers`, `/admin/diagnostics`, `/admin/messages`).
  Guards live in `src/routing/ProtectedRoutes.jsx`; the session + profile
  context lives in `src/auth/AuthContext.jsx`.
- **Layout**: mobile-first shell (`AppLayout`) with a sticky header whose nav
  changes by role and a log-out control.
- **API access**: `src/api/` client layer (`request()` adds the bearer token,
  normalizes errors, and maps session expiry). In development, requests go
  through the Vite proxy (`/api` -> `http://localhost:8000`). A
  `VITE_API_BASE_URL` variable overrides the base URL for other environments.

## Backend

- **Stack**: Python + FastAPI, run with uvicorn.
- **API versioning**: all endpoints live under `/api/v1/`.
- **Auth**: `app/api/deps.py` verifies the Supabase access token (HS256, signed
  with `SUPABASE_JWT_SECRET`) via PyJWT and loads the caller's `profiles` row.
  The application role comes from the database row, never from the token.
- **Data access**: `app/db/` exposes a `DataProvider` interface with a
  Supabase REST implementation (`httpx` for PostgREST + Auth Admin) and a fake
  used by tests. Privileged role/farm transitions run as SECURITY DEFINER RPCs
  on Supabase.
- **Structure**:
  - `app/api/v1/routes/` — versioned route modules (`health`, `auth`,
    `onboarding`, `farms`, `invitations`).
  - `app/api/errors.py` — global provider-error -> HTTP mapping.
  - `app/core/` — configuration (pydantic-settings) and JWT verification.
  - `app/schemas/` — request/response Pydantic models.
  - `app/services/` — user, farm, and invitation domain logic.
- **CORS**: configured from the `CORS_ORIGINS` env variable for non-proxy
  environments.

## Database

Supabase PostgreSQL with Row Level Security. Phase 1 ships
`supabase/migrations/0001_auth_foundation.sql`: `farms`, `profiles`,
`invitations`, an auto-profile trigger for new auth users, RLS policies, and
SECURITY DEFINER functions (`complete_admin_onboarding`,
`update_profile_full_name`, `claim_pending_invitation`). See `database.md`.

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