# Plant-GAI-AI

Mobile-first web application that helps farmers diagnose plant diseases from
leaf photos using an already-trained PyTorch ResNet-18 model.

**Current status: Phase 4 — Administration and polish complete.** All phases
(0–4) are implemented: foundation, accounts and farms, diagnosis, farm
features and messaging, and administration and polish (observability, rate
limits, error tracking, accessibility, and performance hardening). See
[`docs/development-phases.md`](docs/development-phases.md) for the roadmap.

## Repository structure

```
plant-gai-ai/
├── frontend/   React + Vite (Vercel)
├── backend/    FastAPI (Render)
├── model/      model weights + metadata (weights never committed)
├── docs/       product, architecture, database, api, ml-inference, phases
├── supabase/   Supabase config/scaffolding + migrations
├── docker/     optional deploy-only Docker files (NOT required locally)
├── AGENTS.md
├── README.md
└── .env.example
```

## Prerequisites

- Node.js 20+ and npm
- Python 3.10+ with a virtual environment
- A Supabase project (auth + PostgreSQL) for live authentication
- No Docker required for local development

## Environment configuration

Copy `.env.example` (at repo root) to your local `.env` files and fill in real
values. The backend reads the root `.env` (and `backend/.env`) when running
from `backend/`, and the frontend needs the `VITE_`-prefixed variables. Never
commit real `.env` files.

Key variables:

| Variable | Used by |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` | Backend (token verification + service calls) |
| `FRONTEND_ORIGIN` | Backend (invitation links) |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Frontend (direct Supabase Auth calls) |
| `VITE_API_BASE_URL` | Frontend (API base; defaults to `/api/v1` behind the Vite proxy) |

Apply the database migrations before first use, in filename order:

```
supabase/migrations/0001_auth_foundation.sql
supabase/migrations/0002_diagnosis_history.sql
supabase/migrations/0003_farm_statistics.sql
supabase/migrations/0004_farm_diagnoses.sql
supabase/migrations/0005_authorized_diagnosis_detail.sql
supabase/migrations/0006_messaging.sql
```

See [`docs/database.md`](docs/database.md) for the schema and Row Level
Security design.

## Backend (FastAPI)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
.\.venv\Scripts\uvicorn app.main:app --reload
```

- API base: `http://localhost:8000/api/v1`
- Health check: `GET /api/v1/health` -> `200 {"status": "ok"}`
- Interactive docs: `http://localhost:8000/docs`

Authenticated endpoints verify the Supabase access JWT for the project and
derive the user's role and farm from their `profiles` row. This includes
diagnosis, farm statistics, farm diagnosis views, and messaging. Supabase must
be configured for auth-backed endpoints to respond (they return `503` otherwise).

## Frontend (React + Vite)

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The frontend provides auth screens
(login/reset/invited-registration), role-based routing (farmers vs. farm
admins), diagnosis and history, farm dashboards and reports, diagnostics, and
farm-scoped messaging.

> Run the backend first so the frontend can reach `/api/*` through the Vite
> proxy (`/api` -> `http://localhost:8000`).

## Auth flow (Phase 1)

- **Farm admin**: sign up at `/signup` (account + farm name) -> redirected to
  the admin dashboard.
- **Admin invites farmers**: `/admin/farmers` sends an invitation email; the
  farmer completes registration at `/complete-registration` (set password +
  name) and is bound to the admin's farm.
- **Password reset**: `/forgot-password` -> emailed link -> `/reset-password`.

## Tests

```powershell
# Backend
cd backend
python -m pytest

# Frontend
cd frontend
npm test
```

## Documentation

- [`docs/product-requirements.md`](docs/product-requirements.md) — product overview
- [`docs/architecture.md`](docs/architecture.md) — system architecture
- [`docs/database.md`](docs/database.md) — database design and RLS
- [`docs/api.md`](docs/api.md) — API contract
- [`docs/ml-inference.md`](docs/ml-inference.md) — ML model and inference
- [`docs/development-phases.md`](docs/development-phases.md) — phase roadmap

## Model

The trained model is `plant_disease_resnet18_best.pth`
(ResNet-18, 22 classes, 224x224 input, 88.04% test accuracy). It is final and
must not be retrained. Weights are excluded from Git; place the `.pth` file
under `model/weights/`. See [`docs/ml-inference.md`](docs/ml-inference.md).

## Reference

Built for a Microsoft ecosystem:
- **Frontend**: React + Vite, deployed on Vercel Free
- **Backend**: FastAPI, deployed on Render Free
- **Database / Auth / Storage**: Supabase (PostgreSQL)
- **Inference**: PyTorch / ResNet-18 (CPU)