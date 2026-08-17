# Supabase scaffolding

Plant-GAI-AI uses Supabase for:

- **Auth** — user registration/login (Phase 1+)
- **PostgreSQL** — application database (Phase 1+)
- **Storage** — uploaded leaf photos (Phase 2+)

Phase 0 does **not** implement any of these. This folder only prepares the
project so a later phase can integrate them.

## Environment variables

Copy the `SUPABASE_*` and `DATABASE_URL` placeholders from the repository root
`.env.example` into your local `.env`. Never commit real values.

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Project URL, e.g. `https://xyz.supabase.co` |
| `SUPABASE_ANON_KEY` | Public anon/API key (safe for the browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side key (backend only, never exposed) |
| `SUPABASE_JWT_SECRET` | JWT secret for verifying Auth tokens |
| `DATABASE_URL` | PostgreSQL connection string |

## Layout

```
supabase/
├── README.md         this file
└── migrations/       SQL migration files land here from Phase 1 onward
```

## Local development

- No Supabase account or local Supabase stack is required for Phase 0.
- The backend health endpoint does not touch the database.
- Docker is NOT required to run Supabase or this project locally.