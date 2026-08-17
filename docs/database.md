# Database design

## Status

**Phase 0: no schema.** The backend does not connect to a database and no
migrations exist. This document records the *planned* data model so that
Phase 1 and later phases can be implemented consistently.

Everything below is a **future design** and must not be implemented yet.

## Platform

- PostgreSQL hosted by Supabase.
- Auth handled by Supabase Auth (managed users table) from Phase 1.
- SQL migrations will be stored in `supabase/migrations/`.

## Planned entities

### profiles

Extends the Supabase Auth `auth.users` record with application data.

| column | type | notes |
| --- | --- | --- |
| id | uuid | FK -> `auth.users(id)` |
| full_name | text | |
| phone | text | optional |
| role | enum | `farmer` \| `admin` |
| farm_id | uuid, null | FK -> `farms(id)`, null until assigned |
| created_at | timestamptz | |

### farms

| column | type | notes |
| --- | --- | --- |
| id | uuid | PK |
| name | text | |
| location | text | optional |
| admin_id | uuid | FK -> `profiles(id)` |
| created_at | timestamptz | |

### diagnoses

Stores one AI diagnosis per uploaded leaf photo.

| column | type | notes |
| --- | --- | --- |
| id | uuid | PK |
| profile_id | uuid | FK -> `profiles(id)` |
| farm_id | uuid, null | snapshot of farm at diagnosis time |
| image_url | text | Supabase Storage object URL |
| model_version | text | model used |
| predicted_class | text | mapped 22-class name |
| confidence | numeric | 0..1 |
| created_at | timestamptz | |

### messages

One-to-one or one-to-many messaging between admins and farmers.

| column | type | notes |
| --- | --- | --- |
| id | uuid | PK |
| sender_id | uuid | FK -> `profiles(id)` |
| recipient_id | uuid | FK -> `profiles(id)` |
| body | text | |
| read_at | timestamptz, null | |
| created_at | timestamptz | |

## Conventions

- UUID primary keys.
- Timestamps are `timestamptz`.
- Row Level Security enabled on every table; policies added per role in the
  phase that introduces each feature.
- Storage buckets (e.g. `leaf-photos`) created in the phase that introduces
  uploads.