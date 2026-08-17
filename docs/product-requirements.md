# Product Requirements

## Product overview

**Plant-GAI-AI** is a mobile-first web application that lets farmers diagnose
plant diseases from leaf photos using an already-trained PyTorch ResNet-18
model. It is designed for use on phones in low-bandwidth settings.

## Users and roles

### Farmer

- Register and log in.
- Belong to a farm.
- Take or upload a leaf photo.
- Receive an AI-assisted disease diagnosis.
- View their diagnosis history.
- View farm-level diagnostic health information.
- Communicate with their farm administrator.

### Farm administrator

- View the farmers belonging to their farm.
- View farm diagnostics and farm-level statistics.
- Send messages to farmers.
- Receive messages from farmers.

## Model

The application uses the final, already-trained model
`plant_disease_resnet18_best.pth`:

| Property | Value |
| --- | --- |
| Architecture | ResNet-18 |
| Input size | 224 x 224 |
| Classes | 22 plant disease classes |
| Test accuracy | 88.04% |
| Status | FINAL — never retrain |

## Non-goals (Phase 0)

Phase 0 delivers project foundation only. It explicitly does **not** include:

- Login / registration
- Diagnosis or camera functionality
- Diagnosis history
- Farm-level statistics
- Messaging
- Admin dashboards
- Production database schema
- Model loading or real inference

These are covered in later phases (see `development-phases.md`).

## Current phase (Phase 0) scope

- React + Vite frontend shell with a placeholder dashboard.
- FastAPI backend with a versioned health endpoint (`GET /api/v1/health`).
- Environment configuration and secret-safe Git setup.
- Testing infrastructure (pytest + Vitest).
- Supabase and ML inference scaffolding only.
- Documentation and agent guidance (AGENTS.md).