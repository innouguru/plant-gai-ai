# AGENTS.md

Guidance for AI coding agents working on **Plant-GAI-AI**.

Plant-GAI-AI is a mobile-first web application that helps farmers diagnose plant
diseases from leaf photos using an already-trained PyTorch ResNet-18 model.

This file governs how changes to this repository must be made. Read it before
writing or modifying any code.

---

## 1. Controlled phases

The project is developed in **controlled phases** (see `docs/development-phases.md`).

- Phases 0 through 3 are complete: foundation, accounts and farms, diagnosis,
  and farm features/messaging.
- Phase 4 is planned and covers monitoring, rate limits, error tracking,
  accessibility, and performance hardening.

An agent must implement **only the requested phase**. Do not start a later phase
because it seems obvious or convenient.

## 2. Scope discipline

Implement exactly the work described in the current task. Do not add future
Phase 4 functionality unless it is explicitly requested. Preserve the
completed authentication, diagnosis, farm-feature, and messaging behavior
unless a task explicitly requests a change.

## 3. No unapproved redesign

The architecture in `docs/architecture.md` and the repository layout at the
top of this file are the agreed design. Do not redesign the architecture,
renaming top-level folders, or restructure the API versioning without written
approval.

## 4. Never retrain the ML model

The model `plant_disease_resnet18_best.pth` is final:

- ResNet-18, 224x224 input
- 22 disease classes
- 88.04% test accuracy

Do not retrain, fine-tune, or replace it. Do not regenerate weights.

## 5. Do not change preprocessing without approval

Inference preprocessing is implemented and frozen. Do not modify
normalization, resize, class mapping, or confidence behavior without explicit
approval.

## 6. Never expose secrets

- Never print, log, or return secrets (API keys, JWT secrets, DB passwords).
- Use environment variables only; never hard-code credentials.
- Real secrets live in local `.env` files, which are never committed.

## 7. Never commit `.env` files

`.env`, `.env.local`, and `.env.*.local` are ignored. Keep it that way.
Only `.env.example` (with placeholders, no real values) may be tracked.

## 8. Never commit model weights

Everything under `model/weights/` plus any `*.pth`, `*.pt`, `*.ckpt` are
ignored by Git. Do not `git add -f` them.

## 9. Run tests after changes

After any change, run the relevant test suites and report results:

- Backend: `cd backend && python -m pytest`
- Frontend: `cd frontend && npm test`

Fix regressions before finishing. Docker is NOT required for local
development or testing.

## 10. Report work

Every task report must include:

- **files changed**
- **commands executed**
- **tests executed**
- **test results**
- **unresolved issues**

## 11. Preserve backward compatibility

Keep public interfaces (`/api/v1/*`) and exported frontend components backward
compatible where practical. Avoid unnecessary breaking changes.

## 12. No premature implementation

Future Phase 4 functionality must not be implemented prematurely. Working but
unrequested features are not acceptable. Existing completed features should be
preserved rather than replaced with placeholders.

---

## Repository layout (approved)

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

## Environment quick reference

- Frontend: `cd frontend && npm install && npm run dev`
- Backend: `cd backend && .\.venv\Scripts\pip install -r requirements.txt && uvicorn app.main:app --reload` (or `python -m uvicorn ...`)
- Backend tests: `cd backend && python -m pytest`
- Frontend tests: `cd frontend && npm test`
- API base: `http://localhost:8000/api/v1` — health at `GET /api/v1/health`