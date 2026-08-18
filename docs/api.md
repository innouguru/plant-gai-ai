# API contract

## Conventions

- **Base prefix**: `/api/v1/` for all endpoints.
- **Format**: JSON; errors use `{"detail": "human-readable message"}`.
- **Auth**: bearer access token issued by Supabase Auth (`Authorization:
  Bearer <JWT>`). The backend verifies the token with the project JWT secret
  and derives the user's role from their `profiles` row.
- **Backend docs**: FastAPI serves interactive docs at `/docs` when running
  locally.

## Unauthenticated endpoint

### GET /api/v1/health

Confirms the API is running. Response `200`:

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

## Authenticated endpoints (Phase 1)

All of the following require `Authorization: Bearer <Supabase access token>`.

### GET /api/v1/auth/me

Returns the current user's profile and farm context.

Response `200`:

```json
{
  "id": "8f4b...",
  "email": "farmer@example.com",
  "full_name": null,
  "role": "farmer",
  "farm_id": "1c2a...",
  "farm": { "id": "1c2a...", "name": "Green Acres", "admin_id": "8f4b...", "created_at": "2026-01-01T00:00:00Z" },
  "requires_onboarding": false
}
```

`requires_onboarding` is `true` until the profile has a `farm_id` (a new admin
onboarding or an invited farmer before claiming).

### POST /api/v1/onboarding

Creates the caller's first farm and promotes them to `farm_admin`. A user can
only do this while they have no farm.

Request (`201` on success):

```json
{ "farm_name": "Green Acres" }
```

Response `201`:

```json
{
  "profile": { "...": "same shape as /auth/me" },
  "farm": { "id": "1c2a...", "name": "Green Acres", "admin_id": "...", "created_at": "..." }
}
```

Errors: `409` if already set up, `400` if the farm could not be created.

### POST /api/v1/invitations (farm admin only)

Records an invitation for the admin's own farm and emails the farmer a
registration link.

Request (`201` on success):

```json
{ "email": "farmer@example.com", "full_name": "Ada Farmer" }
```

Response `201`:

```json
{
  "id": "inv-1",
  "farm_id": "1c2a...",
  "email": "farmer@example.com",
  "invited_name": "Ada Farmer",
  "status": "pending",
  "created_at": "2026-01-01T00:00:00Z"
}
```

Errors: `400` if the invitation cannot be sent (e.g. email already registered).

### POST /api/v1/invitations/accept

Claims the caller's oldest pending invitation: binds their profile to the
invitation's farm with role `farmer` and stores their full name.

Request:

```json
{ "full_name": "Ada Farmer" }
```

Response `200`:

```json
{
  "profile": { "...": "same shape as /auth/me" }
}
```

Errors: `409` if already associated with a farm, `400` if no pending
invitation exists.

### GET /api/v1/farms/{farm_id}/members (farm admin only)

Lists the members of the caller's own farm.

Response `200`:

```json
[
  { "id": "8f4b...", "email": "farmer@example.com", "full_name": "Ada Farmer", "role": "farmer" }
]
```

Errors: `403` if the caller does not administer that farm.

## Auth flows (Supabase-managed)

Sign-up, sign-in, password reset, and invited registration are handled by the
frontend + Supabase Auth directly:

- Admin sign-up: `/signup` (Supabase sign-up, then `POST /onboarding`).
- Invited farmer: emailed link to `/complete-registration` (set password, then
  `POST /invitations/accept`).
- Password reset: `/forgot-password` -> `/reset-password`.

## Planned endpoints (future phases)

These are **not implemented**. Listed for planning only.

### Diagnoses (Phase 2+)

- `POST /api/v1/diagnoses` — upload a photo and get a prediction
- `GET /api/v1/diagnoses` — own history
- `GET /api/v1/diagnoses/{id}`

### Farm analytics (Phase 3+)

- `GET /api/v1/farms/{farm_id}/statistics` (admin)

### Messaging (Phase 3+)

- `GET /api/v1/messages`, `POST /api/v1/messages`
- `PATCH /api/v1/messages/{id}/read`