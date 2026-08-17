# API contract

## Conventions

- **Base prefix**: `/api/v1/` for all endpoints.
- **Format**: JSON.
- **Auth**: none in Phase 0. Supabase JWT bearer tokens arrive in a later phase.
- **Backend docs**: FastAPI serves interactive docs at `/docs` when running
  locally.

## Current endpoints (Phase 0)

### GET /api/v1/health

Confirms the API is running.

Response `200`:

```json
{
  "status": "ok",
  "message": "Plant-GAI-AI API is running"
}
```

### GET /

Top-level pointer. Response `200`:

```json
{
  "message": "Plant-GAI-AI API",
  "docs": "/docs",
  "health": "/api/v1/health"
}
```

## Planned endpoints (future phases)

These are **not implemented**. Listed for planning only.

### Auth (Phase 1)

- `POST /api/v1/auth/register` — farmer/administrator registration
- `POST /api/v1/auth/login` — obtain a session

These will sit on top of Supabase Auth rather than issuing own tokens.

### Profiles / farms (Phase 1)

- `GET /api/v1/users/me`
- `PATCH /api/v1/users/me`
- `GET /api/v1/farms/{farm_id}` (admin)

### Diagnoses (Phase 2+)

- `POST /api/v1/diagnoses` — upload a photo and get a prediction
- `GET /api/v1/diagnoses` — own history
- `GET /api/v1/diagnoses/{id}`

### Farm analytics (Phase 3+)

- `GET /api/v1/farms/{farm_id}/statistics` (admin)

### Messaging (Phase 3+)

- `GET /api/v1/messages`, `POST /api/v1/messages`
- `PATCH /api/v1/messages/{id}/read`

## Error format (future)

Once implemented, error responses will use a consistent shape:

```json
{
  "detail": "human-readable explanation"
}
```