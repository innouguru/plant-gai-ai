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

## Non-goals

The following are explicitly not part of this application:

- Offline-first local storage of diagnosis data.
- Third-party API integrations beyond Supabase.
- Multi-tenant farm management (each farm is an independent unit).

See `development-phases.md` for the implementation roadmap.

## Implementation status

All planned phases (0–4) are complete. The application includes
authentication, diagnosis, farm management, messaging, observability,
rate limiting, and accessibility features. See
`development-phases.md` for the full phase breakdown.