# Development phases

Plant-GAI-AI is developed in **controlled phases**. Each phase must be
completed, tested, and approved before the next begins. Agents must implement
only the phase requested and must not start a later phase early.

## Phase 0 — Project foundation (done)

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

## Phase 1 — Accounts and farms (CURRENT)

| Status | Deliverable |
| --- | --- |
| Done | Supabase Auth integration: sign up, sign in, password reset, invited registration |
| Done | `profiles`, `farms`, `invitations` tables + migration `0001_auth_foundation.sql` |
| Done | Row Level Security and SECURITY DEFINER transitions (onboarding, full-name update, invitation claim) |
| Done | Backend JWT verification (`/auth/me`) and farm-admin enforcement |
| Done | Endpoints: `POST /onboarding`, `POST /invitations`, `POST /invitations/accept`, `GET /farms/{farm_id}/members` |
| Done | Frontend login/registration/reset screens, session handling, role-based routing and shells |
| Done | `FRONTEND_ORIGIN` / Supabase environment wiring + docs update |

Acceptance: authenticated flows work end to end with a configured Supabase
project; backend and frontend test suites pass. Diagnosis, camera, storage,
history, statistics, and messaging are intentionally **not** implemented.

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