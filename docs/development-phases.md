# Development phases

Plant-GAI-AI is developed in **controlled phases**. Each phase must be
completed, tested, and approved before the next begins. Agents must implement
only the phase requested and must not start a later phase early.

## Phase 0 — Project foundation (CURRENT)

| Status | Deliverable |
| --- | --- |
| Done | React + Vite frontend shell, mobile-first layout, placeholder dashboard |
| Done | FastAPI backend with versioned API (`/api/v1/`) |
| Done | Health endpoint `GET /api/v1/health` |
| Done | Frontend-backend health connectivity check |
| Done | Environment configuration structure (`.env.example`, `.gitignore`) |
| Done | Testing infrastructure (pytest + Vitest) |
| Done | Documentation (`docs/`) |
| Done | `AGENTS.md` agent guidance |
| Done | Supabase scaffolding (no features) |
| Done | ML inference scaffolding (no model loading) |

Acceptance: see the checklist in the Phase 0 task definition. No auth, no
diagnosis, no database schema, no messaging, no admin dashboard.

## Phase 1 — Accounts and farms (planned)

- Supabase Auth integration (register/login, password reset).
- `profiles` and `farms` tables + migrations.
- Farmer profile and farm membership endpoints.
- Frontend login/registration screens and session handling.
- Default CORS/origin handling for authenticated requests.

## Phase 2 — Diagnosis (planned)

- Verify original training/inference configuration.
- Implement preprocessing and real inference with the final model.
- Photo upload to Supabase Storage.
- `diagnoses` table + create/history endpoints.
- Frontend camera/upload UI and diagnosis result screen.

## Phase 3 — Farm features and messaging (planned)

- Farm-level statistics and diagnostic health views.
- Farmer and farm administrator dashboard views.
- `messages` table + inbox/send endpoints.
- Frontend messaging screens.

## Phase 4 — Administration and polish (planned)

- Admin dashboard (farm/diagnostic overview).
- Monitoring, rate limits, error tracking.
- Accessibility and performance hardening.

## Cross-cutting rules

- Docker is optional, deploy-only; local work runs natively on Windows.
- Model and preprocessing are frozen after training.
- Backward compatibility is preserved where practical.
- Every phase ends with tests passing and a report: files changed, commands
  run, tests run, test results, unresolved issues.