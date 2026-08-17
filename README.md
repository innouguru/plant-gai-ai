# Plant-GAI-AI

Mobile-first web application that helps farmers diagnose plant diseases from
leaf photos using an already-trained PyTorch ResNet-18 model.

**Current status: Phase 0 — Project Foundation.** See
[`docs/development-phases.md`](docs/development-phases.md) for the roadmap.

## Repository structure

```
plant-gai-ai/
├── frontend/   React + Vite (Vercel)
├── backend/    FastAPI (Render)
├── model/      model weights + metadata (weights never committed)
├── docs/       product, architecture, database, api, ml-inference, phases
├── supabase/   Supabase config/scaffolding
├── docker/     optional deploy-only Docker files (NOT required locally)
├── AGENTS.md
├── README.md
└── .env.example
```

## Prerequisites

- Node.js 20+ and npm
- Python 3.10+ with a virtual environment
- No Docker required for local development

## Environment configuration

Copy `.env.example` (at repo root) to your local `.env` files and fill in real
values. The backend reads the root `.env` when running from its directory, and
the frontend needs the `VITE_`-prefixed variables. Never commit real `.env`
files.

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

## Frontend (React + Vite)

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The placeholder dashboard fetches the backend
health endpoint to confirm connectivity.

> Tip: run the backend first so the frontend dashboard can reach
> `GET /api/v1/health` through the Vite proxy (`/api` -> `http://localhost:8000`).

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
- [`docs/database.md`](docs/database.md) — database design (future)
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